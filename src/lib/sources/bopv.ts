/**
 * Adaptador del BOPV (Boletín Oficial del País Vasco / EHAA).
 * API REST oficial de Open Data Euskadi. El texto completo viene inline en el
 * listado mensual (text.content), así que no hace falta una 2ª llamada.
 *
 *   Listado por mes:  https://api.euskadi.eus/bopv/administrative-acts/{YYYY}/{MM}?currentPage=N&itemsOfPage=S&lang=SPANISH
 */

import { inferActType, NormalizedPublication, SourceAdapter } from "./types";
import { MAX_BODY_CHARS, fetchJson, isoDate, stripHtml } from "./util";

interface BopvItem {
  id?: string;
  name?: string;
  publishDate?: string; // UTC, p.ej. "2026-05-31T22:00:00Z"
  mainEntityOfPage?: string;
  text?: { content?: string };
}

/** Día civil en Europe/Madrid (UTC + ~1-2h). Sumamos 2h y tomamos la fecha. */
function madridDay(utc: string): string {
  const d = new Date(utc);
  d.setUTCHours(d.getUTCHours() + 2);
  return d.toISOString().slice(0, 10);
}

// La API filtra por mes (respuestas de ~9 MB con texto inline). Cacheamos el
// mes en memoria para no rebajarlo en cada día del backfill.
const monthCache = new Map<string, BopvItem[]>();

async function getMonthItems(year: number, month: string): Promise<BopvItem[]> {
  const key = `${year}-${month}`;
  const cached = monthCache.get(key);
  if (cached) return cached;

  const base = `https://api.euskadi.eus/bopv/administrative-acts/${year}/${month}`;
  const items: BopvItem[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const data = (await fetchJson(
      `${base}?currentPage=${page}&itemsOfPage=200&lang=SPANISH`
    )) as { totalPages?: number; items?: BopvItem[] } | null;
    if (!data) break;
    totalPages = data.totalPages ?? 1;
    items.push(...(data.items ?? []));
    page++;
  } while (page <= totalPages);

  monthCache.set(key, items);
  if (monthCache.size > 3) {
    const oldest = monthCache.keys().next().value;
    if (oldest) monthCache.delete(oldest);
  }
  return items;
}

export const bopvAdapter: SourceAdapter = {
  code: "BOPV",
  name: "Boletín Oficial del País Vasco",
  type: "AUTONOMIC",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const target = isoDate(date);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");

    const out: NormalizedPublication[] = [];
    for (const it of await getMonthItems(year, month)) {
      if (!it.publishDate || madridDay(it.publishDate) !== target) continue;
      const title = it.name ?? "";
      const body = it.text?.content ? stripHtml(it.text.content) : "";
      out.push({
        externalId: it.id ?? `${year}/${month}/${out.length}`,
        title,
        searchText: `${title}\n${body}`.slice(0, MAX_BODY_CHARS),
        url: it.mainEntityOfPage ?? `https://api.euskadi.eus/bopv/administrative-acts/${year}/${month}`,
        publishedAt: date,
        actType: inferActType(title),
        region: "País Vasco",
      });
    }
    return out;
  },
};
