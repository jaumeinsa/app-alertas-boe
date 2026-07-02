/**
 * Factory de BOPs sobre OpenCms/SagaSuite (Diputaciones de Granada y Sevilla)
 * — exporta `bopGranadaAdapter` (BOP_18) y `bopSevillaAdapter` (BOP_41).
 *
 * Época MODERNA (Granada ≥ 2024-07-01, Sevilla ≥ 2022-12-01):
 *   1) Sumario HTML del día (404 = sin boletín, finde/festivo):
 *        https://{HOST}/publica/consulta-de-bops/buscador/BOP-{DD}-{MM}-{YYYY}/
 *      → todos los anuncios vienen embebidos como <li class="elementoListado">
 *        con el slug del detalle, título (h3.titulo_elemento), organismo
 *        (.campo_1 .container) y CVE (.campo_3, p.ej. BOP-GRA-2026-120001
 *        / BOP-SE-2026-121001) que usamos como externalId.
 *   2) Detalle HTML del anuncio (NO contiene el cuerpo) → de él se extrae la
 *      URL del PDF firmado: /export/sites/bop/.galleries/Documentos-Anuncios-en-PDF/*.pdf
 *   3) PDF → texto (capa de texto). OJO Sevilla: muchos PDFs recientes son
 *      vectoriales SIN capa de texto; si el texto útil (quitando cabeceras
 *      "Página X", CVEs, URLs) queda corto se indexa título+organismo y se
 *      sigue (no es un error).
 *
 * Época LEGADO (fechas anteriores al corte; 1 PDF/día = 1 documento, mismo
 * enfoque que bop_daypdf):
 *   · GRANADA: https://bop.dipgra.es/export/sites/bop/publica/boletines-anteriores/
 *       .galleries/Boletines-Anteriores/{YYYYMMDD}-{YYYY}{NNN}.pdf
 *     donde NNN = nº correlativo del boletín en el año (3 dígitos) y NO hay
 *     índice fecha→NNN. Se sondea: caché del último NNN por año (el siguiente
 *     día hábil suele ser NNN+1) y, en frío, estimación por nº de día hábil
 *     del año ± ventana. 404 en todos los candidatos = día sin boletín.
 *   · SEVILLA: handler de fecha (mes/día SIN cero inicial):
 *       https://www.dipusevilla.es/system/modules/com.saga.sagasuite.theme
 *         .diputacion.sevilla.corporativo/handlers/search-bop-date.jsp?date={YYYY}-{M}-{D}
 *     → href /bop/download-bop.pdf?id={uuid} → PDF diario con capa de texto.
 *   externalId legado = {code}-{YYYYMMDD}.
 */

import {
  inferActType,
  NormalizedPublication,
  SourceAdapter,
} from "./types";
import {
  CONCURRENCY,
  ddmmyyyy,
  fetchPdfText,
  fetchText,
  MAX_BODY_CHARS,
  mapPool,
  stripHtml,
  yyyymmdd,
} from "./util";

