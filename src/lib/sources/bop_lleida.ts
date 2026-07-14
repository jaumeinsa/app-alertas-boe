/**
 * Adaptador del BOP de Lleida (25) — plataforma eBOP/DDGI `ebop.diputaciolleida.cat`.
 *
 * Portal nuevo (migración a mediados de 2023). El sumario del día vive en una
 * URL limpia `/bop/mostra-bop/{YYYY-MM-DD}/{YYYY}/{numBOP}` pero el nº de
 * boletín NO es derivable de la fecha: hay que resolverlo con un pequeño flujo
 * JSF (JavaServer Faces), POST-redirect-GET, SIN cookies (basta el jsessionid
 * incrustado en la URL del form):
 *
 *   1) GET  /bop/cerca
 *        → del HTML se cosecha el `;jsessionid=...` del action del formulario
 *          y el `javax.faces.ViewState`.
 *   2) POST /bop/cerca;jsessionid=... (application/x-www-form-urlencoded) con:
 *          formCercaData=formCercaData
 *          formCercaData:data={DD/MM/YYYY}
 *          formCercaData:exercici=            (vacío)
 *          formCercaData:numBop=              (vacío)
 *          formCercaData:j_idt23=Cerca
 *          javax.faces.ViewState={VS}
 *        → 302 a /bop/mostra-bop/{YYYY-MM-DD}/{YYYY}/{numBOP}. Node `fetch`
 *          sigue el redirect automáticamente y devuelve ese HTML.
 *          (Si el día no tiene boletín NO redirige: se queda en /bop/cerca con
 *           una página de error y 0 enlaces de edicto → devolvemos []).
 *   3) El HTML del sumario lista cada edicto en <li class="edicte"> con un
 *        <a href=".../aplicacions/bop/bopV1/fitxers/pdf/{YYYY}/{numBOP}/{fich}.pdf">
 *          {num} - <span>{ORGANISME}</span> - {TÍTOL}
 *        Los ficheros recientes se llaman `{YYYY}{numBOP}05NNNNN.pdf`; los
 *        antiguos (2020-2022) `BOP-NNNNNNNNN.pdf`. En días antiguos el sumario
 *        incluye además un PDF del boletín completo bajo
 *        `/aplicacions/bop/pdf-bops-complets/` — se ignora filtrando por la
 *        ruta `bopV1/fitxers/pdf/` (y por estar dentro de <li class="edicte">).
 *   4) Cada edicto es un PDF independiente con capa de texto (público, sin
 *        sesión) → un NormalizedPublication por edicto.
 *
 * externalId = code + nombre de fichero del PDF (estable y único por edicto).
 */

import {
  inferActType,
  NormalizedPublication,
  SourceAdapter,
} from "./types";
import {
  CONCURRENCY,
  ddmmyyyy,
  fetchPdfText,
  fetchText,
  MAX_BODY_CHARS,
  mapPool,
  stripHtml,
} from "./util";

const BASE = "https://ebop.diputaciolleida.cat";
const CERCA = `${BASE}/bop/cerca`;

interface LleidaEdicte {
  fileStem: string; // nombre del PDF sin extensión (id estable del edicto)
  num: string; // nº de edicto dentro del boletín ("5323", "985"...)
  organisme: string; // "AJUNTAMENT D'ALFÉS", "JUTJAT SOCIAL..."
  titol: string; // texto del edicto
  seccio: string; // sección del sumario ("Administració Local - Ajuntaments")
  pdfUrl: string; // URL absoluta del PDF del edicto
}

/** Decodifica las entidades HTML mínimas que aparecen en el ViewState/enlaces. */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

/** Extrae el `;jsessionid=...` del action del formulario de búsqueda. */
function extractJsessionId(html: string): string | null {
  const m = /action="\/bop\/cerca;jsessionid=([^"?;]+)"/.exec(html);
  return m ? m[1] : null;
}

/** Extrae el valor de `javax.faces.ViewState` del HTML del formulario. */
function extractViewState(html: string): string | null {
  const m =
    /name="javax\.faces\.ViewState"[^>]*value="([^"]*)"/.exec(html) ??
    /value="([^"]*)"[^>]*name="javax\.faces\.ViewState"/.exec(html);
  return m ? decodeEntities(m[1]) : null;
}

/**
 * Parsea el sumario del día. Recorre los <li class="edicte"> (así se excluye
 * de forma natural el PDF del boletín completo, que está fuera de la lista) y,
 * para dar contexto, arrastra el último <h2 class="seccioTau"> visto.
 */
