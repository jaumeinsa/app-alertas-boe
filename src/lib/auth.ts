/**
 * Sesión (cookie firmada con HMAC) y login por enlace mágico (magic-link).
 * Sin contraseñas: el alta crea la sesión directamente; el login posterior se
 * hace con un token de un solo uso enviado por email.
 */

import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

const COOKIE = "nk_session";
const MAX_AGE = 60 * 60 * 24 * 60; // 60 días
const TOKEN_TTL_MS = 1000 * 60 * 30; // 30 min para el magic-link

/** Secreto de firma. En producción es OBLIGATORIO (un valor por defecto
 *  conocido permitiría falsificar cookies de sesión). Lazy para no romper
 *  el `next build` (que corre sin .env). */
function getSecret(): string {
  const s = process.env.AUTH_SECRET?.trim();
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET no configurada en producción");
  }
  return "dev-insecure-secret-change-me";
}

function sign(data: string): string {
  return crypto.createHmac("sha256", getSecret()).update(data).digest("base64url");
}

export function createSessionToken(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, exp: Date.now() + MAX_AGE * 1000 })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string): string | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig || sign(payload) !== sig) return null;
  try {
    const { uid, exp } = JSON.parse(
      Buffer.from(payload, "base64url").toString()
    );
    if (!uid || typeof exp !== "number" || exp < Date.now()) return null;
    return uid as string;
  } catch {
    return null;
  }
}

export function setSessionCookie(userId: string): void {
  cookies().set(COOKIE, createSessionToken(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export function clearSessionCookie(): void {
  cookies().delete(COOKIE);
}

export async function getSessionUser() {
  const value = cookies().get(COOKIE)?.value;
  if (!value) return null;
  const uid = verifySessionToken(value);
  if (!uid) return null;
  return prisma.user.findUnique({ where: { id: uid } });
}

/** Crea un token de magic-link para un email (crea el usuario si no existe). */
export async function createLoginToken(
  email: string
): Promise<{ token: string; userId: string }> {
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email },
  });
  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.loginToken.create({
    data: {
      token,
      userId: user.id,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });
  return { token, userId: user.id };
}

/** Consume un token de magic-link y devuelve el userId si es válido. */
export async function consumeLoginToken(token: string): Promise<string | null> {
  const row = await prisma.loginToken.findUnique({ where: { token } });
  if (!row || row.usedAt || row.expiresAt < new Date()) return null;
  await prisma.loginToken.update({
    where: { id: row.id },
    data: { usedAt: new Date() },
  });
  return row.userId;
}
