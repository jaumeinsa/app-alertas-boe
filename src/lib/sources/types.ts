/**
 * Contrato común para todas las fuentes oficiales.
 *
 * Cada boletín (BOE, BORME, boletines provinciales, autonómicos...) implementa
 * este adaptador. La capa de ingesta no necesita conocer los detalles de cada
 * API: solo pide "dame las publicaciones del día X" y recibe documentos
 * normalizados listos para indexar y comparar.
 */

export type SourceType = "BOE" | "TEU" | "BORME" | "BOP" | "AUTONOMIC";

export interface NormalizedPublication {
  /** Identificador oficial del documento (único dentro de la fuente). */
  externalId: string;
  title: string;
  summary?: string;
  /** Texto plano para el matching (puede ser solo el título). */
  searchText?: string;
  url: string;
  publishedAt: Date;
  /** Tipo de acto si se puede inferir: "multa", "embargo", "citacion"... */
  actType?: string;
  /** Provincia/CCAA si aplica. */
  region?: string;
}

export interface SourceAdapter {
  /** Código único de la fuente, p.ej. "BOE", "BOP_28". */
  readonly code: string;
  readonly name: string;
  readonly type: SourceType;
  /** ¿El adaptador está implementado y listo para ingerir? */
  readonly enabled: boolean;

  /** Descarga las publicaciones de un día concreto. */
  fetchByDate(date: Date): Promise<NormalizedPublication[]>;
}

/** Formatea una fecha como YYYYMMDD (formato típico de los boletines). */
export function yyyymmdd(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/** Infiere el tipo de acto a partir del título del documento. */
export function inferActType(title: string): string | undefined {
  const t = title.toLowerCase();
  if (/(multa|sanci[oó]n|tr[aá]fico|dgt)/.test(t)) return "multa";
  if (/(embargo|apremio|recaudaci[oó]n|deuda)/.test(t)) return "embargo";
  if (/(citaci[oó]n|emplazamiento|requerimiento)/.test(t)) return "citacion";
  if (/(juzgado|judicial|sentencia|procedimiento)/.test(t)) return "judicial";
  if (/(notificaci[oó]n|edicto|anuncio)/.test(t)) return "notificacion";
  if (/(concurso|mercantil|administrador|nombramiento)/.test(t)) return "mercantil";
  return undefined;
}
