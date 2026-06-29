/** Paleta y tipografías compartidas (azul marino + azul + beige, coral esporádico). */

export const INK = "#22386B"; // azul marino: textos y superficies oscuras
export const CREAM = "#F3EFE4"; // beige de fondo
export const BLUE = "#2C5BD0"; // azul saturado: botones, enlaces, acentos
export const BLUE_LT = "#9DB6F2"; // azul claro
export const BLUE_SOFT = "#E7ECFB"; // superficie azul muy clara
export const CORAL = "#E8552D"; // acento esporádico / alerta
export const WHITE = "#FFFFFF";

export const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";
export const SANS = "'Instrument Sans', system-ui, -apple-system, sans-serif";
export const SERIF = "'Instrument Serif', Georgia, serif";
export const MONO = "'JetBrains Mono', monospace";
export const BRAND = "'Plus Jakarta Sans', sans-serif";

/** Color del acento por tipo de acto (badges del dashboard). */
export function actTypeColor(actType: string | null | undefined): string {
  switch (actType) {
    case "multa":
    case "embargo":
      return CORAL;
    case "citacion":
    case "judicial":
      return BLUE;
    default:
      return INK;
  }
}

export function actTypeLabel(actType: string | null | undefined): string {
  switch (actType) {
    case "multa":
      return "Multa / sanción";
    case "embargo":
      return "Embargo / apremio";
    case "citacion":
      return "Citación / requerimiento";
    case "judicial":
      return "Judicial";
    case "notificacion":
      return "Notificación";
    case "mercantil":
      return "Mercantil";
    default:
      return "Documento oficial";
  }
}
