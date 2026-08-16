/**
 * Extracción de datos a partir de fotos del DNI.
 *
 * Contrato `DniExtractor` para poder enchufar distintos motores. Hoy hay uno:
 * visión con la API de Claude (requiere ANTHROPIC_API_KEY). Si no hay motor
 * disponible, el usuario siempre puede teclear sus datos a mano — la
 * extracción es una comodidad, nunca un requisito.
 *
 * El resultado SIEMPRE se presenta al usuario para revisión antes de
 * guardarse (exactitud + RGPD), y se verifica de forma independiente:
 * letra del DNI (módulo 23) y dígitos de control de la MRZ.
 */

import { z } from "zod";

export const DniExtractionSchema = z.object({
  nombre: z.string().optional(),
  apellido1: z.string().optional(),
  apellido2: z.string().optional(),
  numeroDocumento: z.string().optional(),
  /** ISO YYYY-MM-DD */
  fechaNacimiento: z.string().optional(),
  sexo: z.enum(["M", "F"]).optional(),
  nacionalidad: z.string().optional(),
  fechaCaducidad: z.string().optional(),
  /** Transcripción literal de la MRZ del reverso, si es visible. */
  mrz: z.string().optional(),
});

export type DniExtraction = z.infer<typeof DniExtractionSchema>;

export interface DniImage {
  data: Buffer;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
}

export interface DniExtractor {
  readonly id: string;
  available(): boolean;
  extract(images: DniImage[]): Promise<DniExtraction>;
}

import { claudeExtractor } from "./claude";

const EXTRACTORS: DniExtractor[] = [claudeExtractor];

/** Devuelve el primer motor disponible, o null si no hay ninguno configurado. */
export function getExtractor(): DniExtractor | null {
  return EXTRACTORS.find((e) => e.available()) ?? null;
}
