/**
 * Adaptador del BOCCE — Boletín Oficial de la Ciudad de Ceuta (51).
 *
 * Plataforma jDownloads sobre Joomla (`www.ceuta.es`). Todo por GET puro, sin
 * cookies ni JS. Jerarquía navegable: Sección BOCCE → categoría por AÑO →
 * subcategorías por MES → boletines (1 PDF por edición). Pipeline de fetchByDate:
 *
 *   1) Resolver AÑO→catId desde la página estable de la sección:
 *      GET /ceuta/documentos/secciones/bocces
 *      → enlaces `viewcategory/{catId}-{YYYY}` (se cachea por año).
 *   2) GET la categoría del año `viewcategory/{catId}?Itemid=534`
 *      → subcategorías de mes `viewcategory/{monthCatId}-{mes}` (mes en español).
 *   3) GET el mes `viewcategory/{monthCatId}-{mes}?Itemid=534`
 *      → enlaces de descarga directa
 *        `component/jdownloads/finish/{monthCatId}-{mes}/{fileId}-bocce-{variante?}-{DD-MM-YYYY}?Itemid=534`
 *      Filtrar por la {DD-MM-YYYY} de la fecha pedida y bajar cada PDF (capa de
 *      texto, sin OCR). El BOCCE es 1 documento por edición.
 *
 * Ceuta NO publica a diario (~2-4 ediciones/semana + extras/tributarios) y un
 * mismo día puede tener VARIAS ediciones (ordinaria + "extra"/"trib"): se emite
 * un NormalizedPublication por cada boletín de esa fecha. Días sin edición → [].
 * externalId = code + fileId (numérico, único y estable por edición).
 */

import {
  inferActType,
  NormalizedPublication,
  SourceAdapter,
} from "./types";
import { ddmmyyyy, fetchPdfText, fetchText, MAX_BODY_CHARS } from "./util";

const CODE = "BOP_51";
const REGION = "Ceuta";
const BASE = "https://www.ceuta.es/ceuta";
const SECTION_URL = `${BASE}/documentos/secciones/bocces`;
const ITEMID = "534";

// Nombre del mes en español (1=enero ... 12=diciembre) tal como aparece en el
// slug de las subcategorías de mes.
const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

// Caché AÑO→catId (la página de la sección lista todos los años; se resuelve una
// vez por año y se reutiliza en el resto del backfill).
const yearCatCache = new Map<number, string>();

/** Resuelve el catId de la categoría de un año desde la página de la sección. */
async function resolveYearCatId(year: number): Promise<string | null> {
  const cached = yearCatCache.get(year);
  if (cached) return cached;
  const html = await fetchText(SECTION_URL);
  if (!html) return null;
  // Rellenar la caché con TODOS los años presentes (una sola descarga sirve para
  // todo el rango). Enlaces: viewcategory/{catId}-{YYYY}
  const re = /viewcategory\/(\d+)-((?:19|20)\d{2})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const y = parseInt(m[2], 10);
    if (!yearCatCache.has(y)) yearCatCache.set(y, m[1]);
  }
  return yearCatCache.get(year) ?? null;
}

/** Localiza el catId de la subcategoría del mes dentro de la categoría del año. */
async function resolveMonthCatId(
  yearCatId: string,
  monthName: string
): Promise<string | null> {
  const html = await fetchText(
    `${BASE}/component/jdownloads/viewcategory/${yearCatId}?Itemid=${ITEMID}`
  );
  if (!html) return null;
  // viewcategory/{monthCatId}-{mes}
  const re = new RegExp(`viewcategory/(\\d+)-${monthName}\\b`, "i");
  const m = re.exec(html);
  return m ? m[1] : null;
}

interface CeutaBoletin {
  fileId: string;
  slug: string; // p.ej. "bocce-6631-03-07-2026" o "bocce-extra37-19-06-2023"
  url: string; // URL de descarga directa del PDF
}

/**
 * Extrae del HTML del mes los boletines cuya fecha (DD-MM-YYYY al final del slug)
 * coincide con `dmy`. Formato del enlace:
 *   component/jdownloads/finish/{monthCatId}-{mes}/{fileId}-bocce-...-{DD-MM-YYYY}?...
 */
function parseMonth(html: string, dmy: string): CeutaBoletin[] {
  const out: CeutaBoletin[] = [];
  const seen = new Set<string>();
  const re =
    /component\/jdownloads\/finish\/[^"'\s]+?\/(\d+)-(bocce-[a-z0-9]*-?\d{2}-\d{2}-\d{4})(\?[^"'\s]*)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const fileId = m[1];
    const slug = m[2];
    // La fecha es siempre el sufijo DD-MM-YYYY del slug.
    if (!slug.endsWith(`-${dmy}`)) continue;
    if (seen.has(fileId)) continue;
    seen.add(fileId);
    out.push({
      fileId,
      slug,
      url: `${BASE}/${m[0].replace(/&amp;/g, "&")}`,
    });
  }
  return out;
}

/** Título legible a partir del slug (nº de boletín / extra / tributario). */
function titleFromSlug(slug: string, dmy: string): string {
  const ref = slug.replace(/^bocce-/, "").replace(/-\d{2}-\d{2}-\d{4}$/, "");
  const kind = /^extra/i.test(ref)
    ? "extraordinario"
    : /^trib/i.test(ref)
      ? "tributario"
      : "ordinario";
  const num = ref.replace(/^(extra|trib)/i, "");
  return `BOCCE Ceuta ${kind} nº ${num} (${dmy})`;
}

export const bopCeutaAdapter: SourceAdapter = {
  code: CODE,
  name: "Boletín Oficial de la Ciudad de Ceuta",
  type: "BOP",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const year = date.getUTCFullYear();
    const monthName = MONTHS[date.getUTCMonth()];
    const dmy = ddmmyyyy(date); // DD-MM-YYYY

    const yearCatId = await resolveYearCatId(year);
    if (!yearCatId) return [];

    const monthCatId = await resolveMonthCatId(yearCatId, monthName);
    if (!monthCatId) return []; // mes sin categoría (año en curso aún sin ese mes)

    const monthHtml = await fetchText(
      `${BASE}/component/jdownloads/viewcategory/${monthCatId}-${monthName}?Itemid=${ITEMID}`
    );
    if (!monthHtml) return [];

    const boletines = parseMonth(monthHtml, dmy);
    if (boletines.length === 0) return []; // día sin edición (normal en Ceuta)

    const out: NormalizedPublication[] = [];
    // Secuencial: el BOCCE completo puede pesar 0,4-2,2 MB; evitamos apretar la
    // sede. Un PDF que falle no debe tumbar el día → se salta.
    for (const b of boletines) {
      const title = titleFromSlug(b.slug, dmy);
      const text = await fetchPdfText(b.url);
      out.push({
        externalId: `${CODE}-${b.fileId}`,
        title: title.slice(0, 300),
        searchText: (text ?? title).slice(0, MAX_BODY_CHARS),
        url: b.url,
        publishedAt: date,
        actType: inferActType(text ? `${title} ${text.slice(0, 500)}` : title),
        region: REGION,
      });
    }
    return out;
  },
};
