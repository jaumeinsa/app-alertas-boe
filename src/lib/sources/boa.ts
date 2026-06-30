/**
 * Adaptador del BOA (Boletín Oficial de Aragón) — code `BOA`.
 *
 * Sistema BRS/BASIS (BRSCGI). Sin API JSON: sumario en HTML (ISO-8859-1) y cada
 * disposición en PDF con capa de texto (sin OCR).
 *   Sumario:  BRSCGI?CMD=VERLST&DOCS=1-N&BASE=BOLE&SEC=BUSQUEDA_FECHA&SEPARADOR=&PUBL=YYYYMMDD
 *       → enlaces a documentos con su id interno MLKOB.
 *   Documento PDF:  BRSCGI?CMD=VEROBJ&MLKOB={id}&type=pdf
 *       ⚠️ Algunos MLKOB son ficheros de firma (application/sig), no PDF →
 *          fetchBuffer ya los descarta (verifica content-type/magic %PDF-).
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

const BASE = "https://www.boa.aragon.es/cgi-bin/EBOA/BRSCGI";

/** Empareja cada MLKOB único con el último título (<h5 class="boatitulo">) que lo precede. */
function parseDocs(html: string): Array<{ mlkob: string; title: string }> {
  const titles: Array<{ idx: number; text: string }> = [];
  const titleRe = /<h5 class="boatitulo">([\s\S]*?)<\/h5>/g;
  let tm: RegExpExecArray | null;
  while ((tm = titleRe.exec(html))) {
    titles.push({ idx: tm.index, text: stripHtml(tm[1]) });
  }

  const out: Array<{ mlkob: string; title: string }> = [];
  const seen = new Set<string>();
  const linkRe = /MLKOB=(\d+)/g;
  let lm: RegExpExecArray | null;
  while ((lm = linkRe.exec(html))) {
    const id = lm[1];
    if (seen.has(id)) continue;
    seen.add(id);
    let title = "";
    for (const t of titles) {
      if (t.idx < lm.index) title = t.text;
      else break;
    }
    out.push({ mlkob: id, title });
  }
  return out;
}

export const boaAdapter: SourceAdapter = {
  code: "BOA",
  name: "Boletín Oficial de Aragón",
  type: "AUTONOMIC",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const ymd = yyyymmdd(date);
    const html = await fetchText(
      `${BASE}?CMD=VERLST&DOCS=1-2000&BASE=BOLE&SEC=BUSQUEDA_FECHA&SEPARADOR=&PUBL=${ymd}`,
      { charset: "iso-8859-1" }
    );
    if (!html) return [];

    const docs = parseDocs(html);
    if (docs.length === 0) return [];

    const out: NormalizedPublication[] = [];
    await mapPool(docs, CONCURRENCY, async (d) => {
      const url = `${BASE}?CMD=VEROBJ&MLKOB=${d.mlkob}&type=pdf`;
      const text = await fetchPdfText(url);
      if (!text) return; // no es PDF (p.ej. fichero de firma) o vacío
      const title = d.title || `BOA ${d.mlkob}`;
      out.push({
        externalId: d.mlkob,
        title,
        searchText: `${title}\n${text}`.slice(0, MAX_BODY_CHARS),
        url,
        publishedAt: date,
        actType: inferActType(title),
        region: "Aragón",
      });
    });
    return out;
  },
};
