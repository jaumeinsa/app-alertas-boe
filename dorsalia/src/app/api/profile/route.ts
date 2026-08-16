/**
 * GET  /api/profile — perfil guardado (o vacío) + estado de completitud.
 * PUT  /api/profile — guarda el perfil (validado con zod) en el vault cifrado.
 */

import { NextRequest, NextResponse } from "next/server";
import { loadJson, saveJson } from "@/lib/vault";
import {
  RunnerProfile,
  RunnerProfileSchema,
  completeness,
  emptyProfile,
} from "@/lib/profile/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const stored = loadJson<RunnerProfile>("profile");
  const profile = stored ? RunnerProfileSchema.parse(stored) : emptyProfile();
  return NextResponse.json({ profile, completeness: completeness(profile) });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const parsed = RunnerProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Perfil inválido", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  saveJson("profile", parsed.data);
  return NextResponse.json({ ok: true, completeness: completeness(parsed.data) });
}
