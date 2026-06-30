/**
 * Registro de adaptadores activos.
 *
 * A medida que se implementen nuevos adaptadores (BORME, BOPs, autonómicos),
 * se añaden aquí y la ingesta los recogerá automáticamente.
 */

import { boeAdapter } from "./boe";
import { bojaAdapter } from "./boja";
import { bocylAdapter } from "./bocyl";
import { borAdapter } from "./bor";
import { bormCcaaAdapter } from "./borm_ccaa";
import { bormeAdapter } from "./borme";
import { bopvAdapter } from "./bopv";
import { dogcAdapter } from "./dogc";
import { dogvAdapter } from "./dogv";
import { SourceAdapter } from "./types";

export const ADAPTERS: SourceAdapter[] = [
  boeAdapter,
  bormeAdapter,
  dogvAdapter,
  bojaAdapter,
  dogcAdapter,
  bormCcaaAdapter,
  bopvAdapter,
  bocylAdapter,
  borAdapter,
];

export function enabledAdapters(): SourceAdapter[] {
  // INGEST_ONLY="BORME" (o "BOE,BORME") limita la ingesta a esas fuentes,
  // útil para backfillear una sola fuente sin re-descargar las demás.
  const only = process.env.INGEST_ONLY?.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  return ADAPTERS.filter((a) => a.enabled && (!only || only.length === 0 || only.includes(a.code)));
}

export function getAdapter(code: string): SourceAdapter | undefined {
  return ADAPTERS.find((a) => a.code === code);
}

export * from "./types";
export * from "./catalog";
