import { findUserByReferralCode } from "@/lib/db";
import { referralConfig } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Kontrollerar en värvningskod medan användaren skriver (publik, läcker inget känsligt). */
export async function GET(request: Request) {
  const config = referralConfig();
  const code = (new URL(request.url).searchParams.get("code") ?? "").trim().toUpperCase();
  if (!config.enabled || code.length < 4) return Response.json({ valid: false, bonusDays: 0 });
  const inviter = findUserByReferralCode(code);
  return Response.json({ valid: Boolean(inviter), bonusDays: inviter ? config.trialBonusDays : 0 });
}
