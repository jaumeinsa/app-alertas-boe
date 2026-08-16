/**
 * Parser de la zona MRZ (Machine Readable Zone) del reverso del DNI español,
 * formato TD1 de la OACI: 3 líneas de 30 caracteres.
 *
 *   Línea 1: IDESP + nº de soporte (9) + dígito control + nº DNI en la zona opcional
 *   Línea 2: fecha nacimiento (YYMMDD) + DC + sexo + caducidad (YYMMDD) + DC + nacionalidad + DC final
 *   Línea 3: APELLIDO1<APELLIDO2<<NOMBRE
 *
 * Los dígitos de control (pesos 7-3-1, módulo 10) permiten VERIFICAR que la
 * lectura es correcta: si cuadran, los datos son fiables sin intervención
 * humana. Es la comprobación cruzada perfecta para lo que extrae la visión.
 */

export interface MrzResult {
  valid: boolean;
  errors: string[];
  documentNumber?: string; // nº de soporte (BGM...)
  dniNumber?: string; // nº de DNI (zona opcional de la línea 1)
  birthDate?: string; // ISO YYYY-MM-DD
  expiryDate?: string; // ISO YYYY-MM-DD
  sex?: "M" | "F";
  surname1?: string;
  surname2?: string;
  givenNames?: string;
  nationality?: string;
}

function charValue(c: string): number {
  if (c >= "0" && c <= "9") return c.charCodeAt(0) - 48;
  if (c >= "A" && c <= "Z") return c.charCodeAt(0) - 55; // A=10..Z=35
  return 0; // '<'
}

export function checkDigit(field: string): number {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < field.length; i++) {
    sum += charValue(field[i]) * weights[i % 3];
  }
  return sum % 10;
}

function toIsoDate(yymmdd: string, kind: "birth" | "expiry"): string | undefined {
  if (!/^\d{6}$/.test(yymmdd)) return undefined;
  const yy = Number(yymmdd.slice(0, 2));
  const now = new Date().getUTCFullYear() % 100;
  // Caducidades siempre en el futuro cercano (2000s); nacimientos pueden ser 19xx.
  const century = kind === "expiry" ? 2000 : yy > now ? 1900 : 2000;
  return `${century + yy}-${yymmdd.slice(2, 4)}-${yymmdd.slice(4, 6)}`;
}

/**
 * Busca y parsea una MRZ TD1 dentro de un texto arbitrario (p.ej. la
 * transcripción que devuelve el modelo de visión).
 */
export function parseMrz(raw: string): MrzResult {
  const errors: string[] = [];
  const lines = raw
    .toUpperCase()
    .split(/\r?\n/)
    .map((l) => l.replace(/[^A-Z0-9<]/g, ""))
    .filter((l) => l.length >= 28 && l.length <= 32)
    .map((l) => l.padEnd(30, "<").slice(0, 30));

  const start = lines.findIndex((l) => l.startsWith("ID"));
  if (start === -1 || lines.length - start < 3) {
    return { valid: false, errors: ["No se encontró una MRZ TD1 (3 líneas de 30)"] };
  }
  const [l1, l2, l3] = lines.slice(start, start + 3);

  // Línea 1: tipo (2) + país (3) + nº soporte (9) + DC (1) + opcional (15)
  const documentNumber = l1.slice(5, 14).replace(/</g, "");
  const dc1 = l1[14];
  if (String(checkDigit(l1.slice(5, 14))) !== dc1) {
    errors.push("Dígito de control del nº de soporte no cuadra");
  }
  const dniNumber = l1.slice(15, 30).replace(/</g, "") || undefined;

  // Línea 2: nacimiento (6) + DC + sexo + caducidad (6) + DC + nacionalidad (3) ... DC final
  const birthRaw = l2.slice(0, 6);
  if (String(checkDigit(birthRaw)) !== l2[6]) {
    errors.push("Dígito de control de la fecha de nacimiento no cuadra");
  }
  const sexChar = l2[7];
  const expiryRaw = l2.slice(8, 14);
  if (String(checkDigit(expiryRaw)) !== l2[14]) {
    errors.push("Dígito de control de la caducidad no cuadra");
  }
  const nationality = l2.slice(15, 18).replace(/</g, "");

  // Dígito de control compuesto (final de línea 2).
  const composite =
    l1.slice(5, 30) + l2.slice(0, 7) + l2.slice(8, 15) + l2.slice(18, 29);
  if (String(checkDigit(composite)) !== l2[29]) {
    errors.push("Dígito de control compuesto no cuadra");
  }

  // Línea 3: APELLIDO1<APELLIDO2<<NOMBRE
  const [surnamesPart, givenPart = ""] = l3.split("<<");
  const surnameTokens = surnamesPart.split("<").filter(Boolean);
  const givenNames = givenPart.split("<").filter(Boolean).join(" ") || undefined;

  return {
    valid: errors.length === 0,
    errors,
    documentNumber: documentNumber || undefined,
    dniNumber,
    birthDate: toIsoDate(birthRaw, "birth"),
    expiryDate: toIsoDate(expiryRaw, "expiry"),
    sex: sexChar === "M" ? "M" : sexChar === "F" ? "F" : undefined,
    surname1: surnameTokens[0],
    surname2: surnameTokens.slice(1).join(" ") || undefined,
    givenNames,
    nationality: nationality || undefined,
  };
}
