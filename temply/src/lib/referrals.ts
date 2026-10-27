import { addPlanDays, db, findUserById, findUserByReferralCode, generateReferralCode, setUserReferral, type UserRow } from "./db";
import { referralConfig, type ReferralConfig } from "./settings";

/**
 * Värvningsprogram för privatpersoner.
 *
 * Reglerna är valda för att alla tre parter ska vinna utan att kundbasen blir gratis:
 *  - den inbjudne får fler provdagar direkt,
 *  - den som bjuder in får gratisdagar först när den inbjudne faktiskt betalar,
 *  - ägaren får betalande kunder och ett tak som stoppar oändliga gratismånader.
 */

export type ReferralStatus = "pending" | "rewarded" | "capped" | "void";

export type ReferralRow = {
  id: string;
  code: string;
  inviter_id: string;
  invitee_id: string;
  status: ReferralStatus;
  bonus_days: number;
  reward_days: number;
  created_at: string;
  rewarded_at: string | null;
};

export type ReferralSummary = {
  enabled: boolean;
  code: string;
  invited: number;
  paying: number;
  rewarded: number;
  earnedDays: number;
  remaining: number;
  maxRewards: number;
  rewardDays: number;
  trialBonusDays: number;
};

/** Varje konto får en kod första gången dashboarden öppnas. */
export function ensureReferralCode(user: UserRow): string {
  if (user.referral_code) return user.referral_code;
  let code = generateReferralCode();
  for (let attempt = 0; attempt < 5 && findUserByReferralCode(code); attempt += 1) {
    code = generateReferralCode();
  }
  setUserReferral(user.id, { referralCode: code });
  return code;
}

function countFor(inviterId: string, status: ReferralStatus): number {
  const row = db()
    .prepare("SELECT COUNT(*) AS count FROM referrals WHERE inviter_id = ? AND status = ?")
    .get(inviterId, status) as unknown as { count: number };
  return Number(row?.count ?? 0);
}

export function referralSummary(user: UserRow): ReferralSummary {
  const config = referralConfig();
  const code = ensureReferralCode(user);
  const total = db().prepare("SELECT COUNT(*) AS count FROM referrals WHERE inviter_id = ?").get(user.id) as unknown as { count: number };
  const rewarded = countFor(user.id, "rewarded");
  const earned = db()
    .prepare("SELECT COALESCE(SUM(reward_days), 0) AS days FROM referrals WHERE inviter_id = ? AND status = 'rewarded'")
    .get(user.id) as unknown as { days: number };
  return {
    enabled: config.enabled,
    code,
    invited: Number(total?.count ?? 0),
    paying: rewarded,
    rewarded,
    earnedDays: Number(earned?.days ?? 0),
    remaining: Math.max(0, config.maxRewards - rewarded),
    maxRewards: config.maxRewards,
    rewardDays: config.rewardDays,
    trialBonusDays: config.trialBonusDays,
  };
}

export type ApplyReferralResult =
  | { ok: true; bonusDays: number; inviterName: string | null }
  | { ok: false; reason: "disabled" | "unknown_code" | "self" | "already_referred" };

/**
 * Kopplar en nyregistrerad person till den som bjöd in och förlänger provperioden.
 * Anropas direkt efter att kontot skapats.
 */
export function applyReferral(input: { invitee: UserRow; code: string }): ApplyReferralResult {
  const config = referralConfig();
  if (!config.enabled) return { ok: false, reason: "disabled" };

  const code = input.code.trim().toUpperCase();
  if (!code) return { ok: false, reason: "unknown_code" };

  const inviter = findUserByReferralCode(code);
  if (!inviter) return { ok: false, reason: "unknown_code" };
  if (inviter.id === input.invitee.id || inviter.email === input.invitee.email) return { ok: false, reason: "self" };

  const existing = db().prepare("SELECT id FROM referrals WHERE invitee_id = ?").get(input.invitee.id);
  if (existing) return { ok: false, reason: "already_referred" };

  const bonus = config.trialBonusDays;
  db()
    .prepare(
      "INSERT INTO referrals (id, code, inviter_id, invitee_id, status, bonus_days, reward_days, created_at) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)",
    )
    .run(crypto.randomUUID(), code, inviter.id, input.invitee.id, bonus, config.rewardDays, new Date().toISOString());
  setUserReferral(input.invitee.id, { referredBy: inviter.id });
  if (bonus > 0) addPlanDays(input.invitee.id, bonus);

  return { ok: true, bonusDays: bonus, inviterName: inviter.name || null };
}

export type QualifyResult = { rewarded: boolean; days: number; inviterId: string | null; reason?: "capped" | "none" };

