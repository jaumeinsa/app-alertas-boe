/**
 * Adaptador del BOE (Boletín Oficial del Estado) vía API de datos abiertos.
 *
 * Endpoint oficial (gratuito, JSON):
 *   GET https://www.boe.es/datosabiertos/api/boe/sumario/YYYYMMDD
 *   Header: Accept: application/json
 *
 * El sumario diario está muy anidado (diario → sección → departamento →
 * epígrafe → item). Recorremos todo el árbol y aplanamos cualquier nodo que
 * tenga `identificador` + `titulo` en una publicación normalizada.
 *
 * El Tablón Edictal Único (TEU) son las notificaciones por edicto: viajan
 * dentro del propio sumario del BOE (sección de anuncios / suplemento de
 * notificaciones). Por eso el mismo adaptador cubre BOE y TEU.
 */

import {
  inferActType,
  NormalizedPublication,
  SourceAdapter,
  yyyymmdd,
} from "./types";

const BASE = "https://www.boe.es/datosabiertos/api/boe/sumario";

interface BoeItem {
  identificador?: string;
  titulo?: string;
  url_pdf?: { texto?: string } | string;
  url_html?: string;
  url_xml?: string;
}

/** Recorre recursivamente el árbol del sumario y recoge los items hoja. */
function collectItems(node: unknown, out: BoeItem[]): void {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const child of node) collectItems(child, out);
    return;
  }
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if (typeof obj.identificador === "string" && typeof obj.titulo === "string") {
      out.push(obj as BoeItem);
    }
    for (const key of Object.keys(obj)) {
      // Evitamos volver a entrar en campos escalares ya capturados.
      if (key === "identificador" || key === "titulo") continue;
      collectItems(obj[key], out);
    }
  }
}

function pdfUrl(item: BoeItem): string | undefined {
  if (typeof item.url_pdf === "string") return item.url_pdf;
  if (item.url_pdf && typeof item.url_pdf === "object") return item.url_pdf.texto;
  return undefined;
}

function buildUrl(item: BoeItem): string {
  const html = item.url_html;
  const pdf = pdfUrl(item);
  if (html) return html.startsWith("http") ? html : `https://www.boe.es${html}`;
  if (pdf) return pdf.startsWith("http") ? pdf : `https://www.boe.es${pdf}`;
  return `https://www.boe.es/diario_boe/txt.php?id=${item.identificador}`;
}

const UA =
  process.env.INGEST_USER_AGENT ?? "NotifikadoBot/0.1 (+https://notifikado.com)";

// Texto completo: activado por defecto. Solo se descarga el cuerpo de los
// documentos de anuncios (BOE-B-*), que es donde aparecen los nombres y DNIs
// de personas (notificaciones AEAT/tráfico, edictos judiciales, Tablón Edictal
// Único…). Los BOE-A-* (disposiciones generales, nombramientos) no se enriquecen.
const FULLTEXT_ENABLED = process.env.INGEST_FULLTEXT !== "0";
const FULLTEXT_CONCURRENCY = Math.max(
  1,
  parseInt(process.env.INGEST_FULLTEXT_CONCURRENCY ?? "5", 10) || 5
);
// Tope de caracteres del cuerpo guardado (acota el almacenamiento; los nombres
// suelen estar bien dentro de este margen).
const MAX_BODY_CHARS = 60_000;

async function fetchSumario(date: Date): Promise<unknown | null> {
  const url = `${BASE}/${yyyymmdd(date)}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": UA,
    },
    // Cachea el sumario del día: una vez publicado no cambia.
    next: { revalidate: 60 * 60 },
  });

  // 404 = no hay boletín ese día (festivos, domingos). No es un error.
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`BOE sumario ${yyyymmdd(date)} respondió ${res.status}`);
  }
  return res.json();
}

/** Descarga el texto plano del cuerpo de un documento del BOE vía xml.php. */
async function fetchDocText(externalId: string): Promise<string | null> {
  const url = `https://www.boe.es/diario_boe/xml.php?id=${externalId}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/xml", "User-Agent": UA },
      next: { revalidate: 60 * 60 * 24 },
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const buf = await res.arrayBuffer();
  const xml = new TextDecoder("utf-8").decode(buf);
  const m = xml.match(/<texto>([\s\S]*?)<\/texto>/i);
  const body = m ? m[1] : "";
  if (!body) return null;

  const plain = body
    .replace(/<[^>]+>/g, " ") // quita etiquetas HTML/XML
    .replace(/&[a-z]+;/gi, " ") // entidades
    .replace(/\s+/g, " ")
    .trim();

  return plain ? plain.slice(0, MAX_BODY_CHARS) : null;
}

/** Ejecuta `fn` sobre `items` con un máximo de `concurrency` en paralelo. */
async function mapPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>
): Promise<void> {
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      await fn(items[i], i);
    }
  }
  const n = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
}

export const boeAdapter: SourceAdapter = {
  code: "BOE",
  name: "Boletín Oficial del Estado (incl. Tablón Edictal Único)",
  type: "BOE",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const data = await fetchSumario(date);
    if (!data) return [];

    const items: BoeItem[] = [];
    collectItems(data, items);

    const seen = new Set<string>();
    const out: NormalizedPublication[] = [];

    for (const item of items) {
      const externalId = item.identificador!;
      const title = item.titulo!;
      if (seen.has(externalId)) continue;
      seen.add(externalId);

      out.push({
        externalId,
        title,
        searchText: title, // por defecto el título; se enriquece abajo con el cuerpo
        url: buildUrl(item),
        publishedAt: date,
        actType: inferActType(title),
      });
    }

    // Fase 2: enriquecer con el texto completo del cuerpo. Solo anuncios
    // (BOE-B-*), que es donde aparecen los nombres y DNIs de personas.
    if (FULLTEXT_ENABLED) {
      const targets = out.filter((p) => /^BOE-B-/.test(p.externalId));
      await mapPool(targets, FULLTEXT_CONCURRENCY, async (pub) => {
        const body = await fetchDocText(pub.externalId);
        if (body) {
          pub.searchText = `${pub.title}\n${body}`.slice(0, MAX_BODY_CHARS);
        }
      });
    }

    return out;
  },
};
