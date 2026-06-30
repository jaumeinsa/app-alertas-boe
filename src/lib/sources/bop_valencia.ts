/**
 * Adaptador del BOP de Valencia (Diputación de València) — code `BOP_46`.
 *
 * Plataforma `bop.dival.es`. Todo en PDF con capa de texto (sin OCR):
 *   Sumario del día:  /bop/downloads?boletinFecha=DD/MM/YYYY   (PDF índice)
 *       → lista cada anuncio con su nº de registro "AAAA/NNNNN".
 *   Anuncio completo: /bop/downloads?anuncioNumReg=AAAA/NNNNN&lang=es  (PDF)
 *       → texto íntegro del anuncio. Aquí están los nombres/DNIs (multas,
 *         embargos, edictos, notificaciones) = lo que de verdad importa para
 *         el matching de personas.
 *
 * Estrategia: bajar el sumario, extraer los numReg (líneas que son EXACTAMENTE
 * un código, para no confundirlos con referencias inline a otros anuncios) y
 * descargar cada anuncio como un documento independiente con su texto completo.
 */

import { inferActType, NormalizedPublication, SourceAdapter } from "./types";
import {
  CONCURRENCY,
  ddmmyyyy,
  fetchPdfText,
  MAX_BODY_CHARS,
  mapPool,
} from "./util";

const DOWNLOAD = "https://bop.dival.es/bop/downloads";

/** numReg = línea que es EXACTAMENTE "AAAA/NNNNN" (descarta refs inline). */
function parseNumRegs(sumario: string): string[] {
  return Array.from(
    new Set(
      sumario
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => /^\d{4}\/\d{4,6}$/.test(l))
    )
  );
}

/** Título = texto entre el numReg y el comienzo del cuerpo del anuncio. */
function extractTitle(text: string, numReg: string): string {
  const idx = text.indexOf(numReg);
  const after = idx >= 0 ? text.slice(idx + numReg.length) : text;
  const cut = after.split(
    /\b(?:ANUNCIO|EDICTO|RESOLUCI[ÓO]N|ACUERDO|DECRETO)\b/
  )[0];
  const title = (cut || after).replace(/\s+/g, " ").trim().slice(0, 300);
  return title || `BOP Valencia ${numReg}`;
}

export const bopValenciaAdapter: SourceAdapter = {
  code: "BOP_46",
  name: "Boletín Oficial de la Provincia de Valencia",
  type: "BOP",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const fecha = ddmmyyyy(date, "/");
    const sumario = await fetchPdfText(`${DOWNLOAD}?boletinFecha=${fecha}`);
    if (!sumario) return []; // festivo/fin de semana o no hay boletín ese día

    const numRegs = parseNumRegs(sumario);
    if (numRegs.length === 0) return [];

    const out: NormalizedPublication[] = [];
    await mapPool(numRegs, CONCURRENCY, async (numReg) => {
      const url = `${DOWNLOAD}?anuncioNumReg=${encodeURIComponent(numReg)}&lang=es`;
      const text = await fetchPdfText(url);
      if (!text) return;
      const title = extractTitle(text, numReg);
      out.push({
        externalId: numReg,
        title,
        searchText: text.slice(0, MAX_BODY_CHARS),
        url,
        publishedAt: date,
        actType: inferActType(title),
        region: "Valencia",
      });
    });
    return out;
  },
};
