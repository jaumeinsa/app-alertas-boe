/**
 * Perfil del corredor: todos los datos que piden (una y otra vez) los
 * formularios de inscripción de carreras. Se rellena una sola vez —
 * a mano o extrayéndolo de la foto del DNI — y a partir de ahí Dorsalia
 * lo vuelca en cualquier formulario.
 */

import { z } from "zod";

export const RunnerProfileSchema = z.object({
  // Identidad
  nombre: z.string().default(""),
  apellido1: z.string().default(""),
  apellido2: z.string().default(""),
  tipoDocumento: z.enum(["DNI", "NIE", "PASAPORTE"]).default("DNI"),
  numeroDocumento: z.string().default(""),
  /** ISO YYYY-MM-DD */
  fechaNacimiento: z.string().default(""),
  sexo: z.enum(["M", "F", ""]).default(""),
  nacionalidad: z.string().default("España"),

  // Contacto
  email: z.string().default(""),
  telefono: z.string().default(""),

  // Dirección
  direccion: z.string().default(""),
  codigoPostal: z.string().default(""),
  localidad: z.string().default(""),
  provincia: z.string().default(""),
  pais: z.string().default("España"),

  // Datos deportivos
  club: z.string().default(""),
  federado: z.boolean().default(false),
  numeroLicencia: z.string().default(""),
  tallaCamiseta: z.enum(["XS", "S", "M", "L", "XL", "XXL", ""]).default(""),

  // Emergencias y otros
  contactoEmergenciaNombre: z.string().default(""),
  contactoEmergenciaTelefono: z.string().default(""),
  observaciones: z.string().default(""),
});

export type RunnerProfile = z.infer<typeof RunnerProfileSchema>;

export function emptyProfile(): RunnerProfile {
  return RunnerProfileSchema.parse({});
}

/** Apellidos juntos, como los piden la mayoría de formularios. */
export function apellidos(p: RunnerProfile): string {
  return [p.apellido1, p.apellido2].filter(Boolean).join(" ");
}

export function nombreCompleto(p: RunnerProfile): string {
  return [p.nombre, apellidos(p)].filter(Boolean).join(" ");
}

/** Campos sin los cuales no tiene sentido intentar una inscripción. */
const REQUIRED_FIELDS: Array<[keyof RunnerProfile, string]> = [
  ["nombre", "Nombre"],
  ["apellido1", "Primer apellido"],
  ["numeroDocumento", "DNI/NIE"],
  ["fechaNacimiento", "Fecha de nacimiento"],
  ["email", "Email"],
  ["telefono", "Teléfono"],
];

export interface ProfileCompleteness {
  ready: boolean;
  missing: string[];
  /** % de campos del perfil con contenido (orientativo). */
  pct: number;
}

export function completeness(p: RunnerProfile): ProfileCompleteness {
  const missing = REQUIRED_FIELDS.filter(([k]) => !String(p[k]).trim()).map(
    ([, label]) => label,
  );
  const values = Object.values(p);
  const filled = values.filter((v) =>
    typeof v === "boolean" ? v : String(v).trim() !== "",
  ).length;
  return {
    ready: missing.length === 0,
    missing,
    pct: Math.round((filled / values.length) * 100),
  };
}
