/**
 * Worker de matching.
 *
 * Por cada perfil monitorizado activo, busca en el índice full-text las
 * publicaciones que contienen su nombre (rápido, vía GIN), las puntúa con
 * señales extra (DNI parcial, provincia) y crea las coincidencias (Match) que
 * superen el umbral. Las nuevas quedan en estado NEW para el worker de avisos.
 *
 *   npm run worker:match           # publicaciones de los últimos 2 días
 *   npm run worker:match -- 30     # publicaciones de los últimos 30 días
 *   npm run worker:match -- all    # todo el histórico (tras un backfill)
 */

import { prisma } from "@/lib/db";
import { evaluateMatch } from "@/lib/matching/match";
import { searchByName, type SearchHit } from "@/lib/search";

const MIN_SCORE = 0.6;

async function main() {
  const arg = process.argv[2] ?? "2";
  const since =
    arg === "all"
      ? new Date(0)
      : (() => {
          const d = new Date();
          d.setUTCDate(d.getUTCDate() - (parseInt(arg, 10) || 2));
          return d;
        })();

  const profiles = await prisma.monitoredProfile.findMany({ where: { active: true } });
  if (profiles.length === 0) {
    console.log("No hay perfiles activos.");
    return;
  }

  console.log(
    `Buscando ${profiles.length} perfiles en el índice full-text (desde ${since
      .toISOString()
      .slice(0, 10)})…`
  );

  let newMatches = 0;
  for (const profile of profiles) {
    // Busca el nombre y sus alias en el índice; deduplica por publicación.
    const names = [profile.fullName, ...profile.aliases];
    const byId = new Map<string, SearchHit>();
    for (const name of names) {
      for (const hit of await searchByName(name, { since })) {
        byId.set(hit.id, hit);
      }
    }

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

      const created = await prisma.match
        .create({
          data: {
            profileId: profile.id,
            publicationId: pub.id,
            score: result.score,
            matchedOn: result.matchedOn,
          },
        })
        .catch(() => null); // unique(profileId, publicationId) → ya existía

      if (created) {
        newMatches++;
        console.log(
          `  ⚠ ${profile.fullName} ↔ ${pub.title.slice(0, 70)}… (${Math.round(
            result.score * 100
          )}%)`
        );
      }
    }
  }

  console.log(`Hecho. ${newMatches} coincidencias nuevas.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
