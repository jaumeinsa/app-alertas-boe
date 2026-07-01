/**
 * Adaptador del BOP de Ourense — code `BOP_32`.
 *
 * Plataforma Absis/BOP (Angular SPA + API REST). Todo JSON/GET:
 *   Boletín del día: /portalapi/api/boletin/getFecha/YYYYMMDD
 *     → [{ boletin: { numeroBop, edictos: [{ id, sumarioCas, ... }] } }]
 *   Texto del edicto (HTML): /portalapi/api/edicto/descargar/html/{id}/es
 *     (PDF alternativo: /edicto/descargar/pdf/{id}/idioma/es)
 * externalId = id del edicto.
 */

import {
  inferActType,
  NormalizedPublication,
  SourceAdapter,
} from "./types";
import {
  CONCURRENCY,
  fetchJson,
  fetchText,
  MAX_BODY_CHARS,
  mapPool,
  stripHtml,
  yyyymmdd,
} from "./util";

const API = "https://bop.depourense.es/portalapi/api";

interface OurEdicto {
  id: number;
  sumarioCas?: string;
  sumario?: string;
}

export const bopOurenseAdapter: SourceAdapter = {
  code: "BOP_32",
  name: "Boletín Oficial de la Provincia de Ourense",
  type: "BOP",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const data = (await fetchJson(
      `${API}/boletin/getFecha/${yyyymmdd(date)}`
    )) as Array<{ boletin?: { edictos?: OurEdicto[] }; edictos?: OurEdicto[] }> | null;
    const first = Array.isArray(data) ? data[0] : null;
    const edictos = first?.boletin?.edictos ?? first?.edictos ?? [];
    if (edictos.length === 0) return [];

    const out: NormalizedPublication[] = [];
    await mapPool(edictos, CONCURRENCY, async (e) => {
      const html = await fetchText(`${API}/edicto/descargar/html/${e.id}/es`);
      const text = html ? stripHtml(html) : "";
      if (!text) return;
      const title = (e.sumarioCas || e.sumario || `BOP Ourense ${e.id}`).slice(0, 300);
      out.push({
        externalId: String(e.id),
        title,
        searchText: `${title}\n${text}`.slice(0, MAX_BODY_CHARS),
        url: `${API}/edicto/descargar/pdf/${e.id}/idioma/es`,
        publishedAt: date,
        actType: inferActType(title),
        region: "Ourense",
      });
    });
    return out;
  },
};
