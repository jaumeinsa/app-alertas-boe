/**
 * Seed: carga el catálogo completo de fuentes oficiales en la base de datos.
 */

import { prisma } from "@/lib/db";
import { SOURCE_CATALOG } from "@/lib/sources";

async function main() {
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
  console.log(`Catálogo cargado: ${SOURCE_CATALOG.length} fuentes.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
