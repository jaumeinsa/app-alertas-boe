/**
 * Adaptador del BOP de Córdoba — code `BOP_14`.
 *
 * Plataforma eBOP/Eprinsa. Todo por GET, PDF con capa de texto nativa:
 *   Sumario del día: /dia/DD-MM-YYYY  (HTML) → enlaces /visor-pdf/DD-MM-YYYY/BOP-A-YYYY-N.pdf
 *     (BOP-A = anuncio; BOP-S = sumario del boletín, se ignora).
 *   Anuncio PDF:     /visor-pdf/DD-MM-YYYY/BOP-A-YYYY-N.pdf
 * externalId = BOP-A-YYYY-N.
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

const BASE = "https://bop.dipucordoba.es";

export const bopCordobaAdapter: SourceAdapter = {
  code: "BOP_14",
  name: "Boletín Oficial de la Provincia de Córdoba",
  type: "BOP",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const fecha = ddmmyyyy(date, "-");
    const html = await fetchText(`${BASE}/dia/${fecha}`);
    if (!html) return [];

    const re = /\/visor-pdf\/(\d{2}-\d{2}-\d{4})\/(BOP-A-\d{4}-\d+)\.pdf/g;
    const seen = new Set<string>();
    const anuncios: Array<{ code: string; url: string }> = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      const code = m[2];
      if (seen.has(code)) continue;
      seen.add(code);
      anuncios.push({ code, url: `${BASE}/visor-pdf/${m[1]}/${code}.pdf` });
    }
    if (anuncios.length === 0) return [];

    const out: NormalizedPublication[] = [];
    await mapPool(anuncios, CONCURRENCY, async (a) => {
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
        region: "Córdoba",
      });
    });
    return out;
  },
};
