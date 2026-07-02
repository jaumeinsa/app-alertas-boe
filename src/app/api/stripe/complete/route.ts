/**
 * Aterrizaje tras el pago: los Payment Links de Stripe redirigen aquí con
 * ?session_id={CHECKOUT_SESSION_ID}. Verificamos la sesión contra la API de
 * Stripe, dejamos al usuario autenticado (cookie de sesión) y le llevamos a
 * configurar su vigilancia. Si algo no cuadra, caemos en /gracias con un
 * mensaje amable (el webhook le habrá enviado el acceso por email igualmente).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth";
import { getCheckoutSession, getSubscription, normalizeSubscription, stripeKey } from "@/lib/stripe";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://notifikado.com";

export async function GET(req: NextRequest) {
  const gracias = (estado: string) => NextResponse.redirect(new URL(`/gracias?estado=${estado}`, APP_URL));

  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!sessionId) return gracias("error");
  if (!stripeKey()) return gracias("recibido");

  try {
    const session = await getCheckoutSession(sessionId);
    const paymentStatus = session.payment_status as string | undefined;
    const details = session.customer_details as { email?: string | null } | undefined;
    const email = (details?.email ?? (session.customer_email as string | null))?.trim().toLowerCase();

    if (!email) return gracias("error");
    if (paymentStatus !== "paid" && paymentStatus !== "no_payment_required") {
      return gracias("pendiente");
    }

    // Usuario + suscripción (idempotente respecto al webhook, que puede haber
    // llegado ya o llegar después).
    const customerId = typeof session.customer === "string" ? session.customer : null;
    const user = await prisma.user.upsert({
      where: { email },
      update: customerId ? { stripeCustomerId: customerId } : {},
      create: { email, stripeCustomerId: customerId },
    });

    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : ((session.subscription as { id?: string } | null)?.id ?? null);
    if (subscriptionId) {
      const sub = normalizeSubscription(await getSubscription(subscriptionId));
      await prisma.subscription.upsert({
        where: { userId: user.id },
        update: {
          plan: sub.plan,
          status: sub.status,
          stripeSubscriptionId: sub.id,
          stripePriceId: sub.priceId,
          currentPeriodEnd: sub.currentPeriodEnd,
          maxProfiles: sub.maxProfiles,
        },
        create: {
          userId: user.id,
          plan: sub.plan,
          status: sub.status,
          stripeSubscriptionId: sub.id,
          stripePriceId: sub.priceId,
          currentPeriodEnd: sub.currentPeriodEnd,
          maxProfiles: sub.maxProfiles,
        },
      });
    }

    setSessionCookie(user.id);

    const profiles = await prisma.monitoredProfile.count({ where: { userId: user.id } });
    return NextResponse.redirect(
      new URL(profiles === 0 ? "/alta?bienvenida=1" : "/dashboard?pago=ok", APP_URL)
    );
  } catch (err) {
    console.error("[stripe] error verificando checkout session:", err);
    return gracias("recibido");
  }
}
