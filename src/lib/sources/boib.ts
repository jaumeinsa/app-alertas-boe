/**
 * Adaptador del BOIB (Butlletí Oficial de les Illes Balears) — code `BOIB`.
 *
 * Flujo (sin cookie ni Referer; UTF-8):
 *   1) Calendario anual: /eboibfront/ca/{year}/  → rejilla por meses (<h3>gener…
 *      desembre</h3> en catalán). Cada enlace ordinario/extraordinario da el {id}
 *      de boletín y el DÍA (el mes se deduce del bloque <h3>). {id} es GLOBAL.
 *   2) Sumario: /eboibfront/es/{year}/{id}  → 3-4 URLs de sección
 *      (ignorar los enlaces ELI /dof/…, no llevan a las disposiciones).
 *   3) Sección: /eboibfront/es/{year}/{id}/{slug}/{secId}  → URLs de disposición
 *      (cada docId aparece 2 veces: normal + /xml → deduplicar por docId).
 *   4) Texto: {urlDisposición}/xml → <env:contingut> con CDATA malformado
 *      (![CDATA[…]]) y HTML doble-escapado → doble unescape + strip.
 * externalId = docId. Día sin boletín → no aparece en el calendario → [].
 */

import {
  inferActType,
  NormalizedPublication,
  SourceAdapter,
} from "./types";
import {
  CONCURRENCY,
  fetchText,
  MAX_BODY_CHARS,
  mapPool,
  stripHtml,
} from "./util";

const ORIGIN = "https://www.caib.es";
const HOST = `${ORIGIN}/eboibfront`;
const MONTHS_CA = [
  "gener", "febrer", "març", "abril", "maig", "juny",
  "juliol", "agost", "setembre", "octubre", "novembre", "desembre",
];

// Calendario cacheado por año (el backfill recorre un año muchas veces).
const calCache = new Map<number, Map<string, string[]>>();

/** Decodifica entidades HTML una vez (aplicar 2 veces para el doble escape del BOIB). */
function unescapeOnce(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

function extractTag(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  if (!m) return "";
  const body = m[1].replace(/^\s*!\[CDATA\[/, "").replace(/\]\]\s*$/, "");
  return stripHtml(unescapeOnce(unescapeOnce(body)));
}

async function getYearCalendar(year: number): Promise<Map<string, string[]>> {
  const cached = calCache.get(year);
  if (cached) return cached;
  const map = new Map<string, string[]>();
  const html = await fetchText(`${HOST}/ca/${year}/`);
  if (html) {
    const parts = html.split(
      /<h3>(gener|febrer|març|abril|maig|juny|juliol|agost|setembre|octubre|novembre|desembre)<\/h3>/
    );
    for (let i = 1; i < parts.length; i += 2) {
      const monthIdx = MONTHS_CA.indexOf(parts[i]) + 1;
      const re =
        /<a class="(?:ordinario|extraordinario)" href="\/eboibfront\/ca\/\d+\/(\d+)\/" title="BOIB (?:ordinari|extraordinari) del dia (\d+)"/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(parts[i + 1] ?? ""))) {
        const key = `${monthIdx}-${parseInt(m[2], 10)}`;
        const arr = map.get(key) ?? [];
        arr.push(m[1]);
        map.set(key, arr);
      }
    }
  }
  calCache.set(year, map);
  return map;
}

export const boibAdapter: SourceAdapter = {
  code: "BOIB",
  name: "Butlletí Oficial de les Illes Balears",
  type: "AUTONOMIC",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const year = date.getUTCFullYear();
    const cal = await getYearCalendar(year);
    const ids = cal.get(`${date.getUTCMonth() + 1}-${date.getUTCDate()}`);
    if (!ids || ids.length === 0) return [];

    // docId -> URL de la disposición (dedup entre secciones y boletines del día).
    const dispMap = new Map<string, string>();
    for (const id of ids) {
      const sumario = await fetchText(`${HOST}/es/${year}/${id}`);
      if (!sumario) continue;
      const secRe = new RegExp(
        `href="(/eboibfront/es/${year}/${id}/[a-z0-9-]+/[0-9]+)"`,
        "g"
      );
      const secPaths = [...new Set([...sumario.matchAll(secRe)].map((m) => m[1]))];
      for (const secPath of secPaths) {
        const secHtml = await fetchText(`${ORIGIN}${secPath}`);
        if (!secHtml) continue;
        const dispRe = new RegExp(
          `href="(https://www\\.caib\\.es/eboibfront/es/${year}/${id}/(\\d+)/[a-z0-9-]+)"`,
          "g"
        );
        let m: RegExpExecArray | null;
        while ((m = dispRe.exec(secHtml))) {
          if (!dispMap.has(m[2])) dispMap.set(m[2], m[1]);
        }
      }
    }
    if (dispMap.size === 0) return [];

    const out: NormalizedPublication[] = [];
    await mapPool([...dispMap.entries()], CONCURRENCY, async ([docId, url]) => {
      const xml = await fetchText(`${url}/xml`);
      if (!xml) return;
      const text = extractTag(xml, "env:contingut");
      if (!text) return;
      const title = extractTag(xml, "env:sumariEnviament") || text.slice(0, 180);
      out.push({
        externalId: docId,
        title: title.slice(0, 300),
        searchText: text.slice(0, MAX_BODY_CHARS),
        url,
        publishedAt: date,
        actType: inferActType(title),
        region: "Illes Balears",
      });
    });
    return out;
  },
};
