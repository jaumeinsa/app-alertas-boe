import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { consumeLoginToken, setSessionCookie } from "@/lib/auth";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://notifikado.com";

/**
 * GET: NO consume el token. Muestra una página mínima que lo reenvía por POST
 * (auto-submit). Así los escáneres de enlaces de los clientes de correo (que
 * hacen GET) no queman el enlace de un solo uso antes del clic del usuario.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const row = token
    ? await prisma.loginToken.findUnique({ where: { token } })
    : null;
  if (!row || row.usedAt || row.expiresAt < new Date()) {
    return NextResponse.redirect(new URL("/login?error=expirado", APP_URL));
  }
  // El token viene de nuestra BD (base64url: [A-Za-z0-9_-]) → seguro en el HTML.
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Entrando en Notifikado…</title></head>
<body style="font-family:system-ui,sans-serif;background:#F3EFE4;color:#22386B;display:grid;place-items:center;min-height:100vh;margin:0">
<form method="POST" action="/api/auth/verify" style="text-align:center;padding:24px">
  <input type="hidden" name="token" value="${row.token}">
  <p style="font-size:15px;margin:0 0 16px">Un momento, entrando en tu panel…</p>
  <button type="submit" style="background:#2C5BD0;color:#fff;border:none;border-radius:100px;padding:12px 26px;font-weight:700;font-size:15px;cursor:pointer">Entrar en Notifikado</button>
</form>
<script>document.forms[0].submit()</script>
</body></html>`;
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** POST: consume el token de un solo uso y crea la sesión. */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const token = String(form?.get("token") ?? "");
  const userId = await consumeLoginToken(token);
  if (!userId) {
    return NextResponse.redirect(new URL("/login?error=expirado", APP_URL), 303);
  }
  setSessionCookie(userId);

  // Un usuario recién pagado aún no tiene ningún nombre vigilado: le llevamos
  // directamente a configurarlo en vez de a un panel vacío.
  const profiles = await prisma.monitoredProfile.count({ where: { userId } });
  return NextResponse.redirect(
    new URL(profiles === 0 ? "/alta?bienvenida=1" : "/dashboard", APP_URL),
    303
  );
}
