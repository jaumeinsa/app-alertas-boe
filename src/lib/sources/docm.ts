/**
 * Adaptador del DOCM (Diario Oficial de Castilla-La Mancha) — code `DOCM`.
 *
 * Sumario HTML (UTF-8, con el listado de disposiciones HTML-escapado dentro):
 *   https://docm.jccm.es/portaldocm/sumario.do?fecha=YYYYMMDD
 *     → cada disposición: enlace `descargarArchivo.do?ruta=YYYY/MM/DD/pdf/AAAA_NNNN.pdf`
 *       envuelto en <a class="new-window">TÍTULO</a>. NID = AAAA/NNNN.
 * Documento PDF (capa de texto, sin OCR; sin cookie ni Referer):
 *   https://docm.jccm.es/portaldocm/descargarArchivo.do?ruta=YYYY/MM/DD/pdf/AAAA_NNNN.pdf&tipo=rutaDocm
 *
 * Días sin boletín → el sumario responde 200 pero sin NIDs → devolvemos [].
 * (El detalle HTML `detalleDocumento.do` da 500; por eso vamos al PDF.)
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
  stripHtml,
  yyyymmdd,
} from "./util";

const BASE = "https://docm.jccm.es/portaldocm";

/** Decodifica entidades HTML (incl. numéricas) y una capa de doble escape. */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)));
}

interface DocmDoc {
  nid: string; // AAAA/NNNN
  ruta: string; // YYYY/MM/DD
  file: string; // AAAA_NNNN
  title: string;
}

function parseDocs(rawHtml: string): DocmDoc[] {
  // El listado va HTML-escapado dentro del sumario: deshacer un nivel revela
  // los <a ...>TÍTULO</a> reales (y convierte &amp;amp; -> &amp; en los href).
  const html = decodeEntities(rawHtml);
  const out: DocmDoc[] = [];
  const seen = new Set<string>();
  const re =
    /<a[^>]*?descargarArchivo\.do\?ruta=(\d{4}\/\d{2}\/\d{2})\/pdf\/(\d{4}_\d+)\.pdf[^>]*?>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const [, ruta, file, rawTitle] = m;
    const nid = file.replace("_", "/");
    if (seen.has(nid)) continue;
    seen.add(nid);
    const title = decodeEntities(stripHtml(rawTitle)).replace(/\s+/g, " ").trim();
    out.push({ nid, ruta, file, title });
  }
  return out;
}

export const docmAdapter: SourceAdapter = {
  code: "DOCM",
  name: "Diario Oficial de Castilla-La Mancha",
  type: "AUTONOMIC",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const html = await fetchText(`${BASE}/sumario.do?fecha=${yyyymmdd(date)}`);
    if (!html) return [];

    const docs = parseDocs(html);
    if (docs.length === 0) return []; // fin de semana/festivo o sin boletín

    const out: NormalizedPublication[] = [];
    await mapPool(docs, CONCURRENCY, async (d) => {
      const url = `${BASE}/descargarArchivo.do?ruta=${d.ruta}/pdf/${d.file}.pdf&tipo=rutaDocm`;
      const text = await fetchPdfText(url);
      if (!text) return;
      const title = d.title || `DOCM ${d.nid}`;
      out.push({
        externalId: d.nid,
        title,
        searchText: `${title}\n${text}`.slice(0, MAX_BODY_CHARS),
        url,
        publishedAt: date,
        actType: inferActType(title),
        region: "Castilla-La Mancha",
      });
    });
    return out;
  },
};
