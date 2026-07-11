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

// pdf.js (vía pdf-parse) rechaza promesas huérfanas ante PDFs corruptos
// (p. ej. "FormatError: Illegal character"); sin este manejador, node mata el
// proceso y el backfill da el año por completo sin estarlo (falso-completo,
// cazado con BOP_47 2022/2024).
process.on("unhandledRejection", (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  console.error(`unhandledRejection (ignorada, doc descartado): ${msg}`);
});

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** PostgreSQL no admite el byte NUL (0x00) en columnas text; quítalo. */
function stripNul<T extends string | null | undefined>(s: T): T {
  return (typeof s === "string" ? s.replace(/\x00/g, "") : s) as T;
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

    let ok = 0;
    for (const pub of pubs) {
      // Un documento problemático (p.ej. PDF con bytes inválidos) no debe tumbar
      // la ingesta del resto del día/año: se registra y se continúa.
      try {
        await prisma.publication.upsert({
          where: {
            sourceId_externalId: { sourceId: source.id, externalId: pub.externalId },
          },
          // Las publicaciones oficiales no cambian, pero sí enriquecemos el
          // cuerpo (searchText) al reingerir: la primera pasada puede traer solo
          // el título y una posterior el texto completo.
          update: {
            searchText: stripNul(pub.searchText),
            summary: stripNul(pub.summary),
            actType: pub.actType,
          },
          create: {
            sourceId: source.id,
            externalId: pub.externalId,
            title: stripNul(pub.title),
            summary: stripNul(pub.summary),
            searchText: stripNul(pub.searchText),
            url: pub.url,
            publishedAt: pub.publishedAt,
            actType: pub.actType,
          },
        });
        ok++;
      } catch (err) {
        console.error(
          `  ✗ upsert ${adapter.code} ${pub.externalId}:`,
          err instanceof Error ? err.message : err
        );
      }
    }

    await prisma.source.update({
      where: { id: source.id },
      data: { lastIngestAt: new Date() },
    });

    console.log(
      `✓ ${adapter.code} ${date.toISOString().slice(0, 10)}: ${ok}/${pubs.length} publicaciones procesadas`
    );
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(s: string): Date {
  const d = new Date(`${s}T00:00:00.000Z`);
  return d;
}

async function main() {
  const raw = process.argv.slice(2);
  await ensureSources();

  // Pausa opcional entre días (ms) para fuentes con WAF sensible al ritmo
  // (el Radware del BORM pone la IP en cuarentena si el backfill va seguido).
  const dayDelay = parseInt(process.env.INGEST_DAY_DELAY_MS ?? "0", 10) || 0;

  // Modo rango de fechas: `ingest.ts 2020-01-01 2020-12-31` (ascendente, inclusivo).
  // Pensado para el backfill histórico.
  if (raw[0] && DATE_RE.test(raw[0])) {
    const start = parseDate(raw[0]);
    const end = raw[1] && DATE_RE.test(raw[1]) ? parseDate(raw[1]) : start;
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      await ingestDate(new Date(d));
      if (dayDelay > 0) await new Promise((r) => setTimeout(r, dayDelay));
    }
    return;
  }

  // Modo offset de días (cron diario): `ingest.ts 0 1` = de hoy a ayer.
  const from = Number.isFinite(parseInt(raw[0], 10)) ? parseInt(raw[0], 10) : 0;
  const to = Number.isFinite(parseInt(raw[1], 10)) ? parseInt(raw[1], 10) : from;
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
