/**
 * Adaptador del BOP de Valladolid — code `BOP_47`.
 *
 * Plataforma Liferay (BOPVA) con directorio navegable por fecha. GET, PDF
 * con capa de texto por anuncio:
 *   Directorio del día: /boletines/{YYYY}/{mes-en-texto}/{DD}/  (HTML listado)
 *     → ficheros BOPVA-A-YYYY-NNNNN.pdf (anuncios; BOPVA-B-...=completo).
 * externalId = BOPVA-A-YYYY-NNNNN.
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

const BASE = "https://bop.sede.diputaciondevalladolid.es";
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const pad = (n: number) => String(n).padStart(2, "0");

export const bopValladolidAdapter: SourceAdapter = {
  code: "BOP_47",
  name: "Boletín Oficial de la Provincia de Valladolid",
  type: "BOP",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const dir = `${BASE}/boletines/${date.getUTCFullYear()}/${MESES[date.getUTCMonth()]}/${pad(date.getUTCDate())}/`;
    const html = await fetchText(dir);
    if (!html) return [];

    const codes = [...new Set(html.match(/BOPVA-A-\d{4}-\d+/g) ?? [])];
    if (codes.length === 0) return [];

    const out: NormalizedPublication[] = [];
    await mapPool(codes, CONCURRENCY, async (code) => {
      const url = `${dir}${code}.pdf`;
      const text = await fetchPdfText(url);
      if (!text) return;
      const title = text.replace(/\s+/g, " ").trim().slice(0, 200) || code;
      out.push({
        externalId: code,
        title,
        searchText: text.slice(0, MAX_BODY_CHARS),
        url,
        publishedAt: date,
        actType: inferActType(title),
        region: "Valladolid",
      });
    });
    return out;
  },
};
