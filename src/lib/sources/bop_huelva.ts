/**
 * Adaptador del BOP de Huelva (21) — Diputación de Huelva, backend
 * `s2.diphuelva.es` (Domino/JSP). DOS sistemas con corte el 20-jun-2023:
 *
 * SISTEMA NUEVO (fecha >= 2023-06-20) — anuncio a anuncio, API JSON:
 *   POST /lib/bope/anuncios_bop/ajaxAnuncios.php
 *   body form-urlencoded: tipo=2 & fecha=YYYY-M-D   (mes y día SIN cero a la izq.)
 *   → JSON { success, num_bop, Anuncios:[{ id_anuncio, documento, titulo,
 *            entidad_anunciante, csv, ... }] }.
 *   PDF de cada anuncio (capa de texto): /portalweb/bope/anuncios/{documento}
 *   donde documento = "Anuncio_XXXXXX_BOP-{num}_{año}.pdf".
 *   1 NormalizedPublication por anuncio.
 *
 * SISTEMA LEGACY (fecha <= 2023-06-19) — boletín completo del día, 1 PDF:
 *   El boletín entero está en /portalweb/bop/boletines/{YYYYMMDD}-1.pdf
 *   (patrón fijo por fecha; el visor legacy solo lo embebe en un iframe).
 *   1 NormalizedPublication con el texto del boletín completo.
 *
 * Día sin boletín (finde/festivo): nuevo → success:false o sin Anuncios;
 * legacy → el PDF 404 → fetchPdfText null. En ambos casos return [].
 * externalId prefijado con el code y estable: "BOP_21-{id_anuncio}" (nuevo)
 * o "BOP_21-{YYYYMMDD}" (legacy, 1 doc/día).
 */

import {
  inferActType,
  NormalizedPublication,
  SourceAdapter,
} from "./types";
import {
  CONCURRENCY,
  fetchJson,
  fetchPdfText,
  isoDate,
  MAX_BODY_CHARS,
  mapPool,
  yyyymmdd,
} from "./util";

const CODE = "BOP_21";
const REGION = "Huelva";
const BASE = "https://s2.diphuelva.es";
const AJAX = `${BASE}/lib/bope/anuncios_bop/ajaxAnuncios.php`;
const ANUNCIO_DIR = `${BASE}/portalweb/bope/anuncios`;
const BOLETIN_DIR = `${BASE}/portalweb/bop/boletines`;

// Corte entre sistemas: el sistema nuevo cubre desde 2023-06-20 (inclusive).
const CUTOVER = "2023-06-20";

interface AjaxAnuncio {
  id_anuncio?: number | string;
  documento?: string;
  titulo?: string;
  entidad_anunciante?: string;
}

interface AjaxResponse {
  success?: boolean;
  num_bop?: string;
  Anuncios?: AjaxAnuncio[];
}

/** Fecha para el API nuevo: YYYY-M-D con mes y día SIN cero a la izquierda. */
function ymdNoPad(date: Date): string {
  return (
    date.getUTCFullYear() +
    "-" +
    (date.getUTCMonth() + 1) +
    "-" +
    date.getUTCDate()
  );
}

/** Sistema nuevo: 1 documento por anuncio, texto del PDF individual. */
async function fetchNuevo(date: Date): Promise<NormalizedPublication[]> {
  const json = (await fetchJson(AJAX, {
    method: "POST",
    body: { tipo: "2", fecha: ymdNoPad(date) },
  })) as AjaxResponse | null;

  if (!json || json.success !== true) return []; // sin boletín ese día
  const anuncios = (json.Anuncios ?? []).filter(
    (a): a is AjaxAnuncio & { id_anuncio: number | string; documento: string } =>
      a != null && a.id_anuncio != null && typeof a.documento === "string"
  );
  if (anuncios.length === 0) return [];

  const out: NormalizedPublication[] = [];
  await mapPool(anuncios, CONCURRENCY, async (a) => {
    const entidad = (a.entidad_anunciante ?? "").trim();
    const rawTitle = (a.titulo ?? "").trim();
    const title = (
      rawTitle || entidad || `BOP Huelva ${a.id_anuncio}`
    ).slice(0, 300);
    const url = `${ANUNCIO_DIR}/${a.documento}`;
    // Texto completo del anuncio (capa de texto, sin OCR). Si falla la red de
    // un anuncio concreto, lo saltamos: no tumbamos el día entero.
    const pdfText = await fetchPdfText(url);
    const searchText = `${entidad}\n${rawTitle}\n${pdfText ?? ""}`
      .trim()
      .slice(0, MAX_BODY_CHARS);
    if (!searchText) return;
    out.push({
      externalId: `${CODE}-${a.id_anuncio}`,
      title,
      searchText,
      url,
      publishedAt: date,
      actType: inferActType(title),
      region: REGION,
    });
  });
  return out;
}

/** Sistema legacy: 1 documento = boletín completo del día (patrón fijo). */
async function fetchLegacy(date: Date): Promise<NormalizedPublication[]> {
  const ymd = yyyymmdd(date);
  const url = `${BOLETIN_DIR}/${ymd}-1.pdf`;
  const text = await fetchPdfText(url);
  if (!text) return []; // finde/festivo/sin boletín → 404 → null
  const title = (
    text.replace(/\s+/g, " ").trim().slice(0, 200) || `BOP Huelva ${ymd}`
  ).slice(0, 300);
  return [
    {
      externalId: `${CODE}-${ymd}`,
      title,
      searchText: text.slice(0, MAX_BODY_CHARS),
      url,
      publishedAt: date,
      actType: inferActType(title),
      region: REGION,
    },
  ];
}

export const bopHuelvaAdapter: SourceAdapter = {
  code: CODE,
  name: "Boletín Oficial de la Provincia de Huelva",
  type: "BOP",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    return isoDate(date) >= CUTOVER ? fetchNuevo(date) : fetchLegacy(date);
  },
};
