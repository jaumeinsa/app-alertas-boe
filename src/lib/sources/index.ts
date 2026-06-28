/**
 * Registro de adaptadores activos.
 *
 * A medida que se implementen nuevos adaptadores (BORME, BOPs, autonómicos),
 * se añaden aquí y la ingesta los recogerá automáticamente.
 */

import { boeAdapter } from "./boe";
import { SourceAdapter } from "./types";

export const ADAPTERS: SourceAdapter[] = [boeAdapter];

export function enabledAdapters(): SourceAdapter[] {
  return ADAPTERS.filter((a) => a.enabled);
}

export function getAdapter(code: string): SourceAdapter | undefined {
  return ADAPTERS.find((a) => a.code === code);
}

export * from "./types";
export * from "./catalog";
