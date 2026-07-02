/**
 * Adaptador del BOP de Pontevedra (BOPPO) — code `BOP_36`.
 *
 * Plataforma BOPPO sobre Liferay. GET, PDF con capa de texto por anuncio:
 *   Detalle del día (= sumario): /web/boppo/detalle/-/boppo/YYYY/MM/DD (HTML)
 *     → enlaces .../{id}/an.bop.PONTEVEDRA.YYYYMMDD.{id}.pdf
 * externalId = id del anuncio (AAAANNNNNN).
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

const BASE = "https://boppo.depo.gal";
const pad = (n: number) => String(n).padStart(2, "0");

export const bopPontevedraAdapter: SourceAdapter = {
  code: "BOP_36",
  name: "Boletín Oficial de la Provincia de Pontevedra",
  type: "BOP",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const y = date.getUTCFullYear();
    const m = pad(date.getUTCMonth() + 1);
    const d = pad(date.getUTCDate());
    const html = await fetchText(`${BASE}/web/boppo/detalle/-/boppo/${y}/${m}/${d}`);
    if (!html) return [];

    const re =
      /(\/web\/boppo\/detalle\/-\/boppo\/\d{4}\/\d{2}\/\d{2}\/(\d+)\/an\.bop\.PONTEVEDRA\.\d{8}\.\d+\.pdf)/g;
    const seen = new Set<string>();
    const items: Array<{ id: string; url: string }> = [];
    let m2: RegExpExecArray | null;
    while ((m2 = re.exec(html))) {
      if (seen.has(m2[2])) continue;
      seen.add(m2[2]);
      items.push({ id: m2[2], url: `${BASE}${m2[1]}` });
    }
    if (items.length === 0) return [];

    const out: NormalizedPublication[] = [];
    await mapPool(items, CONCURRENCY, async (a) => {
      const text = await fetchPdfText(a.url);
      if (!text) return;
      const title = text.replace(/\s+/g, " ").trim().slice(0, 200) || a.id;
      out.push({
        externalId: a.id,
        title,
        searchText: text.slice(0, MAX_BODY_CHARS),
        url: a.url,
        publishedAt: date,
        actType: inferActType(title),
        region: "Pontevedra",
      });
    });
    return out;
  },
};
