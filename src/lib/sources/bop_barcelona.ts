/**
 * Adaptador del BOP de Barcelona — code `BOP_08`.
 *
 * Índice HTML por fecha (GET, paginado), PDF con capa de texto por anuncio:
 *   Sumario del día: /anteriors/YYYY-MM-DD  (y /anteriors/YYYY-MM-DD/2, /3…)
 *     → enlaces /anunci/{ID}/…
 *   Anuncio PDF: /anunci/descarrega-pdf/{ID}
 * externalId = ID del anuncio.
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
  isoDate,
  MAX_BODY_CHARS,
  mapPool,
} from "./util";

const BASE = "https://bop.diba.cat";

export const bopBarcelonaAdapter: SourceAdapter = {
  code: "BOP_08",
  name: "Butlletí Oficial de la Província de Barcelona",
  type: "BOP",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const iso = isoDate(date);
    const ids = new Set<string>();
    for (let page = 1; page <= 100; page++) {
      const url = page === 1 ? `${BASE}/anteriors/${iso}` : `${BASE}/anteriors/${iso}/${page}`;
      const html = await fetchText(url);
      if (!html) break;
      const pageIds = [...new Set([...html.matchAll(/\/anunci\/(\d+)\//g)].map((m) => m[1]))];
      const fresh = pageIds.filter((id) => !ids.has(id));
      if (fresh.length === 0) break; // página sin ids nuevos → fin
      fresh.forEach((id) => ids.add(id));
    }
    if (ids.size === 0) return [];

    const out: NormalizedPublication[] = [];
    await mapPool([...ids], CONCURRENCY, async (id) => {
      const url = `${BASE}/anunci/descarrega-pdf/${id}`;
      const text = await fetchPdfText(url);
      if (!text) return;
      const title = text.replace(/\s+/g, " ").trim().slice(0, 200) || id;
      out.push({
        externalId: id,
        title,
        searchText: text.slice(0, MAX_BODY_CHARS),
        url,
        publishedAt: date,
        actType: inferActType(title),
        region: "Barcelona",
      });
    });
    return out;
  },
};
