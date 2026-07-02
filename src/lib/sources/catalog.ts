/**
 * Catálogo completo de fuentes oficiales que Notifikado quiere cubrir.
 *
 * El objetivo del producto es "cubrirlo todo": el BOE/TEU, el BORME, los 50
 * boletines provinciales (BOP) y los diarios autonómicos. Aquí están todas
 * catalogadas. Las que ya tienen adaptador funcional están marcadas con
 * `ingestEnabled: true`; el resto quedan registradas y listas para activar
 * conforme se vayan implementando sus adaptadores.
 */

import { SourceType } from "./types";

export interface SourceCatalogEntry {
  code: string;
  name: string;
  type: SourceType;
  region?: string;
  ingestEnabled: boolean;
}

/** Las 50 provincias españolas con su código INE (para los BOP). */
const PROVINCES: Array<[string, string]> = [
  ["01", "Álava"],
  ["02", "Albacete"],
  ["03", "Alicante"],
  ["04", "Almería"],
  ["05", "Ávila"],
  ["06", "Badajoz"],
  ["07", "Illes Balears"],
  ["08", "Barcelona"],
  ["09", "Burgos"],
  ["10", "Cáceres"],
  ["11", "Cádiz"],
  ["12", "Castellón"],
  ["13", "Ciudad Real"],
  ["14", "Córdoba"],
  ["15", "A Coruña"],
  ["16", "Cuenca"],
  ["17", "Girona"],
  ["18", "Granada"],
  ["19", "Guadalajara"],
  ["20", "Gipuzkoa"],
  ["21", "Huelva"],
  ["22", "Huesca"],
  ["23", "Jaén"],
  ["24", "León"],
  ["25", "Lleida"],
  ["26", "La Rioja"],
  ["27", "Lugo"],
  ["28", "Madrid"],
  ["29", "Málaga"],
  ["30", "Murcia"],
  ["31", "Navarra"],
  ["32", "Ourense"],
  ["33", "Asturias"],
  ["34", "Palencia"],
  ["35", "Las Palmas"],
  ["36", "Pontevedra"],
  ["37", "Salamanca"],
  ["38", "Santa Cruz de Tenerife"],
  ["39", "Cantabria"],
  ["40", "Segovia"],
  ["41", "Sevilla"],
  ["42", "Soria"],
  ["43", "Tarragona"],
  ["44", "Teruel"],
  ["45", "Toledo"],
  ["46", "Valencia"],
  ["47", "Valladolid"],
  ["48", "Bizkaia"],
  ["49", "Zamora"],
  ["50", "Zaragoza"],
];

/** Diarios oficiales autonómicos. */
const AUTONOMIC: Array<[string, string, string]> = [
  ["BOJA", "Boletín Oficial de la Junta de Andalucía", "Andalucía"],
  ["BOA", "Boletín Oficial de Aragón", "Aragón"],
  ["BOPA", "Boletín Oficial del Principado de Asturias", "Asturias"],
  ["BOIB", "Butlletí Oficial de les Illes Balears", "Illes Balears"],
  ["BOC_CANARIAS", "Boletín Oficial de Canarias", "Canarias"],
  ["BOC_CANTABRIA", "Boletín Oficial de Cantabria", "Cantabria"],
  ["DOCM", "Diario Oficial de Castilla-La Mancha", "Castilla-La Mancha"],
  ["BOCYL", "Boletín Oficial de Castilla y León", "Castilla y León"],
  ["DOGC", "Diari Oficial de la Generalitat de Catalunya", "Cataluña"],
  ["DOGV", "Diari Oficial de la Generalitat Valenciana", "C. Valenciana"],
  ["DOE", "Diario Oficial de Extremadura", "Extremadura"],
  ["DOG", "Diario Oficial de Galicia", "Galicia"],
  ["BOCM", "Boletín Oficial de la Comunidad de Madrid", "Madrid"],
  ["BORM", "Boletín Oficial de la Región de Murcia", "Murcia"],
  ["BON", "Boletín Oficial de Navarra", "Navarra"],
  ["BOPV", "Boletín Oficial del País Vasco", "País Vasco"],
  ["BOR", "Boletín Oficial de La Rioja", "La Rioja"],
];

/** INE de las provincias cuyo BOP ya tiene adaptador activo. */
const BOP_ENABLED = new Set<string>([
  "46", // Valencia
  "14", // Córdoba
  "23", // Jaén
  "05", // Ávila
  "32", // Ourense
  "15", // A Coruña
  "36", // Pontevedra
  "45", // Toledo
  "13", // Ciudad Real
  "47", // Valladolid
  "37", // Salamanca
  "20", // Gipuzkoa
  "35", // Las Palmas
  "38", // Santa Cruz de Tenerife
  "27", // Lugo
]);

/** Códigos de autonómicos con adaptador activo (los demás del catálogo siguen pendientes). */
const AUTO_ENABLED = new Set<string>([
  "BOJA", "BOA", "BOPA", "BOC_CANARIAS", "DOCM", "BOCYL", "DOGC",
  "DOGV", "DOE", "DOG", "BOCM", "BORM", "BON", "BOPV", "BOR", "BOC_CANTABRIA",
  "BOIB",
]);

export const SOURCE_CATALOG: SourceCatalogEntry[] = [
  // Estatales — implementadas.
  {
    code: "BOE",
    name: "Boletín Oficial del Estado (incl. Tablón Edictal Único)",
    type: "BOE",
    ingestEnabled: true,
  },
  // BORME — Registro Mercantil (nombramientos/ceses de administradores, etc.).
  {
    code: "BORME",
    name: "Boletín Oficial del Registro Mercantil",
    type: "BORME",
    ingestEnabled: true,
  },
  // 50 boletines provinciales. Los que ya tienen adaptador funcional van con
  // ingestEnabled: true (su INE en BOP_ENABLED).
  ...PROVINCES.map(([ine, name]) => ({
    code: `BOP_${ine}`,
    name: `Boletín Oficial de la Provincia de ${name}`,
    type: "BOP" as SourceType,
    region: name,
    ingestEnabled: BOP_ENABLED.has(ine),
  })),
  // Autonómicos.
  ...AUTONOMIC.map(([code, name, region]) => ({
    code,
    name,
    type: "AUTONOMIC" as SourceType,
    region,
    ingestEnabled: AUTO_ENABLED.has(code),
  })),
];

export function countCatalog() {
  return {
    total: SOURCE_CATALOG.length,
    enabled: SOURCE_CATALOG.filter((s) => s.ingestEnabled).length,
    byType: SOURCE_CATALOG.reduce<Record<string, number>>((acc, s) => {
      acc[s.type] = (acc[s.type] ?? 0) + 1;
      return acc;
    }, {}),
  };
}
