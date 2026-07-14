/**
 * Adaptador del BOP de Lugo — code `BOP_27`.
 *
 * Plataforma Drupal. Solo hay **PDF único diario** (todo el boletín) con capa
 * de texto → se ingiere como 1 documento/día:
 *   https://www.deputacionlugo.gal/sites/deputacionlugo.org/files/inline-files/DD-MM-YYYY.pdf
 * externalId = YYYYMMDD. 404 = no hubo boletín.
 */

import {
  inferActType,
  NormalizedPublication,
  SourceAdapter,
} from "./types";
import { ddmmyyyy, fetchPdfText, yyyymmdd } from "./util";

const BASE =
  "https://www.deputacionlugo.gal/sites/deputacionlugo.org/files/inline-files";
const DAY_MAX = 1_000_000;

export const bopLugoAdapter: SourceAdapter = {
  code: "BOP_27",
  name: "Boletín Oficial de la Provincia de Lugo",
  type: "BOP",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const url = `${BASE}/${ddmmyyyy(date, "-")}.pdf`;
    const text = await fetchPdfText(url);
    if (!text) return [];
    const title = text.replace(/\s+/g, " ").trim().slice(0, 200) || `BOP Lugo ${ddmmyyyy(date, "-")}`;
    return [
      {
        externalId: yyyymmdd(date),
        title,
        searchText: text.slice(0, DAY_MAX),
        url,
        publishedAt: date,
        actType: inferActType(title),
        region: "Lugo",
      },
    ];
  },
};
