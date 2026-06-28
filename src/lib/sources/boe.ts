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

async function fetchSumario(date: Date): Promise<unknown | null> {
  const url = `${BASE}/${yyyymmdd(date)}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent":
        process.env.INGEST_USER_AGENT ?? "NotifikadoBot/0.1 (+https://notifikado.com)",
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
        searchText: title, // el sumario solo trae títulos; el cuerpo se enriquece en fase 2
        url: buildUrl(item),
        publishedAt: date,
        actType: inferActType(title),
      });
    }

    return out;
  },
};
