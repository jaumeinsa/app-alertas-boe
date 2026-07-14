/**
 * Adaptador del BOP de A Coruña — code `BOP_15`.
 *
 * Plataforma bopPortal (Java Struts). GET, PDF con capa de texto por anuncio:
 *   Sumario del día: /bopportal/cambioBoletin?fechaInput=DD%2FMM%2FYYYY (HTML)
 *     → ids de anuncio con formato AAAA_NNNNNNNNNN.
 *   Anuncio PDF: /bopportal/publicado/YYYY/MM/DD/{id}.pdf
 * externalId = id (AAAA_NNNNNNNNNN).
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

const BASE = "https://bop.dacoruna.gal/bopportal";
const pad = (n: number) => String(n).padStart(2, "0");

export const bopACorunaAdapter: SourceAdapter = {
  code: "BOP_15",
  name: "Boletín Oficial de la Provincia de A Coruña",
  type: "BOP",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const y = date.getUTCFullYear();
    const m = pad(date.getUTCMonth() + 1);
    const d = pad(date.getUTCDate());
    const html = await fetchText(
      `${BASE}/cambioBoletin?fechaInput=${d}%2F${m}%2F${y}`
    );
    if (!html) return [];

    const ids = [...new Set(html.match(/\d{4}_\d{10}/g) ?? [])];
    if (ids.length === 0) return [];

    const out: NormalizedPublication[] = [];
    await mapPool(ids, CONCURRENCY, async (id) => {
      const url = `${BASE}/publicado/${y}/${m}/${d}/${id}.pdf`;
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
        region: "A Coruña",
      });
    });
    return out;
  },
};
