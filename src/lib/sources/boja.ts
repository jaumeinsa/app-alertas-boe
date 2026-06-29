/**
 * Adaptador del BOJA (Boletín Oficial de la Junta de Andalucía).
 *
 * API de datos abiertos oficial (sin clave):
 *   Calendario:  /api/v0/boja/get/calendar?year=YYYY&month=M
 *     -> { columns, rows: [[number, "DD/MM/YYYY"], ...] }  (varios number/día posibles)
 *   Boletín:     /api/v0/boja/get/bulletin?year=YYYY&number=N
 *     -> { results: [{ id, summaryNoHtml, bodyNoHtml (TEXTO COMPLETO), date, pdf, ... }] }
 *
 * Ventaja: el boletín ya trae sumario + texto completo de todas las disposiciones
 * en una sola llamada (no hace falta pedir cada documento por separado).
 */

import {
  inferActType,
  NormalizedPublication,
  SourceAdapter,
} from "./types";

const BASE = "https://datos.juntadeandalucia.es/api/v0/boja";
const UA =
  process.env.INGEST_USER_AGENT ?? "NotifikadoBot/0.1 (+https://notifikado.com)";
const MAX_BODY_CHARS = 200_000;

function ddmmyyyy(date: Date): string {
  const d = String(date.getUTCDate()).padStart(2, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${d}/${m}/${date.getUTCFullYear()}`;
}

async function fetchJson(url: string): Promise<unknown | null> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": UA },
      next: { revalidate: 60 * 60 },
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

interface BojaResult {
  id?: string;
  internal?: number;
  summaryNoHtml?: string;
  bodyNoHtml?: string;
  pdf?: Array<{ publicUrl?: string }>;
}

export const bojaAdapter: SourceAdapter = {
  code: "BOJA",
  name: "Boletín Oficial de la Junta de Andalucía",
  type: "AUTONOMIC",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const target = ddmmyyyy(date);
    const cal = (await fetchJson(
      `${BASE}/get/calendar?year=${date.getUTCFullYear()}&month=${date.getUTCMonth() + 1}`
    )) as { rows?: Array<[number, string]> } | null;
    const numbers = (cal?.rows ?? [])
      .filter((r) => r[1] === target)
      .map((r) => r[0]);
    if (numbers.length === 0) return [];

    const out: NormalizedPublication[] = [];
    const seen = new Set<string>();
    for (const number of numbers) {
      const bul = (await fetchJson(
        `${BASE}/get/bulletin?year=${date.getUTCFullYear()}&number=${number}`
      )) as { results?: BojaResult[] } | null;
      for (const r of bul?.results ?? []) {
        const externalId = r.id ?? String(r.internal ?? "");
        if (!externalId || seen.has(externalId)) continue;
        seen.add(externalId);
        const title = r.summaryNoHtml ?? "";
        const body = r.bodyNoHtml ?? "";
        out.push({
          externalId,
          title,
          searchText: `${title}\n${body}`.slice(0, MAX_BODY_CHARS),
          url: r.pdf?.[0]?.publicUrl ?? `${BASE}/${externalId}`,
          publishedAt: date,
          actType: inferActType(title),
          region: "Andalucía",
        });
      }
    }
    return out;
  },
};
