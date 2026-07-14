import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { matchId, action } = await req.json().catch(() => ({}));
  const status =
    action === "confirm" ? "CONFIRMED" : action === "dismiss" ? "DISMISSED" : null;
  if (!matchId || !status) {
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }

  // Verifica que la coincidencia pertenece a un perfil del usuario.
  const match = await prisma.match.findFirst({
    where: { id: matchId, profile: { userId: user.id } },
    select: { id: true },
  });
  if (!match) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  await prisma.match.update({ where: { id: matchId }, data: { status } });
  return NextResponse.json({ ok: true, status });
}
