/**
 * Adaptador del BON (Boletín Oficial de Navarra). Plataforma Liferay.
 *
 *   Calendario (fecha->número), JSON: portlet getBoletines (mes 0-indexado)
 *   Sumario:  https://bon.navarra.es/es/boletin/-/sumario/{anyo}/{numero}  (HTML)
 *   Texto:    https://bon.navarra.es/es/anuncio/-/texto/{anyo}/{numero}/{secuencia}  (HTML)
 */

import { inferActType, NormalizedPublication, SourceAdapter } from "./types";
import { CONCURRENCY, MAX_BODY_CHARS, fetchJson, fetchText, isoDate, mapPool, stripHtml } from "./util";

const PORTLET =
  "es_navarra_bon_calendario_portlet_CalendarioPortlet_INSTANCE_6JrV16g0duGz";

function cleanDoc(html: string): string {
  return stripHtml(
    html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
  );
}

// Calendario por (año,mes): JSON pequeño, lo cacheamos para el backfill.
const calCache = new Map<string, Record<string, Array<{ numero: number }>>>();

async function getCalendar(year: number, monthIdx: number) {
  const key = `${year}-${monthIdx}`;
  const cached = calCache.get(key);
  if (cached) return cached;
  const url =
    `https://bon.navarra.es/es/boletin?p_p_id=${PORTLET}&p_p_lifecycle=2&p_p_state=normal` +
    `&p_p_mode=view&p_p_resource_id=getBoletines&p_p_cacheability=cacheLevelPage` +
    `&_${PORTLET}_anyo=${year}&_${PORTLET}_mes=${monthIdx}`;
  const data = (await fetchJson(url)) as Record<string, Array<{ numero: number }>> | null;
  const cal = data ?? {};
  calCache.set(key, cal);
  if (calCache.size > 6) {
    const oldest = calCache.keys().next().value;
    if (oldest) calCache.delete(oldest);
  }
  return cal;
}

export const bonAdapter: SourceAdapter = {
  code: "BON",
  name: "Boletín Oficial de Navarra",
  type: "AUTONOMIC",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const year = date.getUTCFullYear();
    const cal = await getCalendar(year, date.getUTCMonth()); // mes 0-indexado
    const entries = cal[isoDate(date)];
    if (!entries || entries.length === 0) return [];

    const out: NormalizedPublication[] = [];
    const seen = new Set<string>();
    for (const { numero } of entries) {
      const sumario = await fetchText(
        `https://bon.navarra.es/es/boletin/-/sumario/${year}/${numero}`
      );
      if (!sumario) continue;
      const re = /<a[^>]+href="(\/es\/anuncio\/-\/texto\/\d+\/\d+\/(\d+))"[^>]*>([\s\S]*?)<\/a>/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(sumario)) !== null) {
        const seq = m[2];
        const externalId = `${year}/${numero}/${seq}`;
        if (seen.has(externalId)) continue;
        seen.add(externalId);
        const title = stripHtml(m[3]);
        out.push({
          externalId,
          title,
          searchText: title,
          url: `https://bon.navarra.es${m[1]}`,
          publishedAt: date,
          actType: inferActType(title),
          region: "Navarra",
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
