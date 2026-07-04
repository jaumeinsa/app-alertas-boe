/**
 * Adaptador del BORM (Boletín Oficial de la Región de Murcia).
 * API REST JSON del propio portal (borm.es). Requiere cabeceras de navegador
 * (protección anti-bot Radware) y fecha en formato DD-MM-YYYY.
 *
 *   Sumario:  https://www.borm.es/services/boletin/fecha/{DD-MM-YYYY}/sumario
 *   Texto:    https://www.borm.es/services/anuncio/{id}/txt
 */

import { inferActType, NormalizedPublication, SourceAdapter } from "./types";
import { CONCURRENCY, MAX_BODY_CHARS, ddmmyyyy, fetchText, mapPool } from "./util";

// El sumario exige Accept: application/json; el /txt devuelve 406 con ese
// Accept y 200 (text/plain) sin él.
const JSON_HEADERS = {
  Referer: "https://www.borm.es/",
  "X-Requested-With": "XMLHttpRequest",
  Accept: "application/json",
};
const TXT_HEADERS = {
  Referer: "https://www.borm.es/",
  "X-Requested-With": "XMLHttpRequest",
  Accept: "text/plain, */*",
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
    // Pedimos el sumario como TEXTO para poder distinguir el JSON real del
    // challenge anti-bot de Radware (HTML con `__uzdbm`), que llega con 200 y
    // parecería "día sin boletín". Sin esta distinción un backfill puede dar
    // un falso "completo" (le pasó a 2022/2024). Si detectamos el challenge,
    // LANZAMOS para que la ingesta lo registre como fallo, no como día vacío.
    const raw = await fetchText(
      `https://www.borm.es/services/boletin/fecha/${f}/sumario`,
      { headers: JSON_HEADERS }
    );
    if (raw == null) return []; // error de red puntual
    const head = raw.trimStart().slice(0, 400).toLowerCase();
    if (head.startsWith("<") || head.includes("uzdbm") || head.includes("incapsula")) {
      throw new Error("BORM: challenge anti-bot Radware (WAF cerrado)");
    }
    let sumario: { anunciosBoletin?: BormAnuncio[] } | null = null;
    try {
      sumario = JSON.parse(raw);
    } catch {
      return []; // respuesta no-JSON no reconocible → tratar como día sin boletín
    }
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
        { headers: TXT_HEADERS }
      );
      if (txt) pub.searchText = `${pub.title}\n${txt}`.slice(0, MAX_BODY_CHARS);
    });

    return out;
  },
};
