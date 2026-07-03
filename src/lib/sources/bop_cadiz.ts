/**
 * Adaptador del BOP de Cádiz (11) — sede `www.bopcadiz.es` (OpenCms + Volterra).
 *
 * Cádiz publica el boletín como UN PDF completo por día (no anuncio a anuncio),
 * así que se ingiere como 1 documento/día con el texto íntegro del PDF.
 *
 * Pipeline fetchByDate(date):
 *   1) GET al calendario mensual (JSON-ish embebido en HTML) que mapea
 *      fecha → nº de boletín:
 *        /system/modules/es.dipucadiz.bop/elements/innerquery.jsp?anno=YYYY&mes=MM
 *      Devuelve bloques <div id="element_N"> con
 *        <h3><a href='/boletin/Boletin-numero-{NNN}-del-ano-{YYYY}/'>...</a></h3>
 *        <p class="fechaEvento">25/06/2026 08:00</p>
 *      (la sede negocia el formato de fecha: Node recibe DD/MM/YYYY; curl recibe
 *      el formato Date de Java "Thu Jun 25 08:00:00 CEST 2026". Soportamos ambos.)
 *      El nº de boletín viene con CEROS a la izquierda (030, 112, 120) y esos
 *      ceros son OBLIGATORIOS en la URL del PDF (BOP30_... da 404).
 *   2) Se busca el bloque cuya fecha (día/mes/año en inglés) coincide con la
 *      fecha pedida. Si no hay ninguno → ese día no hubo boletín → return [].
 *   3) Se construye la URL del PDF completo (302 → seguir con redirect):
 *        /.boletines_pdf/{YYYY}/{MM}_{mes-palabra}/BOP{NNN}_{DD-MM-YY}.pdf
 *      (meses: 01_enero ... 12_diciembre). El PDF tiene capa de texto.
 *
 * externalId = "BOP_11-{YYYY}-{NNN}" (año + nº de boletín, estable y único).
 * Verificado con curl: 25-06-2026=BOP120, 15-06-2023=BOP112, 13-02-2020=BOP030.
 */

import {
  inferActType,
  NormalizedPublication,
  SourceAdapter,
} from "./types";
import { fetchPdfText, fetchText, MAX_BODY_CHARS } from "./util";

const BASE = "https://www.bopcadiz.es";

// Nombres de mes en la carpeta del PDF (índice 1 = enero).
const MES_PALABRA = [
  "",
  "01_enero",
  "02_febrero",
  "03_marzo",
  "04_abril",
  "05_mayo",
  "06_junio",
  "07_julio",
  "08_agosto",
  "09_septiembre",
  "10_octubre",
  "11_noviembre",
  "12_diciembre",
];

// Abreviaturas de mes en inglés por si el servidor negocia el formato largo
// "Www Mmm DD HH:MM:SS TZ YYYY" (lo hace con algunos clientes/idiomas).
const EN_MONTH: Record<string, number> = {
  Jan: 1,
  Feb: 2,
  Mar: 3,
  Apr: 4,
  May: 5,
  Jun: 6,
  Jul: 7,
  Aug: 8,
  Sep: 9,
  Oct: 10,
  Nov: 11,
  Dec: 12,
};

/**
 * Extrae del calendario mensual el nº de boletín (con ceros) para un día dado.
 * Devuelve null si ese día no aparece (no hubo boletín).
 *
 * OJO: la sede sirve la fecha de `fechaEvento` en DOS formatos según el cliente:
 *   - "25/06/2026 08:00"                      (DD/MM/YYYY — lo que recibe Node)
 *   - "Thu Jun 25 08:00:00 CEST 2026"         (formato Date de Java en inglés)
 * Soportamos ambos. Cada tarjeta:
 *   <h3><a href='/boletin/Boletin-numero-NNN-del-ano-YYYY/'>...</a></h3>
 *   ... <p class="fechaEvento">FECHA</p>
 */
function findBoletinNumber(
  html: string,
  year: number,
  month: number,
  day: number
): string | null {
  const blockRe =
    /Boletin-numero-(\d+)-del-ano-(\d{4})[\s\S]*?fechaEvento[^>]*>(?:<span>[^<]*<\/span>)?\s*([^<]+?)<\/p>/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html))) {
    const num = m[1];
    if (fechaMatches(m[3], year, month, day)) {
      return num; // conserva los ceros a la izquierda tal cual vienen
    }
  }
  return null;
}

/** ¿La cadena de fecha (cualquiera de los dos formatos) es el día pedido? */
function fechaMatches(
  raw: string,
  year: number,
  month: number,
  day: number
): boolean {
  const s = raw.trim();
  // Formato DD/MM/YYYY.
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (slash) {
    return (
      parseInt(slash[1], 10) === day &&
      parseInt(slash[2], 10) === month &&
      parseInt(slash[3], 10) === year
    );
  }
  // Formato Java "Www Mmm DD HH:MM:SS TZ YYYY".
  const eng = /^[A-Za-z]{3}\s+([A-Za-z]{3})\s+(\d{1,2})\s+[\d:]+\s+\w+\s+(\d{4})/.exec(
    s
  );
  if (eng) {
    return (
      EN_MONTH[eng[1]] === month &&
      parseInt(eng[2], 10) === day &&
      parseInt(eng[3], 10) === year
    );
  }
  return false;
}

export const bopCadizAdapter: SourceAdapter = {
  code: "BOP_11",
  name: "Boletín Oficial de la Provincia de Cádiz",
  type: "BOP",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1; // 1-based
    const day = date.getUTCDate();
    const mm = String(month).padStart(2, "0");

    // 1) Calendario mensual → nº de boletín del día.
    // insecure:true: la cadena de certificado de www.bopcadiz.es la rechaza Node
    // (UNABLE_TO_VERIFY_LEAF_SIGNATURE) aunque curl la acepte.
    const calUrl = `${BASE}/system/modules/es.dipucadiz.bop/elements/innerquery.jsp?anno=${year}&mes=${mm}`;
    const html = await fetchText(calUrl, { insecure: true });
    if (!html) return [];

    const num = findBoletinNumber(html, year, month, day);
    if (!num) return []; // sin boletín ese día (finde/festivo/no publicado)

    // 2) URL del PDF completo del boletín.
    const dd = String(day).padStart(2, "0");
    const yy = String(year).slice(2);
    const pdfName = `BOP${num}_${dd}-${mm}-${yy}.pdf`;
    const pdfUrl = `${BASE}/.boletines_pdf/${year}/${MES_PALABRA[month]}/${pdfName}`;

    const text = await fetchPdfText(pdfUrl, { insecure: true });
    if (!text) return []; // PDF no disponible → no tumbar el día

    // Título a partir de las primeras líneas del PDF (sumario/cabecera).
    const firstLine =
      text.replace(/\s+/g, " ").trim().slice(0, 250) ||
      `Boletín Oficial de la Provincia de Cádiz nº ${num} (${dd}-${mm}-${year})`;
    const title =
      `BOP Cádiz nº ${num} — ${firstLine}`.slice(0, 300);

    return [
      {
        externalId: `BOP_11-${year}-${num}`,
        title,
        searchText: text.slice(0, MAX_BODY_CHARS),
        url: pdfUrl,
        publishedAt: date,
        actType: inferActType(title),
        region: "Cádiz",
      },
    ];
  },
};
