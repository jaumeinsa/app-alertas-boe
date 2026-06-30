/**
 * Adaptador del DOG (Diario Oficial de Galicia).
 * Ficheros estáticos en www.xunta.gal. No hay API: se enumera el sumario por
 * secciones y se baja el HTML digital de cada documento.
 *
 *   Sumario:  https://www.xunta.gal/dog/Publicados/{YYYY}/{YYYYMMDD}/Secciones{N}_es.html  (N=1..6)
 *   Texto:    https://www.xunta.gal/dog/Publicados/{YYYY}/{YYYYMMDD}/{id}_es.html
 */

import { inferActType, NormalizedPublication, SourceAdapter } from "./types";
import { CONCURRENCY, MAX_BODY_CHARS, fetchText, mapPool, stripHtml, yyyymmdd } from "./util";

const BASE = "https://www.xunta.gal/dog/Publicados";

function cleanDoc(html: string): string {
  return stripHtml(
    html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
  );
}

export const dogAdapter: SourceAdapter = {
  code: "DOG",
  name: "Diario Oficial de Galicia",
  type: "AUTONOMIC",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const ymd = yyyymmdd(date);
    const year = date.getUTCFullYear();
    const dir = `${BASE}/${year}/${ymd}`;
    const linkRe = new RegExp(
      `<a[^>]+href="([^"]*\\/(${"[A-Za-z0-9][A-Za-z0-9-]*"})_es\\.html)"[^>]*>([\\s\\S]*?)<\\/a>`,
      "g"
    );

    const seen = new Set<string>();
    const out: NormalizedPublication[] = [];
    let anySection = false;

    for (let n = 1; n <= 6; n++) {
      const html = await fetchText(`${dir}/Secciones${n}_es.html`);
      if (html === null) {
        if (n === 1) return []; // sin boletín ese día
        continue;
      }
      anySection = true;
      let m: RegExpExecArray | null;
      while ((m = linkRe.exec(html)) !== null) {
        const id = m[2];
        if (id.startsWith("Secciones") || id.startsWith("Indice") || seen.has(id)) continue;
        seen.add(id);
        const title = stripHtml(m[3]);
        out.push({
          externalId: id,
          title,
          searchText: title,
          url: `${dir}/${id}_es.html`,
          publishedAt: date,
          actType: inferActType(title),
          region: "Galicia",
        });
      }
    }
    if (!anySection) return [];

    await mapPool(out, CONCURRENCY, async (pub) => {
      const html = await fetchText(`${dir}/${pub.externalId}_es.html`);
      if (html) pub.searchText = `${pub.title}\n${cleanDoc(html)}`.slice(0, MAX_BODY_CHARS);
    });

    return out;
  },
};
