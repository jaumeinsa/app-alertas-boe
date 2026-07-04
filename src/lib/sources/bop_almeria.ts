/**
 * Adaptador del BOP de Almería (04) — archivo digital **Pandora** (Cran
 * Consulting) en `app.dipalme.org/pandora`. NO se usa el visor ZK (zkau+JS):
 * Pandora es todo GET stateless (sin cookies ni JS), 1 PDF completo por día
 * (patrón día-PDF como Cádiz/León): 1 NormalizedPublication = el boletín entero.
 *
 * Nodo del BOP en el árbol Pandora:
 *   parent:0000010919  ("Boletín Oficial de la Provincia de Almería")
 *   → 48.092 ejemplares, desde 28/7/1834 hasta hoy menos ~2 semanas
 *     (Pandora tiene un retraso de ingesta de ~2 semanas; si la fecha objetivo
 *     es más reciente que el último ejemplar disponible → return []).
 *
 * Pipeline fetchByDate(date), todo GET (UA Chrome + Accept-Language es-ES):
 *
 *  1) Listado paginado por fecha de creación ASCENDENTE (t=+creation):
 *       GET results.vm?q=parent:0000010919&t=%2Bcreation&s={offset}&l=100&lang=es&view=global
 *     Cada página trae 100 ítems (l=100 es el máximo real; >100 cae a 15) con
 *     enlaces:
 *       high.raw?id={docId}&name={name}&attachment={att}
 *     donde `att` (URL-encoded + entidades HTML) termina en 'D/M/YYYY.pdf' SIN
 *     ceros a la izquierda (p.ej. '14/2/2020.pdf'). El total ("Resultados:
 *     <strong>48.092</strong>", puntos = miles) da el nº de ejemplares.
 *
 *  2) Búsqueda binaria sobre el offset `s` (alineado a múltiplos de 100):
 *     como el orden es por fecha ascendente, se compara la fecha objetivo con la
 *     fecha mín/máx de las 100 fechas de cada página y se estrecha el intervalo.
 *     Converge en ~6-10 GETs. Se cachea la última página cargada por si el mismo
 *     backfill pide fechas contiguas.
 *
 *  3) docId de la fecha objetivo → PDF del boletín completo:
 *       GET high.raw?id={docId}&name=00000001.original.pdf&attachment=x.pdf
 *     (name=00000001.original.pdf es CONSTANTE y obligatorio; attachment es
 *     decorativo). Devuelve application/pdf con capa de texto.
 *
 * externalId = "BOP_04-{docId}" (docId Pandora, estable y permanente por ejemplar).
 * Verificado con curl: 19/6/2026=0000392690, 15/3/2023=0000390559, 14/2/2020=0000389630.
 */

import {
  inferActType,
  NormalizedPublication,
  SourceAdapter,
} from "./types";
import { fetchPdfText, fetchText, MAX_BODY_CHARS } from "./util";

const PANDORA = "https://app.dipalme.org/pandora";
const PARENT = "0000010919"; // nodo del BOP de Almería en el árbol Pandora
const PAGE = 100; // ítems por página (máximo real de `l`)

interface Item {
  docId: string;
  /** Fecha del ejemplar como número YYYYMMDD para comparar. */
  ymd: number;
}

/** Convierte una fecha a clave numérica YYYYMMDD comparable. */
function toKey(y: number, m: number, d: number): number {
  return y * 10000 + m * 100 + d;
}

/**
 * Descarga y parsea una página del listado (offset `s`). Devuelve los ítems
 * (docId + fecha) en orden ascendente, o null si falla la red.
 */
