/**
 * Adaptador del BOME (Boletín Oficial de Melilla) — code `BOP_52`.
 *
 * Plataforma propia `bomemelilla.es` (HTML server-rendered, sin sesión).
 * Sale martes y viernes, más extraordinarios. Pipeline (2 + N GET):
 *   1) Calendario del mes (JSON, cacheado):
 *        /api/bomes/calendar?start=YYYY-MM-01&end=YYYY-MM-{último día}
 *        → [{ start:"YYYY-MM-DD", url:"/bome/BOME-B-YYYY-NNNN" }, …]
 *          (ordinario BOME-B-…, extraordinario BOME-BX-…). Día sin entrada
 *          = sin boletín (finde/festivo) → [].
 *   2) Sumario del boletín: /bome/{BOME-B-YYYY-NNNN} (HTML) → cada anuncio
 *      en <ul class="articulo-list"> con su CVE "(CVE: BOME-A-YYYY-NNN)",
 *      título en el <blockquote> siguiente y enlace a la vista web
 *      /bome/{boletín}/articulo/{N}. El organismo emisor va en el
 *      <h4 class="text-uppercase h5"> del bloque que le precede.
 *   3) Texto completo: /bome/{boletín}/articulo/{N} (HTML) → el cuerpo
 *      íntegro (con nombres de personas) va tras el ancla
 *      id="bome-show-articulo-content" y termina en el <footer>.
 *      PDF de respaldo: /bome/descargar/{CVE}.pdf.
 *
 * externalId = CVE (p.ej. BOME-A-2026-720), único y estable.
 */

import { inferActType, NormalizedPublication, SourceAdapter } from "./types";
import {
  CONCURRENCY,
  fetchJson,
  fetchPdfText,
  fetchText,
  isoDate,
  MAX_BODY_CHARS,
  mapPool,
  stripHtml,
} from "./util";

const BASE = "https://bomemelilla.es";

interface CalEntry {
  dayIso: string;
  code: string; // BOME-B-YYYY-NNNN | BOME-BX-YYYY-NN
}

// Calendario mensual cacheado (el backfill recorre un mes muchas veces).
const monthCache = new Map<string, CalEntry[]>();

async function getMonth(year: number, month: number): Promise<CalEntry[]> {
  const key = `${year}-${month}`;
  const cached = monthCache.get(key);
  if (cached) return cached;
  const mm = String(month).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const json = (await fetchJson(
    `${BASE}/api/bomes/calendar?start=${year}-${mm}-01&end=${year}-${mm}-${lastDay}`
  )) as Array<{ start?: string; url?: string }> | null;
  const arr: CalEntry[] = [];
  for (const b of json ?? []) {
    const m = /\/bome\/(BOME-BX?-\d{4}-\d+)/.exec(b.url ?? "");
    if (m && b.start) arr.push({ dayIso: b.start, code: m[1] });
  }
  // No cachear si la petición falló (json null): un [] real sí es cacheable.
  if (json !== null) monthCache.set(key, arr);
  return arr;
}

interface BomeArticle {
  cve: string; // BOME-A-YYYY-NNN | BOME-AX-YYYY-NN
  titulo: string;
  organismo: string;
  /** URL pública: vista web /articulo/ o, si no existiera, el propio boletín. */
  url: string;
  hasWebView: boolean;
}

/**
 * Extrae los anuncios del sumario HTML de un boletín. Trocea el documento por
 * apariciones de "(CVE: ...)" para que el título y el enlace de cada anuncio
 * se busquen SOLO dentro de su bloque (sin sangrar al siguiente anuncio).
 */
