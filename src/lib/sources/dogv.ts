/**
 * Adaptador del DOGV (Diari Oficial de la Generalitat Valenciana).
 *
 *   Sumario por fecha:  https://dogv.gva.es/dogv-portal/dogv?date=YYYY-MM-DD&lang=es
 *     -> JSON { cabecera, disposiciones: [{ id, titulo, codigoInsercion, urlPdf, ... }] }
 *   Texto del documento: https://dogv.gva.es/dogv-portal/disposicion/{id}?lang=es
 *     -> JSON { texto (HTML completo), cve: "DOGV-YYYY-NNNNN", ... }
 *
 * Sanciones y subvenciones autonómicas, edictos, expropiaciones, etc. de la
 * Comunitat Valenciana — donde puede aparecer el nombre de una persona.
 */

import {
  inferActType,
  NormalizedPublication,
  SourceAdapter,
} from "./types";

const PORTAL = "https://dogv.gva.es/dogv-portal";
const UA =
  process.env.INGEST_USER_AGENT ?? "NotifikadoBot/0.1 (+https://notifikado.com)";
const CONCURRENCY = Math.max(
  1,
  parseInt(process.env.INGEST_FULLTEXT_CONCURRENCY ?? "5", 10) || 5
);
const MAX_BODY_CHARS = 200_000;

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface DogvDisposicion {
  id: number;
  titulo: string;
  codigoInsercion?: string;
  urlPdf?: string;
}

async function fetchJson(url: string): Promise<unknown | null> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": UA },
      next: { revalidate: 60 * 60 },
    });
  } catch {
    return null;
  }
  if (res.status === 404) return null;
  if (!res.ok) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) await fn(items[cursor++]);
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
}

export const dogvAdapter: SourceAdapter = {
  code: "DOGV",
  name: "Diari Oficial de la Generalitat Valenciana",
  type: "AUTONOMIC",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const sumario = (await fetchJson(
      `${PORTAL}/dogv?date=${isoDate(date)}&lang=es`
    )) as { disposiciones?: DogvDisposicion[] } | null;
    const disposiciones = sumario?.disposiciones;
    if (!disposiciones || disposiciones.length === 0) return [];

    const out: NormalizedPublication[] = [];
    const seen = new Set<string>();
    for (const d of disposiciones) {
      const externalId = d.codigoInsercion ?? String(d.id);
      if (seen.has(externalId)) continue;
      seen.add(externalId);
      out.push({
        externalId,
        title: d.titulo,
        searchText: d.titulo,
        url: d.urlPdf ?? `${PORTAL}/disposicion/${d.id}?lang=es`,
        publishedAt: date,
        actType: inferActType(d.titulo),
        region: "Comunitat Valenciana",
      });
    }

    // Texto completo de cada disposición.
    await mapPool(disposiciones, CONCURRENCY, async (d) => {
      const externalId = d.codigoInsercion ?? String(d.id);
      const pub = out.find((p) => p.externalId === externalId);
      if (!pub) return;
      const doc = (await fetchJson(`${PORTAL}/disposicion/${d.id}?lang=es`)) as
        | { texto?: string }
        | null;
      if (doc?.texto) {
        pub.searchText = `${pub.title}\n${stripHtml(doc.texto)}`.slice(
          0,
          MAX_BODY_CHARS
        );
      }
    });

    return out;
  },
};
