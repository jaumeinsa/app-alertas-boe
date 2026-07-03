/**
 * Adaptador del BOP de León (24) — plataforma OpenCms SAGA `bop.dipuleon.es`.
 *
 * León publica el boletín entero como UN único PDF por día (con capa de texto),
 * así que se ingiere como 1 documento/día (searchText = texto del PDF completo).
 *
 * Hay DOS vías según antigüedad y el adaptador prueba primero la barata:
 *
 * 1) VÍA RECIENTE (~5 meses hacia atrás) — GET directo:
 *      GET /publica/consulta-de-bops/buscador/BOP-DD-MM-YYYY/
 *    Devuelve HTML que RESUELVE el UUID aleatorio del PDF del día y contiene el
 *    enlace directo:
 *      /export/sites/bop/.galleries/Documentos-BOPs-en-PDF/bop-DD_MM_YYYY-UUID-TIMESTAMP.pdf
 *    Días sin boletín (finde/festivo) o más antiguos que ~5 meses → HTTP 404.
 *
 * 2) VÍA HISTÓRICA (2020→~5 meses) — POST al listador Solr SagaListado:
 *      POST /system/modules/com.saga.listado/elements/SagaListado-element.jsp?__locale=es
 *      body: objeto `parametros` completo del portlet + rango de fechas del día
 *            (desde/hasta en ISO) → Solr `Old_PDF_Online`, carpeta Boletines-Anteriores.
 *    El HTML de resultados trae el enlace del boletín del día:
 *      /export/sites/bop/publica/boletines-anteriores/.galleries/Boletines-Anteriores/RESID_YYYYMMDD.pdf
 *    (RESID es un id de recurso OpenCms aleatorio, NO derivable de la fecha:
 *    por eso hay que pedirlo al listador). "No se han encontrado" → 0 resultados.
 *
 * Ambas vías terminan en un PDF con capa de texto perfecta que empieza por el
 * sumario ("S U M A R I O ... Número N"). externalId = code + YYYYMMDD.
 */

import {
  inferActType,
  NormalizedPublication,
  SourceAdapter,
} from "./types";
import { fetchPdfText, fetchText, MAX_BODY_CHARS, yyyymmdd } from "./util";

const CODE = "BOP_24";
const REGION = "León";
const BASE = "https://bop.dipuleon.es";
const AJAX =
  `${BASE}/system/modules/com.saga.listado/elements/SagaListado-element.jsp?__locale=es`;

