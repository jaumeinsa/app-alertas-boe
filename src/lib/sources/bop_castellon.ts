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
 *       - Sin fila / sin idBoletin → ese día no hubo boletín → return [].
 *       - ViewState corrupto / sesión caducada → <redirect .../view_expired> →
 *         no hay idBoletin → return [] (sin lanzar).
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
 * Extrae del <partial-response> el idBoletin de la datatable
 * formListBoletinAntiguos. Devuelve null si no hay ninguno (día sin boletín o
 * redirect a view_expired).
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
    // 1) Cebar sesión: JSESSIONID + ViewState.
    const session = await getSessionState();
    if (!session) return [];

    const dd = String(date.getUTCDate()).padStart(2, "0");
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const yyyy = date.getUTCFullYear();
    const fecha = `${dd}/${mm}/${yyyy}`; // DD/MM/YYYY

    // 2) POST de búsqueda por fecha (mismo día en inicial y final = 1 día).
    const respXml = await fetchText(BOLANT_URL, {
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
    if (!respXml) return [];

    const idBoletin = parseIdBoletin(respXml);
    if (!idBoletin) return []; // día sin boletín (o view_expired) → [] sin error

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
