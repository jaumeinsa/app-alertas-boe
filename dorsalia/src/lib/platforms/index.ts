/**
 * Registro de adaptadores activos. El motor pregunta aquí qué adaptador
 * corresponde a una URL; si ninguno la reconoce, se usa el modo genérico
 * (heurística pura), que funciona en cualquier plataforma.
 */

import { PlatformAdapter } from "./types";
import { rockTheSportAdapter } from "./rockthesport";
import { sportmaniacsAdapter } from "./sportmaniacs";

export const ADAPTERS: PlatformAdapter[] = [rockTheSportAdapter, sportmaniacsAdapter];

export function detectAdapter(url: URL): PlatformAdapter | null {
  return ADAPTERS.find((a) => a.matches(url)) ?? null;
}
