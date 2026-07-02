/**
 * Adaptador del BOP de Tarragona — code `BOP_43`.
 *
 * Misma plataforma que el BOP de Barcelona (bop.diba.cat) servida bajo
 * dipta.cat con el prefijo /bopt/web:
 *   Sumario del día (HTML paginado, 20 anuncios/página):
 *     /bopt/web/anteriors/YYYY-MM-DD  (y /anteriors/YYYY-MM-DD/2, /3…
 *     mientras exista <a class="page-link" … rel="next">)
 *     → tarjetas <h3><a href="/bopt/web/anunci/{ID}/{slug}">ANUNCIANT</a></h3>
 *       seguidas de <p>título real del anuncio</p>.
 *       ⚠️ Se descartan hrefs con querystring (enlaces de filtro bopb_dia[…]).
 *       ⚠️ Un día SIN boletín (finde/festivo) responde HTTP 500 → los helpers
 *       de util devuelven null y se trata como día vacío ([]).
 *   Texto completo: PDF con capa de texto /bopt/web/anunci/descarrega-pdf/{ID}.
 * externalId = "bopt-{ID}". URL pública = /bopt/web/anunci/{ID}.
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
  isoDate,
  MAX_BODY_CHARS,
  mapPool,
  stripHtml,
} from "./util";

const BASE = "https://www.dipta.cat/bopt/web";

/** Decodifica entidades numéricas (&#039;…) que stripHtml no cubre. */
function clean(html: string): string {
  return stripHtml(html.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)));
}

// Tarjeta del sumario: <h3 …><a href="/bopt/web/anunci/{ID}/{slug}">ANUNCIANT</a></h3> <p>título</p>
const CARD_RE =
  /<a\s+href="\/bopt\/web\/anunci\/(\d+)\/[^"?]*"[^>]*>([\s\S]*?)<\/a><\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>/g;
// Cualquier enlace a anuncio (fallback + control de paginación), sin querystring.
const ID_RE = /href="\/bopt\/web\/anunci\/(\d+)\/[^"?]*"/g;

export const bopTarragonaAdapter: SourceAdapter = {
  code: "BOP_43",
  name: "Butlletí Oficial de la Província de Tarragona",
  type: "BOP",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const iso = isoDate(date);
    const ids = new Set<string>();
    // id → "ANUNCIANT — título" extraído de la tarjeta del sumario.
    const titles = new Map<string, string>();

    for (let page = 1; page <= 100; page++) {
      const url = page === 1 ? `${BASE}/anteriors/${iso}` : `${BASE}/anteriors/${iso}/${page}`;
      const html = await fetchText(url);
      if (!html) break; // día sin boletín (HTTP 500) o red caída → sin páginas
      let m: RegExpExecArray | null;
      while ((m = CARD_RE.exec(html))) {
        const [, id, anunciant, titol] = m;
        if (!titles.has(id)) {
          titles.set(id, [clean(anunciant), clean(titol)].filter(Boolean).join(" — "));
        }
      }
      const pageIds = [...new Set([...html.matchAll(ID_RE)].map((mm) => mm[1]))];
      const fresh = pageIds.filter((id) => !ids.has(id));
      if (fresh.length === 0) break; // página sin ids nuevos → fin
      fresh.forEach((id) => ids.add(id));
      if (!/class="page-link"[^>]*rel="next"/.test(html)) break; // última página
    }
    if (ids.size === 0) return [];

    const out: NormalizedPublication[] = [];
    await mapPool([...ids], CONCURRENCY, async (id) => {
      const text = await fetchPdfText(`${BASE}/anunci/descarrega-pdf/${id}`);
      const fromCard = titles.get(id) ?? "";
      const title = fromCard || text?.replace(/\s+/g, " ").trim().slice(0, 200) || id;
      if (!fromCard && !text) return; // error puntual y sin metadatos → saltar
      out.push({
        externalId: `bopt-${id}`,
        title: title.slice(0, 300),
        searchText: `${fromCard}\n${text ?? ""}`.trim().slice(0, MAX_BODY_CHARS),
        url: `${BASE}/anunci/${id}`,
        publishedAt: date,
        actType: inferActType(title),
        region: "Tarragona",
      });
    });
    return out;
  },
};
