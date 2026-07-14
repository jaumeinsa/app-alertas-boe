/**
 * Adaptador del BOP de Girona — code `BOP_17`.
 *
 * El portal indexa por nº de boletín (numBop), NO por fecha (la fecha en la URL
 * es cosmética). Estrategia: construir un mapa numBop→fecha por año (iterando y
 * leyendo la fecha real de cada boletín; cacheado). Cert/TLS → insecure.
 *   Boletín: /bop/mostra-bop/x/{YYYY}/{numBop} (HTML) → fecha DD/MM/YYYY + PDFs.
 *   Anuncio PDF: https://ssl4.ddgi.cat/bopV1/pdf/{YYYY}/{numBop}/{ID}.pdf
 * externalId = ID del anuncio (12 díg).
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

const BASE = "https://www.ddgi.cat/bop";
const PDFBASE = "https://ssl4.ddgi.cat/bopV1/pdf";
const pad = (n: number) => String(n).padStart(2, "0");

interface GirBoletin {
  numBop: number;
  ids: string[];
}
// año → Map<"DD/MM/YYYY", {numBop, ids}>
const yearCache = new Map<number, Map<string, GirBoletin>>();

async function getYearMap(year: number): Promise<Map<string, GirBoletin>> {
  const cached = yearCache.get(year);
  if (cached) return cached;
  const map = new Map<string, GirBoletin>();
  let miss = 0;
  for (let nb = 1; nb <= 400 && miss < 10; nb++) {
    const html = await fetchText(`${BASE}/mostra-bop/x/${year}/${nb}`, {
      insecure: true,
    });
    if (!html) {
      miss++;
      continue;
    }
    miss = 0;
    const dm = html.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!dm || parseInt(dm[3], 10) !== year) continue;
    const ids = [
      ...new Set(
        [...html.matchAll(new RegExp(`/bopV1/pdf/${year}/${nb}/(\\d+)\\.pdf`, "g"))].map(
          (m) => m[1]
        )
      ),
    ];
    map.set(`${dm[1]}/${dm[2]}/${dm[3]}`, { numBop: nb, ids });
  }
  yearCache.set(year, map);
  return map;
}

export const bopGironaAdapter: SourceAdapter = {
  code: "BOP_17",
  name: "Butlletí Oficial de la Província de Girona",
  type: "BOP",
  // Probado: 2025-06-16 → 58 docs. El mapa del año tarda ~10 min en construirse
  // (una vez por año, cacheado; el backfill lo amortiza).
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const y = date.getUTCFullYear();
    const key = `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${y}`;
    const entry = (await getYearMap(y)).get(key);
    if (!entry || entry.ids.length === 0) return [];

    const out: NormalizedPublication[] = [];
    await mapPool(entry.ids, CONCURRENCY, async (id) => {
      const url = `${PDFBASE}/${y}/${entry.numBop}/${id}.pdf`;
      const text = await fetchPdfText(url, { insecure: true });
      if (!text) return;
      const title = text.replace(/\s+/g, " ").trim().slice(0, 200) || id;
      out.push({
        externalId: id,
        title,
        searchText: text.slice(0, MAX_BODY_CHARS),
        url,
        publishedAt: date,
        actType: inferActType(title),
        region: "Girona",
      });
    });
    return out;
  },
};
