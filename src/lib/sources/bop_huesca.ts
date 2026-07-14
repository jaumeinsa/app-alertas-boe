/**
 * Adaptador del BOP de Huesca (22) — plataforma gnuBOP `bop.dphuesca.es`.
 *
 * Buscador por fecha vía POST (form clásico, SIN cookies/JS/viewstate):
 *   POST /index.php/mod.bopanuncios/mem.busqueda/idmenu.50008.html
 *   body: FILTRO_FECHA_DESDE=DD-MM-YYYY & FILTRO_FECHA_HASTA=DD-MM-YYYY & BOTON_BUSCAR=Buscar
 *   (GET con query-string devuelve el formulario vacío → tiene que ser POST).
 * El HTML de resultados viene en ISO-8859-1, con un enlace por anuncio:
 *   /index.php/mod.bopanuncios/mem.visualizarpdf/relcategoria.60008/idbopanuncio.{ID}/chk.{hash}.html
 * El `chk` NO se valida (el PDF responde con chk de ceros). Cada PDF tiene
 * capa de texto. externalId = idbopanuncio. Sin paginación (día en 1 página).
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
} from "./util";

const BASE = "https://bop.dphuesca.es";
const SEARCH = `${BASE}/index.php/mod.bopanuncios/mem.busqueda/idmenu.50008.html`;

interface HuescaAnuncio {
  id: string;
  ref: string; // "AÑO / NUM"
  titulo: string;
  organismo: string;
  pdfUrl: string;
}

/** Extrae los anuncios del sumario HTML (latin-1 ya decodificado). */
function parseSumario(html: string): HuescaAnuncio[] {
  const out: HuescaAnuncio[] = [];
  const seen = new Set<string>();
  // Cada anuncio: <a ... idbopanuncio.{ID}/chk.{hash}.html ...>. Troceamos por
  // esos enlaces y miramos hacia atrás para el "+ AÑO / NUM - ANUNCIANTE".
  const linkRe =
    /href="(\/index\.php\/mod\.bopanuncios\/mem\.visualizarpdf\/[^"]*idbopanuncio\.(\d+)[^"]*)"/g;
  let m: RegExpExecArray | null;
  const marks: Array<{ id: string; href: string; pos: number }> = [];
  while ((m = linkRe.exec(html))) {
    marks.push({ id: m[2], href: m[1], pos: m.index });
  }
  for (let i = 0; i < marks.length; i++) {
    const { id, href, pos } = marks[i];
    if (seen.has(id)) continue;
    seen.add(id);
    // Bloque del anuncio: desde el enlace anterior (o inicio) hasta este enlace.
    const from = i > 0 ? marks[i - 1].pos : Math.max(0, pos - 2000);
    const block = html.slice(from, pos);
    // "+ 2026 / 2911 - AYUNTAMIENTO DE ..." (referencia + anunciante).
    const refM = /\+\s*(\d{4}\s*\/\s*\d+)\s*-\s*([^<\n]+)/.exec(block);
    const ref = refM ? refM[1].replace(/\s+/g, "") : "";
    const organismo = refM ? stripHtml(refM[2]).trim() : "";
    // Título del anuncio en <em>...</em> (el último del bloque).
    const emAll = [...block.matchAll(/<em>([\s\S]*?)<\/em>/g)];
    const titulo = emAll.length ? stripHtml(emAll[emAll.length - 1][1]) : "";
    out.push({
      id,
      ref,
      titulo: titulo || organismo || `BOP Huesca ${ref || id}`,
      organismo,
      pdfUrl: BASE + href,
    });
  }
  return out;
}

export const bopHuescaAdapter: SourceAdapter = {
  code: "BOP_22",
  name: "Boletín Oficial de la Provincia de Huesca",
  type: "BOP",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const f = ddmmyyyy(date); // DD-MM-YYYY
    const html = await fetchText(SEARCH, {
      method: "POST",
      body: {
        FILTRO_FECHA_DESDE: f,
        FILTRO_FECHA_HASTA: f,
        BOTON_BUSCAR: "Buscar",
      },
      charset: "iso-8859-1",
    });
    if (!html) return [];

    const anuncios = parseSumario(html);
    if (anuncios.length === 0) return [];

    const out: NormalizedPublication[] = anuncios.map((a) => ({
      externalId: `BOP_22-${a.id}`,
      title: a.titulo.slice(0, 300),
      searchText: `${a.organismo}\n${a.titulo}`.slice(0, MAX_BODY_CHARS),
      url: a.pdfUrl,
      publishedAt: date,
      actType: inferActType(a.titulo),
      region: "Huesca",
    }));

    // Texto completo del PDF por anuncio (capa de texto, sin OCR).
    await mapPool(out, CONCURRENCY, async (pub, i) => {
      const txt = await fetchPdfText(anuncios[i].pdfUrl);
      if (txt) {
        pub.searchText = `${anuncios[i].organismo}\n${txt}`.slice(0, MAX_BODY_CHARS);
      }
    });

    return out;
  },
};
