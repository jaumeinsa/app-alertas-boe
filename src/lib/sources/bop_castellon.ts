/**
 * Adaptador del BOP de Castellón (12) — Diputación de Castellón,
 * `bop.dipcas.es/PortalBOP` (portal JSF/PrimeFaces + RESTEasy).
 *
 * Castellón publica el boletín como UN PDF completo por día (patrón día-PDF,
 * como Cádiz/Soria): 1 NormalizedPublication = el boletín entero, con
 * searchText = texto íntegro del PDF.
 *
 * MODO B de la receta (funciona para CUALQUIER fecha, incluidas 2020/2012+):
 * "baile" de ViewState JSF contra el buscador de boletines antiguos. Formato de
 * fecha en todo el portal: DD/MM/YYYY.
 *
 * Pipeline fetchByDate(date):
 *
 *  1) GET https://bop.dipcas.es/PortalBOP/boletinesAntiguos/  (jar NUEVO).
 *     - Se captura del Set-Cookie el JSESSIONID (Path=/PortalBOP; Secure; HttpOnly)
 *       y del HTML el ViewState:  input hidden id="j_id1:javax.faces.ViewState:0".
 *       Todos los j_id1:...ViewState de la página comparten el mismo valor.
 *     - El GET inicial con jar nuevo entrega un ViewState válido para la búsqueda
 *       (no hace falta pasar por /buscador/). Sin cookie el POST da view_expired.
 *     - NECESITAMOS el Set-Cookie, que los helpers de util.ts no exponen, así que
 *       este único GET de cebado de sesión usa un fetch local (getSessionState)
 *       con undici — la misma librería que usa util. El resto (POST y PDF) va por
 *       los helpers obligatorios fetchText/fetchBuffer con la Cookie manual.
 *
 *  2) POST https://bop.dipcas.es/PortalBOP/boletinesAntiguos/  (AJAX parcial JSF)
 *     con la Cookie del paso 1 y el ViewState. Body urlencoded:
 *        javax.faces.partial.ajax=true
 *        javax.faces.source=buscadorForm:j_idt150            (botón "Buscar")
 *        javax.faces.partial.execute=buscadorForm
 *        javax.faces.partial.render=formListBoletinAntiguos formListAnunciosBolAnt buscadorForm buscadorReducidaForm
 *        buscadorForm:j_idt150=buscadorForm:j_idt150
 *        buscadorForm=buscadorForm
 *        buscadorForm:numBoletinAntiguo=(vacío)
 *        buscadorForm:fechaInicialAntiguo_input=DD/MM/YYYY
 *        buscadorForm:fechaFinalAntiguo_input=DD/MM/YYYY     (misma fecha = 1 día)
 *        javax.faces.ViewState={paso 1}
 *     (URLSearchParams codifica los ':' de los ids como %3A, que es lo que el
 *     servidor espera.) La respuesta es un <partial-response>; en
 *     <update id="formListBoletinAntiguos"><![CDATA[…datatable…]]> viene una fila
 *     por boletín con el enlace descargarBoletin?idBoletin=NNN y 3 spans
 *     class="text" = [Nº, DD/MM/YYYY, referencia BYYMMDD].
 *       - Sin fila / sin idBoletin (con sesión VÁLIDA) → ese día no hubo
 *         boletín → return [].
 *       - ViewState corrupto / sesión caducada → <redirect .../view_expired>
 *         (o ViewExpiredException/validationFailed). CRÍTICO: NO confundirlo con
 *         "día sin boletín". La sesión se cachea entre días (ver getCachedSession),
 *         así que ante view_expired hay que INVALIDAR la cache, re-cebar una vez y
 *         reintentar el POST; solo si con sesión fresca sigue sin idBoletin es un
 *         día realmente vacío → []. Devolver [] ante view_expired perdería el día.
 *
 *  3) idBoletin → PDF consolidado del boletín:
 *        GET https://bop.dipcas.es/PortalBOP/api/descargarBoletin?idBoletin=NNN&idioma=es
 *     Devuelve application/octet-stream con cuerpo %PDF- (fetchBuffer lo acepta por
 *     los magic bytes). Filename Nº-YYYY-es.pdf. PDF con capa de texto.
 *
 * externalId = "BOP_12-{idBoletin}"  (id de BD estable y único; fallback YYYYMMDD).
 * Verificado con curl real: 25/06/2026 → Nº76 idBoletin=26578 (PDF 10,2 MB);
 * 13/06/2023 → Nº74 idBoletin=18899; 13/02/2020 → Nº19 idBoletin=16298.
 */

import { fetch as undiciFetch } from "undici";

import {
  inferActType,
  NormalizedPublication,
  SourceAdapter,
} from "./types";
import {
  fetchBuffer,
  fetchText,
  MAX_BODY_CHARS,
  pdfToText,
  UA,
} from "./util";

