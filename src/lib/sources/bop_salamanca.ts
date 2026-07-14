/**
 * Adaptador del BOP de Salamanca — code `BOP_37`.
 *
 * Plataforma OpenCms. GET, PDF con capa de texto por anuncio, numerados
 * secuencialmente (no hace falta parsear sumario):
 *   Anuncio PDF: /documentacion/bop/{YYYY}/{YYYYMMDD}/BOP-SA-{YYYYMMDD}-NNN.pdf
 *     NNN = 001, 002, … (el -000 es el sumario/boletín completo, se salta).
 * Enumeramos NNN hasta acumular varios 404 seguidos. externalId = CVE completo.
 */

import {
  inferActType,
  NormalizedPublication,
  SourceAdapter,
} from "./types";
import { fetchPdfText, MAX_BODY_CHARS } from "./util";

const BASE = "https://sede.diputaciondesalamanca.gob.es/documentacion/bop";
const pad2 = (n: number) => String(n).padStart(2, "0");
const pad3 = (n: number) => String(n).padStart(3, "0");

export const bopSalamancaAdapter: SourceAdapter = {
  code: "BOP_37",
  name: "Boletín Oficial de la Provincia de Salamanca",
  type: "BOP",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const y = date.getUTCFullYear();
    const ymd = `${y}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}`;

    // ¿Hay boletín ese día? El -000 (sumario) debe existir.
    const sumario = await fetchPdfText(`${BASE}/${y}/${ymd}/BOP-SA-${ymd}-000.pdf`, {
      insecure: true,
    });
    if (!sumario) return [];

    const out: NormalizedPublication[] = [];
    let misses = 0;
    for (let n = 1; n <= 500 && misses < 4; n++) {
      const code = `BOP-SA-${ymd}-${pad3(n)}`;
      const url = `${BASE}/${y}/${ymd}/${code}.pdf`;
      const text = await fetchPdfText(url, { insecure: true });
      if (!text) {
        misses++;
        continue;
      }
      misses = 0;
      const title = text.replace(/\s+/g, " ").trim().slice(0, 200) || code;
      out.push({
        externalId: code,
        title,
        searchText: text.slice(0, MAX_BODY_CHARS),
        url,
        publishedAt: date,
        actType: inferActType(title),
        region: "Salamanca",
      });
    }
    return out;
  },
};
