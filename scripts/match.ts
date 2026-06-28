/**
 * Worker de matching.
 *
 * Compara las publicaciones recientes con los perfiles monitorizados activos
 * y crea las coincidencias (Match) que superen el umbral de confianza. Las
 * coincidencias nuevas quedan en estado NEW para que el worker de
 * notificaciones (fase 2) las envíe.
 *
 *   npm run worker:match           # publicaciones de los últimos 2 días
 *   npm run worker:match -- 30     # publicaciones de los últimos 30 días
 */

import { prisma } from "@/lib/db";
import { evaluateMatch } from "@/lib/matching/match";

const MIN_SCORE = 0.6;

async function main() {
  const days = parseInt(process.argv[2] ?? "2", 10) || 2;
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);

  const profiles = await prisma.monitoredProfile.findMany({
    where: { active: true },
  });
  if (profiles.length === 0) {
    console.log("No hay perfiles activos.");
    return;
  }

  const publications = await prisma.publication.findMany({
    where: { publishedAt: { gte: since } },
    include: { source: true },
  });

  console.log(
    `Comparando ${profiles.length} perfiles × ${publications.length} publicaciones…`
  );

  let newMatches = 0;
  for (const profile of profiles) {
    for (const pub of publications) {
      const result = evaluateMatch(
        {
          fullName: profile.fullName,
          aliases: profile.aliases,
          dniSuffix: profile.dniSuffix,
          provinces: profile.provinces,
        },
        {
          title: pub.title,
          searchText: pub.searchText,
          region: pub.source.region,
        }
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
