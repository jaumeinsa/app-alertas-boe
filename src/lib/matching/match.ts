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

/**
 * ¿Aparecen TODOS los tokens del nombre JUNTOS (en proximidad) en el texto?
 *
 * Exigir proximidad —y no solo que cada token aparezca en algún punto del
 * documento— evita falsos positivos en documentos largos que agregan a muchas
 * personas (p. ej. un BORME provincial con decenas de empresas, donde "Jaume",
 * "Insa" y "Pérez" podrían pertenecer a personas distintas). El nombre real
 * aparece como secuencia contigua: "INSA PÉREZ, JAUME" o "Jaume Insa Pérez".
 */
function nameAppearsInText(
  nameTokens: string[],
  haystack: string,
  window = 60
): boolean {
  if (nameTokens.length === 0) return false;
  // Token de anclaje: el más largo (suele ser el más distintivo).
  const anchor = nameTokens.reduce((a, b) => (b.length > a.length ? b : a));
  const others = nameTokens.filter((t) => t !== anchor);

  let from = 0;
  for (;;) {
    const i = haystack.indexOf(anchor, from);
    if (i < 0) return false;
    const slice = haystack.slice(
      Math.max(0, i - window),
      i + anchor.length + window
    );
    if (others.every((t) => slice.includes(t))) return true;
    from = i + 1;
  }
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
