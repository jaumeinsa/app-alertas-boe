/**
 * Adaptador del BOP de Ávila — code `BOP_05`.
 *
 * HTML propio, GET, PDF con capa de texto por anuncio:
 *   Sumario del día: /boletin-oficial/{YYYY}/DD-MM-YYYY.html
 *   Anuncio PDF:     /bops/{YYYY}/DD-MM-YYYY/DD-MM-YYYY_{NNNNNN}.pdf
 * externalId = número de anuncio.
 */

import {
  inferActType,
  NormalizedPublication,
  SourceAdapter,
} from "./types";
import {
  CONCURRENCY,
  ddmmyyyy,
  fetchPdfText,
  fetchText,
  MAX_BODY_CHARS,
  mapPool,
} from "./util";

const BASE = "https://www.diputacionavila.es";

export const bopAvilaAdapter: SourceAdapter = {
  code: "BOP_05",
  name: "Boletín Oficial de la Provincia de Ávila",
  type: "BOP",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const y = date.getUTCFullYear();
    const fecha = ddmmyyyy(date, "-");
    const html = await fetchText(`${BASE}/boletin-oficial/${y}/${fecha}.html`);
    if (!html) return [];

    const re = new RegExp(`/bops/${y}/${fecha}/${fecha}_(\\d+)\\.pdf`, "g");
    const seen = new Set<string>();
    const items: Array<{ code: string; url: string }> = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      if (seen.has(m[1])) continue;
      seen.add(m[1]);
      items.push({ code: m[1], url: `${BASE}/bops/${y}/${fecha}/${fecha}_${m[1]}.pdf` });
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
        region: "Ávila",
      });
    });
    return out;
  },
};
