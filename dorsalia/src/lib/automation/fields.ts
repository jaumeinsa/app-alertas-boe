/**
 * Diccionario de campos: cómo reconocer los campos típicos de un formulario
 * de inscripción a partir de su etiqueta, name, id, placeholder o atributo
 * autocomplete, en español, catalán e inglés.
 *
 * Es el corazón del modo genérico: gracias a esto el motor rellena
 * formularios de plataformas que no tienen adaptador dedicado.
 */

import { RunnerProfile, apellidos, nombreCompleto } from "../profile/types";

export type FieldKey =
  | "nombre"
  | "nombreCompleto"
  | "apellidos"
  | "apellido1"
  | "apellido2"
  | "documento"
  | "email"
  | "emailConfirm"
  | "telefono"
  | "fechaNacimiento"
  | "diaNacimiento"
  | "mesNacimiento"
  | "anioNacimiento"
  | "sexo"
  | "nacionalidad"
  | "direccion"
  | "cp"
  | "localidad"
  | "provincia"
  | "pais"
  | "club"
  | "licencia"
  | "talla"
  | "emergenciaNombre"
  | "emergenciaTelefono"
  | "observaciones";

/** minúsculas, sin acentos, solo [a-z0-9 ] — para comparar con sinónimos. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Reglas en orden: la primera que casa gana, así que las más específicas
 * ("segundo apellido", "confirmar email") van antes que las genéricas.
 * Se aplican sobre el texto normalizado del descriptor del campo.
 */
const RULES: Array<[FieldKey, RegExp]> = [
  ["emailConfirm", /(confirm|repit|repet|verif)\w* (e ?mail|correo)|(e ?mail|correo)\w* ?(confirm|repit|repet|verif)/],
  ["email", /e ?mail|correo/],
  ["emergenciaTelefono", /(emergencia|urgencia)\w*.*(tel|movil|mobil|phone)|(tel|movil|mobil|phone)\w*.*(emergencia|urgencia)/],
  ["emergenciaNombre", /emergencia|urgencia/],
  ["fechaNacimiento", /fecha (de )?nacimiento|nacimiento|naixement|birth ?date|date of birth|\bbday\b|\bf nac\b/],
  ["diaNacimiento", /\b(dia|day|dd)\b/],
  ["mesNacimiento", /\b(mes|month|mm)\b/],
  ["anioNacimiento", /\b(ano|anio|any|year|yyyy|aaaa)\b/],
  ["apellido2", /segundo apellido|2\w* apellido|apellido 2|second surname|segon cognom/],
  ["apellido1", /primer apellido|1\w* apellido|apellido 1|first surname|primer cognom/],
  ["apellidos", /apellid|surname|last ?name|cognom|family ?name/],
  ["nombreCompleto", /nombre y apellidos|nombre completo|full ?name|nom complet/],
  ["documento", /\bdni\b|\bnif\b|\bnie\b|documento|passaport|pasaporte|passport|document|identity|id card/],
  ["nacionalidad", /nacionalidad|nationality|nacionalitat/],
  ["nombre", /\bnombre\b|first ?name|given ?name|\bnom\b/],
  ["telefono", /telefono|telefon|movil|mobil|phone|celular/],
  ["cp", /codigo postal|\bcp\b|postal ?code|\bzip\b/],
  ["direccion", /direccion|domicilio|address|adreca|calle/],
  ["localidad", /localidad|ciudad|poblacion|municipio|\bcity\b|\btown\b|poblacio/],
  ["provincia", /provincia|province|\bstate\b/],
  ["pais", /\bpais\b|country/],
  ["club", /\bclub\b|equipo|\bteam\b/],
  ["licencia", /licencia|license|licence|federad/],
  ["talla", /talla|camiseta|t ?shirt|samarreta|\bsize\b/],
  ["sexo", /\bsexo\b|genero|gender|\bsex\b|\bgenere\b/],
  ["observaciones", /observacion|comentario|alergia|allerg|remarks|notes|medic/],
];

