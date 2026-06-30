/**
 * Utilidades compartidas por los adaptadores de fuentes (CCAA, BOPs, ...).
 */

export const UA =
  process.env.INGEST_USER_AGENT ??
  "Mozilla/5.0 (compatible; NotifikadoBot/0.1; +https://notifikado.com)";

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
}

export async function fetchJson(
  url: string,
  opts: FetchOpts = {}
): Promise<unknown | null> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": UA, ...opts.headers },
      next: { revalidate: 60 * 60 },
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
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
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": UA, ...opts.headers },
      next: { revalidate: 60 * 60 * 24 },
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
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
