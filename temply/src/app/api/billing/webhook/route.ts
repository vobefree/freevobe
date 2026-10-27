import { NextResponse } from "next/server";
import { activateSubscription, findUserById, hasPaidPaymentForSession, recordPayment, updateUser } from "@/lib/db";
import { qualifyReferral } from "@/lib/referrals";
import { verifyStripeSignature, PLAN_CURRENCY, PLAN_USD_CENTS } from "@/lib/billing";

export const runtime = "nodejs";

type StripeEvent = {
  type: string;
  data: {
    object: {
      id?: string;
      amount_total?: number;
      /** Fakturor har amount_paid i stället för amount_total. */
      amount_paid?: number;
      currency?: string;
      metadata?: { userId?: string };
      /** Prenumerationsmetadata följer med fakturan hit, inte alltid till metadata. */
      subscription_details?: { metadata?: { userId?: string } };
      client_reference_id?: string;
      status?: string;
    };
  };
};

export async function POST(request: Request) {
  const payload = await request.text();
  if (!verifyStripeSignature(payload, request.headers.get("stripe-signature"))) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const object = event.data?.object;
  const userId = object?.metadata?.userId ?? object?.subscription_details?.metadata?.userId ?? object?.client_reference_id;
  if (userId && findUserById(userId)) {
    if (event.type === "checkout.session.completed" || event.type === "invoice.paid") {
      activateSubscription(userId);
      // Fakturan är den bokföringsmässiga händelsen: ett belopp, en valuta, en rad.
      // Checkout-händelsen aktiverar bara prenumerationen, så att samma betalning
      // inte bokförs både där och i returflödet.
      if (event.type === "invoice.paid" && object.id && !hasPaidPaymentForSession(object.id)) {
        recordPayment({
          userId,
          provider: "stripe",
          amountCents: object.amount_total ?? object.amount_paid ?? PLAN_USD_CENTS,
          currency: object.currency ?? PLAN_CURRENCY,
          status: "paid",
          stripeSessionId: object.id,
        });
      }
      // Först nu, när kunden faktiskt betalar, får den som bjöd in sina gratisdagar.
      qualifyReferral(userId);
    }
    if (event.type === "customer.subscription.deleted") {
      updateUser(userId, { plan_status: "canceled" });
    }
  }

  return NextResponse.json({ received: true });
}
