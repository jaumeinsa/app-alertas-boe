/**
 * Adaptador del BOP de Cáceres (Diputación de Cáceres) — code `BOP_10`.
 *
 * Plataforma propia `bop.dip-caceres.es` con API JSON. El más simple de todos:
 * UN solo GET por día devuelve todos los anuncios con su texto completo:
 *   /bop/services/anuncios/fechaPublicacion?fechaPublic={MM}/{DD}/{YYYY}
 *     ⚠️ formato AMERICANO MM/DD/YYYY con ceros a la izquierda.
 *     → { data: [{ csv, tituloAnuncio, contenidoHtml, nombreEntidad,
 *                  nombreTipoEntidad, numBop, idAnuncio, ... }], total }
 *     data vacío = día sin boletín (finde/festivo).
 *
 *   - csv ("BOP-2026-2943") es único y estable → externalId.
 *   - tituloAnuncio ya incluye el CSV al principio; se recorta del título
 *     visible pero se conserva en externalId.
 *   - contenidoHtml trae el cuerpo íntegro (nombres, NIFs, anexos en tablas)
 *     con entidades HTML escapadas (&uacute;…). El stripHtml de util.ts se
 *     come las entidades con nombre (→ espacio), así que las acentuadas se
 *     decodifican ANTES localmente para no perder tildes.
 *   - URL pública del anuncio: /bop/anuncio.html?csv={csv}
 */

import { inferActType, NormalizedPublication, SourceAdapter } from "./types";
import { fetchJson, MAX_BODY_CHARS, stripHtml } from "./util";

const BASE = "https://bop.dip-caceres.es/bop";

interface CaceresAnuncio {
  csv?: string | null;
  tituloAnuncio?: string | null;
  contenidoHtml?: string | null;
  nombreEntidad?: string | null;
  nombreTipoEntidad?: string | null;
  idAnuncio?: number | null;
}

interface CaceresResponse {
  data?: CaceresAnuncio[] | null;
  total?: number | null;
}

// Entidades HTML con nombre que stripHtml destruiría (las convierte en
// espacio). Se decodifican antes: acentuadas, ñ/ü/ç, ordinales y comillas.
// Case-sensitive: &Aacute; ≠ &aacute;.
const NAMED_ENTITIES: Record<string, string> = {
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
  ntilde: "ñ", Ntilde: "Ñ", uuml: "ü", Uuml: "Ü", ccedil: "ç", Ccedil: "Ç",
  agrave: "à", egrave: "è", igrave: "ì", ograve: "ò", ugrave: "ù",
  ordf: "ª", ordm: "º", deg: "°", middot: "·", quot: '"', apos: "'",
  laquo: "«", raquo: "»", ndash: "–", mdash: "—", euro: "€", amp: "&",
};

/** Decodifica entidades acentuadas/comunes (pre-stripHtml) y numéricas (post). */
function decodeNamed(s: string): string {
  return s
    .replace(/&([A-Za-z]+);/g, (full, name: string) => NAMED_ENTITIES[name] ?? full)
    .replace(/&#39;/g, "'");
}

function decodeNumeric(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)));
}

/** HTML del anuncio → texto plano con tildes intactas. */
function htmlToText(html: string): string {
  // Orden: 1) decodificar acentuadas (antes de que stripHtml las borre);
  // &lt;/&gt; NO se decodifican aquí para no fabricar falsas etiquetas.
  // 2) stripHtml quita etiquetas/&nbsp;/entidades restantes. 3) numéricas.
  return decodeNumeric(stripHtml(decodeNamed(html)));
}

export const bopCaceresAdapter: SourceAdapter = {
  code: "BOP_10",
  name: "Boletín Oficial de la Provincia de Cáceres",
  type: "BOP",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    // ⚠️ Formato americano MM/DD/YYYY.
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(date.getUTCDate()).padStart(2, "0");
    const fecha = `${mm}/${dd}/${date.getUTCFullYear()}`;

    const json = (await fetchJson(
      `${BASE}/services/anuncios/fechaPublicacion?fechaPublic=${fecha}`
    )) as CaceresResponse | null;
    const anuncios = json?.data;
    if (!Array.isArray(anuncios) || anuncios.length === 0) return []; // sin boletín

    const out: NormalizedPublication[] = [];
    const seen = new Set<string>();
    for (const a of anuncios) {
      const externalId =
        a.csv?.trim() || (a.idAnuncio ? `BOP-CC-ID-${a.idAnuncio}` : "");
      if (!externalId || seen.has(externalId)) continue;
      seen.add(externalId);

      const rawTitle = htmlToText(a.tituloAnuncio ?? "");
      // El título llega con el CSV delante ("BOP-2026-2943 Relación…"):
      // se recorta del título visible (queda en externalId).
      const title =
        rawTitle.replace(/^BOP-\d{4}-\d+\s*/i, "").trim().slice(0, 300) ||
        `BOP Cáceres ${externalId}`;

      const body = a.contenidoHtml ? htmlToText(a.contenidoHtml) : "";
      const organismo = [a.nombreEntidad, a.nombreTipoEntidad]
        .filter(Boolean)
        .join(" — ");

      out.push({
        externalId,
        title,
        searchText: [title, organismo, body]
          .filter(Boolean)
          .join("\n")
          .slice(0, MAX_BODY_CHARS),
        url: `${BASE}/anuncio.html?csv=${encodeURIComponent(externalId)}`,
        publishedAt: date,
        actType: inferActType(title),
        region: "Cáceres",
      });
    }
    return out;
  },
};
