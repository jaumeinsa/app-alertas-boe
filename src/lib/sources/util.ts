/**
 * Utilidades compartidas por los adaptadores de fuentes (CCAA, BOPs, ...).
 */

import pdfParse from "pdf-parse/lib/pdf-parse.js";

// User-Agent de NAVEGADOR (Windows Chrome, el más universal): los WAF de varias
// sedes bloquean UAs con "Bot" e incluso el UA de Mac (xunta.gal da 500).
// No usar INGEST_USER_AGENT aquí.
export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export const CONCURRENCY = Math.max(
  1,
  parseInt(process.env.INGEST_FULLTEXT_CONCURRENCY ?? "5", 10) || 5
);

export const MAX_BODY_CHARS = 200_000;

/** Quita etiquetas HTML/XML y normaliza espacios. */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!\[CDATA\[/g, " ")
    .replace(/\]\]>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ejecuta `fn` sobre `items` con un máximo de `concurrency` en paralelo. */
export async function mapPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>
): Promise<void> {
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      await fn(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
}

interface FetchOpts {
  headers?: Record<string, string>;
  /** Charset para decodificar el cuerpo (p.ej. "iso-8859-1"). Por defecto utf-8. */
  charset?: string;
  /** Reintentos ante bloqueo/red (WAF, 429/403/503). Por defecto 2. */
  retries?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Timeout por intento. CRÍTICO: fetch de Node no tiene timeout por defecto, y
// una conexión colgada (sede que acepta y no responde) bloqueaba el backfill
// para siempre. Con AbortSignal.timeout el intento aborta y reintenta.
const FETCH_TIMEOUT_MS = Math.max(
  5000,
  parseInt(process.env.INGEST_FETCH_TIMEOUT_MS ?? "45000", 10) || 45000
);

/** Fetch con reintentos, backoff y timeout ante errores transitorios o WAF. */
async function fetchRetry(
  url: string,
  init: RequestInit,
  retries: number
): Promise<Response | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      // 429/403/503 suelen ser rate-limit/WAF transitorio → reintentar.
      if (res.ok) return res;
      if (![429, 403, 503, 502, 500].includes(res.status) || attempt === retries) {
        return res.ok ? res : null;
      }
    } catch {
      if (attempt === retries) return null;
    }
    await sleep(700 * (attempt + 1) + Math.floor(attempt * 300));
  }
  return null;
}

// Cabeceras de navegador: algunas sedes (xunta.gal, etc.) devuelven 500/bloqueo
// si falta Accept/Accept-Language, aunque el User-Agent sea de navegador.
const ACCEPT_LANG = "es-ES,es;q=0.9,en;q=0.8";
const ACCEPT_HTML =
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8";

export async function fetchJson(
  url: string,
  opts: FetchOpts = {}
): Promise<unknown | null> {
  const res = await fetchRetry(
    url,
    {
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": ACCEPT_LANG,
        "User-Agent": UA,
        ...opts.headers,
      },
    },
    opts.retries ?? 2
  );
  if (!res) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchText(
  url: string,
  opts: FetchOpts = {}
): Promise<string | null> {
  const res = await fetchRetry(
    url,
    {
      headers: {
        Accept: ACCEPT_HTML,
        "Accept-Language": ACCEPT_LANG,
        "User-Agent": UA,
        ...opts.headers,
      },
    },
    opts.retries ?? 2
  );
  if (!res) return null;
  try {
    const buf = await res.arrayBuffer();
    return new TextDecoder(opts.charset ?? "utf-8").decode(buf);
  } catch {
    return null;
  }
}

/**
 * Descarga un PDF como Buffer. Verifica que de verdad sea un PDF (algunas sedes
 * devuelven una página HTML de error con código 200 cuando no hay boletín).
 */
export async function fetchBuffer(
  url: string,
  opts: FetchOpts = {}
): Promise<Buffer | null> {
  const res = await fetchRetry(
    url,
    {
      headers: {
        Accept: "application/pdf,application/octet-stream,*/*",
        "Accept-Language": ACCEPT_LANG,
        "User-Agent": UA,
        ...opts.headers,
      },
    },
    opts.retries ?? 2
  );
  if (!res) return null;
  try {
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get("content-type") ?? "";
    const isPdf =
      ct.includes("pdf") || buf.subarray(0, 5).toString("latin1") === "%PDF-";
    return isPdf ? buf : null;
  } catch {
    return null;
  }
}

/**
 * Extrae el texto de un PDF (capa de texto, sin OCR).
 *
 * Conserva los saltos de línea (colapsa solo espacios horizontales) porque
 * algunos adaptadores los necesitan para parsear sumarios línea a línea.
 */
export async function pdfToText(buf: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buf);
    return (data.text ?? "")
      // PostgreSQL (text/tsvector) NO admite el byte NUL ni otros controles C0;
      // algunos PDF los cuelan. Quitarlos (preservando \t y \n).
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
      .replace(/[ \t\f\v]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } catch {
    return "";
  }
}

/** Descarga un PDF y devuelve su texto, o null si no es PDF/está vacío. */
export async function fetchPdfText(
  url: string,
  opts: FetchOpts = {}
): Promise<string | null> {
  const buf = await fetchBuffer(url, opts);
  if (!buf) return null;
  const text = await pdfToText(buf);
  return text || null;
}

/** YYYYMMDD */
export function yyyymmdd(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    String(d.getUTCMonth() + 1).padStart(2, "0") +
    String(d.getUTCDate()).padStart(2, "0")
  );
}

/** YYYY-MM-DD */
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** DD-MM-YYYY (sep configurable) */
export function ddmmyyyy(d: Date, sep = "-"): string {
  return [
    String(d.getUTCDate()).padStart(2, "0"),
    String(d.getUTCMonth() + 1).padStart(2, "0"),
    d.getUTCFullYear(),
  ].join(sep);
}
