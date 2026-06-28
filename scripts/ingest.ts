/**
 * Worker de ingesta.
 *
 * Descarga las publicaciones del día de todas las fuentes con adaptador activo
 * y las guarda en la base de datos (idempotente gracias a la unique
 * sourceId+externalId). Pensado para ejecutarse a diario por cron en el VPS:
 *
 *   npm run worker:ingest            # día de hoy
 *   npm run worker:ingest -- 2 5     # desde hace 2 días hasta hace 5 días
 *
 * Tras ingerir, conviene lanzar el matching (scripts/match.ts).
 */

import { prisma } from "@/lib/db";
import { enabledAdapters, SOURCE_CATALOG } from "@/lib/sources";

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Garantiza que el catálogo de fuentes existe en la base de datos. */
async function ensureSources() {
  for (const entry of SOURCE_CATALOG) {
    await prisma.source.upsert({
      where: { code: entry.code },
      update: {
        name: entry.name,
        type: entry.type,
        region: entry.region,
        ingestEnabled: entry.ingestEnabled,
      },
      create: {
        code: entry.code,
        name: entry.name,
        type: entry.type,
        region: entry.region,
        ingestEnabled: entry.ingestEnabled,
      },
    });
  }
}

async function ingestDate(date: Date) {
  for (const adapter of enabledAdapters()) {
    const source = await prisma.source.findUnique({ where: { code: adapter.code } });
    if (!source) continue;

    let pubs;
    try {
      pubs = await adapter.fetchByDate(date);
    } catch (err) {
      console.error(`✗ ${adapter.code} ${date.toISOString().slice(0, 10)}:`, err);
      continue;
    }

    for (const pub of pubs) {
      await prisma.publication.upsert({
        where: {
          sourceId_externalId: { sourceId: source.id, externalId: pub.externalId },
        },
        update: {}, // las publicaciones oficiales no cambian
        create: {
          sourceId: source.id,
          externalId: pub.externalId,
          title: pub.title,
          summary: pub.summary,
          searchText: pub.searchText,
          url: pub.url,
          publishedAt: pub.publishedAt,
          actType: pub.actType,
        },
      });
    }

    await prisma.source.update({
      where: { id: source.id },
      data: { lastIngestAt: new Date() },
    });

    console.log(
      `✓ ${adapter.code} ${date.toISOString().slice(0, 10)}: ${pubs.length} publicaciones procesadas`
    );
  }
}

async function main() {
  const args = process.argv.slice(2).map((n) => parseInt(n, 10));
  const from = Number.isFinite(args[0]) ? args[0] : 0;
  const to = Number.isFinite(args[1]) ? args[1] : from;

  await ensureSources();

  for (let n = from; n <= to; n++) {
    await ingestDate(daysAgo(n));
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
