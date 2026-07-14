/**
 * Adaptador del BOP de Guadalajara — code `BOP_19`.
 *
 * Plataforma Joomla + K2. Todo por GET. Dos saltos por anuncio:
 *   1. Sumario del día (HTML, paginado de 6 en 6 con ?start=N):
 *        /boletin/index.php/buscar-k2-menu/date/{YYYY}/{M}/{D}   (mes y día SIN cero inicial)
 *      → items de anuncio  /boletin/index.php/buscar-k2-menu/1-anuncio/{ITEMID}-{slug}
 *        (se ignora el item "9-general", que es el boletín completo en un solo PDF).
 *   2. Página de detalle del item K2 (HTML) → enlace al PDF del anuncio:
 *        /boletin/pdf/pdf{YYYY}_{NNNN}.pdf   (NNNN es un contador interno, NO el ITEMID).
 * Texto = fetchPdfText del PDF (tiene capa de texto nativa, sin OCR).
 * externalId = {YYYY}_{NNNN}. Día sin boletín → [].
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

const BASE = "https://boletin.dguadalajara.es/boletin";
const PAGE_SIZE = 6;
// Tope de seguridad: un BOP provincial no supera unas decenas de anuncios/día.
const MAX_PAGES = 40;

// Item de anuncio en el sumario: /buscar-k2-menu/1-anuncio/{ITEMID}-{slug}
// El primer segmento numérico ("1-anuncio") es el catid; el ITEMID es el que
// sigue. Se excluye el item "9-general" (boletín completo) por no casar aquí.
const ITEM_RE =
  /\/boletin\/index\.php\/buscar-k2-menu\/\d+-anuncio\/(\d+)-/gi;

// Enlace al PDF del anuncio dentro de su página de detalle.
const PDF_RE = /\/boletin\/pdf\/pdf(\d{4})_(\d+)\.pdf/i;

// La cabecera de todos los PDF repite el membrete del boletín y dos líneas de
// fecha ("BOP de Guadalajara, nº. NN, fecha: ... de AAAA"). El asunto real del
// anuncio empieza justo después. Se recorta para que title/inferActType usen el
// texto útil y no el membrete común a todos los anuncios.
const HEADER_RE =
  /^[\s\S]*?BOP de Guadalajara,\s*n[ºo°]?\.?\s*\d+,\s*fecha:[^\n]*\n/i;

/** Devuelve el asunto del anuncio saltando el membrete de cabecera del PDF. */
function bodyAfterHeader(text: string): string {
  return text.replace(HEADER_RE, "").trim() || text;
}

export const bopGuadalajaraAdapter: SourceAdapter = {
  code: "BOP_19",
  name: "Boletín Oficial de la Provincia de Guadalajara",
  type: "BOP",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    // Mes y día SIN cero inicial (formato de las rutas de fecha de K2).
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth() + 1;
    const d = date.getUTCDate();
    const dayUrl = `${BASE}/index.php/buscar-k2-menu/date/${y}/${m}/${d}`;

    // Recorre las páginas del sumario acumulando ITEMIDs de anuncio hasta que
    // una página no aporte ninguno nuevo (o se llegue al tope de seguridad).
    const itemIds: string[] = [];
    const seenItems = new Set<string>();
    for (let page = 0; page < MAX_PAGES; page++) {
      const url = page === 0 ? dayUrl : `${dayUrl}?start=${page * PAGE_SIZE}`;
      const html = await fetchText(url);
      if (!html) break;
      let m2: RegExpExecArray | null;
      let added = 0;
      ITEM_RE.lastIndex = 0;
      while ((m2 = ITEM_RE.exec(html))) {
        const id = m2[1];
        if (seenItems.has(id)) continue;
        seenItems.add(id);
        itemIds.push(id);
        added++;
      }
      // Sin anuncios en la primera página → día sin boletín. En páginas
      // siguientes, sin anuncios nuevos → fin de la paginación.
      if (added === 0) break;
    }
    if (itemIds.length === 0) return [];

    // Cada anuncio: abrir su página de detalle, extraer el PDF y su texto.
    const out: NormalizedPublication[] = [];
    await mapPool(itemIds, CONCURRENCY, async (itemId) => {
      const detailUrl = `${BASE}/index.php/buscar-k2-menu/1-anuncio/${itemId}-x`;
      const detail = await fetchText(detailUrl);
      if (!detail) return;
      const pm = PDF_RE.exec(detail);
      if (!pm) return;
      const externalId = `${pm[1]}_${pm[2]}`;
      const pdfUrl = `${BASE}/pdf/pdf${externalId}.pdf`;

      const text = await fetchPdfText(pdfUrl);
      if (!text) return;
      const title =
        bodyAfterHeader(text).replace(/\s+/g, " ").trim().slice(0, 300) ||
        externalId;
      out.push({
        externalId,
        title,
        searchText: text.slice(0, MAX_BODY_CHARS),
        url: pdfUrl,
        publishedAt: date,
        actType: inferActType(title),
        region: "Guadalajara",
      });
    });
    return out;
  },
};
