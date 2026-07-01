/**
 * Adaptador del BOC (Boletín Oficial de Cantabria) — code `BOC_CANTABRIA`.
 *
 * Sin cookie ni sesión JSP (2 GET):
 *   1) Índice del mes (JSON): busquedaBoletines.do?mes={M}&year={YYYY}
 *        → [{ id, fecBolString:"27 de junio de 2025", tipoBol, numBol }, …]
 *          (un día puede tener ordinario tipoBol=0 y extraordinario tipoBol=1).
 *   2) XML del boletín entero: verXmlAction.do?idBlob={id}
 *        → <disposicion> con <numeroExp> (CVE, único), <titulo_text> y
 *          <texto> (cuerpo completo, con nombres de personas). Charset UTF-8.
 */

import {
  inferActType,
  NormalizedPublication,
  SourceAdapter,
} from "./types";
import {
  fetchJson,
  fetchText,
  MAX_BODY_CHARS,
  stripHtml,
} from "./util";

const BASE = "https://boc.cantabria.es/boces";

// Índice mensual cacheado (el backfill recorre un mes muchas veces).
const monthCache = new Map<string, Array<{ id: number; day: number }>>();

function firstGroup(re: RegExp, s: string): string {
  const m = s.match(re);
  return m ? m[1] : "";
}

async function getMonth(
  year: number,
  month: number
): Promise<Array<{ id: number; day: number }>> {
  const key = `${year}-${month}`;
  const cached = monthCache.get(key);
  if (cached) return cached;
  const json = (await fetchJson(
    `${BASE}/busquedaBoletines.do?mes=${month}&year=${year}`
  )) as Array<{ id?: number; fecBolString?: string }> | null;
  const arr: Array<{ id: number; day: number }> = [];
  for (const b of json ?? []) {
    const dm = /^(\d+)\s+de/.exec(b.fecBolString ?? "");
    if (b.id && dm) arr.push({ id: b.id, day: parseInt(dm[1], 10) });
  }
  monthCache.set(key, arr);
  return arr;
}

interface BocDisp {
  cve: string;
  titulo: string;
  texto: string;
}

function parseDisposiciones(xml: string): BocDisp[] {
  const out: BocDisp[] = [];
  const seen = new Set<string>();
  const re = /<disposicion\b[^>]*>([\s\S]*?)<\/disposicion>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const block = m[1];
    const cve = firstGroup(/<numeroExp>([^<]+)<\/numeroExp>/, block).replace(
      /\s+/g,
      ""
    );
    if (!cve || seen.has(cve)) continue;
    seen.add(cve);
    out.push({
      cve,
      titulo: stripHtml(firstGroup(/<titulo_text>([\s\S]*?)<\/titulo_text>/, block)),
      texto: stripHtml(firstGroup(/<texto>([\s\S]*?)<\/texto>/, block)),
    });
  }
  return out;
}

export const bocCantabriaAdapter: SourceAdapter = {
  code: "BOC_CANTABRIA",
  name: "Boletín Oficial de Cantabria",
  type: "AUTONOMIC",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();

    const boletines = (await getMonth(year, month)).filter((b) => b.day === day);
    if (boletines.length === 0) return [];

    const out: NormalizedPublication[] = [];
    for (const b of boletines) {
      const xml = await fetchText(`${BASE}/verXmlAction.do?idBlob=${b.id}`);
      if (!xml) continue;
      const url = `${BASE}/verXmlAction.do?idBlob=${b.id}`;
      for (const d of parseDisposiciones(xml)) {
        const title = d.titulo || `BOC ${d.cve}`;
        out.push({
          externalId: d.cve,
          title: title.slice(0, 300),
          searchText: `${d.titulo}\n${d.texto}`.slice(0, MAX_BODY_CHARS),
          url,
          publishedAt: date,
          actType: inferActType(title),
          region: "Cantabria",
        });
      }
    }
    return out;
  },
};