/** Mapeo directo del atributo `autocomplete` (máxima confianza). */
const AUTOCOMPLETE_MAP: Record<string, FieldKey> = {
  "given-name": "nombre",
  "family-name": "apellidos",
  name: "nombreCompleto",
  email: "email",
  tel: "telefono",
  "tel-national": "telefono",
  bday: "fechaNacimiento",
  "bday-day": "diaNacimiento",
  "bday-month": "mesNacimiento",
  "bday-year": "anioNacimiento",
  "postal-code": "cp",
  "street-address": "direccion",
  "address-line1": "direccion",
  "address-level2": "localidad",
  "address-level1": "provincia",
  country: "pais",
  "country-name": "pais",
  sex: "sexo",
  organization: "club",
};

export function matchField(descriptor: string, autocomplete?: string): FieldKey | null {
  if (autocomplete) {
    const direct = AUTOCOMPLETE_MAP[autocomplete.toLowerCase().trim()];
    if (direct) return direct;
  }
  const text = normalizeText(descriptor);
  if (!text) return null;
  for (const [key, re] of RULES) {
    if (re.test(text)) return key;
  }
  return null;
}

/** Casillas que NUNCA se marcan solas: consentimientos legales. */
export const CONSENT_RE =
  /acept|acepto|condicion|privacidad|politica|reglamento|rgpd|lopd|consent|terms|autorizo|mayor de edad|descargo|exoner|waiver/;

function birthParts(p: RunnerProfile): { d: string; m: string; y: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(p.fechaNacimiento);
  if (!m) return { d: "", m: "", y: "" };
  return { y: m[1], m: m[2], d: m[3] };
}

/** Valor de texto que corresponde a cada campo según el perfil. */
export function valueForField(key: FieldKey, p: RunnerProfile): string {
  switch (key) {
    case "nombre":
      return p.nombre;
    case "nombreCompleto":
      return nombreCompleto(p);
    case "apellidos":
      return apellidos(p);
    case "apellido1":
      return p.apellido1;
    case "apellido2":
      return p.apellido2;
    case "documento":
      return p.numeroDocumento;
    case "email":
    case "emailConfirm":
      return p.email;
    case "telefono":
      return p.telefono;
    case "fechaNacimiento":
      return p.fechaNacimiento;
    case "diaNacimiento":
      return birthParts(p).d;
    case "mesNacimiento":
      return birthParts(p).m;
    case "anioNacimiento":
      return birthParts(p).y;
    case "sexo":
      return p.sexo;
    case "nacionalidad":
      return p.nacionalidad;
    case "direccion":
      return p.direccion;
    case "cp":
      return p.codigoPostal;
    case "localidad":
      return p.localidad;
    case "provincia":
      return p.provincia;
    case "pais":
      return p.pais;
    case "club":
      return p.club;
    case "licencia":
      return p.numeroLicencia;
    case "talla":
      return p.tallaCamiseta;
    case "emergenciaNombre":
      return p.contactoEmergenciaNombre;
    case "emergenciaTelefono":
      return p.contactoEmergenciaTelefono;
    case "observaciones":
      return p.observaciones;
  }
}

const MALE_RE = /\bm\b|masculino|masculi|hombre|male|varon/;
const FEMALE_RE = /\bf\b|femenino|femeni|mujer|female|dona/;

/** ¿Esta opción/radio de sexo corresponde al sexo del perfil? */
export function genderOptionMatches(optionText: string, sexo: "M" | "F"): boolean {
  const t = normalizeText(optionText);
  // "female" contiene "male": lo femenino se comprueba primero y lo
  // masculino exige que NO case también como femenino.
  if (sexo === "F") return FEMALE_RE.test(t);
  return MALE_RE.test(t) && !FEMALE_RE.test(t);
}

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** ¿La opción de un <select> de mes corresponde al mes MM (01-12)? */
export function monthOptionMatches(optionText: string, optionValue: string, mm: string): boolean {
  const n = Number(mm);
  const t = normalizeText(optionText);
  const v = normalizeText(optionValue);
  if (Number(v) === n || Number(t) === n) return true;
  return t.includes(MONTHS_ES[n - 1]);
}