function parseSumario(html: string): LleidaEdicte[] {
  const out: LleidaEdicte[] = [];
  const seen = new Set<string>();

  // Recorremos el HTML de principio a fin capturando dos tipos de marca:
  // encabezados de sección y bloques de edicto, para conservar la sección.
  const tokenRe =
    /<h2 class="seccioTau">([\s\S]*?)<\/h2>|<li class="edicte">([\s\S]*?)<\/li>/g;
  let seccioActual = "";
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(html))) {
    if (m[1] !== undefined) {
      seccioActual = stripHtml(m[1]);
      continue;
    }
    const block = m[2];
    // Enlace al PDF del edicto (ruta bopV1/fitxers/pdf). Puede ser relativa
    // (antiguos) o absoluta (recientes).
    const hrefM =
      /href="([^"]*\/aplicacions\/bop\/bopV1\/fitxers\/pdf\/[^"]*\.pdf)"/.exec(
        block
      );
    if (!hrefM) continue;
    const href = decodeEntities(hrefM[1]);
    const pdfUrl = href.startsWith("http") ? href : BASE + href;
    const fileM = /\/([^/]+)\.pdf$/.exec(pdfUrl);
    const fileStem = fileM ? fileM[1] : "";
    if (!fileStem || seen.has(fileStem)) continue;
    seen.add(fileStem);

    // Texto del anchor: "{num} - <span>{ORGANISME}</span> - {TÍTOL}".
    const anchorM = /<a\b[^>]*>([\s\S]*?)<\/a>/.exec(block);
    const anchorInner = anchorM ? anchorM[1] : block;
    const spanM = /<span>([\s\S]*?)<\/span>/.exec(anchorInner);
    const organisme = spanM ? stripHtml(spanM[1]) : "";
    // Nº de edicto: lo que va antes del primer " - ".
    const numM = /^\s*([^<\-\s][^<]*?)\s*-\s*<span>/.exec(anchorInner);
    const num = numM ? stripHtml(numM[1]) : "";
    // Título: todo el texto del anchor, quitando el número y el organismo del inicio.
    let titol = stripHtml(anchorInner);
    if (organisme) {
      const cut = titol.indexOf(organisme);
      if (cut >= 0) {
        titol = titol.slice(cut + organisme.length).replace(/^\s*-\s*/, "").trim();
      }
    }
    if (!titol) titol = stripHtml(anchorInner);

    out.push({
      fileStem,
      num,
      organisme,
      titol,
      seccio: seccioActual,
      pdfUrl,
    });
  }
  return out;
}

/** Resuelve el sumario del día: GET /bop/cerca + POST con la fecha → HTML mostra-bop. */
async function fetchSumarioHtml(date: Date): Promise<string | null> {
  const form = await fetchText(CERCA);
  if (!form) return null;
  const jsessionId = extractJsessionId(form);
  const viewState = extractViewState(form);
  if (!jsessionId || !viewState) return null;

  const postUrl = `${CERCA};jsessionid=${jsessionId}`;
  const html = await fetchText(postUrl, {
    method: "POST",
    body: {
      formCercaData: "formCercaData",
      "formCercaData:data": ddmmyyyy(date, "/"), // DD/MM/YYYY
      "formCercaData:exercici": "",
      "formCercaData:numBop": "",
      "formCercaData:j_idt23": "Cerca",
      "javax.faces.ViewState": viewState,
    },
  });
  return html;
}

export const bopLleidaAdapter: SourceAdapter = {
  code: "BOP_25",
  name: "Butlletí Oficial de la Província de Lleida",
  type: "BOP",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const html = await fetchSumarioHtml(date);
    if (!html) return []; // sin sesión/ViewState resoluble o red caída

    const edictes = parseSumario(html);
    if (edictes.length === 0) return []; // finde/festivo o día sin boletín

    const out: NormalizedPublication[] = edictes.map((e) => {
      const title = (e.organisme ? `${e.organisme} - ${e.titol}` : e.titol)
        .slice(0, 300)
        .trim();
      return {
        externalId: `BOP_25-${e.fileStem}`,
        title: title || `BOP Lleida ${e.num || e.fileStem}`,
        searchText: [e.seccio, e.organisme, e.titol]
          .filter(Boolean)
          .join("\n")
          .slice(0, MAX_BODY_CHARS),
        url: e.pdfUrl,
        publishedAt: date,
        actType: inferActType(`${e.organisme} ${e.titol}`),
        region: "Lleida",
      };
    });

    // Texto completo del PDF por edicto (capa de texto, sin OCR). El PDF es
    // público (no requiere la sesión). Un fallo de red de un edicto no tumba
    // el día: conserva el título del sumario como searchText.
    await mapPool(out, CONCURRENCY, async (pub, i) => {
      const txt = await fetchPdfText(edictes[i].pdfUrl);
      if (txt) {
        pub.searchText = [edictes[i].seccio, edictes[i].organisme, txt]
          .filter(Boolean)
          .join("\n")
          .slice(0, MAX_BODY_CHARS);
      }
    });

    return out;
  },
};
