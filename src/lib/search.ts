/**
 * Búsqueda full-text de nombres sobre el corpus de documentos (Publication).
 *
 * Usa el índice GIN + tsvector creado en la migración 0002_fulltext_search.
 * `plainto_tsquery` convierte "Jaume Insa" en `jaume & insa` (todos los tokens,
 * en cualquier posición), con unaccent, así que casa con "INSA GARCIA, JAUME"
 * o "Jaume Insa García". Escala a millones de filas porque el filtrado lo hace
 * el índice, no un escaneo en memoria.
 */

import { prisma } from "@/lib/db";
import { tokenizeName } from "@/lib/matching/normalize";

export interface SearchHit {
  id: string;
  externalId: string;
  title: string;
  searchText: string | null;
  url: string;
  publishedAt: Date;
  actType: string | null;
  sourceId: string;
  sourceCode: string;
  region: string | null;
}

export interface SearchOptions {
  /** Solo publicaciones desde esta fecha (por defecto, todas). */
  since?: Date;
  /** Máximo de resultados (por defecto 1000). */
  limit?: number;
}

/**
 * Devuelve las publicaciones cuyo texto contiene TODOS los tokens del nombre.
 * Requiere al menos 2 tokens (nombre + apellido) para evitar ruido.
 */
export async function searchByName(
  fullName: string,
  opts: SearchOptions = {}
): Promise<SearchHit[]> {
  const tokens = tokenizeName(fullName);
  if (tokens.length < 2) return [];

  const query = tokens.join(" ");
  const since = opts.since ?? new Date(0);
  const limit = opts.limit ?? 1000;

  return prisma.$queryRaw<SearchHit[]>`
    SELECT
      p.id,
      p."externalId",
      p.title,
      p."searchText",
      p.url,
      p."publishedAt",
      p."actType",
      p."sourceId",
      s.code   AS "sourceCode",
      s.region AS region
    FROM "Publication" p
    JOIN "Source" s ON s.id = p."sourceId"
    WHERE p."publishedAt" >= ${since}
      AND p."searchVector" @@ plainto_tsquery('es_unaccent', ${query})
    ORDER BY p."publishedAt" DESC
    LIMIT ${limit}
  `;
}
