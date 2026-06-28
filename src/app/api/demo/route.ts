/**
 * API de la demo de la landing.
 *
 * POST /api/demo  { "name": "Antonio García López" }
 * Devuelve coincidencias reales encontradas en el BOE de los últimos días
 * más, si no hay ninguna, ejemplos ilustrativos marcados como tales.
 */

import { runDemoSearch } from "@/lib/demo/search";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  name: z.string().min(3, "Escribe nombre y apellidos").max(120),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  try {
    const result = await runDemoSearch(parsed.data.name);
    return NextResponse.json(result);
  } catch (err) {
    console.error("demo search error", err);
    return NextResponse.json(
      { error: "No hemos podido completar la búsqueda. Inténtalo de nuevo." },
      { status: 502 }
    );
  }
}
