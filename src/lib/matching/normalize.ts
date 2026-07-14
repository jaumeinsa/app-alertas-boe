/**
 * Normalización de nombres y textos para el matching.
 *
 * Los boletines oficiales escriben los nombres de formas muy variadas:
 *  - "GARCÍA LÓPEZ, ANTONIO"  (apellidos primero, mayúsculas)
 *  - "Antonio García López"
 *  - con/sin acentos, con la "ñ", con dobles espacios, etc.
 *
 * Reducimos todo a una clave canónica: minúsculas, sin acentos (excepto ñ→n
 * para maximizar coincidencias), sin signos de puntuación y con los tokens
 * ordenados alfabéticamente. Así "García López Antonio" y
 * "Antonio García López" producen la misma `searchKey`.
 */

/** Palabras de relleno que no aportan a la identificación de la persona. */
const STOPWORDS = new Set([
  "de",
  "del",
  "la",
  "las",
  "los",
  "el",
  "y",
  "i", // catalán
  "da",
  "do",
  "dos",
  "san",
]);

/** Quita acentos/diacríticos (incluida la ñ → n). */
export function stripDiacritics(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ñ/gi, "n");
}

/** Tokeniza un nombre en palabras limpias y significativas. */
export function tokenizeName(name: string): string[] {
  return stripDiacritics(name)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Clave canónica e independiente del orden para un nombre.
 * Úsala para indexar y comparar perfiles con publicaciones.
 */
export function nameSearchKey(name: string): string {
  return tokenizeName(name).sort().join(" ");
}

/** Normaliza texto libre (títulos, cuerpos) para búsqueda full-text simple. */
export function normalizeText(text: string): string {
  return stripDiacritics(text).toLowerCase().replace(/\s+/g, " ").trim();
}

/** Extrae sufijos de DNI estilo BOE: "***4567**", "*4567*", "X4567Z". */
export function extractDniSuffixes(text: string): string[] {
  const matches = text.match(/[*x]+\d{3,4}[*a-z]*/gi) ?? [];
  return matches
    .map((m) => (m.match(/\d{3,4}/)?.[0] ?? ""))
    .filter((s) => s.length >= 3);
}
