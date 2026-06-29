/**
 * Adaptador del BORME (Boletín Oficial del Registro Mercantil) vía la API de
 * datos abiertos del BOE.
 *
 *   Sumario diario:  https://www.boe.es/datosabiertos/api/borme/sumario/YYYYMMDD
 *   Texto documento: https://www.boe.es/diario_borme/xml.php?id=BORME-A-...
 *
 * El BORME se publica por secciones y PROVINCIA:
 *   - Sección A (BORME-A-*): Empresarios — Actos inscritos. Aquí están los
 *     NOMBRAMIENTOS y ceses de administradores, constituciones, etc. — con
 *     nombre y apellidos de las personas. Es la sección clave para vigilar a
 *     una persona física que sea administrador/apoderado de una sociedad.
 *   - Sección B (BORME-B-*): otros actos (subastas, etc.).
 *   - Sección C (BORME-C-*): anuncios y avisos legales (fusiones, etc.).
 *
 * Descargamos el texto completo de TODOS los documentos del sumario (es donde
 * aparecen los nombres) y lo guardamos en searchText.
 */

import {
  inferActType,
  NormalizedPublication,
  SourceAdapter,
  yyyymmdd,
} from "./types";

const SUMARIO = "https://www.boe.es/datosabiertos/api/borme/sumario";
const DOC = "https://www.boe.es/diario_borme/xml.php?id=";

const UA =
  process.env.INGEST_USER_AGENT ?? "NotifikadoBot/0.1 (+https://notifikado.com)";
const CONCURRENCY = Math.max(
  1,
  parseInt(process.env.INGEST_FULLTEXT_CONCURRENCY ?? "5", 10) || 5
);
// Los documentos del BORME-A (una provincia entera por día) son grandes; subimos
// el tope para no truncar nombres del final del documento.
const MAX_BODY_CHARS = 300_000;

interface BormeItem {
  identificador?: string;
  titulo?: string;
}

function collectItems(node: unknown, out: BormeItem[]): void {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const child of node) collectItems(child, out);
    return;
  }
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if (typeof obj.identificador === "string") {
      out.push(obj as BormeItem);
    }
    for (const key of Object.keys(obj)) {
      if (key === "identificador") continue;
      collectItems(obj[key], out);
    }
  }
}

async function fetchSumario(date: Date): Promise<unknown | null> {
  const res = await fetch(`${SUMARIO}/${yyyymmdd(date)}`, {
    headers: { Accept: "application/json", "User-Agent": UA },
    next: { revalidate: 60 * 60 },
  });
  if (res.status === 404) return null; // sin BORME ese día
  if (!res.ok) throw new Error(`BORME sumario ${yyyymmdd(date)} → ${res.status}`);
  return res.json();
}

async function fetchDocText(externalId: string): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(`${DOC}${externalId}`, {
      headers: { Accept: "application/xml", "User-Agent": UA },
      next: { revalidate: 60 * 60 * 24 },
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const xml = new TextDecoder("utf-8").decode(await res.arrayBuffer());
  const m = xml.match(/<texto>([\s\S]*?)<\/texto>/i);
  const body = m ? m[1] : "";
  if (!body) return null;
  const plain = body
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plain ? plain.slice(0, MAX_BODY_CHARS) : null;
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      await fn(items[cursor++]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
}

export const bormeAdapter: SourceAdapter = {
  code: "BORME",
  name: "Boletín Oficial del Registro Mercantil",
  type: "BORME",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const data = await fetchSumario(date);
    if (!data) return [];

    const items: BormeItem[] = [];
    collectItems(data, items);

    const seen = new Set<string>();
    const out: NormalizedPublication[] = [];
    for (const item of items) {
      const externalId = item.identificador;
      // Saltamos el propio sumario (BORME-S-*).
      if (!externalId || /^BORME-S-/.test(externalId)) continue;
      if (seen.has(externalId)) continue;
      seen.add(externalId);

      const title = item.titulo ?? externalId;
      out.push({
        externalId,
        title,
        searchText: title,
        url: `https://www.boe.es/diario_borme/txt.php?id=${externalId}`,
        publishedAt: date,
        actType: inferActType(title) ?? "mercantil",
      });
    }

    // Texto completo de todos los documentos (ahí están los nombres).
    await mapPool(out, CONCURRENCY, async (pub) => {
      const body = await fetchDocText(pub.externalId);
      if (body) pub.searchText = `${pub.title}\n${body}`.slice(0, MAX_BODY_CHARS);
    });

    return out;
  },
};
