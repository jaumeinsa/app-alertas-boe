/**
 * Adaptador del BOR (Boletín Oficial de La Rioja).
 * API XML oficial (servlet ExportarBoletinServlet), respuestas en ISO-8859-1.
 *
 *   Sumario (tipo=1): .../ExportarBoletinServlet?tipo=1&fecha=YYYY/MM/DD
 *   Texto   (tipo=2): .../ExportarBoletinServlet?tipo=2&fecha=YYYY/MM/DD&referencia={refHtml}
 */

import { inferActType, NormalizedPublication, SourceAdapter } from "./types";
import { CONCURRENCY, MAX_BODY_CHARS, fetchText, mapPool, stripHtml } from "./util";

const SERVLET = "https://ias1.larioja.org/boletin/ExportarBoletinServlet";

function slashDate(d: Date): string {
  return `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(
    d.getUTCDate()
  ).padStart(2, "0")}`;
}

export const borAdapter: SourceAdapter = {
  code: "BOR",
  name: "Boletín Oficial de La Rioja",
  type: "AUTONOMIC",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const fecha = slashDate(date);
    const sumario = await fetchText(`${SERVLET}?tipo=1&fecha=${fecha}`, {
      charset: "iso-8859-1",
    });
    if (!sumario || !sumario.includes("<anuncio")) return [];

    // Cada <anuncio> trae un <titulo> (CDATA) y una referencia html.
    const pairs: Array<{ pub: NormalizedPublication; ref: string }> = [];
    const seen = new Set<string>();
    for (const block of sumario.match(/<anuncio\b[\s\S]*?<\/anuncio>/g) ?? []) {
      const ref = block.match(/<contenido\s+tipo='html'>\s*([^<\s][^<]*?)\s*<\/contenido>/)?.[1];
      if (!ref || seen.has(ref)) continue;
      seen.add(ref);
      const title = stripHtml(block.match(/<titulo>([\s\S]*?)<\/titulo>/)?.[1] ?? "");
      pairs.push({
        ref,
        pub: {
          externalId: ref,
          title,
          searchText: title,
          url: `${SERVLET}?tipo=2&fecha=${fecha}&referencia=${ref}`,
          publishedAt: date,
          actType: inferActType(title),
          region: "La Rioja",
        },
      });
    }
    if (pairs.length === 0) return [];

    await mapPool(pairs, CONCURRENCY, async ({ pub, ref }) => {
      const doc = await fetchText(
        `${SERVLET}?tipo=2&fecha=${fecha}&referencia=${encodeURIComponent(ref)}`,
        { charset: "iso-8859-1" }
      );
      if (doc) {
        const body = stripHtml(
          doc.match(/<contenido\s+tipo='html'>([\s\S]*?)<\/contenido>/)?.[1] ?? doc
        );
        pub.searchText = `${pub.title}\n${body}`.slice(0, MAX_BODY_CHARS);
      }
    });

    return pairs.map((p) => p.pub);
  },
};
