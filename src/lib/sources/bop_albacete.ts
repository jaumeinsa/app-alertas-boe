/**
 * Adaptador del BOP de Albacete (02) — portal ASP.NET `bop.dipualba.es`.
 *
 * OJO: la home antigua `dipualba.es/WebBop` sigue en 503; el portal vivo es
 * `bop.dipualba.es`. El JS `js/home/index.min.js` define
 * `window.yedata='https://bop.dipualba.es/servicesajax/'` y sus endpoints.
 *
 * Pipeline fetchByDate(date) — SIN cookies, SIN token, SIN navegador:
 *   1) GET /servicesajax/obtenerdiaspublicacion/?a={YYYY-MM-DD}
 *      (cualquier día del mes objetivo). Respuesta:
 *      { yedata: <base64> } → base64-decode → JSON array de eventos del MES,
 *      cada uno { id (INTERNO, único global), idbop (nº impreso, se reinicia
 *      cada año), fechabop "DD/MM/YYYY", cantidadAnuncios, descripcion }.
 *   2) Elegir el evento cuyo fechabop == la fecha buscada. Si no existe → ese
 *      día no hubo boletín → return [].
 *   3) GET /servicesajax/descararchivobopcompleto/?a={id-INTERNO} → PDF del
 *      boletín completo del día (capa de texto perfecta).
 *
 * Cuidado con la AMBIGÜEDAD: `descararchivobopcompleto` con el `idbop` (nº
 * impreso) devuelve OTRO PDF (el idbop de otro año); usar SIEMPRE el `id`
 * interno del listado.
 *
 * Estilo "boletín completo por día": el boletín entero es 1 documento.
 * externalId = code + id interno (estable y único global).
 */

import {
  inferActType,
  NormalizedPublication,
  SourceAdapter,
} from "./types";
import { fetchJson, fetchPdfText, isoDate, MAX_BODY_CHARS } from "./util";

const BASE = "https://bop.dipualba.es/servicesajax";

interface DiaPublicacion {
  id: string; // id INTERNO, único global — el que hay que usar
  idbop: string; // nº impreso (se reinicia cada año) — NO usar para el PDF
  fechabop: string; // "DD/MM/YYYY"
  cantidadAnuncios?: string;
  descripcion?: string;
}

interface ObtenerDiasResponse {
  yedata?: string; // JSON array de DiaPublicacion, codificado en base64
}

/** Decodifica el `yedata` (base64 → JSON array) del listado del mes. */
function parseDiasPublicacion(json: unknown): DiaPublicacion[] {
  const b64 = (json as ObtenerDiasResponse | null)?.yedata;
  if (!b64 || typeof b64 !== "string") return [];
  try {
    const decoded = Buffer.from(b64, "base64").toString("utf-8");
    const arr = JSON.parse(decoded);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (e): e is DiaPublicacion =>
        typeof e?.id === "string" && typeof e?.fechabop === "string"
    );
  } catch {
    return [];
  }
}

export const bopAlbaceteAdapter: SourceAdapter = {
  code: "BOP_02",
  name: "Boletín Oficial de la Provincia de Albacete",
  type: "BOP",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    // Paso 1: días de publicación del mes (a= cualquier día del mes objetivo).
    const json = await fetchJson(
      `${BASE}/obtenerdiaspublicacion/?a=${isoDate(date)}`
    );
    const dias = parseDiasPublicacion(json);
    if (dias.length === 0) return [];

    // Paso 2: buscar el evento del día exacto (fechabop DD/MM/YYYY).
    const dd = String(date.getUTCDate()).padStart(2, "0");
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const target = `${dd}/${mm}/${date.getUTCFullYear()}`;
    const evento = dias.find((e) => e.fechabop === target);
    if (!evento) return []; // sin boletín ese día (finde/festivo) → sin error

    // Paso 3: PDF del boletín completo (usar SIEMPRE el id interno, no idbop).
    const url = `${BASE}/descararchivobopcompleto/?a=${encodeURIComponent(
      evento.id
    )}`;
    const text = await fetchPdfText(url);
    if (!text) return []; // el PDF no bajó o venía vacío → no tumbar el día

    const numero = evento.idbop ? `Boletín ${evento.idbop}` : "Boletín";
    const title = (
      evento.descripcion?.trim() ||
      text.replace(/\s+/g, " ").trim().slice(0, 200) ||
      `BOP Albacete ${numero} (${target})`
    ).slice(0, 300);

    return [
      {
        externalId: `BOP_02-${evento.id}`,
        title,
        searchText: `${title}\n${text}`.slice(0, MAX_BODY_CHARS),
        url,
        publishedAt: date,
        actType: inferActType(title),
        region: "Albacete",
      },
    ];
  },
};
