import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { activateSubscription, recordPayment } from "@/lib/db";
import { createCheckoutSession, planFor, stripeEnabled } from "@/lib/billing";
import { qualifyReferral } from "@/lib/referrals";
import { isLocale } from "@/lib/theme/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { locale?: string } | null;
  const locale = isLocale(body?.locale) ? body.locale : isLocale(user.locale) ? user.locale : "sv";

  if (!stripeEnabled()) {
    // Dev-läget ska gå igenom samma kedja som ett riktigt köp: aktivera planen,
    // registrera en betalning i rätt valuta och kvalificera eventuell värvning.
    const plan = planFor(locale);
    activateSubscription(user.id);
    recordPayment({
      userId: user.id,
      provider: "dev",
      amountCents: plan.amountCents,
      currency: plan.currency,
      status: "paid",
    });
    qualifyReferral(user.id);
    return NextResponse.json({ url: `/${locale}/pricing?success=1&dev=1`, dev: true });
  }

  try {
    const origin = (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, "");
    const plan = planFor(locale);
    const session = await createCheckoutSession({ userId: user.id, email: user.email, locale, origin });
    recordPayment({
      userId: user.id,
      provider: "stripe",
      amountCents: plan.amountCents,
      currency: plan.currency,
      status: "pending",
      stripeSessionId: session.id,
    });
    return NextResponse.json({ url: session.url, dev: false });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "checkout_failed" }, { status: 502 });
  }
}