function parseSumario(html: string, bulletinUrl: string): BomeArticle[] {
  // Posiciones de los organismos para asignar a cada anuncio el último
  // <h4 class="text-uppercase h5"> que le precede en el documento.
  const orgs: Array<{ pos: number; name: string }> = [];
  const orgRe = /<h4 class="text-uppercase h5">([\s\S]*?)<\/h4>/g;
  let om: RegExpExecArray | null;
  while ((om = orgRe.exec(html))) {
    orgs.push({ pos: om.index, name: stripHtml(om[1]) });
  }

  // Posiciones de cada CVE (delimitan los bloques de anuncio).
  const marks: Array<{ pos: number; cve: string }> = [];
  const cveRe = /\(CVE:\s*(BOME-AX?-\d{4}-\d+)\)/g;
  let cm: RegExpExecArray | null;
  while ((cm = cveRe.exec(html))) {
    marks.push({ pos: cm.index, cve: cm[1] });
  }

  const out: BomeArticle[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < marks.length; i++) {
    const { pos, cve } = marks[i];
    if (seen.has(cve)) continue;
    seen.add(cve);
    const chunk = html.slice(pos, i + 1 < marks.length ? marks[i + 1].pos : undefined);
    const bq = /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/.exec(chunk);
    const link = /href='?\/bome\/(BOME-BX?-\d{4}-\d+)\/articulo\/(\d+)'?/.exec(chunk);
    let organismo = "";
    for (const o of orgs) {
      if (o.pos < pos) organismo = o.name;
      else break;
    }
    out.push({
      cve,
      titulo: bq ? stripHtml(bq[1]) : "",
      organismo,
      url: link ? `${BASE}/bome/${link[1]}/articulo/${link[2]}` : bulletinUrl,
      hasWebView: !!link,
    });
  }
  return out;
}

/** Cuerpo completo de un anuncio: vista web HTML, con PDF de respaldo. */
async function fetchArticleText(a: BomeArticle): Promise<string> {
  const html = a.hasWebView ? await fetchText(a.url) : null;
  if (html) {
    let start = html.indexOf('id="bome-show-articulo-content"');
    if (start < 0) start = html.indexOf("DESCARGAR ART"); // marcador de respaldo
    if (start >= 0) {
      let rest = html.slice(start);
      // El ancla cae en mitad de una etiqueta: saltar hasta cerrar el tag para
      // que stripHtml no cuele el atributo como texto.
      const gt = rest.indexOf(">");
      if (gt >= 0) rest = rest.slice(gt + 1);
      const end = rest.indexOf("<footer");
      const body = stripHtml(end > 0 ? rest.slice(0, end) : rest);
      if (body.length > 50) return body;
    }
  }
  return (await fetchPdfText(`${BASE}/bome/descargar/${a.cve}.pdf`)) ?? "";
}

export const bopMelillaAdapter: SourceAdapter = {
  code: "BOP_52",
  name: "Boletín Oficial de Melilla (BOME)",
  type: "BOP",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const iso = isoDate(date);
    const boletines = (
      await getMonth(date.getUTCFullYear(), date.getUTCMonth() + 1)
    ).filter((b) => b.dayIso === iso);
    if (boletines.length === 0) return []; // sin boletín ese día

    // Sumarios (ordinario + extraordinarios del día).
    const articles: BomeArticle[] = [];
    for (const b of boletines) {
      const bulletinUrl = `${BASE}/bome/${b.code}`;
      const html = await fetchText(bulletinUrl);
      if (!html) continue; // fallo puntual de un boletín: no tumbar el día
      articles.push(...parseSumario(html, bulletinUrl));
    }

    const out: NormalizedPublication[] = [];
    await mapPool(articles, CONCURRENCY, async (a) => {
      const texto = await fetchArticleText(a); // "" si falla → queda el título
      const title = (a.titulo || `BOME ${a.cve}`).slice(0, 300);
      out.push({
        externalId: a.cve,
        title,
        searchText: `${a.organismo}\n${a.titulo}\n${texto}`.slice(
          0,
          MAX_BODY_CHARS
        ),
        url: a.url,
        publishedAt: date,
        actType: inferActType(title),
        region: "Melilla",
      });
    });
    return out;
  },
};