/**
 * Körs när en inbjuden person blir betalande. Då får den som bjöd in sina
 * gratisdagar – om taket inte redan är nått. Taket räknas alltid, oavsett hur
 * många som bjuds in, så gratisperioder aldrig kan staplas obegränsat.
 */
export function qualifyReferral(inviteeId: string): QualifyResult {
  const row = db().prepare("SELECT * FROM referrals WHERE invitee_id = ?").get(inviteeId) as unknown as ReferralRow | undefined;
  if (!row || row.status !== "pending") return { rewarded: false, days: 0, inviterId: null, reason: "none" };

  const config = referralConfig();
  const inviter = findUserById(row.inviter_id);
  if (!inviter) {
    db().prepare("UPDATE referrals SET status = 'void' WHERE id = ?").run(row.id);
    return { rewarded: false, days: 0, inviterId: null, reason: "none" };
  }

  const already = countFor(inviter.id, "rewarded");
  if (already >= config.maxRewards || config.rewardDays <= 0) {
    db().prepare("UPDATE referrals SET status = 'capped', reward_days = 0 WHERE id = ?").run(row.id);
    return { rewarded: false, days: 0, inviterId: inviter.id, reason: "capped" };
  }

  const days = row.reward_days > 0 ? row.reward_days : config.rewardDays;
  addPlanDays(inviter.id, days);
  db()
    .prepare("UPDATE referrals SET status = 'rewarded', reward_days = ?, rewarded_at = ? WHERE id = ?")
    .run(days, new Date().toISOString(), row.id);
  return { rewarded: true, days, inviterId: inviter.id };
}

export type ReferralAdminRow = {
  id: string;
  status: ReferralStatus;
  inviter: string;
  inviterEmail: string;
  invitee: string;
  inviteeEmail: string;
  rewardDays: number;
  createdAt: string;
  rewardedAt: string | null;
};

export function listReferrals(limit = 50): ReferralAdminRow[] {
  const rows = db()
    .prepare(
      `SELECT r.id, r.status, r.reward_days AS rewardDays, r.created_at AS createdAt, r.rewarded_at AS rewardedAt,
        i.name AS inviter, i.email AS inviterEmail, n.name AS invitee, n.email AS inviteeEmail
       FROM referrals r
       JOIN users i ON i.id = r.inviter_id
       JOIN users n ON n.id = r.invitee_id
       ORDER BY r.created_at DESC LIMIT ?`,
    )
    .all(limit) as unknown as ReferralAdminRow[];
  return rows.map((row) => ({
    ...row,
    inviter: String(row.inviter),
    inviterEmail: String(row.inviterEmail),
    invitee: String(row.invitee),
    inviteeEmail: String(row.inviteeEmail),
    rewardDays: Number(row.rewardDays),
  }));
}

export type ReferralAdminStats = {
  total: number;
  pending: number;
  rewarded: number;
  capped: number;
  bonusDaysGiven: number;
  rewardDaysGiven: number;
  topInviters: { email: string; invited: number; rewarded: number }[];
  config: ReferralConfig;
};

export function referralStats(): ReferralAdminStats {
  const count = (status?: ReferralStatus): number =>
    status
      ? Number(
          (db().prepare("SELECT COUNT(*) AS count FROM referrals WHERE status = ?").get(status) as unknown as { count: number })?.count ?? 0,
        )
      : Number((db().prepare("SELECT COUNT(*) AS count FROM referrals").get() as unknown as { count: number })?.count ?? 0);
  const sums = db()
    .prepare(
      `SELECT COALESCE(SUM(bonus_days), 0) AS bonus, COALESCE(SUM(CASE WHEN status = 'rewarded' THEN reward_days ELSE 0 END), 0) AS reward FROM referrals`,
    )
    .get() as unknown as { bonus: number; reward: number };
  const top = db()
    .prepare(
      `SELECT u.email AS email, COUNT(r.id) AS invited,
        COALESCE(SUM(CASE WHEN r.status = 'rewarded' THEN 1 ELSE 0 END), 0) AS rewarded
       FROM referrals r JOIN users u ON u.id = r.inviter_id
       GROUP BY u.id ORDER BY invited DESC LIMIT 5`,
    )
    .all() as unknown as { email: string; invited: number; rewarded: number }[];

  return {
    total: count(),
    pending: count("pending"),
    rewarded: count("rewarded"),
    capped: count("capped"),
    bonusDaysGiven: Number(sums?.bonus ?? 0),
    rewardDaysGiven: Number(sums?.reward ?? 0),
    topInviters: top.map((row) => ({ email: String(row.email), invited: Number(row.invited), rewarded: Number(row.rewarded) })),
    config: referralConfig(),
  };
}
