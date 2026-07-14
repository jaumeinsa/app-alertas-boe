/**
 * Adaptador del BOP de Teruel — code `BOP_44`.
 *
 * Plataforma IBM Domino. Solo hay **PDF único diario** (todo el boletín) con
 * capa de texto → 1 documento/día:
 *   https://236ws.dpteruel.es/estatico/boletines/{YYYY}/{DD}{mes-texto}.pdf
 *     (día CON cero: "02junio"; mes en minúsculas). externalId = YYYYMMDD.
 */

import {
  inferActType,
  NormalizedPublication,
  SourceAdapter,
} from "./types";
import { fetchPdfText, yyyymmdd } from "./util";

const BASE = "https://236ws.dpteruel.es/estatico/boletines";
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const pad = (n: number) => String(n).padStart(2, "0");
const DAY_MAX = 1_000_000;

export const bopTeruelAdapter: SourceAdapter = {
  code: "BOP_44",
  name: "Boletín Oficial de la Provincia de Teruel",
  type: "BOP",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const url = `${BASE}/${date.getUTCFullYear()}/${pad(date.getUTCDate())}${MESES[date.getUTCMonth()]}.pdf`;
    const text = await fetchPdfText(url);
    if (!text) return [];
    const title = text.replace(/\s+/g, " ").trim().slice(0, 200) || `BOP Teruel ${yyyymmdd(date)}`;
    return [
      {
        externalId: yyyymmdd(date),
        title,
        searchText: text.slice(0, DAY_MAX),
        url,
        publishedAt: date,
        actType: inferActType(title),
        region: "Teruel",
      },
    ];
  },
};
