import { NextRequest, NextResponse } from "next/server";
import { createLoginToken } from "@/lib/auth";
import { sendEmail } from "@/lib/mail";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://notifikado.com";

export async function POST(req: NextRequest) {
  const { email: rawEmail } = await req.json().catch(() => ({}));
  const email = String(rawEmail ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Email no válido." }, { status: 400 });
  }

  const { token } = await createLoginToken(email);
  const link = `${APP_URL}/api/auth/verify?token=${token}`;

  const mail = await sendEmail({
    to: email,
    subject: "Tu enlace de acceso a Notifikado",
    html: `<p>Hola,</p><p>Pulsa este enlace para entrar en tu panel de Notifikado (caduca en 30 minutos):</p><p><a href="${link}">Entrar en Notifikado</a></p><p>Si no has solicitado esto, ignora este mensaje.</p>`,
  });

  // Si el email no está configurado todavía, devolvemos el enlace para no
  // bloquear las pruebas (solo en ese caso).
  return NextResponse.json({ ok: true, emailed: mail.sent, devLink: mail.sent ? undefined : link });
}