const BASE = "https://bop.dipcas.es/PortalBOP";
const BOLANT_URL = `${BASE}/boletinesAntiguos/`;
const ACCEPT_LANG = "es-ES,es;q=0.9,en;q=0.8";

/** Sesión JSF: cookie JSESSIONID + valor del ViewState. */
interface SessionState {
  cookie: string;
  viewState: string;
}

/**
 * GET de cebado: obtiene JSESSIONID (Set-Cookie) + ViewState del buscador de
 * boletines antiguos. Es el único paso que necesita leer cabeceras de respuesta
 * (Set-Cookie), que los helpers de util.ts no exponen; por eso usa un fetch
 * local con undici (misma librería que util). Devuelve null ante cualquier fallo
 * de red → el adaptador devolverá [] sin lanzar.
 */
async function getSessionState(): Promise<SessionState | null> {
  try {
    const res = await undiciFetch(BOLANT_URL, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": ACCEPT_LANG,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) return null;

    // JSESSIONID del Set-Cookie (getSetCookie da un array por cookie).
    const setCookies = res.headers.getSetCookie?.() ?? [];
    let jsession: string | null = null;
    for (const c of setCookies) {
      const m = /^JSESSIONID=([^;]+)/.exec(c);
      if (m) {
        jsession = m[1];
        break;
      }
    }
    if (!jsession) return null;

    const html = await res.text();
    // Cualquiera de los j_id1:...ViewState comparte valor; tomamos el :0.
    const vs =
      /id="j_id1:javax\.faces\.ViewState:0" value="([^"]+)"/.exec(html) ??
      /name="javax\.faces\.ViewState"[^>]*value="([^"]+)"/.exec(html);
    if (!vs) return null;

    return { cookie: `JSESSIONID=${jsession}`, viewState: vs[1] };
  } catch {
    return null;
  }
}

/**
 * TTL de la sesión JSF cacheada. El JSESSIONID + ViewState del buscador de
 * boletines antiguos es reutilizable entre días y años (verificado: una sola
 * sesión resolvió 2020, 2023 y 2026 sin view_expired), pero el lado servidor la
 * expira por inactividad. ~18 min deja margen bajo el timeout típico de sesión
 * (30 min) sin arriesgar demasiadas caducidades a media ráfaga.
 */
const SESSION_TTL_MS = 18 * 60 * 1000;

/**
 * Sesión JSF cacheada a nivel de módulo. Evita re-cebar (GET ~1,8s, el coste
 * DOMINANTE por día) en cada fetchByDate; se comparte entre días dentro del
 * mismo proceso de ingesta/backfill.
 */
let cachedSession: { state: SessionState; ts: number } | null = null;

/**
 * Devuelve la sesión cacheada si sigue fresca (< SESSION_TTL_MS). Si no la hay,
 * caducó, o `forceRefresh` (tras un view_expired), ceba una nueva con
 * getSessionState() y la guarda. Ante fallo de red al cebar, deja la cache
 * vacía y devuelve null.
 */
async function getCachedSession(
  forceRefresh = false
): Promise<SessionState | null> {
  const now = Date.now();
  if (
    !forceRefresh &&
    cachedSession &&
    now - cachedSession.ts < SESSION_TTL_MS
  ) {
    return cachedSession.state;
  }
  const state = await getSessionState();
  cachedSession = state ? { state, ts: now } : null;
  return state;
}

/**
 * POST de búsqueda por fecha (mismo día en inicial y final = 1 día) con la
 * sesión indicada. Devuelve el XML del <partial-response> o null ante fallo de
 * red. El ':' de los ids lo codifica URLSearchParams como %3A, que es lo que el
 * servidor espera.
 */
function searchByDate(
  session: SessionState,
  fecha: string
): Promise<string | null> {
  return fetchText(BOLANT_URL, {
    method: "POST",
    headers: {
      Cookie: session.cookie,
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Faces-Request": "partial/ajax",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: {
      "javax.faces.partial.ajax": "true",
      "javax.faces.source": "buscadorForm:j_idt150",
      "javax.faces.partial.execute": "buscadorForm",
      "javax.faces.partial.render":
        "formListBoletinAntiguos formListAnunciosBolAnt buscadorForm buscadorReducidaForm",
      "buscadorForm:j_idt150": "buscadorForm:j_idt150",
      buscadorForm: "buscadorForm",
      "buscadorForm:numBoletinAntiguo": "",
      "buscadorForm:fechaInicialAntiguo_input": fecha,
      "buscadorForm:fechaFinalAntiguo_input": fecha,
      "javax.faces.ViewState": session.viewState,
    },
  });
}

/**
 * ¿Marcador de ViewState expirado DENTRO de un <partial-response>? JSF puede
 * responder al ViewState caducado (sesión aún viva) con un redirect a
 * view_expired o una ViewExpiredException/validationFailed en el cuerpo.
 */
function hasExpiredMarker(xml: string): boolean {
  return /view_expired|ViewExpiredException|validationFailed/i.test(xml);
}

