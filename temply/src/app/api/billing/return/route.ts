import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { activateSubscription } from "@/lib/db";
import { retrieveCheckoutSession, stripeEnabled } from "@/lib/billing";
import { qualifyReferral } from "@/lib/referrals";
import { isLocale } from "@/lib/theme/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const localeParam = url.searchParams.get("locale");
  const locale = isLocale(localeParam ?? undefined) ? localeParam : "sv";
  const sessionId = url.searchParams.get("session_id");

  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL(`/${locale}/login`, url.origin));

  if (!stripeEnabled() || !sessionId) {
    return NextResponse.redirect(new URL(`/${locale}/pricing?error=1`, url.origin));
  }

  const session = await retrieveCheckoutSession(sessionId);
  if (!session || session.userId !== user.id) {
    return NextResponse.redirect(new URL(`/${locale}/pricing?error=1`, url.origin));
  }

  if (session.status === "complete" || session.payment_status === "paid") {
    activateSubscription(user.id);
    // Själva betalningsraden bokförs av webhooken på fakturan (invoice.paid), så att
    // belopp och valuta kommer från Stripe och varje betalning bokförs exakt en gång.
    qualifyReferral(user.id);
    return NextResponse.redirect(new URL(`/${locale}/pricing?success=1`, url.origin));
  }

  return NextResponse.redirect(new URL(`/${locale}/pricing?error=1`, url.origin));
}
