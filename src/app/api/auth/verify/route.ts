import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { consumeLoginToken, setSessionCookie } from "@/lib/auth";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://notifikado.com";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const userId = await consumeLoginToken(token);
  if (!userId) {
    return NextResponse.redirect(new URL("/login?error=expirado", APP_URL));
  }
  setSessionCookie(userId);

  // Un usuario recién pagado aún no tiene ningún nombre vigilado: le llevamos
  // directamente a configurarlo en vez de a un panel vacío.
  const profiles = await prisma.monitoredProfile.count({ where: { userId } });
  return NextResponse.redirect(
    new URL(profiles === 0 ? "/alta?bienvenida=1" : "/dashboard", APP_URL)
  );
}
