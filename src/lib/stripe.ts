/**
 * Cliente mínimo de la API de Stripe vía fetch (sin SDK).
 * Se usa para: verificar sesiones de Checkout tras el pago, procesar webhooks
 * y sincronizar suscripciones. Si STRIPE_SECRET_KEY no está configurada, todas
 * las operaciones fallan de forma controlada.
 */

import crypto from "crypto";
import type { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";

const API = "https://api.stripe.com/v1";

export function stripeKey(): string | null {
  const k = process.env.STRIPE_SECRET_KEY?.trim();
  return k ? k : null;
}

async function stripeRequest(
  method: "GET" | "POST" | "DELETE",
  path: string,
  params?: Record<string, string> | URLSearchParams
): Promise<Record<string, unknown>> {
  const key = stripeKey();
  if (!key) throw new Error("STRIPE_SECRET_KEY no configurada");
  const body = params ? new URLSearchParams(params).toString() : undefined;
  const url = method !== "POST" && body ? `${API}${path}?${body}` : `${API}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: method === "POST" ? body : undefined,
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const err = json.error as { message?: string } | undefined;
    throw new Error(`Stripe ${res.status}: ${err?.message ?? "error"}`);
  }
  return json;
}

export const stripeGet = (path: string, params?: Record<string, string> | URLSearchParams) =>
  stripeRequest("GET", path, params);
export const stripePost = (path: string, params?: Record<string, string> | URLSearchParams) =>
  stripeRequest("POST", path, params);

/* ── Webhook: verificación de firma (Stripe-Signature) ──────── */

export function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  toleranceSeconds = 600
): boolean {
  if (!header) return false;
  let timestamp = "";
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.split("=", 2);
    if (k?.trim() === "t") timestamp = v ?? "";
    if (k?.trim() === "v1" && v) signatures.push(v);
  }
  const ts = Number(timestamp);
  if (!ts || !signatures.length) return false;
  if (Math.abs(Date.now() / 1000 - ts) > toleranceSeconds) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  const expectedBuf = Buffer.from(expected);
  return signatures.some((sig) => {
    const buf = Buffer.from(sig);
    return buf.length === expectedBuf.length && crypto.timingSafeEqual(buf, expectedBuf);
  });
}

/* ── Mapeos Stripe → nuestro modelo ─────────────────────────── */

export function mapStripeStatus(s: string | undefined): SubscriptionStatus {
  switch (s) {
    case "active":
      return "ACTIVE";
    case "trialing":
      return "TRIALING";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    case "canceled":
    case "incomplete_expired":
      return "CANCELED";
    default:
      return "INCOMPLETE";
  }
}

/** Deducción del plan a partir del precio (importe en céntimos + intervalo). */
export function mapPlan(
  unitAmount: number | null | undefined,
  interval: string | null | undefined
): { plan: SubscriptionPlan; maxProfiles: number } {
  if (interval === "year") return { plan: "YEARLY", maxProfiles: 1 };
  if (unitAmount != null && unitAmount >= 1400) return { plan: "FAMILY", maxProfiles: 5 };
  return { plan: "MONTHLY", maxProfiles: 1 };
}

/** Datos normalizados de una suscripción de Stripe. */
export interface StripeSubData {
  id: string;
  status: SubscriptionStatus;
  plan: SubscriptionPlan;
  maxProfiles: number;
  priceId: string | null;
  currentPeriodEnd: Date | null;
  customerId: string | null;
  email: string | null;
}

/**
 * Normaliza el objeto suscripción de Stripe. `current_period_end` vive en la
 * raíz en versiones antiguas de la API y en items.data[0] en las nuevas
 * (2025-03+): leemos ambas.
 */
export function normalizeSubscription(sub: Record<string, unknown>): StripeSubData {
  const items = (sub.items as { data?: Record<string, unknown>[] } | undefined)?.data ?? [];
  const item = items[0] ?? {};
  const price = (item.price ?? {}) as {
    id?: string;
    unit_amount?: number | null;
    recurring?: { interval?: string } | null;
  };
  const periodEnd =
    (sub.current_period_end as number | undefined) ??
    (item.current_period_end as number | undefined);
  const { plan, maxProfiles } = mapPlan(price.unit_amount, price.recurring?.interval);
  const customer = sub.customer;
  const customerObj =
    customer && typeof customer === "object" ? (customer as Record<string, unknown>) : null;
  return {
    id: String(sub.id ?? ""),
    status: mapStripeStatus(sub.status as string | undefined),
    plan,
    maxProfiles,
    priceId: price.id ?? null,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    customerId: customerObj ? String(customerObj.id ?? "") : typeof customer === "string" ? customer : null,
    email: customerObj ? ((customerObj.email as string | null) ?? null) : null,
  };
}

export async function getCheckoutSession(sessionId: string) {
  return stripeGet(`/checkout/sessions/${encodeURIComponent(sessionId)}`);
}

export async function getSubscription(subscriptionId: string) {
  return stripeGet(`/subscriptions/${encodeURIComponent(subscriptionId)}`);
}

/** Cancela una suscripción en Stripe (baja inmediata de la renovación). */
export async function cancelSubscription(subscriptionId: string) {
  return stripeRequest("DELETE", `/subscriptions/${encodeURIComponent(subscriptionId)}`);
}