const PDF_RE =
  /\/export\/sites\/bop\/\.galleries\/Documentos-Anuncios-en-PDF\/[^"?]+\.pdf/;

function firstGroup(re: RegExp, s: string): string {
  const m = s.match(re);
  return m ? m[1] : "";
}

/* ------------------------------ época moderna ------------------------------ */

interface SumarioItem {
  slug: string;
  title: string;
  organismo: string;
  externalId: string;
}

/** Parsea los <li class="elementoListado"> del sumario del día. */
function parseSumario(html: string): SumarioItem[] {
  const out: SumarioItem[] = [];
  const seen = new Set<string>();
  for (const chunk of html.split(/<li\s+class="elementoListado/).slice(1)) {
    const block = chunk.split("</li>")[0];
    const slug = firstGroup(
      /href="(\/publica\/buscador-anuncios\/anuncio\/[^"]+)"/,
      block
    );
    if (!slug) continue;
    const title = stripHtml(
      firstGroup(/<h3 class="titulo_elemento">([\s\S]*?)<\/h3>/, block) ||
        firstGroup(/title="([^"]*)"/, block)
    );
    const organismo = stripHtml(
      firstGroup(/campo_1">\s*<div class="container">([\s\S]*?)<\/div>/, block)
    );
    // CVE (BOP-GRA-2026-120001 / BOP-SE-...). Fallback: último tramo del slug.
    const cve = firstGroup(/campo_3">\s*([^<]+?)\s*</, block).replace(/\s+/g, "");
    const externalId =
      cve || slug.split("/").filter(Boolean).pop() || slug;
    if (seen.has(externalId)) continue;
    seen.add(externalId);
    out.push({ slug, title, organismo, externalId });
  }
  return out;
}

/**
 * Longitud "útil" del texto de un PDF: sin cabeceras de página, CVEs, URLs,
 * dígitos ni puntuación. Si queda corto es un PDF vectorial sin capa de texto
 * real (frecuente en Sevilla) → mejor indexar solo título+organismo.
 */
function usefulLength(text: string): number {
  return text
    .replace(/P[áa]gina\s+\d+(\s+de\s+\d+)?/gi, " ")
    .replace(/BOP-[A-Z]{2,4}-\d{4}-\d+/g, " ")
    .replace(/Bolet[íi]n\s+Oficial\s+de\s+la\s+provincia\s+de\s+\S+/gi, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[\s\d.,;:/()\-–—·|]+/g, "").length;
}

/* ------------------------------- época legado ------------------------------ */

/** Documento único del día a partir del PDF completo del boletín. */
function dayPdfDoc(
  code: string,
  region: string,
  date: Date,
  url: string,
  text: string
): NormalizedPublication {
  const ymd = yyyymmdd(date);
  const title =
    text.replace(/\s+/g, " ").trim().slice(0, 300) || `${code} ${ymd}`;
  return {
    externalId: `${code}-${ymd}`,
    title,
    searchText: text.slice(0, MAX_BODY_CHARS),
    url,
    publishedAt: date,
    actType: inferActType(title),
    region,
  };
}

/** Nº estimado de boletín de Granada: días hábiles del año menos ~8 festivos. */
function estimateGranadaNNN(date: Date): number {
  const y = date.getUTCFullYear();
  let weekdays = 0;
  for (let t = Date.UTC(y, 0, 1); t <= date.getTime(); t += 86_400_000) {
    const dow = new Date(t).getUTCDay();
    if (dow !== 0 && dow !== 6) weekdays++;
  }
  const dayOfYear =
    Math.floor((date.getTime() - Date.UTC(y, 0, 1)) / 86_400_000) + 1;
  return Math.max(1, weekdays - Math.round((dayOfYear / 365) * 8));
}

/** center, center+1, center-1, center+2, … (clamp ≥ 1). */
function outwardCandidates(center: number, radius: number): number[] {
  const out = [center];
  for (let i = 1; i <= radius; i++) {
    out.push(center + i);
    if (center - i >= 1) out.push(center - i);
  }
  return out;
}

const GRA_LEGACY_BASE =
  "https://bop.dipgra.es/export/sites/bop/publica/boletines-anteriores/.galleries/Boletines-Anteriores";

// Último (fecha, NNN) acertado por año: en un backfill ascendente el siguiente
// día hábil es casi siempre NNN+1 y solo la primera fecha paga el sondeo amplio.
const graLastHit = new Map<number, { ymd: string; nnn: number }>();

async function granadaLegacyFetch(date: Date): Promise<NormalizedPublication[]> {
  const y = date.getUTCFullYear();
  const ymd = yyyymmdd(date);
  const hit = graLastHit.get(y);
  let candidates: number[];
  if (hit && ymd === hit.ymd) {
    candidates = [hit.nnn];
  } else if (hit && ymd > hit.ymd) {
    candidates = [1, 2, 3, 4, 5, 6].map((i) => hit.nnn + i);
  } else {
    candidates = outwardCandidates(estimateGranadaNNN(date), 10);
  }
  for (const nnn of candidates) {
    const url = `${GRA_LEGACY_BASE}/${ymd}-${y}${String(nnn).padStart(3, "0")}.pdf`;
    const text = await fetchPdfText(url);
    if (!text) continue; // 404/no-PDF → probar siguiente candidato
    graLastHit.set(y, { ymd, nnn });
    return [dayPdfDoc("BOP_18", "Granada", date, url, text)];
  }
  return []; // sin boletín ese día (o NNN fuera de la ventana de sondeo)
}

const SEV_LEGACY_SEARCH =
  "https://www.dipusevilla.es/system/modules/com.saga.sagasuite.theme.diputacion.sevilla.corporativo/handlers/search-bop-date.jsp";

async function sevillaLegacyFetch(date: Date): Promise<NormalizedPublication[]> {
  // mes y día SIN cero inicial (el handler no reconoce "02")
  const q = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`;
  const html = await fetchText(`${SEV_LEGACY_SEARCH}?date=${q}`);
  const id = html?.match(/\/bop\/download-bop\.pdf\?id=([\w-]+)/)?.[1];
  if (!id) return []; // sin boletín ese día
  const url = `https://www.dipusevilla.es/bop/download-bop.pdf?id=${id}`;
  const text = await fetchPdfText(url);
  if (!text) return [];
  return [dayPdfDoc("BOP_41", "Sevilla", date, url, text)];
}

/* --------------------------------- factory --------------------------------- */

interface OpenCmsBopConfig {
  code: string;
  name: string;
  region: string;
  /** Host del buscador moderno (OpenCms). */
  host: string;
  /** Primera fecha (YYYYMMDD) cubierta por el buscador moderno. */
  modernSince: string;
  /** Estrategia para fechas anteriores al corte. */
  legacy: (date: Date) => Promise<NormalizedPublication[]>;
}

function makeOpenCmsBop(cfg: OpenCmsBopConfig): SourceAdapter {
  return {
    code: cfg.code,
    name: cfg.name,
    type: "BOP",
    enabled: true,

    async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
      if (yyyymmdd(date) < cfg.modernSince) return cfg.legacy(date);

      const sumario = await fetchText(
        `https://${cfg.host}/publica/consulta-de-bops/buscador/BOP-${ddmmyyyy(date, "-")}/`
      );
      if (!sumario) return []; // 404 = sin boletín (finde/festivo)

      const items = parseSumario(sumario);
      if (items.length === 0) return [];

      const out: NormalizedPublication[] = [];
      await mapPool(items, CONCURRENCY, async (item) => {
        const pubUrl = `https://${cfg.host}${item.slug}`;
        let body = "";
        const detail = await fetchText(pubUrl);
        const pdfPath = detail?.match(PDF_RE)?.[0];
        if (pdfPath) {
          body = (await fetchPdfText(`https://${cfg.host}${pdfPath}`)) ?? "";
        }
        // PDF vectorial sin capa de texto o PDF caído → título+organismo.
        if (usefulLength(body) < 100) body = "";
        const title = (item.title || `${cfg.name} ${item.externalId}`).slice(0, 300);
        out.push({
          externalId: item.externalId,
          title,
          searchText: [item.title, item.organismo, body]
            .filter(Boolean)
            .join("\n")
            .slice(0, MAX_BODY_CHARS),
          url: pubUrl,
          publishedAt: date,
          actType: inferActType(title),
          region: cfg.region,
        });
      });
      return out;
    },
  };
}

export const bopGranadaAdapter: SourceAdapter = makeOpenCmsBop({
  code: "BOP_18",
  name: "Boletín Oficial de la Provincia de Granada",
  region: "Granada",
  host: "bop.dipgra.es",
  modernSince: "20240701",
  legacy: granadaLegacyFetch,
});

export const bopSevillaAdapter: SourceAdapter = makeOpenCmsBop({
  code: "BOP_41",
  name: "Boletín Oficial de la Provincia de Sevilla",
  region: "Sevilla",
  host: "bopsevilla.dipusevilla.es",
  modernSince: "20221201",
  legacy: sevillaLegacyFetch,
});
