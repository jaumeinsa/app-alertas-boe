/**
 * Adaptador del BOP de Ciudad Real — code `BOP_13`.
 *
 * Plataforma propia + SIGEM. GET, PDF con capa de texto:
 *   Sumario del día: bop.dipucr.es/bop/YYYY/MM/DD (HTML)
 *     → enlaces getDocument.do?entidad=005&doc={DOC}
 *   Documento PDF: se1.dipucr.es:4443/SIGEM_BuscadorDocsWeb/getDocument.do?entidad=005&doc={DOC}
 *     (el primer doc del día es el boletín completo; el resto anuncios.)
 * externalId = doc (nº documento SIGEM).
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

const SUM = "https://bop.dipucr.es";
const DOC = "https://se1.dipucr.es:4443/SIGEM_BuscadorDocsWeb/getDocument.do";
const pad = (n: number) => String(n).padStart(2, "0");

export const bopCiudadRealAdapter: SourceAdapter = {
  code: "BOP_13",
  name: "Boletín Oficial de la Provincia de Ciudad Real",
  type: "BOP",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const y = date.getUTCFullYear();
    const html = await fetchText(
      `${SUM}/bop/${y}/${pad(date.getUTCMonth() + 1)}/${pad(date.getUTCDate())}`,
      { insecure: true } // cert con cadena incompleta
    );
    if (!html) return [];

    const docs = [
      ...new Set([...html.matchAll(/getDocument\.do\?[^"'\s<>]*doc=(\d+)/g)].map((m) => m[1])),
    ];
    if (docs.length === 0) return [];

    const out: NormalizedPublication[] = [];
    await mapPool(docs, CONCURRENCY, async (doc) => {
      const url = `${DOC}?entidad=005&doc=${doc}`;
      const text = await fetchPdfText(url, { insecure: true });
      if (!text) return;
      const title = text.replace(/\s+/g, " ").trim().slice(0, 200) || doc;
      out.push({
        externalId: doc,
        title,
        searchText: text.slice(0, MAX_BODY_CHARS),
        url,
        publishedAt: date,
        actType: inferActType(title),
        region: "Ciudad Real",
      });
    });
    return out;
  },
};
