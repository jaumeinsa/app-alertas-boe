/**
 * Almacén local cifrado (AES-256-GCM) para los datos del usuario: perfil,
 * fotos del DNI y resultados de inscripciones.
 *
 * RGPD: todo vive en `data/` en la máquina del usuario, cifrado en reposo.
 * La clave sale de DORSALIA_KEY (hex de 64 caracteres) o, si no existe, se
 * genera una vez y se guarda en `data/.key` con permisos 600.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const MAGIC = Buffer.from("DSL1");
const IV_LEN = 12;
const TAG_LEN = 16;

export function dataDir(): string {
  const dir = process.env.DORSALIA_DATA_DIR ?? path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const fromEnv = process.env.DORSALIA_KEY;
  if (fromEnv) {
    if (!/^[0-9a-fA-F]{64}$/.test(fromEnv)) {
      throw new Error("DORSALIA_KEY debe ser hex de 64 caracteres (32 bytes)");
    }
    cachedKey = Buffer.from(fromEnv, "hex");
    return cachedKey;
  }
  const keyFile = path.join(dataDir(), ".key");
  if (fs.existsSync(keyFile)) {
    cachedKey = Buffer.from(fs.readFileSync(keyFile, "utf8").trim(), "hex");
    return cachedKey;
  }
  const key = crypto.randomBytes(32);
  fs.writeFileSync(keyFile, key.toString("hex") + "\n", { mode: 0o600 });
  cachedKey = key;
  return key;
}

export function encrypt(plain: Buffer): Buffer {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), enc]);
}

export function decrypt(blob: Buffer): Buffer {
  if (!blob.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("Formato de fichero cifrado no reconocido");
  }
  const iv = blob.subarray(MAGIC.length, MAGIC.length + IV_LEN);
  const tag = blob.subarray(MAGIC.length + IV_LEN, MAGIC.length + IV_LEN + TAG_LEN);
  const enc = blob.subarray(MAGIC.length + IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]);
}

function fileFor(name: string): string {
  // Solo nombres simples: nada de rutas relativas dentro del vault.
  if (!/^[\w.-]+$/.test(name)) throw new Error(`Nombre de vault inválido: ${name}`);
  return path.join(dataDir(), `${name}.enc`);
}

export function saveBlob(name: string, data: Buffer): void {
  fs.writeFileSync(fileFor(name), encrypt(data), { mode: 0o600 });
}

export function loadBlob(name: string): Buffer | null {
  const file = fileFor(name);
  if (!fs.existsSync(file)) return null;
  return decrypt(fs.readFileSync(file));
}

export function saveJson(name: string, value: unknown): void {
  saveBlob(name, Buffer.from(JSON.stringify(value, null, 2), "utf8"));
}

export function loadJson<T>(name: string): T | null {
  const blob = loadBlob(name);
  if (!blob) return null;
  return JSON.parse(blob.toString("utf8")) as T;
}

export function removeEntry(name: string): void {
  const file = fileFor(name);
  if (fs.existsSync(file)) fs.rmSync(file);
}
