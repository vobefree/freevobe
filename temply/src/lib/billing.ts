import { createHmac, timingSafeEqual } from "node:crypto";
import { localPlan } from "@/lib/i18n";
import type { Locale } from "@/lib/theme/types";
import { envValue } from "./settings";

export const PLAN_USD_CENTS = 200;
export const PLAN_CURRENCY = "usd";

/** Priset är alltid 2 USD, men debiteras i kundens lokala valuta. */
export function planFor(locale: Locale): { currency: string; amountCents: number } {
  return localPlan(locale);
}

export function stripeEnabled(): boolean {
  return Boolean(envValue("STRIPE_SECRET_KEY"));
}

async function stripeRequest(path: string, init?: RequestInit): Promise<Response> {
  const key = envValue("STRIPE_SECRET_KEY");
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return fetch(`https://api.stripe.com/v1/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
}

export type CheckoutResult = { id: string; url: string };

export async function createCheckoutSession(input: {
  userId: string;
  email: string;
  locale: string;
  origin: string;
}): Promise<CheckoutResult> {
  const plan = localPlan(input.locale as Locale);
  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("success_url", `${input.origin}/api/billing/return?session_id={CHECKOUT_SESSION_ID}&locale=${input.locale}`);
  params.set("cancel_url", `${input.origin}/${input.locale}/pricing?canceled=1`);
  params.set("customer_email", input.email);
  params.set("locale", input.locale === "nb" ? "nb" : input.locale);
  params.set("client_reference_id", input.userId);
  params.set("metadata[userId]", input.userId);
  params.set("subscription_data[metadata][userId]", input.userId);
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", plan.currency);
  params.set("line_items[0][price_data][unit_amount]", String(plan.amountCents));
  params.set("line_items[0][price_data][recurring][interval]", "month");
  params.set("line_items[0][price_data][product_data][name]", "ThemeFold Unlimited");
  params.set("line_items[0][price_data][product_data][description]", "Unlimited Shopify themes, all features, all languages.");

  const res = await stripeRequest("checkout/sessions", { method: "POST", body: params.toString() });
  const json = (await res.json()) as { id?: string; url?: string; error?: { message?: string } };
  if (!res.ok || !json.id || !json.url) {
    throw new Error(json.error?.message ?? "Could not create Stripe checkout session");
  }
  return { id: json.id, url: json.url };
}

export async function retrieveCheckoutSession(id: string): Promise<{
  id: string;
  status: string | null;
  payment_status: string | null;
  userId: string | null;
  amountCents: number | null;
  currency: string | null;
} | null> {
  const res = await stripeRequest(`checkout/sessions/${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  const json = (await res.json()) as {
    id: string;
    status?: string;
    payment_status?: string;
    amount_total?: number;
    currency?: string;
    client_reference_id?: string;
    metadata?: { userId?: string };
  };
  return {
    id: json.id,
    status: json.status ?? null,
    payment_status: json.payment_status ?? null,
    userId: json.metadata?.userId ?? json.client_reference_id ?? null,
    amountCents: typeof json.amount_total === "number" ? json.amount_total : null,
    currency: json.currency ?? null,
  };
}

export function verifyStripeSignature(payload: string, header: string | null): boolean {
  const secret = envValue("STRIPE_WEBHOOK_SECRET");
  if (!secret || !header) return false;
  const parts = header.split(",").reduce<Record<string, string>>((acc, part) => {
    const [k, v] = part.split("=");
    if (k && v) acc[k.trim()] = v.trim();
    return acc;
  }, {});
  const timestamp = Number(parts.t);
  const signature = parts.v1;
  if (!timestamp || !signature) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${parts.t}.${payload}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
