/**
 * Palencia (BOP_34) y Zamora (BOP_49): BOPs con solo PDF diario cuyo nombre
 * lleva fecha+NN. Ver factory en bop_daypdf.ts. 1 doc/día, texto completo.
 */

import { makeDayPdfNnBop } from "./bop_daypdf";

export const bopPalenciaAdapter = makeDayPdfNnBop({
  code: "BOP_34",
  name: "Boletín Oficial de la Provincia de Palencia",
  region: "Palencia",
  urlFor: (y, ymd, nn) =>
    `https://www.diputaciondepalencia.es/system/files/bop/${y}/${ymd}-bop-${nn}-Ordinario.pdf`,
});

export const bopZamoraAdapter = makeDayPdfNnBop({
  code: "BOP_49",
  name: "Boletín Oficial de la Provincia de Zamora",
  region: "Zamora",
  insecure: true, // cert con cadena incompleta
  urlFor: (y, ymd, nn) =>
    `https://www.diputaciondezamora.es/opencms/export/sites/dipu-zamora/servicios/BOP/.Archivos/documentos/BOP/${y}/${ymd}-${nn}.pdf`,
});
