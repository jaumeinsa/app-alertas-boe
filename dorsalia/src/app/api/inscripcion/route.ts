/**
 * POST /api/inscripcion { url } — lanza el autorrelleno de una carrera.
 *   Responde en cuanto arranca ({ runId }); el navegador se abre en la
 *   máquina donde corre el servidor (uso pensado: localhost).
 * GET  /api/inscripcion?id=... — estado/informe de una ejecución.
 * GET  /api/inscripcion — últimas ejecuciones.
 */

import { NextRequest, NextResponse } from "next/server";
import { loadJson } from "@/lib/vault";
import {
  RunnerProfile,
  RunnerProfileSchema,
  completeness,
} from "@/lib/profile/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
  let url: URL;
  try {
    url = new URL(rawUrl);
    if (!/^https?:$/.test(url.protocol)) throw new Error("protocolo");
  } catch {
    return NextResponse.json(
      { error: "URL no válida. Pega el enlace completo de la carrera (https://...)." },
      { status: 400 },
    );
  }

  const stored = loadJson<RunnerProfile>("profile");
  if (!stored) {
    return NextResponse.json(
      { error: "Primero guarda tu perfil en la pestaña «Mi perfil»." },
      { status: 409 },
    );
  }
  const profile = RunnerProfileSchema.parse(stored);
  const check = completeness(profile);
  if (!check.ready) {
    return NextResponse.json(
      { error: `Faltan datos en el perfil: ${check.missing.join(", ")}.` },
      { status: 409 },
    );
  }

  // Import dinámico: Playwright solo se carga cuando de verdad se usa.
  const { runInscripcion } = await import("@/lib/automation/engine");

  let runId: string | null = null;
  const started = new Promise<string>((resolve) => {
    // El motor persiste el resultado inicial de forma síncrona al arrancar;
    // capturamos el id en el primer onUpdate y NO esperamos al relleno.
    void runInscripcion(url.toString(), profile, {
      onUpdate: (r) => {
        if (!runId) {
          runId = r.id;
          resolve(r.id);
        }
      },
    }).catch(() => {
      /* el error queda registrado en el informe del run */
    });
  });

  const id = await started;
  return NextResponse.json({ runId: id }, { status: 202 });
}

export async function GET(req: NextRequest) {
  const { getRun, listRuns } = await import("@/lib/automation/engine");
  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    const run = getRun(id);
    if (!run) return NextResponse.json({ error: "Run no encontrado" }, { status: 404 });
    return NextResponse.json({ run });
  }
  return NextResponse.json({ runs: listRuns().slice(0, 20) });
}
