/**
 * Configuración one-shot de Stripe. Ejecutar UNA VEZ cuando exista
 * STRIPE_SECRET_KEY (vale desde el Mac con el forward de BD, o en el worker):
 *
 *   STRIPE_SECRET_KEY=sk_live_… DATABASE_URL=… npx tsx scripts/stripe-setup.ts
 *
 * Hace tres cosas, todas idempotentes:
 *  1. Configura la redirección post-pago de TODOS los Payment Links activos
 *     → /api/stripe/complete?session_id={CHECKOUT_SESSION_ID}
 *  2. Crea el webhook /api/stripe/webhook si no existe (imprime el whsec_
 *     que hay que pegar en .env como STRIPE_WEBHOOK_SECRET)
 *  3. Sincroniza las suscripciones YA existentes en Stripe hacia la BD
 *     (rescata pagos hechos antes de configurar el webhook)
 */

import { prisma } from "@/lib/db";
import { normalizeSubscription, stripeGet, stripePost, stripeKey } from "@/lib/stripe";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://notifikado.com";

async function main() {
  if (!stripeKey()) {
    console.error("Falta STRIPE_SECRET_KEY en el entorno.");
    process.exit(1);
  }

  // 1) Redirección post-pago en los Payment Links.
  const redirectUrl = `${APP_URL}/api/stripe/complete?session_id={CHECKOUT_SESSION_ID}`;
  const links = await stripeGet("/payment_links", { active: "true", limit: "100" });
  for (const link of ((links.data as Record<string, unknown>[]) ?? [])) {
    const params = new URLSearchParams();
    params.set("after_completion[type]", "redirect");
    params.set("after_completion[redirect][url]", redirectUrl);
    await stripePost(`/payment_links/${link.id}`, params);
    console.log(`✓ payment_link ${link.id} → redirige a ${redirectUrl}`);
  }

  // 2) Webhook endpoint.
  const hookUrl = `${APP_URL}/api/stripe/webhook`;
  const hooks = await stripeGet("/webhook_endpoints", { limit: "100" });
  const existing = ((hooks.data as Record<string, unknown>[]) ?? []).find(
    (h) => h.url === hookUrl && h.status === "enabled"
  );
  if (existing) {
    console.log(`✓ webhook ya existe (${existing.id}). El whsec_ solo se muestra al crearlo;`);
    console.log("  si no lo tienes, bórralo en el dashboard de Stripe y re-ejecuta este script.");
  } else {
    const params = new URLSearchParams();
    params.set("url", hookUrl);
    params.set("description", "Notifikado — altas y estado de suscripciones");
    for (const ev of [
      "checkout.session.completed",
      "customer.subscription.updated",
      "customer.subscription.deleted",
    ]) {
      params.append("enabled_events[]", ev);
    }
    const created = await stripePost("/webhook_endpoints", params);
    console.log(`✓ webhook creado: ${created.id}`);
    console.log("");
    console.log(`⚠️  AÑADE ESTO AL .env DEL VPS Y REINICIA web:`);
    console.log(`    STRIPE_WEBHOOK_SECRET=${created.secret}`);
    console.log("");
  }

  // 3) Sincronizar suscripciones existentes.
  const subs = await stripeGet("/subscriptions", {
    status: "all",
    limit: "100",
    "expand[]": "data.customer",
  });
  let synced = 0;
  // Stripe lista de más nueva a más vieja; procesamos en orden cronológico
  // para que, si un email tiene varias, la más reciente quede en la BD.
  for (const raw of ((subs.data as Record<string, unknown>[]) ?? []).slice().reverse()) {
    const sub = normalizeSubscription(raw);
    if (!sub.email) {
      console.log(`— suscripción ${sub.id} sin email de cliente; la salto`);
      continue;
    }
    const email = sub.email.trim().toLowerCase();
    const user = await prisma.user.upsert({
      where: { email },
      update: sub.customerId ? { stripeCustomerId: sub.customerId } : {},
      create: { email, stripeCustomerId: sub.customerId },
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
    synced++;
    console.log(`✓ ${email} → plan ${sub.plan} (${sub.status})`);
  }
  console.log(`\nListo: ${synced} suscripciones sincronizadas.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
