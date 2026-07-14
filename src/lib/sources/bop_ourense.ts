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
  fetchPdfText,
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
  sumarioGal?: string;
}

interface OurBoletin {
  maquetadosn?: string;
  edictos?: OurEdicto[];
}

/**
 * Texto de respaldo a partir de los sumarios que YA vienen en el JSON de la
 * lista (castellano, gallego y el sumario largo). Se usa cuando la descarga del
 * cuerpo del edicto falla (históricos maquetadosn:'N' → HTTP 500), de modo que
 * el edicto quede indexado al menos por su título y sumario.
 */
function summaryText(e: OurEdicto): string {
  const parts = [e.sumarioCas, e.sumario, e.sumarioGal].filter(
    (s): s is string => typeof s === "string" && s.trim().length > 0
  );
  return Array.from(new Set(parts)).join("\n");
}

export const bopOurenseAdapter: SourceAdapter = {
  code: "BOP_32",
  name: "Boletín Oficial de la Provincia de Ourense",
  type: "BOP",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const data = (await fetchJson(
      `${API}/boletin/getFecha/${yyyymmdd(date)}`
    )) as Array<{ boletin?: OurBoletin; edictos?: OurEdicto[] }> | null;
    const first = Array.isArray(data) ? data[0] : null;
    const edictos = first?.boletin?.edictos ?? first?.edictos ?? [];
    if (edictos.length === 0) return [];

    // Los boletines "maquetados" (maquetadosn:'S', recientes) sirven el cuerpo
    // del edicto por html/pdf con 200. Los históricos ('N') devuelven 500 en esa
    // 2ª llamada: no reintentamos (evita 6 peticiones fallidas por edicto) y
    // caemos directos al sumario del propio JSON de la lista.
    const maquetado = first?.boletin?.maquetadosn === "S";
    const dlOpts = maquetado ? {} : { retries: 0 };

    const out: NormalizedPublication[] = [];
    await mapPool(edictos, CONCURRENCY, async (e) => {
      const title = (
        e.sumarioCas ||
        e.sumario ||
        e.sumarioGal ||
        `BOP Ourense ${e.id}`
      ).slice(0, 300);

      // 1) Cuerpo completo: html y, si falla/viene vacío, pdf.
      const html = await fetchText(
        `${API}/edicto/descargar/html/${e.id}/es`,
        dlOpts
      );
      let body = html ? stripHtml(html) : "";
      if (!body) {
        const pdf = await fetchPdfText(
          `${API}/edicto/descargar/pdf/${e.id}/idioma/es`,
          dlOpts
        );
        if (pdf) body = pdf;
      }

      // 2) Fallback histórico: si no hay cuerpo, indexar por título + sumario.
      //    El edicto SIEMPRE se emite (nunca se descarta por no tener cuerpo).
      if (!body) body = summaryText(e);

      const summary = e.sumarioCas || e.sumarioGal || e.sumario;
      out.push({
        externalId: String(e.id),
        title,
        summary: summary || undefined,
        searchText: `${title}\n${body}`.slice(0, MAX_BODY_CHARS),
        url: `${API}/edicto/descargar/pdf/${e.id}/idioma/es`,
        publishedAt: date,
        actType: inferActType(title),
        region: "Ourense",
      });
    });
    return out;
  },
};
