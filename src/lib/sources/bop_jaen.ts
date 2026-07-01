/**
 * Adaptador del BOP de Jaén — code `BOP_23`.
 *
 * Plataforma "BOP Digit@l" (Dipujaén). GET, PDF con capa de texto nativa:
 *   Sumario del día: /bop/DD-MM-YYYY/anuncios (HTML) → enlaces
 *     descargarws.dip?...&numeroEdicto=N&ejercicioBop=YYYY&tipo=bop&...
 *   Anuncio PDF: /descargarws.dip?...  (mismos parámetros)
 * externalId = ejercicioBop-numeroEdicto.
 */

import {
  inferActType,
  NormalizedPublication,
  SourceAdapter,
} from "./types";
import {
  CONCURRENCY,
  ddmmyyyy,
  fetchPdfText,
  fetchText,
  MAX_BODY_CHARS,
  mapPool,
} from "./util";

const BASE = "https://bop.dipujaen.es";

export const bopJaenAdapter: SourceAdapter = {
  code: "BOP_23",
  name: "Boletín Oficial de la Provincia de Jaén",
  type: "BOP",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const html = await fetchText(`${BASE}/bop/${ddmmyyyy(date, "-")}/anuncios`);
    if (!html) return [];

    const re = /descargarws\.dip\?[^"'\s<>]*numeroEdicto=(\d+)[^"'\s<>]*/g;
    const seen = new Set<string>();
    const items: Array<{ code: string; url: string }> = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      const full = m[0].replace(/&amp;/g, "&");
      const ej = /ejercicioBop=(\d+)/.exec(full)?.[1] ?? String(date.getUTCFullYear());
      const code = `${ej}-${m[1]}`;
      if (seen.has(code)) continue;
      seen.add(code);
      items.push({ code, url: `${BASE}/${full}` });
    }
    if (items.length === 0) return [];

    const out: NormalizedPublication[] = [];
    await mapPool(items, CONCURRENCY, async (a) => {
      const text = await fetchPdfText(a.url);
      if (!text) return;
      const title = text.replace(/\s+/g, " ").trim().slice(0, 200) || a.code;
      out.push({
        externalId: a.code,
        title,
        searchText: text.slice(0, MAX_BODY_CHARS),
        url: a.url,
        publishedAt: date,
        actType: inferActType(title),
        region: "Jaén",
      });
    });
    return out;
  },
};
