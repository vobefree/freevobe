import { NextResponse } from "next/server";
import { hashPassword, startSession, validEmail } from "@/lib/auth";
import { createUser, findUserByEmail } from "@/lib/db";
import { applyReferral } from "@/lib/referrals";
import { siteConfig } from "@/lib/settings";
import { isLocale } from "@/lib/theme/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { name?: string; email?: string; password?: string; locale?: string; ref?: string }
    | null;
  const name = (body?.name ?? "").trim();
  const email = (body?.email ?? "").trim();
  const password = body?.password ?? "";
  const locale = isLocale(body?.locale) ? body.locale : "sv";
  const referralCode = (body?.ref ?? "").trim();

  if (!name || !email || !password) {
    return NextResponse.json({ error: "required" }, { status: 400 });
  }
  if (!validEmail(email)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "weak" }, { status: 400 });
  }
  const site = siteConfig();
  if (!site.signups) {
    return NextResponse.json({ error: "closed" }, { status: 403 });
  }
  if (findUserByEmail(email)) {
    return NextResponse.json({ error: "exists" }, { status: 409 });
  }

  const user = createUser({ email, name, passwordHash: hashPassword(password), locale, trialDays: site.trialDays });
  // Värvningskod: extra provdagar direkt, belöningen till den som bjöd in kommer först vid betalning.
  const referral = referralCode ? applyReferral({ invitee: user, code: referralCode }) : null;
  await startSession(user.id);
  return NextResponse.json({
    ok: true,
    referral: referral?.ok ? { bonusDays: referral.bonusDays } : null,
  });
}
