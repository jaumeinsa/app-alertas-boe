/**
 * Adaptador del BORM (Boletín Oficial de la Región de Murcia).
 * API REST JSON del propio portal (borm.es). Requiere cabeceras de navegador
 * (protección anti-bot Radware) y fecha en formato DD-MM-YYYY.
 *
 *   Sumario:  https://www.borm.es/services/boletin/fecha/{DD-MM-YYYY}/sumario
 *   Texto:    https://www.borm.es/services/anuncio/{id}/txt
 */

import { inferActType, NormalizedPublication, SourceAdapter } from "./types";
import { CONCURRENCY, MAX_BODY_CHARS, ddmmyyyy, fetchJson, fetchText, mapPool } from "./util";

const HEADERS = {
  Referer: "https://www.borm.es/",
  "X-Requested-With": "XMLHttpRequest",
  Accept: "application/json",
};

interface BormAnuncio {
  id: number;
  sumario?: string;
  numero?: number;
}

export const bormCcaaAdapter: SourceAdapter = {
  code: "BORM",
  name: "Boletín Oficial de la Región de Murcia",
  type: "AUTONOMIC",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const f = ddmmyyyy(date); // DD-MM-YYYY
    const sumario = (await fetchJson(
      `https://www.borm.es/services/boletin/fecha/${f}/sumario`,
      { headers: HEADERS }
    )) as { anunciosBoletin?: BormAnuncio[] } | null;
    const anuncios = sumario?.anunciosBoletin;
    if (!anuncios || anuncios.length === 0) return [];

    const out: NormalizedPublication[] = anuncios.map((a) => ({
      externalId: String(a.id),
      title: a.sumario ?? "",
      searchText: a.sumario ?? "",
      url: `https://www.borm.es/#/home/anuncio/${f}/${a.numero ?? ""}`,
      publishedAt: date,
      actType: inferActType(a.sumario ?? ""),
      region: "Murcia",
    }));

    await mapPool(out, CONCURRENCY, async (pub) => {
      const txt = await fetchText(
        `https://www.borm.es/services/anuncio/${pub.externalId}/txt`,
        { headers: HEADERS }
      );
      if (txt) pub.searchText = `${pub.title}\n${txt}`.slice(0, MAX_BODY_CHARS);
    });

    return out;
  },
};
