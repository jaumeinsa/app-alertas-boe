/**
 * Adaptador del BOG/GAO (Boletín Oficial de Gipuzkoa) — code `BOP_20`.
 *
 * GET, texto en HTML por anuncio (iso-8859-1). Usar GET (HEAD da 403):
 *   Índice del día: /gao-bog/castell/bog/{YYYY}/{MM}/{DD}/bc{YYMMDD}.htm
 *     → enlaces c{NNNNNNN}.htm / .pdf (anuncios).
 *   Anuncio HTML: /gao-bog/castell/bog/{YYYY}/{MM}/{DD}/c{NNNNNNN}.htm
 * externalId = código de 7 dígitos.
 */

import {
  inferActType,
  NormalizedPublication,
  SourceAdapter,
} from "./types";
import {
  CONCURRENCY,
  fetchText,
  MAX_BODY_CHARS,
  mapPool,
  stripHtml,
} from "./util";

const BASE = "https://egoitza.gipuzkoa.eus/gao-bog/castell/bog";
const pad = (n: number) => String(n).padStart(2, "0");

export const bopGipuzkoaAdapter: SourceAdapter = {
  code: "BOP_20",
  name: "Boletín Oficial de Gipuzkoa",
  type: "BOP",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const y = date.getUTCFullYear();
    const mm = pad(date.getUTCMonth() + 1);
    const dd = pad(date.getUTCDate());
    const yy = String(y).slice(2);
    const dir = `${BASE}/${y}/${mm}/${dd}`;
    const index = await fetchText(`${dir}/bc${yy}${mm}${dd}.htm`, {
      charset: "iso-8859-1",
    });
    if (!index) return [];

    const codes = [
      ...new Set([...index.matchAll(/c(\d{7})\.(?:htm|pdf)/g)].map((m) => m[1])),
    ];
    if (codes.length === 0) return [];

    const out: NormalizedPublication[] = [];
    await mapPool(codes, CONCURRENCY, async (code) => {
      const url = `${dir}/c${code}.htm`;
      const html = await fetchText(url, { charset: "iso-8859-1" });
      const text = html ? stripHtml(html) : "";
      if (!text) return;
      const title = text.slice(0, 200) || code;
      out.push({
        externalId: code,
        title,
        searchText: text.slice(0, MAX_BODY_CHARS),
        url,
        publishedAt: date,
        actType: inferActType(title),
        region: "Gipuzkoa",
      });
    });
    return out;
  },
};
