import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

/** Preferencias de aviso del usuario (canal email/WhatsApp y teléfono). */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const data: { notifyEmail?: boolean; notifyWhatsapp?: boolean; phone?: string | null } = {};

  if (typeof body.notifyEmail === "boolean") data.notifyEmail = body.notifyEmail;
  if (typeof body.notifyWhatsapp === "boolean") data.notifyWhatsapp = body.notifyWhatsapp;
  if (typeof body.phone === "string") {
    const phone = body.phone.trim();
    if (phone && !/^[+0-9][0-9 .()-]{7,19}$/.test(phone)) {
      return NextResponse.json({ error: "Teléfono no válido." }, { status: 400 });
    }
    data.phone = phone || null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada que guardar." }, { status: 400 });
  }

  const updated = await prisma.user.update({ where: { id: user.id }, data });
  return NextResponse.json({
    ok: true,
    notifyEmail: updated.notifyEmail,
    notifyWhatsapp: updated.notifyWhatsapp,
    phone: updated.phone,
  });
}
