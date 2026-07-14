/**
 * Adaptador del BOC (Boletín Oficial de Canarias).
 * Ficheros estáticos en gobiernodecanarias.org. Índice maestro JS resuelve
 * fecha->número(s) de boletín; sumario y documentos en HTML digital.
 *
 *   Índice fechas:  https://www.gobiernodecanarias.org/boc/boc_index.js  (entradas A(YYYYMMDDNNN))
 *   Sumario:        https://www.gobiernodecanarias.org/boc/{year}/{nnn}/index.html
 *   Texto:          https://www.gobiernodecanarias.org/boc/{year}/{nnn}/{XXXX}.html
 */

import { inferActType, NormalizedPublication, SourceAdapter } from "./types";
import { CONCURRENCY, MAX_BODY_CHARS, fetchText, mapPool, stripHtml, yyyymmdd } from "./util";

const HOST = "https://www.gobiernodecanarias.org/boc";

function cleanDoc(html: string): string {
  return stripHtml(
    html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
  );
}

// Índice fecha->[número] cacheado (el JS pesa ~140 KB; se baja una vez).
let indexCache: Map<string, string[]> | null = null;

async function getIndex(): Promise<Map<string, string[]>> {
  if (indexCache) return indexCache;
  const js = (await fetchText(`${HOST}/boc_index.js`)) ?? "";
  const map = new Map<string, string[]>();
  for (const m of js.matchAll(/A\((\d{8})(\d+)\)/g)) {
    const day = m[1];
    const arr = map.get(day) ?? [];
    arr.push(m[2]); // número (sin padding)
    map.set(day, arr);
  }
  indexCache = map;
  return map;
}

export const bocCanariasAdapter: SourceAdapter = {
  code: "BOC_CANARIAS",
  name: "Boletín Oficial de Canarias",
  type: "AUTONOMIC",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const day = yyyymmdd(date);
    const year = date.getUTCFullYear();
    const numeros = (await getIndex()).get(day);
    if (!numeros || numeros.length === 0) return [];

    const out: NormalizedPublication[] = [];
    const seen = new Set<string>();
    for (const numRaw of numeros) {
      const nnn = numRaw.padStart(3, "0");
      const sumario = await fetchText(`${HOST}/${year}/${nnn}/index.html`);
      if (!sumario) continue;
      const re = /<a[^>]+href="[^"]*\/boc\/\d+\/\d+\/(\d+)\.html"[^>]*>([\s\S]*?)<\/a>/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(sumario)) !== null) {
        const xxxx = m[1];
        const externalId = `BOC-A-${year}-${nnn}-${xxxx}`;
        if (seen.has(externalId)) continue;
        seen.add(externalId);
        const title = stripHtml(m[2]);
        out.push({
          externalId,
          title,
          searchText: title,
          url: `${HOST}/${year}/${nnn}/${xxxx}.html`,
          publishedAt: date,
          actType: inferActType(title),
          region: "Canarias",
        });
      }
    }
    if (out.length === 0) return [];

    await mapPool(out, CONCURRENCY, async (pub) => {
      const html = await fetchText(pub.url);
      if (html) pub.searchText = `${pub.title}\n${cleanDoc(html)}`.slice(0, MAX_BODY_CHARS);
    });

    return out;
  },
};
