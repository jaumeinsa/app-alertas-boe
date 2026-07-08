/**
 * Webhook de Stripe.
 *  - checkout.session.completed → crea/actualiza el usuario y su suscripción
 *    y le envía un email de bienvenida con enlace de acceso (por si cerró la
 *    pestaña antes de la redirección post-pago).
 *  - customer.subscription.updated / .deleted → sincroniza estado y renovación.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createLoginToken } from "@/lib/auth";
import { sendEmail } from "@/lib/mail";
import { welcomeEmail } from "@/lib/emails";
import {
  getSubscription,
  normalizeSubscription,
  verifyStripeSignature,
  type StripeSubData,
} from "@/lib/stripe";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://notifikado.com";

const PLAN_LABEL: Record<string, string> = {
  MONTHLY: "Mensual (1,90 €/mes · 1 nombre)",
  YEARLY: "Anual (9 €/año · 1 nombre)",
  FAMILY: "Pack 10 (49 €/año · 10 nombres)",
  TRIAL: "Prueba",
};

async function upsertUserWithSubscription(
  email: string,
  sub: StripeSubData
): Promise<{ userId: string; created: boolean }> {
  const normalized = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  const user = await prisma.user.upsert({
    where: { email: normalized },
    update: sub.customerId ? { stripeCustomerId: sub.customerId } : {},
    create: { email: normalized, stripeCustomerId: sub.customerId },
  });
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
  return { userId: user.id, created: !existing };
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "Webhook no configurado" }, { status: 503 });
  }

  const payload = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!verifyStripeSignature(payload, signature, secret)) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
  }

  let event: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const type = event.type ?? "";
  const object = event.data?.object ?? {};

  try {
    if (type === "checkout.session.completed") {
      const details = object.customer_details as { email?: string | null } | undefined;
      const email = details?.email ?? (object.customer_email as string | null);
      const subscriptionId =
        typeof object.subscription === "string"
          ? object.subscription
          : ((object.subscription as { id?: string } | null)?.id ?? null);
      // Con métodos de pago asíncronos la sesión llega sin cobro confirmado:
      // no dar de alta ni felicitar hasta que el pago esté realmente hecho.
      const paymentStatus = object.payment_status as string | undefined;
      const paid = paymentStatus === "paid" || paymentStatus === "no_payment_required";

      if (email && subscriptionId && paid) {
        const sub = normalizeSubscription(await getSubscription(subscriptionId));
        if (!sub.customerId && typeof object.customer === "string") {
          sub.customerId = object.customer;
        }
        const { userId } = await upsertUserWithSubscription(email, sub);

        // Email de bienvenida con acceso directo (idempotencia: Stripe puede
        // reintentar el evento; un enlace extra no rompe nada).
        const { token } = await createLoginToken(email.trim().toLowerCase());
        const link = `${APP_URL}/api/auth/verify?token=${token}`;
        const mail = welcomeEmail(link, PLAN_LABEL[sub.plan] ?? sub.plan);
        const sent = await sendEmail({ to: email, subject: mail.subject, html: mail.html });
        if (!sent.sent) {
          // El alta ya está hecha (idempotente); solo queda constancia del fallo
          // de la bienvenida. El usuario puede entrar igualmente vía /login.
          console.error(`[stripe] bienvenida NO enviada a ${email}: ${sent.reason}`);
        }
        console.log(`[stripe] checkout completado: user=${userId} plan=${sub.plan}`);
      }
    } else if (type === "customer.subscription.updated" || type === "customer.subscription.deleted") {
      const sub = normalizeSubscription(object);
      const status = type.endsWith("deleted") ? ("CANCELED" as const) : sub.status;
      const row = await prisma.subscription.findUnique({
        where: { stripeSubscriptionId: sub.id },
      });
      if (row) {
        await prisma.subscription.update({
          where: { id: row.id },
          data: {
            status,
            plan: sub.plan,
            stripePriceId: sub.priceId,
            currentPeriodEnd: sub.currentPeriodEnd,
            maxProfiles: sub.maxProfiles,
          },
        });
      } else if (sub.customerId) {
        const user = await prisma.user.findUnique({
          where: { stripeCustomerId: sub.customerId },
        });
        if (user) {
          await upsertUserWithSubscription(user.email, { ...sub, status });
        }
      }
    }
  } catch (err) {
    // 500 → Stripe reintenta con backoff (lo que queremos si la BD falló).
    console.error(`[stripe] error procesando ${type}:`, err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
