/**
 * Adaptador del BOP de Segovia (40) — plataforma Liferay + portlet ASAC
 * (`as_asac_bulletins`) en `www.dipsegovia.es/bop` (OJO: `bopsg.dipsegovia.es`
 * NO existe, NXDOMAIN). MISMA arquitectura ASAC que Cuenca, cambiando solo la
 * carpeta de documents (Segovia=39512, Cuenca=34525) y la instancia del
 * buscador. Segovia publica el boletín entero como UN PDF/día; lo ingerimos
 * como 1 documento/día con el texto completo del PDF.
 *
 * Pipeline fetchByDate(date):
 *   1) GET al buscador AssetSearch (INSTANCE r0jAmqbO3Q75) con un RANGO MENSUAL
 *      (un solo día a veces no renderiza tarjetas; el rango sí las renderiza
 *      server-side):
 *        /bop?p_p_id=..._INSTANCE_r0jAmqbO3Q75
 *          &p_p_lifecycle=0&p_p_state=normal&p_p_mode=view
 *          &p_r_p_startDate=01/MM/YYYY&p_r_p_endDate=DD/MM/YYYY  (%2F encoded)
 *   2) El HTML lista cada boletín como una miniatura:
 *        <img src="/documents/39512/{UUID}?t=...&documentThumbnail=1"
 *             alt="Imagen {diasemana}, {DD} de {mes} {YYYY}" />
 *      De cada <img> saco el UUID y la fecha (del alt). Filtro por la fecha
 *      pedida.
 *   3) CLAVE (misma técnica que Cuenca): quitar `?t=...&documentThumbnail=1` del
 *      mismo UUID => descarga el PDF del boletín completo (el mismo UUID sirve
 *      miniatura PNG o PDF según el parámetro): /documents/39512/{UUID} →
 *      application/pdf con capa de texto.
 *   4) 1 NormalizedPublication por boletín; searchText = texto del PDF completo
 *      (cap MAX_BODY_CHARS). externalId = "BOP_40-{UUID}" (estable y único).
 *
 * TLS: la cadena de certificado de dipsegovia.es la rechaza Node (self-signed
 * en la cadena), aunque curl la acepte → todas las peticiones con insecure:true.
 *
 * Día sin boletín (finde/festivo/jueves) → [] sin error.
 */

import {
  inferActType,
  NormalizedPublication,
  SourceAdapter,
} from "./types";
import { fetchPdfText, fetchText, MAX_BODY_CHARS } from "./util";

const BASE = "https://www.dipsegovia.es";
const DOCS = `${BASE}/documents/39512`;
const SEARCH_PATH = "/bop";
const INSTANCE =
  "as_asac_asset_search_AssetSearchInstancePortlet_INSTANCE_r0jAmqbO3Q75";

// Meses en español (como aparecen en el alt de la miniatura, minúsculas).
const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

interface SegoviaBoletin {
  uuid: string;
  pdfUrl: string;
}

/** Construye la URL del buscador con rango 01/MM/YYYY → DD/MM/YYYY. */
function searchUrl(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = date.getUTCFullYear();
  const start = encodeURIComponent(`01/${mm}/${yyyy}`);
  const end = encodeURIComponent(`${dd}/${mm}/${yyyy}`);
  const params =
    `p_p_id=${INSTANCE}` +
    `&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view` +
    `&p_r_p_startDate=${start}&p_r_p_endDate=${end}`;
  return `${BASE}${SEARCH_PATH}?${params}`;
}

/**
 * Extrae los boletines cuya fecha (en el alt de la miniatura) coincide con
 * `date`. El alt es "Imagen {diasemana}, {DD} de {mes} {YYYY}".
 */
function parseBoletines(html: string, date: Date): SegoviaBoletin[] {
  const day = date.getUTCDate();
  const monthName = MESES[date.getUTCMonth()];
  const year = date.getUTCFullYear();

  const out: SegoviaBoletin[] = [];
  const seen = new Set<string>();
  // <img src="/documents/39512/{UUID}?t=...&documentThumbnail=1" alt="..." />
  const re =
    /<img[^>]*src="\/documents\/39512\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\?[^"]*documentThumbnail=1"[^>]*alt="([^"]*)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const uuid = m[1];
    const alt = m[2];
    // alt: "Imagen lunes, 01 de junio 2026"
    const dm = /(\d{1,2})\s+de\s+([a-záéíóú]+)\s+(\d{4})/i.exec(alt);
    if (!dm) continue;
    const d = parseInt(dm[1], 10);
    const mesTxt = dm[2].toLowerCase();
    const y = parseInt(dm[3], 10);
    if (d === day && mesTxt === monthName && y === year && !seen.has(uuid)) {
      seen.add(uuid);
      out.push({ uuid, pdfUrl: `${DOCS}/${uuid}` });
    }
  }
  return out;
}

export const bopSegoviaAdapter: SourceAdapter = {
  code: "BOP_40",
  name: "Boletín Oficial de la Provincia de Segovia",
  type: "BOP",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const html = await fetchText(searchUrl(date), { insecure: true });
    if (!html) return [];

    const boletines = parseBoletines(html, date);
    if (boletines.length === 0) return []; // día sin boletín

    const out: NormalizedPublication[] = [];
    for (const b of boletines) {
      let text: string | null = null;
      try {
        text = await fetchPdfText(b.pdfUrl, { insecure: true });
      } catch {
        text = null; // error de red de un boletín → saltarlo, no tumbar el día
      }
      if (!text) continue;
      const title =
        text.replace(/\s+/g, " ").trim().slice(0, 200) ||
        `Boletín Oficial de la Provincia de Segovia ${b.uuid}`;
      out.push({
        externalId: `BOP_40-${b.uuid}`,
        title: title.slice(0, 300),
        searchText: text.slice(0, MAX_BODY_CHARS),
        url: b.pdfUrl,
        publishedAt: date,
        actType: inferActType(title),
        region: "Segovia",
      });
    }
    return out;
  },
};
