/**
 * Adaptador del BOTHA — Boletín Oficial del Territorio Histórico de Álava (01).
 * Plataforma ASP.NET `www.araba.eus/botha` (SGBO50xx.aspx).
 *
 * Sumario del día en UN SOLO GET, sin __VIEWSTATE, sin POST, sin cookies:
 *   GET /botha/Inicio/SGBO5001.aspx?FechaBotha=DD/MM/YYYY
 *   (REQUIERE insecure:true — el certificado de www.araba.eus falla en Node,
 *    aunque curl -k lo acepta).
 * El HTML lista cada anuncio del día como PDF individual con capa de texto:
 *   href="../Boletines/{YYYY}/{NNN}/{YYYY}_{NNN}_{NNNNN}_C.pdf"  (_C = castellano)
 *   URL absoluta = https://www.araba.eus/botha/ + (href sin "../").
 * El nº de boletín ({NNN}) sale del propio enlace del anuncio o del sumario
 * _S_C.pdf. externalId = "{YYYY}_{NNN}_{NNNNN}" (código oficial del anuncio).
 *
 * BOTHA publica ~3 días/semana (lun/mié/vie típico), no todos los laborables.
 * Un día sin boletín devuelve una página placeholder (~53KB) SIN enlaces
 * _C.pdf → se trata como "no publicado" (return []). Cada anuncio es 1 doc.
 */

import { inferActType, NormalizedPublication, SourceAdapter } from "./types";
import {
  CONCURRENCY,
  fetchPdfText,
  fetchText,
  MAX_BODY_CHARS,
  mapPool,
} from "./util";

const BASE = "https://www.araba.eus/botha";
const SUMARIO = `${BASE}/Inicio/SGBO5001.aspx`;

interface AlavaAnuncio {
  /** Código oficial "{YYYY}_{NNN}_{NNNNN}" (año_boletín_secuencial). */
  code: string;
  pdfUrl: string;
}

/** DD/MM/YYYY (formato que espera FechaBotha). */
function ddmmyyyySlash(d: Date): string {
  return [
    String(d.getUTCDate()).padStart(2, "0"),
    String(d.getUTCMonth() + 1).padStart(2, "0"),
    d.getUTCFullYear(),
  ].join("/");
}

/**
 * Extrae los anuncios del sumario HTML: cada uno es un PDF castellano
 * `Boletines/{YYYY}/{NNN}/{YYYY}_{NNN}_{NNNNN}_C.pdf`. Se descartan los
 * enlaces de sumario (`{YYYY}_{NNN}_S_C.pdf`) porque el 3er segmento es "S",
 * no numérico, y el regex exige dígitos.
 */
function parseSumario(html: string): AlavaAnuncio[] {
  const out: AlavaAnuncio[] = [];
  const seen = new Set<string>();
  const linkRe =
    /Boletines\/(\d{4})\/(\d+)\/(\d{4}_\d+_\d+)_C\.pdf/g;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html))) {
    const code = m[3];
    if (seen.has(code)) continue;
    seen.add(code);
    const pdfUrl = `${BASE}/Boletines/${m[1]}/${m[2]}/${code}_C.pdf`;
    out.push({ code, pdfUrl });
  }
  return out;
}

/**
 * Título = primeras líneas útiles del PDF saltando el boiler de cabecera
 * (fecha "… • Núm. N", paginación "N/M", código "YYYY-NNNNN", D.L./ISSN, la URL
 * y los rótulos de sección/administración en MAYÚSCULAS). Cap 300.
 */
function extractTitle(text: string, code: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const meaningful = lines.filter(
    (l) =>
      !/•\s*Núm\.\s*\d+/i.test(l) &&
      !/^\d+\/\d+$/.test(l) &&
      !/^\d{4}-\d+$/.test(l) &&
      !/^D\.L\.:/i.test(l) &&
      !/ISSN/i.test(l) &&
      !/^www\.araba\.eus$/i.test(l) &&
      !/^[IVX]+\s*-\s/.test(l) &&
      // Rótulos de administración/sección en mayúsculas (sin minúsculas).
      !(l === l.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(l))
  );
  const title = meaningful
    .slice(0, 4)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
  return title || `BOTHA Álava ${code}`;
}

export const bopAlavaAdapter: SourceAdapter = {
  code: "BOP_01",
  name: "Boletín Oficial del Territorio Histórico de Álava (BOTHA)",
  type: "BOP",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const fecha = ddmmyyyySlash(date);
    const html = await fetchText(
      `${SUMARIO}?FechaBotha=${encodeURIComponent(fecha)}`,
      { insecure: true } // cert de www.araba.eus roto para Node (curl -k)
    );
    if (!html) return [];

    const anuncios = parseSumario(html);
    if (anuncios.length === 0) return []; // día sin boletín (placeholder ~53KB)

    const out: NormalizedPublication[] = [];
    await mapPool(anuncios, CONCURRENCY, async (a) => {
      const text = await fetchPdfText(a.pdfUrl, { insecure: true });
      if (!text) return; // error de red / PDF vacío → saltar este anuncio
      const title = extractTitle(text, a.code);
      out.push({
        externalId: `BOP_01-${a.code}`,
        title,
        searchText: text.slice(0, MAX_BODY_CHARS),
        url: a.pdfUrl,
        publishedAt: date,
        actType: inferActType(title),
        region: "Álava",
      });
    });
    return out;
  },
};
