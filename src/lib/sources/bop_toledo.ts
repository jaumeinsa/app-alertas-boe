/**
 * Adaptador del BOP de Toledo — code `BOP_45`.
 *
 * Plataforma eBOP (Java/JSP). GET, PDF con capa de texto por anuncio:
 *   Sumario del día: /webEbop/ebopResumen.jsp?publication_date=DD/MM/YYYY&publication_date_to=DD/MM/YYYY
 *     → enlaces DocGet?id={YYMMDDNN};0&insert_number=NNNN&insert_year=YYYY
 *   Anuncio PDF: /webEbop/DocGet?id=...&insert_number=...&insert_year=...
 * externalId = insert_year-insert_number.
 */

import {
  inferActType,
  NormalizedPublication,
  SourceAdapter,
} from "./types";
import {
  CONCURRENCY,
  fetchPdfText,
  fetchText,
  MAX_BODY_CHARS,
  mapPool,
} from "./util";

const BASE = "https://bop.diputoledo.es/webEbop";
const pad = (n: number) => String(n).padStart(2, "0");

export const bopToledoAdapter: SourceAdapter = {
  code: "BOP_45",
  name: "Boletín Oficial de la Provincia de Toledo",
  type: "BOP",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const f = `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
    const html = await fetchText(
      `${BASE}/ebopResumen.jsp?publication_date=${f}&publication_date_to=${f}`
    );
    if (!html) return [];

    const re = /DocGet\?id=[^"'\s<>]*insert_number=(\d+)[^"'\s<>]*/g;
    const seen = new Set<string>();
    const items: Array<{ code: string; url: string }> = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      const full = m[0].replace(/&amp;/g, "&");
      const yr = /insert_year=(\d+)/.exec(full)?.[1] ?? String(date.getUTCFullYear());
      const code = `${yr}-${m[1]}`;
      if (seen.has(code)) continue;
      seen.add(code);
      items.push({ code, url: `${BASE}/${full}` });
    }
    if (items.length === 0) return [];

    const out: NormalizedPublication[] = [];
    await mapPool(items, CONCURRENCY, async (a) => {
      const text = await fetchPdfText(a.url);
      if (!text) return;
      const title = text.replace(/\s+/g, " ").trim().slice(0, 200) || a.code;
      out.push({
        externalId: a.code,
        title,
        searchText: text.slice(0, MAX_BODY_CHARS),
        url: a.url,
        publishedAt: date,
        actType: inferActType(title),
        region: "Toledo",
      });
    });
    return out;
  },
};
