/**
 * Adaptador del DOGC (Diari Oficial de la Generalitat de Catalunya).
 *
 * API REST eadop-rest (POST x-www-form-urlencoded):
 *   1) calendarDOGC  (month, year)      -> calendar[] {date "DD/MM/YYYY", linkDOGC con numDOGC=N}
 *   2) summaryDOGC   (numDOGC)          -> sumaris -> documentos {title, linkDownloadDocumentPDF con documentId}
 *   3) documentDOGC  (documentId)       -> {titleDocument, textDocument (HTML completo), documentData.CVE}
 *
 * Anuncis, administració local, sancions i subvencions de Catalunya.
 */

import {
  inferActType,
  NormalizedPublication,
  SourceAdapter,
} from "./types";

const API = "https://portaldogc.gencat.cat/eadop-rest/api/dogc";
const UA =
  process.env.INGEST_USER_AGENT ?? "NotifikadoBot/0.1 (+https://notifikado.com)";
const CONCURRENCY = Math.max(
  1,
  parseInt(process.env.INGEST_FULLTEXT_CONCURRENCY ?? "5", 10) || 5
);
const MAX_BODY_CHARS = 200_000;

function ddmmyyyy(date: Date): string {
  const d = String(date.getUTCDate()).padStart(2, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${d}/${m}/${date.getUTCFullYear()}`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function postForm(endpoint: string, body: string): Promise<unknown | null> {
  let res: Response;
  try {
    res = await fetch(`${API}/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "User-Agent": UA,
      },
      body,
    });
  } catch {
    return null;
  }
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

interface DogcDoc {
  title?: string;
  linkDownloadDocumentPDF?: string;
}

/** Recorre el sumario (estructura anidada) y recoge los documentos. */
function collectDocs(node: unknown, out: DogcDoc[]): void {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const x of node) collectDocs(x, out);
    return;
  }
  if (typeof node === "object") {
    const o = node as Record<string, unknown>;
    if (typeof o.title === "string" && typeof o.linkDownloadDocumentPDF === "string") {
      out.push(o as DogcDoc);
    }
    for (const v of Object.values(o)) collectDocs(v, out);
  }
}

export const dogcAdapter: SourceAdapter = {
  code: "DOGC",
  name: "Diari Oficial de la Generalitat de Catalunya",
  type: "AUTONOMIC",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const target = ddmmyyyy(date);
    const cal = (await postForm(
      "calendarDOGC",
      `month=${date.getUTCMonth() + 1}&year=${date.getUTCFullYear()}&language=es_ES`
    )) as { calendar?: Array<{ date: string; linkDOGC?: string }> } | null;

    const entry = (cal?.calendar ?? []).find((c) => c.date === target);
    const numDOGC = entry?.linkDOGC?.match(/numDOGC=(\d+)/)?.[1];
    if (!numDOGC) return [];

    const sum = await postForm("summaryDOGC", `numDOGC=${numDOGC}&language=es_ES`);
    const docs: DogcDoc[] = [];
    collectDocs(sum, docs);
    if (docs.length === 0) return [];

    const out: NormalizedPublication[] = [];
    const seen = new Set<string>();
    const tasks: Array<{ documentId: string; title: string; pdf: string }> = [];
    for (const d of docs) {
      const documentId = d.linkDownloadDocumentPDF?.match(/documentId=(\d+)/)?.[1];
      if (!documentId || seen.has(documentId)) continue;
      seen.add(documentId);
      tasks.push({ documentId, title: d.title ?? "", pdf: d.linkDownloadDocumentPDF ?? "" });
    }

    await mapPool(tasks, CONCURRENCY, async (t) => {
      const doc = (await postForm(
        "documentDOGC",
        `documentId=${t.documentId}&language=es_ES`
      )) as
        | { titleDocument?: string; textDocument?: string; documentData?: { CVE?: string } }
        | null;
      const title = doc?.titleDocument ?? t.title;
      const cve = doc?.documentData?.CVE ?? `DOGC-${t.documentId}`;
      const body = doc?.textDocument ? stripHtml(doc.textDocument) : "";
      out.push({
        externalId: cve,
        title,
        searchText: `${title}\n${body}`.slice(0, MAX_BODY_CHARS),
        url: t.pdf || `${API}/documentDOGC?documentId=${t.documentId}`,
        publishedAt: date,
        actType: inferActType(title),
        region: "Cataluña",
      });
    });

    return out;
  },
};
