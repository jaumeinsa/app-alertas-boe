import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://notifikado.com";

export async function GET() {
  clearSessionCookie();
  return NextResponse.redirect(new URL("/", APP_URL));
}