/** DD-MM-YYYY (con guiones) para la ruta del buscador reciente. */
function ddmmyyyyDash(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getUTCFullYear()}`;
}

/**
 * Objeto `parametros` del portlet SagaListado de la página
 * /publica/boletines-anteriores/ (extraído del HTML server-side y verificado con
 * curl real). Es la configuración Solr del listador de boletines antiguos: índice
 * `Old_PDF_Online`, carpeta `Boletines-Anteriores`, sólo tipo `binary` (PDFs).
 * Se envía tal cual por POST; sólo se le añade el rango de fechas del día pedido.
 */
const HIST_PARAMS: Record<string, string> = {
  urlAjax:
    "/system/modules/com.saga.listado/elements/SagaListado-element.jsp?__locale=es",
  esOnline: "true",
  RecursoActual:
    "/publica/boletines-anteriores/.content/SagaListado/SagaListado-00001.xml",
  rutaConfiguracion:
    "/system/modules/com.saga.listado/configuracion_base.xml",
  idiomaUsuarioActual: "es",
  tipoLlamada: "ajax",
  urlActual:
    "/publica/boletines-anteriores/resultados-bop-anteriores/index.html",
  localeActual: "es",
  siteActual: "/sites/bop",
  subSiteActual: "/publica/boletines-anteriores/",
  TipoFormatter: "general",
  IndiceSolr: "Old_PDF_Online",
  ResultadosPorPagina: "15",
  tipo_paginacion: "numeros",
  SitemapBase: "/publica/boletines-anteriores/",
  indexacionFecha: "lastmodified",
  IndexacionFecha: "lastmodified",
  indexacionDescripcion: "Description_dprop_s",
  configIndexacionDescripcion: "todo",
  vistaDefecto: "list",
  TipoResultado: "listado",
  campoPersonalizado1: "Description_dprop_s",
  campoPersonalizado1Tipo: "string",
  MostrarFiltros: "facets",
  FiltroFechaRangos: "false",
  // Construcción de la query Solr
  TiposABuscar: "[binary]",
  TiposAExcluir: "[]",
  CarpetasPadre:
    "[/publica/boletines-anteriores/.galleries/Boletines-Anteriores/]",
  IgnorarCarpetasPadre: "false",
  CarpetasPadreExcluir: "[]",
  OrdenacionQuery: "lastmodified desc",
  ForzarOrdenacionBusqueda: "false",
  QueryExtra:
    "&hl.method=unified&hl.maxAnalyzedChars=2000000&hl.requireFieldMatch=false",
  FacetsExtra:
    "bopantiguo.anio_prop_s,bopantiguo.mes.formateado_prop_s",
  buscarTexto: "",
  buscarTipo: "",
  buscarCategoria: "",
  SoloUsuarioActual: "false",
  ActivarSistemaHighlight: "true",
  TamanoTextoHighlight: "400",
  CamposSolrHighlight:
    "spell,xmlTituloListado_es_t,Title_prop,xmlDescListado_es_t,Description_prop",
};

/** ISO tal como lo genera el front (new Date(fecha+' 00:00:00').toISOString()). */
function isoStart(d: Date): string {
  return new Date(Date.UTC(
    d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0
  )).toISOString();
}
function isoEnd(d: Date): string {
  return new Date(Date.UTC(
    d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59
  )).toISOString();
}

/**
 * Extrae el enlace al PDF del boletín del día. `ymd` (YYYYMMDD) se usa para
 * quedarnos SOLO con el boletín de la fecha pedida (el listador podría, en
 * teoría, colar algún día vecino). Devuelve la URL absoluta o null.
 */
function extractPdfUrl(html: string, ymd: string, re: RegExp): string | null {
  const matches = [...html.matchAll(re)].map((m) => m[0]);
  // Preferir el que contenga la fecha exacta; si no, el primero.
  const withDate = matches.find((p) => p.includes(ymd));
  const path = withDate ?? matches[0];
  if (!path) return null;
  return path.startsWith("http") ? path : BASE + (path.startsWith("/") ? path : "/" + path);
}

/** VÍA RECIENTE: GET al buscador; resuelve el UUID del PDF del día. */
async function fetchRecent(date: Date, ymd: string): Promise<string | null> {
  const url = `${BASE}/publica/consulta-de-bops/buscador/BOP-${ddmmyyyyDash(date)}/`;
  const html = await fetchText(url);
  if (!html) return null; // 404 → día sin boletín o fuera de la ventana reciente
  // /export/sites/bop/.galleries/Documentos-BOPs-en-PDF/bop-DD_MM_YYYY-UUID-TIMESTAMP.pdf
  const re =
    /\/export\/sites\/bop\/\.galleries\/Documentos-BOPs-en-PDF\/bop-[0-9_]+-[a-f0-9-]+-[0-9]+\.pdf/g;
  return extractPdfUrl(html, ymd, re);
}

/** VÍA HISTÓRICA: POST al listador Solr; resuelve el RESID del PDF del día. */
async function fetchHistoric(date: Date, ymd: string): Promise<string | null> {
  const body: Record<string, string> = {
    ...HIST_PARAMS,
    desde: isoStart(date),
    hasta: isoEnd(date),
    busquedaActiva: "true",
    forma_listar: "busqueda",
    pagina: "1",
  };
  const html = await fetchText(AJAX, {
    method: "POST",
    body,
    headers: { "X-Requested-With": "XMLHttpRequest" },
  });
  if (!html) return null;
  // .../Boletines-Anteriores/RESID_YYYYMMDD.pdf (RESID = id de recurso aleatorio)
  const re =
    /\/export\/sites\/bop\/publica\/boletines-anteriores\/\.galleries\/Boletines-Anteriores\/[0-9]+_[0-9]{8}\.pdf/g;
  const url = extractPdfUrl(html, ymd, re);
  // Sólo aceptar si el enlace es de la fecha pedida (evita días vecinos).
  return url && url.includes(`_${ymd}.pdf`) ? url : null;
}

export const bopLeonAdapter: SourceAdapter = {
  code: CODE,
  name: "Boletín Oficial de la Provincia de León",
  type: "BOP",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const ymd = yyyymmdd(date);

    // 1) Vía reciente (GET barato); 2) si no hay, vía histórica (POST Solr).
    let pdfUrl = await fetchRecent(date, ymd);
    if (!pdfUrl) pdfUrl = await fetchHistoric(date, ymd);
    if (!pdfUrl) return []; // día sin boletín (finde/festivo) → [] sin error

    const text = await fetchPdfText(pdfUrl);
    if (!text) return []; // el PDF no trajo texto: no reventar el día

    // Título determinista: "BOP León DD-MM-YYYY" + (si aparece) "Número N".
    // El texto del boletín trae "...de YYYY. Número N" en el sumario; si el
    // layout no lo expone (algún PDF reciente), nos quedamos con la fecha.
    const numM = text.match(/N[úu]mero\s*(\d{1,4})/);
    const num = numM ? ` Número ${numM[1]}` : "";
    const title = `BOP León ${ddmmyyyyDash(date)}${num}`.slice(0, 300);

    return [
      {
        externalId: `${CODE}-${ymd}`,
        title,
        searchText: text.slice(0, MAX_BODY_CHARS),
        url: pdfUrl,
        publishedAt: date,
        actType: inferActType(title),
        region: REGION,
      },
    ];
  },
};
