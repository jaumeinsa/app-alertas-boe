/**
 * Escanea el corpus indexado en busca de un perfil y crea las coincidencias
 * (Match) que superen el umbral. Lo usan el alta (resultado inmediato), el
 * botón "buscar ahora" del dashboard y el worker diario.
 */

import { prisma } from "@/lib/db";
import { evaluateMatch } from "@/lib/matching/match";
import { searchByName, type SearchHit } from "@/lib/search";

const MIN_SCORE = 0.6;

export async function scanProfile(
  profileId: string,
  opts: { since?: Date } = {}
): Promise<number> {
  const profile = await prisma.monitoredProfile.findUnique({
    where: { id: profileId },
  });
  if (!profile || !profile.active) return 0;

  const names = [profile.fullName, ...profile.aliases];
  const byId = new Map<string, SearchHit>();
  for (const name of names) {
    for (const hit of await searchByName(name, { since: opts.since })) {
      byId.set(hit.id, hit);
    }
  }

  let created = 0;
  for (const pub of byId.values()) {
    const result = evaluateMatch(
      {
        fullName: profile.fullName,
        aliases: profile.aliases,
        dniSuffix: profile.dniSuffix,
        provinces: profile.provinces,
      },
      { title: pub.title, searchText: pub.searchText, region: pub.region }
    );
    if (!result.isMatch || result.score < MIN_SCORE) continue;

    const row = await prisma.match
      .create({
        data: {
          profileId: profile.id,
          publicationId: pub.id,
          score: result.score,
          matchedOn: result.matchedOn,
        },
      })
      .catch(() => null); // unique(profileId, publicationId) → ya existía
    if (row) created++;
  }
  return created;
}
