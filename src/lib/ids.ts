/**
 * Validación y normalización de documentos de identidad españoles:
 * DNI (8 dígitos + letra), NIE (X/Y/Z + 7 dígitos + letra) y CIF (empresas).
 */

export type IdKind = "DNI" | "NIF" | "CIF";

const DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";

export function normalizeId(raw: string): string {
  return raw.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

export function detectIdType(raw: string): IdKind | null {
  const s = normalizeId(raw);
  if (/^[0-9]{8}[A-Z]$/.test(s)) return "DNI";
  if (/^[XYZ][0-9]{7}[A-Z]$/.test(s)) return "NIF"; // NIE de extranjeros
  if (/^[A-HJNPQRSUVW][0-9]{7}[0-9A-J]$/.test(s)) return "CIF";
  return null;
}

/** Comprueba la letra de control de un DNI/NIE (no aplica a CIF). */
export function isValidDniNie(raw: string): boolean {
  const s = normalizeId(raw);
  const m = s.match(/^([XYZ]?)([0-9]{7,8})([A-Z])$/);
  if (!m) return false;
  const prefixMap: Record<string, string> = { X: "0", Y: "1", Z: "2", "": "" };
  const num = parseInt(prefixMap[m[1]] + m[2], 10);
  return DNI_LETTERS[num % 23] === m[3];
}

/** Últimos 4 dígitos del documento (para casar con el BOE anonimizado). */
export function idSuffix(raw: string): string {
  return normalizeId(raw).replace(/[^0-9]/g, "").slice(-4);
}

export function kindForIdType(type: IdKind | null): "PERSON" | "COMPANY" {
  return type === "CIF" ? "COMPANY" : "PERSON";
}
