/**
 * Catálogo de plataformas de inscripción que Dorsalia quiere cubrir.
 *
 * Objetivo "cubrirlo todo": el motor heurístico funciona sobre cualquier
 * formulario (nivel "generic"), y las plataformas con manías propias van
 * ganando adaptador dedicado (nivel "adapter"). Las de nivel "manual" son
 * agregadores/calendarios que enlazan a otras plataformas.
 */

export type AutomationLevel = "adapter" | "generic" | "manual";

export interface PlatformCatalogEntry {
  id: string;
  name: string;
  website: string;
  scope: "España" | "Internacional";
  automation: AutomationLevel;
  notes?: string;
}

export const PLATFORM_CATALOG: PlatformCatalogEntry[] = [
  // Con adaptador dedicado (navegación hasta el formulario incluida).
  {
    id: "rockthesport",
    name: "RockTheSport",
    website: "rockthesport.com",
    scope: "España",
    automation: "adapter",
    notes: "Una de las mayores de España; multitud de carreras populares y maratones.",
  },
  {
    id: "sportmaniacs",
    name: "Sportmaniacs",
    website: "sportmaniacs.com",
    scope: "España",
    automation: "adapter",
    notes: "Cronometraje e inscripciones.",
  },

  // Cubiertas por el motor heurístico genérico.
  {
    id: "deporticket",
    name: "Deporticket",
    website: "deporticket.com",
    scope: "España",
    automation: "generic",
  },
  {
    id: "cruzandolameta",
    name: "Cruzando la Meta",
    website: "cruzandolameta.es",
    scope: "España",
    automation: "generic",
  },
  {
    id: "mychip",
    name: "MyChip",
    website: "mychip.es",
    scope: "España",
    automation: "generic",
  },
  {
    id: "orycronsport",
    name: "Orycron Sport",
    website: "orycronsport.com",
    scope: "España",
    automation: "generic",
  },
  {
    id: "gesconchip",
    name: "Gesconchip",
    website: "gesconchip.es",
    scope: "España",
    automation: "generic",
  },
  {
    id: "toprun",
    name: "Toprun",
    website: "toprun.es",
    scope: "España",
    automation: "generic",
  },
  {
    id: "finishers",
    name: "Finishers",
    website: "finishers.com",
    scope: "Internacional",
    automation: "generic",
    notes: "Agregador con inscripción propia en muchas carreras europeas.",
  },
  {
    id: "njuko",
    name: "Njuko",
    website: "njuko.com",
    scope: "Internacional",
    automation: "generic",
    notes: "Motor de inscripción de muchos grandes maratones europeos.",
  },
  {
    id: "atleta",
    name: "Atleta",
    website: "atleta.cc",
    scope: "Internacional",
    automation: "generic",
  },
  {
    id: "raceroster",
    name: "Race Roster",
    website: "raceroster.com",
    scope: "Internacional",
    automation: "generic",
  },
  {
    id: "runsignup",
    name: "RunSignup",
    website: "runsignup.com",
    scope: "Internacional",
    automation: "generic",
  },
  {
    id: "active",
    name: "Active.com",
    website: "active.com",
    scope: "Internacional",
    automation: "generic",
  },

  // Calendarios/agregadores: sirven para encontrar la carrera, la
  // inscripción vive en otra plataforma (se detecta al seguir el enlace).
  {
    id: "runedia",
    name: "Runedia (calendario)",
    website: "runedia.mundodeportivo.com",
    scope: "España",
    automation: "manual",
  },
];

export function countPlatforms() {
  return {
    total: PLATFORM_CATALOG.length,
    byLevel: PLATFORM_CATALOG.reduce<Record<string, number>>((acc, p) => {
      acc[p.automation] = (acc[p.automation] ?? 0) + 1;
      return acc;
    }, {}),
  };
}
