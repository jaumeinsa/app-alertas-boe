/**
 * Adaptador del BOB — Boletín Oficial de Bizkaia (48) — plataforma Liferay
 * `www.bizkaia.eus` (portlet IYBIWBCC). Cert OK, sin cookies/viewstate/JS.
 *
 * fetchByDate(date) en 2 pasos (anuncio a anuncio, PDF con capa de texto):
 *
 * PASO 1 — Resolver fecha → nº de boletín (POST simple, JSON):
 *   POST /es/bob?p_p_id=IYBIWBCC&p_p_lifecycle=2&p_p_state=normal&p_p_mode=view
 *        &p_p_resource_id=%2Fiybiwbcc%2FresourceBoletin&p_p_cacheability=cacheLevelPage
 *   body: _IYBIWBCC_year=YYYY & _IYBIWBCC_month=M   (month 1-based, sin cero)
 *   → JSON [{ fechaBoletin:"YYYYMMDD", numeroBoletin:"NNN", ... }].
 *   Se busca el objeto cuyo fechaBoletin == la fecha pedida; si no existe, ese
 *   día no hubo boletín → return [] sin error.
 *
 *   OJO WAF: este endpoint AJAX (lifecycle=2) está protegido por un F5 ASM que
 *   RECHAZA ("Request Rejected") cualquier petición cuyos nombres de cabecera
 *   vengan en minúsculas — que es justo lo que hace undici (el fetch de Node, y
 *   por tanto los helpers fetchJson/fetchText de util.ts, incluso con
 *   insecure:true). curl y el navegador pasan porque mandan las cabeceras con
 *   mayúsculas canónicas ("User-Agent", "Content-Type"). El ÚNICO cliente de
 *   Node que preserva ese casing es el módulo nativo `node:https`; por eso este
 *   PASO 1 usa https.request a pelo (verificado: undici→bloqueado, https→200).
 *   El resto de peticiones (PASO 2 y PDFs) van por rutas estáticas SIN ese WAF,
 *   así que usan los helpers normales de util.ts.
 *
 * PASO 2 — Listar anuncios del día (GET, render, bnum OBLIGATORIO):
 *   GET /es/bob/resultados?p_p_id=IYBIWBCC&p_p_lifecycle=0&p_p_state=normal
 *       &p_p_mode=view&_IYBIWBCC_mvcRenderCommandName=%2Fdetail
 *       &_IYBIWBCC_bdate=YYYYMMDD&_IYBIWBCC_bnum=NNN
 *   El HTML lista los PDF individuales (capa de texto), uno por anuncio:
 *     //www.bizkaia.eus/lehendakaritza/Bao_bob/{YYYY}/{MM}/{DD}/{ROMAN}-{NUM}_cas.pdf
 *   (ROMAN=I,II,... = sección; _cas=castellano). Regex:
 *     Bao_bob/YYYY/MM/DD/[A-Z]+-[0-9]+_cas\.pdf
 *   externalId = code + cve del anuncio (BOB-YYYYaNNN-(ROMAN-NUM)), estable.
 */

import https from "node:https";
import { inferActType, NormalizedPublication, SourceAdapter } from "./types";
import {
  CONCURRENCY,
  fetchPdfText,
  fetchText,
  MAX_BODY_CHARS,
  mapPool,
  UA,
  yyyymmdd,
} from "./util";

const BASE = "https://www.bizkaia.eus";
const RESOLVER_PATH =
  `/es/bob?p_p_id=IYBIWBCC&p_p_lifecycle=2&p_p_state=normal` +
  `&p_p_mode=view&p_p_resource_id=%2Fiybiwbcc%2FresourceBoletin` +
  `&p_p_cacheability=cacheLevelPage`;

interface BoletinMes {
  fechaBoletin: string; // "YYYYMMDD"
  numeroBoletin: string; // "NNN" (puede venir sin ceros)
}

/**
 * POST al resolver del mes con `node:https` (casing canónico → pasa el WAF F5).
 * Devuelve el cuerpo como string, o null ante error de red/timeout.
 */
function postResolver(body: string): Promise<string | null> {
  return new Promise((resolve) => {
    const req = https.request(
      {
        method: "POST",
        host: "www.bizkaia.eus",
        path: RESOLVER_PATH,
        headers: {
          "User-Agent": UA,
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: 45000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c as Buffer));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      }
    );
    req.on("error", () => resolve(null));
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
    req.write(body);
    req.end();
  });
}

