/**
 * Adaptador del BOCYL (Boletín Oficial de Castilla y León).
 * Sumario vía API Opendatasoft (JSON) filtrando por fecha; texto completo en
 * el XML de cada documento (ISO-8859-15).
 *
 *   Sumario: https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/bocyl/records?where=fecha_publicacion=date'YYYY-MM-DD'&limit=100&offset=N
 *   Texto:   campo enlace_fichero_xml de cada record (http -> https)
 */

import { inferActType, NormalizedPublication, SourceAdapter } from "./types";
import { CONCURRENCY, MAX_BODY_CHARS, fetchJson, fetchText, isoDate, mapPool, stripHtml } from "./util";

interface BocylRecord {
  titulo?: string;
  fecha_publicacion?: string;
  enlace_fichero_xml?: string;
  enlace_fichero_html?: string;
}

export const bocylAdapter: SourceAdapter = {
  code: "BOCYL",
  name: "Boletín Oficial de Castilla y León",
  type: "AUTONOMIC",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const day = isoDate(date);
    const base =
      "https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/bocyl/records";
    const records: BocylRecord[] = [];
    let offset = 0;
    for (;;) {
      const url = `${base}?where=fecha_publicacion=date'${day}'&limit=100&offset=${offset}`;
      const data = (await fetchJson(url)) as
        | { total_count?: number; results?: BocylRecord[] }
        | null;
      const batch = data?.results ?? [];
      records.push(...batch);
      if (batch.length < 100 || offset > 1000) break;
      offset += 100;
    }
    const pairs = records
      .filter((r) => r.enlace_fichero_xml)
      .map((r) => {
        const xmlUrl = (r.enlace_fichero_xml as string).replace(/^http:/, "https:");
        const pub: NormalizedPublication = {
          externalId: xmlUrl.split("/").pop()?.replace(/\.xml$/i, "") ?? xmlUrl,
          title: r.titulo ?? "",
          searchText: r.titulo ?? "",
          url: (r.enlace_fichero_html ?? xmlUrl).replace(/^http:/, "https:"),
          publishedAt: date,
          actType: inferActType(r.titulo ?? ""),
          region: "Castilla y León",
        };
        return { pub, xmlUrl };
      });

    await mapPool(pairs, CONCURRENCY, async ({ pub, xmlUrl }) => {
      const xml = await fetchText(xmlUrl, { charset: "iso-8859-15" });
      if (xml) pub.searchText = `${pub.title}\n${stripHtml(xml)}`.slice(0, MAX_BODY_CHARS);
    });

    return pairs.map((p) => p.pub);
  },
};