async function fetchPage(offset: number): Promise<Item[] | null> {
  const url =
    `${PANDORA}/results.vm?q=parent:${PARENT}` +
    `&t=%2Bcreation&s=${offset}&l=${PAGE}&lang=es&view=global`;
  const html = await fetchText(url);
  if (!html) return null;

  const items: Item[] = [];
  // high.raw?id={docId}&name=...&attachment={att}  — att acaba en D/M/YYYY.pdf
  const re = /high\.raw\?id=(\d+)&name=[^&"]+&attachment=([^"]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const docId = m[1];
    // Decodificar la fecha del final del attachment. Viene doble-codificada:
    // entidades HTML (&#x2F;) + %-encoding (%2F) + '+' por espacio.
    let att = m[2];
    att = att.replace(/&#x2f;/gi, "/").replace(/&#47;/g, "/");
    try {
      att = decodeURIComponent(att.replace(/\+/g, " "));
    } catch {
      // attachment con %-secuencias inválidas: seguir con lo que haya
    }
    const dm = /(\d{1,2})\/(\d{1,2})\/(\d{4})\.pdf/i.exec(att);
    if (!dm) continue;
    const d = parseInt(dm[1], 10);
    const mo = parseInt(dm[2], 10);
    const y = parseInt(dm[3], 10);
    items.push({ docId, ymd: toKey(y, mo, d) });
  }
  return items;
}

/** Extrae el total de ejemplares ("Resultados: <strong>48.092</strong>"). */
function parseTotal(html: string): number | null {
  const m = /Resultados:\s*<strong>([\d.]+)<\/strong>/i.exec(html);
  if (!m) return null;
  const n = parseInt(m[1].replace(/\./g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Encuentra el docId del ejemplar cuya fecha == target mediante búsqueda binaria
 * sobre el offset. Devuelve null si no existe (día sin boletín) o si la fecha es
 * más reciente que el último ejemplar disponible (retraso de ingesta).
 */
async function findDocId(target: number): Promise<string | null> {
  // Primera página también sirve para leer el total (nº de ejemplares).
  const firstUrl =
    `${PANDORA}/results.vm?q=parent:${PARENT}` +
    `&t=%2Bcreation&s=0&l=${PAGE}&lang=es&view=global`;
  const firstHtml = await fetchText(firstUrl);
  if (!firstHtml) return null;
  const total = parseTotal(firstHtml);
  if (!total || total <= 0) return null;

  const maxOffset = Math.floor((total - 1) / PAGE) * PAGE;

  // Cache local de páginas ya descargadas dentro de esta búsqueda.
  const cache = new Map<number, Item[]>();
  async function pageAt(offset: number): Promise<Item[] | null> {
    const cached = cache.get(offset);
    if (cached) return cached;
    const items = await fetchPage(offset);
    if (items && items.length) cache.set(offset, items);
    return items;
  }

  let lo = 0;
  let hi = maxOffset;
  // Cota de seguridad: (maxOffset/PAGE) páginas ⇒ log2 ~9-10 iteraciones; 40 sobra.
  for (let guard = 0; guard < 40 && lo <= hi; guard++) {
    const mid = Math.floor((lo + hi) / 2 / PAGE) * PAGE;
    const items = await pageAt(mid);
    if (!items || items.length === 0) return null;

    const minY = items[0].ymd;
    const maxY = items[items.length - 1].ymd;

    // ¿Está la fecha en esta página?
    if (target >= minY && target <= maxY) {
      const hit = items.find((it) => it.ymd === target);
      return hit ? hit.docId : null; // en rango pero ese día no se publicó
    }
    if (target < minY) {
      if (mid === 0) return null; // más antigua que el primer ejemplar
      hi = mid - PAGE;
    } else {
      // target > maxY
      if (mid >= maxOffset) return null; // más reciente que el último ejemplar
      lo = mid + PAGE;
    }
  }
  return null;
}

export const bopAlmeriaAdapter: SourceAdapter = {
  code: "BOP_04",
  name: "Boletín Oficial de la Provincia de Almería",
  type: "BOP",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const target = toKey(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate()
    );

    const docId = await findDocId(target);
    if (!docId) return []; // sin boletín / fecha futura respecto a la ingesta

    const pdfUrl =
      `${PANDORA}/high.raw?id=${docId}` +
      `&name=00000001.original.pdf&attachment=bop.pdf`;
    const text = await fetchPdfText(pdfUrl);
    if (!text) return []; // error de red del PDF → no tumbar el día

    const title =
      text.replace(/\s+/g, " ").trim().slice(0, 200) ||
      `Boletín Oficial de la Provincia de Almería`;

    return [
      {
        externalId: `BOP_04-${docId}`,
        title: title.slice(0, 300),
        searchText: text.slice(0, MAX_BODY_CHARS),
        url: pdfUrl,
        publishedAt: date,
        actType: inferActType(title),
        region: "Almería",
      },
    ];
  },
};
