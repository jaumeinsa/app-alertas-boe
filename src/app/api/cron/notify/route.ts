import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { notifyNewMatches } from "@/lib/notify";

/** Comparación en tiempo constante (evita timing attacks sobre la clave). */
function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/**
 * Disparo del envío de avisos pendientes. Lo llama el cron del host tras la
 * ingesta y el matching diarios:
 *   curl -fsS -X POST -H "x-cron-key: $CRON_SECRET" http://127.0.0.1:3200/api/cron/notify
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 503 });
  }
  if (!safeEqual(req.headers.get("x-cron-key") ?? "", secret)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const summary = await notifyNewMatches();
  console.log("[notify]", JSON.stringify(summary));
  return NextResponse.json({ ok: true, ...summary });
}
