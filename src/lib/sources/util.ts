/**
 * Utilidades compartidas por los adaptadores de fuentes (CCAA, BOPs, ...).
 */

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

/** Fetch con reintentos y backoff ante errores transitorios o WAF. */
async function fetchRetry(
  url: string,
  init: RequestInit,
  retries: number
): Promise<Response | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);
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
