import { NextRequest, NextResponse } from "next/server";
import { createLoginToken } from "@/lib/auth";
import { sendEmail } from "@/lib/mail";
import { magicLinkEmail } from "@/lib/emails";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://notifikado.com";

export async function POST(req: NextRequest) {
  const { email: rawEmail } = await req.json().catch(() => ({}));
  const email = String(rawEmail ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Email no válido." }, { status: 400 });
  }

  const { token } = await createLoginToken(email);
  const link = `${APP_URL}/api/auth/verify?token=${token}`;

  const tpl = magicLinkEmail(link);
  const mail = await sendEmail({ to: email, subject: tpl.subject, html: tpl.html });

  // devLink SOLO cuando Resend no está configurado en absoluto (entorno de
  // pruebas). Si Resend está configurado pero el envío falla, NUNCA se filtra
  // el enlace al navegador: daría acceso a la cuenta de cualquier email.
  const resendConfigured = Boolean(process.env.RESEND_API_KEY?.trim());
  return NextResponse.json({
    ok: true,
    emailed: mail.sent,
    devLink: !resendConfigured && !mail.sent ? link : undefined,
  });
}
