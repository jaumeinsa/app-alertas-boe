/**
 * Validación de números de documento españoles (DNI y NIE) por letra de
 * control (módulo 23). Sirve para verificar lo que devuelve el OCR/visión
 * antes de dárselo al usuario como bueno.
 */

const LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";

export function dniLetter(num: number): string {
  return LETTERS[num % 23];
}

/** Valida un DNI completo ("12345678Z") o un NIE ("X1234567L"). */
export function validateDocumento(doc: string): boolean {
  const clean = doc.toUpperCase().replace(/[\s-]/g, "");
  const dni = /^(\d{8})([A-Z])$/.exec(clean);
  if (dni) return dniLetter(Number(dni[1])) === dni[2];
  const nie = /^([XYZ])(\d{7})([A-Z])$/.exec(clean);
  if (nie) {
    const prefix = { X: "0", Y: "1", Z: "2" }[nie[1] as "X" | "Y" | "Z"];
    return dniLetter(Number(prefix + nie[2])) === nie[3];
  }
  return false;
}

export function normalizeDocumento(doc: string): string {
  return doc.toUpperCase().replace(/[\s-]/g, "");
}
