/**
 * Supresión total de la cuenta (derecho de supresión, art. 17 RGPD).
 * Cancela la renovación en Stripe (si hay suscripción) y borra al usuario con
 * todos sus datos en cascada: perfiles vigilados, coincidencias, avisos,
 * tokens de acceso y suscripción. Las publicaciones oficiales (datos públicos)
 * no contienen datos del usuario y no se tocan.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { clearSessionCookie, getSessionUser } from "@/lib/auth";
import { cancelSubscription, stripeKey } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { confirm } = await req.json().catch(() => ({}));
  if (confirm !== "ELIMINAR") {
    return NextResponse.json(
      { error: 'Escribe "ELIMINAR" para confirmar la supresión.' },
      { status: 400 }
    );
  }

  // 1) Cancelar la renovación en Stripe (mejor esfuerzo: si falla, el borrado
  //    de datos sigue adelante y se avisa para cancelar manualmente).
  let stripeCancelled: boolean | null = null;
  const subscription = await prisma.subscription.findUnique({ where: { userId: user.id } });
  if (subscription?.stripeSubscriptionId && stripeKey()) {
    try {
      await cancelSubscription(subscription.stripeSubscriptionId);
      stripeCancelled = true;
    } catch (err) {
      console.error("[account/delete] no se pudo cancelar en Stripe:", err);
      stripeCancelled = false;
    }
  }

  // 2) Borrado en cascada de todos los datos personales.
  await prisma.user.delete({ where: { id: user.id } });
  clearSessionCookie();
  console.log(`[account/delete] cuenta eliminada: ${user.email} (stripe: ${stripeCancelled})`);

  return NextResponse.json({ ok: true, stripeCancelled });
}
