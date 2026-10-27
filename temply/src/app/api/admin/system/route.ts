import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/admin/guard";
import { systemChecks } from "@/lib/admin/system-check";
import { referralConfig, saveSettings, siteConfig } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FlagPayload = {
  SITE_SIGNUPS?: string;
  SITE_TRIAL_DAYS?: string;
  SITE_SUPPORT_EMAIL?: string;
  SITE_ANNOUNCEMENT?: string;
  REFERRAL_ENABLED?: string;
  REFERRAL_TRIAL_BONUS_DAYS?: string;
  REFERRAL_REWARD_DAYS?: string;
  REFERRAL_MAX_REWARDS?: string;
};

function clamp(value: string | undefined, min: number, max: number, fallback: number): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return String(fallback);
  return String(Math.max(min, Math.min(max, Math.round(parsed))));
}

export async function GET() {
  const guard = await requirePermission("system.view");
  if ("response" in guard) return guard.response;
  return Response.json({
    checks: systemChecks(),
    site: siteConfig(),
    referral: referralConfig(),
    canManage: guard.actor.identity.permissions.includes("system.manage"),
  });
}

export async function POST(request: Request) {
  const guard = await requirePermission("system.manage");
  if ("response" in guard) return guard.response;
  const { user } = guard.actor;

  const body = (await request.json().catch(() => ({}))) as { flags?: FlagPayload };
  const flags = body.flags ?? {};
  const values: Record<string, string> = {};
  if (typeof flags.SITE_SIGNUPS === "string") values.SITE_SIGNUPS = flags.SITE_SIGNUPS === "0" ? "0" : "1";
  if (typeof flags.SITE_TRIAL_DAYS === "string") values.SITE_TRIAL_DAYS = String(Math.max(1, Math.min(90, Number(flags.SITE_TRIAL_DAYS) || 3)));
  if (typeof flags.SITE_SUPPORT_EMAIL === "string") values.SITE_SUPPORT_EMAIL = flags.SITE_SUPPORT_EMAIL.trim();
  if (typeof flags.SITE_ANNOUNCEMENT === "string") values.SITE_ANNOUNCEMENT = flags.SITE_ANNOUNCEMENT.trim().slice(0, 240);
  if (typeof flags.REFERRAL_ENABLED === "string") values.REFERRAL_ENABLED = flags.REFERRAL_ENABLED === "0" ? "0" : "1";
  if (typeof flags.REFERRAL_TRIAL_BONUS_DAYS === "string") values.REFERRAL_TRIAL_BONUS_DAYS = clamp(flags.REFERRAL_TRIAL_BONUS_DAYS, 0, 60, 7);
  if (typeof flags.REFERRAL_REWARD_DAYS === "string") values.REFERRAL_REWARD_DAYS = clamp(flags.REFERRAL_REWARD_DAYS, 0, 180, 30);
  if (typeof flags.REFERRAL_MAX_REWARDS === "string") values.REFERRAL_MAX_REWARDS = clamp(flags.REFERRAL_MAX_REWARDS, 1, 50, 3);
  if (Object.keys(values).length === 0) return Response.json({ error: "nothing_to_save" }, { status: 400 });

  saveSettings(values, user.email);
  logAudit({ id: user.id, email: user.email }, "system.flags", Object.keys(values).join(","), JSON.stringify(values));
  return Response.json({ ok: true, site: siteConfig(), referral: referralConfig() });
}
