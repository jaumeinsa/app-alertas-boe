/**
 * Motor de coincidencias.
 *
 * Dada una publicación (texto de un boletín) y un perfil monitorizado,
 * calcula un score de confianza 0..1 y qué señales han casado. El objetivo
 * es maximizar los aciertos reales minimizando los falsos positivos típicos
 * de los nombres comunes.
 */

import {
  extractDniSuffixes,
  nameSearchKey,
  normalizeText,
  tokenizeName,
} from "./normalize";

export interface ProfileForMatch {
  fullName: string;
  aliases?: string[];
  dniSuffix?: string | null;
  provinces?: string[];
}

export interface PublicationForMatch {
  title: string;
  searchText?: string | null;
  /** Provincia/región inferida de la fuente, si la hay. */
  region?: string | null;
}

export interface MatchResult {
  isMatch: boolean;
  score: number;
  matchedOn: string[];
}

/** ¿Aparecen TODOS los tokens del nombre dentro del texto del documento? */
function nameAppearsInText(nameTokens: string[], haystack: string): boolean {
  if (nameTokens.length === 0) return false;
  return nameTokens.every((t) => haystack.includes(t));
}

export function evaluateMatch(
  profile: ProfileForMatch,
  publication: PublicationForMatch
): MatchResult {
  const haystack = normalizeText(
    `${publication.title} ${publication.searchText ?? ""}`
  );

  const candidates = [profile.fullName, ...(profile.aliases ?? [])];
  const matchedOn: string[] = [];
  let nameHit = false;

  for (const candidate of candidates) {
    const tokens = tokenizeName(candidate);
    // Exigimos al menos 2 tokens (nombre + apellido) para considerar un acierto:
    // un único token genera demasiado ruido.
    if (tokens.length >= 2 && nameAppearsInText(tokens, haystack)) {
      nameHit = true;
      break;
    }
  }

  if (!nameHit) {
    return { isMatch: false, score: 0, matchedOn: [] };
  }
  matchedOn.push("name");

  // Score base por nombre completo presente.
  let score = 0.6;

  // Señal fuerte: el sufijo del DNI del perfil aparece en el documento.
  if (profile.dniSuffix) {
    const suffixes = extractDniSuffixes(haystack);
    if (suffixes.some((s) => s.endsWith(profile.dniSuffix!.slice(-4)))) {
      score += 0.3;
      matchedOn.push("dniSuffix");
    }
  }

  // Señal media: la provincia del documento coincide con las de interés.
  if (profile.provinces?.length && publication.region) {
    const region = normalizeText(publication.region);
    if (profile.provinces.some((p) => region.includes(normalizeText(p)))) {
      score += 0.1;
      matchedOn.push("province");
    }
  }

  return {
    isMatch: true,
    score: Math.min(score, 1),
    matchedOn,
  };
}

export { nameSearchKey };
