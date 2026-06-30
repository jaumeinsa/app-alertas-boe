/**
 * Adaptador del BOPA (Boletín Oficial del Principado de Asturias) — code `BOPA`.
 *
 * Vía unificada (vale para todos los años, evita los JSON anuales de esquema variable):
 *   Sumario PDF del día:  https://www.asturias.es/bopa/{YYYY}/{MM}/{DD}/{YYYYMMDD}.pdf
 *       → cada disposición aparece marcada con "[Cód. AAAA-NNNNN]".
 *         ⚠️ El guion suele ser U+2011 (non-breaking hyphen), no ASCII → normalizar.
 *   Disposición PDF:      https://sede.asturias.es/bopa/{YYYY}/{MM}/{DD}/{CODIGO}.pdf
 *       (301 → miprincipado.asturias.es; fetch sigue redirecciones solo). Capa de texto.
 * externalId = CODIGO. Días sin boletín → el sumario PDF no existe → [].
 */

import {
  inferActType,
  NormalizedPublication,
  SourceAdapter,
} from "./types";
import {
  CONCURRENCY,
  fetchPdfText,
  MAX_BODY_CHARS,
  mapPool,
} from "./util";

const SUMBASE = "https://www.asturias.es/bopa";
const DOCBASE = "https://sede.asturias.es/bopa";

const pad = (n: number) => String(n).padStart(2, "0");
const DASHES = /[‐-―−]/g;

/** Extrae los CODIGO ("[Cód. AAAA-NNNNN]") del texto del sumario, normalizando el guion. */
function parseCodes(sumText: string): string[] {
  const re = /C[oó]d\.\s*(20\d{2}[‐-―−-]\d{4,6})/g;
  const out: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(sumText))) {
    const code = m[1].replace(DASHES, "-");
    if (seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

export const bopaAdapter: SourceAdapter = {
  code: "BOPA",
  name: "Boletín Oficial del Principado de Asturias",
  type: "AUTONOMIC",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const y = date.getUTCFullYear();
    const m = pad(date.getUTCMonth() + 1);
    const d = pad(date.getUTCDate());
    const ymd = `${y}${m}${d}`;

    const sumText = await fetchPdfText(`${SUMBASE}/${y}/${m}/${d}/${ymd}.pdf`);
    if (!sumText) return []; // sin boletín ese día

    const codes = parseCodes(sumText);
    if (codes.length === 0) return [];

    const out: NormalizedPublication[] = [];
    await mapPool(codes, CONCURRENCY, async (code) => {
      const url = `${DOCBASE}/${y}/${m}/${d}/${code}.pdf`;
      const text = await fetchPdfText(url);
      if (!text) return;
      const title = text.replace(/\s+/g, " ").trim().slice(0, 200) || `BOPA ${code}`;
      out.push({
        externalId: code,
        title,
        searchText: text.slice(0, MAX_BODY_CHARS),
        url,
        publishedAt: date,
        actType: inferActType(title),
        region: "Asturias",
      });
    });
    return out;
  },
};
