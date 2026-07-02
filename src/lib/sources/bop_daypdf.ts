/**
 * Factory para BOPs que solo exponen un **PDF único diario** cuyo nombre lleva
 * la fecha Y el nº de boletín (`{YYYYMMDD}...{NN}...pdf`), sin índice fecha→NN.
 * Resuelve NN sondeando (con parada temprana): en un backfill ascendente el NN
 * crece ~1 por día publicado, así que cacheamos el último NN por (code, año) y
 * solo la primera fecha del año paga un sondeo amplio.
 *
 * Se ingiere el boletín entero como 1 documento/día (texto completo → búsqueda
 * de nombres válida). externalId = YYYYMMDD-NN.
 */

import {
  inferActType,
  NormalizedPublication,
  SourceAdapter,
} from "./types";
import { fetchPdfText } from "./util";

const DAY_MAX = 1_000_000;
const lastNN = new Map<string, number>(); // `${code}-${year}` → último NN visto

export function makeDayPdfNnBop(opts: {
  code: string;
  name: string;
  region: string;
  urlFor: (year: number, ymd: string, nn: number) => string;
  insecure?: boolean;
  maxNN?: number; // tope del sondeo amplio (por defecto 250)
}): SourceAdapter {
  const { code, name, region, urlFor, insecure, maxNN = 250 } = opts;
  return {
    code,
    name,
    type: "BOP",
    enabled: true,
    async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
      const y = date.getUTCFullYear();
      const ymd = `${y}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(
        date.getUTCDate()
      ).padStart(2, "0")}`;
      const key = `${code}-${y}`;
      const prev = lastNN.get(key) ?? 0;
      // Warm: NN esperado justo tras el anterior. Cold (primera vez del año): amplio.
      const start = prev > 0 ? prev + 1 : 1;
      const end = prev > 0 ? prev + 6 : maxNN;

      for (let nn = start; nn <= end; nn++) {
        const url = urlFor(y, ymd, nn);
        const text = await fetchPdfText(url, insecure ? { insecure: true } : {});
        if (!text) continue;
        // encontrado: este NN corresponde a esta fecha
        lastNN.set(key, nn);
        const title = text.replace(/\s+/g, " ").trim().slice(0, 200) || `${code} ${ymd}`;
        return [
          {
            externalId: `${ymd}-${nn}`,
            title,
            searchText: text.slice(0, DAY_MAX),
            url,
            publishedAt: date,
            actType: inferActType(title),
            region,
          },
        ];
      }
      return []; // sin boletín ese día
    },
  };
}
