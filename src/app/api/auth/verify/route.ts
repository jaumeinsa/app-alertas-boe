import { NextRequest, NextResponse } from "next/server";
import { consumeLoginToken, setSessionCookie } from "@/lib/auth";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://notifikado.com";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const userId = await consumeLoginToken(token);
  if (!userId) {
    return NextResponse.redirect(new URL("/login?error=expirado", APP_URL));
  }
  setSessionCookie(userId);
  return NextResponse.redirect(new URL("/dashboard", APP_URL));
}