/** Resuelve el nº de boletín publicado en `date`, o null si ese día no hubo. */
async function resolveBoletinNum(date: Date): Promise<string | null> {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1; // 1-based, sin cero
  const body = `_IYBIWBCC_year=${year}&_IYBIWBCC_month=${month}`;
  const raw = await postResolver(body);
  if (!raw) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(json)) return null;
  const target = yyyymmdd(date);
  for (const item of json as BoletinMes[]) {
    if (item && item.fechaBoletin === target && item.numeroBoletin) {
      return String(item.numeroBoletin);
    }
  }
  return null;
}

interface BobAnuncio {
  cve: string; // "ROMAN-NUM", p.ej. "I-114"
  pdfUrl: string;
}

/** Extrae los anuncios (PDF castellano) del HTML de detalle del día. */
function parseAnuncios(html: string, date: Date): BobAnuncio[] {
  const y = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  // Solo los PDF de ESE día (evita capturar rutas de otras fechas del portlet).
  const re = new RegExp(
    `Bao_bob/${y}/${mm}/${dd}/([A-Z]+-[0-9]+)_cas\\.pdf`,
    "g"
  );
  const out: BobAnuncio[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const cve = m[1];
    if (seen.has(cve)) continue;
    seen.add(cve);
    out.push({
      cve,
      pdfUrl: `${BASE}/lehendakaritza/Bao_bob/${y}/${mm}/${dd}/${cve}_cas.pdf`,
    });
  }
  return out;
}

/**
 * Título del anuncio a partir del texto del PDF. Salta el membrete fijo de la
 * cabecera del BOB (cve, "BOLETÍN OFICIAL DE BIZKAIA", "BOB", fecha/Núm./Pág.,
 * "SECCIÓN X") y encadena las siguientes líneas con contenido (organismo +
 * epígrafe del anuncio) hasta ~300 chars, que es lo descriptivo para el usuario.
 */
function extractTitle(text: string, cve: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const isMembrete = (l: string): boolean =>
    /^cve\s*:/i.test(l) ||
    /^BOLET[IÍ]N OFICIAL DE BIZKAIA/i.test(l) ||
    /^BAO\b/i.test(l) ||
    /^BOB$/i.test(l) ||
    /^SECCI[OÓ]N\b/i.test(l) ||
    /^(BOB-|BOBs-)/i.test(l) ||
    // Línea "Jueves, 13 de febrero de 2020Núm. 30Pág. 1"
    /N[uú]m\.?\s*\d+.*P[aá]g\.?\s*\d+/i.test(l) ||
    l.length < 3;
  const parts: string[] = [];
  for (const l of lines) {
    if (isMembrete(l)) {
      if (parts.length) break; // ya empezó el contenido y volvió el membrete
      continue;
    }
    parts.push(l);
    if (parts.join(" ").length >= 200) break;
  }
  const title = parts.join(" ").replace(/\s+/g, " ").trim();
  return title ? title.slice(0, 300) : `BOB ${cve}`;
}

export const bopBizkaiaAdapter: SourceAdapter = {
  code: "BOP_48",
  name: "Boletín Oficial de Bizkaia",
  type: "BOP",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const num = await resolveBoletinNum(date);
    if (!num) return []; // no publican todos los días → sin error

    const numCve = num.padStart(3, "0"); // cve usa 3 dígitos (BOB-2020a030)
    const bdate = yyyymmdd(date);
    const detailUrl =
      `${BASE}/es/bob/resultados?p_p_id=IYBIWBCC&p_p_lifecycle=0` +
      `&p_p_state=normal&p_p_mode=view` +
      `&_IYBIWBCC_mvcRenderCommandName=%2Fdetail` +
      `&_IYBIWBCC_bdate=${bdate}&_IYBIWBCC_bnum=${num}`;

    const html = await fetchText(detailUrl);
    if (!html) return [];

    const anuncios = parseAnuncios(html, date);
    if (anuncios.length === 0) return [];

    const out: NormalizedPublication[] = [];
    await mapPool(anuncios, CONCURRENCY, async (a) => {
      const text = await fetchPdfText(a.pdfUrl);
      if (!text) return; // error de red de un anuncio → saltar, no tumbar el día
      const title = extractTitle(text, a.cve);
      out.push({
        externalId: `BOP_48-BOB-${date.getUTCFullYear()}a${numCve}-${a.cve}`,
        title,
        searchText: text.slice(0, MAX_BODY_CHARS),
        url: a.pdfUrl,
        publishedAt: date,
        actType: inferActType(title),
        region: "Bizkaia",
      });
    });
    return out;
  },
};
