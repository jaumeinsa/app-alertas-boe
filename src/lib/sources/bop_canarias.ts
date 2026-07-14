/**
 * Adaptadores de los BOP canarios (plataforma PHP "nbop", compartida) —
 * Las Palmas (`BOP_35`) y Santa Cruz de Tenerife (`BOP_38`).
 *
 * Solo hay **PDF único diario** (todo el boletín) con capa de texto:
 *   https://{HOST}/boletines/{YYYY}/{D-M-AA}/{D-M-AA}.pdf   (fecha SIN ceros, año 2 díg)
 * Se ingiere como 1 documento/día con el texto completo (para buscar nombres).
 * externalId = YYYYMMDD. 404 = no hubo boletín ese día.
 */

import {
  inferActType,
  NormalizedPublication,
  SourceAdapter,
} from "./types";
import { fetchPdfText, yyyymmdd } from "./util";

const DAY_MAX = 1_000_000; // boletín entero como 1 doc (los canarios pesan MB)

function makeCanariasBop(
  code: string,
  name: string,
  host: string,
  region: string
): SourceAdapter {
  return {
    code,
    name,
    type: "BOP",
    enabled: true,
    async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
      const stamp = `${date.getUTCDate()}-${date.getUTCMonth() + 1}-${String(
        date.getUTCFullYear()
      ).slice(2)}`;
      const url = `https://${host}/boletines/${date.getUTCFullYear()}/${stamp}/${stamp}.pdf`;
      const text = await fetchPdfText(url);
      if (!text) return [];
      const title = text.replace(/\s+/g, " ").trim().slice(0, 200) || `${code} ${stamp}`;
      return [
        {
          externalId: yyyymmdd(date),
          title,
          searchText: text.slice(0, DAY_MAX),
          url,
          publishedAt: date,
          actType: inferActType(title),
          region,
        },
      ];
    },
  };
}

export const bopLasPalmasAdapter = makeCanariasBop(
  "BOP_35",
  "Boletín Oficial de la Provincia de Las Palmas",
  "www.boplaspalmas.net",
  "Las Palmas"
);

export const bopTenerifeAdapter = makeCanariasBop(
  "BOP_38",
  "Boletín Oficial de la Provincia de Santa Cruz de Tenerife",
  "www.bopsantacruzdetenerife.es",
  "Santa Cruz de Tenerife"
);