/**
 * ¿La respuesta del POST es un resultado de búsqueda VÁLIDO (sesión buena)?
 * CRÍTICO para no confundir "sesión caducada" con "día sin boletín". Verificado
 * contra la sede tres formas de respuesta:
 *   - Día válido (con o sin boletín) → HTTP 200 con <partial-response>; la
 *     datatable trae o no una fila con idBoletin. ESTE es el único caso fiable.
 *   - JSESSIONID inválido/expirado → 302 a /PortalBOP/login → bucle de redirects
 *     → fetchText devuelve null.
 *   - ViewState expirado (sesión viva) → <partial-response> con marcador
 *     view_expired/ViewExpiredException/validationFailed.
 * Solo tratamos como válido lo que trae <partial-response> sin marcador de
 * caducidad; cualquier otra cosa (null incluido) es sesión caducada o fallo de
 * red → re-cebar y reintentar, NO dar el día por vacío.
 */
function isValidSearchResponse(xml: string | null): xml is string {
  return (
    xml !== null && /<partial-response/i.test(xml) && !hasExpiredMarker(xml)
  );
}

/**
 * Extrae del <partial-response> el idBoletin de la datatable
 * formListBoletinAntiguos. Devuelve null si no hay ninguno. Con una respuesta
 * VÁLIDA (ver isValidSearchResponse), null = día sin boletín.
 */
function parseIdBoletin(xml: string): string | null {
  // Aislar el bloque de la datatable para no capturar ids de otras zonas.
  const block =
    /<update id="formListBoletinAntiguos">([\s\S]*?)<\/update>/.exec(xml)?.[1] ??
    xml;
  const m = /descargarBoletin\?idBoletin=(\d+)/.exec(block);
  return m ? m[1] : null;
}

export const bopCastellonAdapter: SourceAdapter = {
  code: "BOP_12",
  name: "Boletín Oficial de la Provincia de Castellón",
  type: "BOP",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const dd = String(date.getUTCDate()).padStart(2, "0");
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const yyyy = date.getUTCFullYear();
    const fecha = `${dd}/${mm}/${yyyy}`; // DD/MM/YYYY

    // 1) Sesión JSF cacheada entre días: solo la 1ª llamada del proceso (o tras
    //    caducar) paga el GET de cebado (~1,8s); las siguientes la reutilizan.
    let session = await getCachedSession();
    if (!session) return [];

    // 2) POST de búsqueda por fecha.
    let respXml = await searchByDate(session, fecha);

    // 2b) CRÍTICO (correctitud): distinguir "sesión caducada" de "día sin
    //     boletín". Con la sesión cacheada, una caducidad se manifiesta como
    //     redirect a /login (fetchText → null) o como marcador view_expired en
    //     el cuerpo — NUNCA como una datatable vacía válida. Si la respuesta no
    //     es un <partial-response> limpio, invalidamos la cache, re-cebamos UNA
    //     vez y reintentamos; devolver [] aquí perdería un boletín real.
    if (!isValidSearchResponse(respXml)) {
      session = await getCachedSession(true);
      if (!session) return [];
      respXml = await searchByDate(session, fecha);
      // Con sesión fresca sigue sin respuesta válida → fallo transitorio de red
      // → [] (contrato "error de red → []"); no reintentamos en bucle.
      if (!isValidSearchResponse(respXml)) return [];
    }

    // Aquí respXml es un <partial-response> válido de una sesión buena.
    const idBoletin = parseIdBoletin(respXml);
    if (!idBoletin) return []; // sesión válida sin fila → día sin boletín → []

    // 3) Descargar el PDF completo del boletín.
    const pdfUrl = `${BASE}/api/descargarBoletin?idBoletin=${idBoletin}&idioma=es`;
    const buf = await fetchBuffer(pdfUrl);
    if (!buf) return []; // error de red del PDF → no tumbar el día
    const text = await pdfToText(buf);
    if (!text) return [];

    // Título: la portada trae un membrete plantilla estático (una fecha fija que
    // NO es la del boletín); el encabezado real va tras "SUMARI / SUMARIO" con la
    // fecha correcta ("JUEVES, 15 DE JUNIO DE 2023 - NÚMERO 75"). Preferimos ese;
    // si no aparece, caemos a las primeras líneas útiles o a un título por fecha.
    const flat = text.replace(/\s+/g, " ").trim();
    const sumario = /SUMARI[OA]?\s*\/?\s*SUMARIO?\s+(.{0,120})/i.exec(flat);
    const title = (
      sumario?.[1]?.trim() ||
      flat.slice(0, 120) ||
      `BOP Castellón nº ${idBoletin} — ${dd}/${mm}/${yyyy}`
    ).slice(0, 300);

    return [
      {
        externalId: `BOP_12-${idBoletin}`,
        title,
        searchText: text.slice(0, MAX_BODY_CHARS),
        url: pdfUrl,
        publishedAt: date,
        actType: inferActType(title),
        region: "Castellón",
      },
    ];
  },
};
