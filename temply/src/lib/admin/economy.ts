import { db } from "@/lib/db";

/**
 * Ekonomiöversikt. Allt räknas ur payments och users – samma sanning som
 * faktureringen använder, ingen separat bokföring.
 */

export type EconomyReport = {
  windowDays: number;
  generatedAt: string;
  totals: {
    allTimeCents: number;
    windowCents: number;
    previousWindowCents: number;
    paidCount: number;
    refundedCount: number;
    arpuCents: number | null;
    mrrCents: number;
  };
  subscribers: { active: number; trialing: number; canceled: number; disabled: number; payingShare: number | null };
  conversion: { newUsers: number; payingUsers: number; trialToPaid: number | null };
  series: { date: string; cents: number; count: number }[];
  byCurrency: { currency: string; cents: number; count: number }[];
  byProvider: { provider: string; cents: number; count: number }[];
  latest: { id: string; email: string; provider: string; amountCents: number; currency: string; status: string; createdAt: string }[];
  plans: { plan: string; users: number }[];
  agencies: { plan: string; workspaces: number }[];
  projects: { published: number; total: number };
};

const DAY = 86_400_000;

export function economyReport(windowDays = 30): EconomyReport {
  const days = Math.max(7, Math.min(365, windowDays));
  const since = new Date(Date.now() - days * DAY).toISOString();
  const prevSince = new Date(Date.now() - 2 * days * DAY).toISOString();

  const sum = (sql: string, ...params: unknown[]): number => {
    const row = db().prepare(sql).get(...(params as never[])) as unknown as { cents: number } | undefined;
    return Number(row?.cents ?? 0);
  };
  const count = (sql: string, ...params: unknown[]): number => {
    const row = db().prepare(sql).get(...(params as never[])) as unknown as { count: number } | undefined;
    return Number(row?.count ?? 0);
  };

  const allTimeCents = sum("SELECT COALESCE(SUM(amount_cents), 0) AS cents FROM payments WHERE status = 'paid'");
  const windowCents = sum("SELECT COALESCE(SUM(amount_cents), 0) AS cents FROM payments WHERE status = 'paid' AND created_at >= ?", since);
  const previousWindowCents = sum(
    "SELECT COALESCE(SUM(amount_cents), 0) AS cents FROM payments WHERE status = 'paid' AND created_at >= ? AND created_at < ?",
    prevSince,
    since,
  );
  const paidCount = count("SELECT COUNT(*) AS count FROM payments WHERE status = 'paid' AND created_at >= ?", since);
  const refundedCount = count("SELECT COUNT(*) AS count FROM payments WHERE status != 'paid' AND created_at >= ?", since);

  const active = count("SELECT COUNT(*) AS count FROM users WHERE plan_status = 'active'");
  const trialing = count("SELECT COUNT(*) AS count FROM users WHERE plan_status = 'trialing'");
  const canceled = count("SELECT COUNT(*) AS count FROM users WHERE plan_status = 'canceled'");
  const disabled = count("SELECT COUNT(*) AS count FROM users WHERE disabled = 1");
  const totalUsers = active + trialing + canceled;
  const newUsers = count("SELECT COUNT(*) AS count FROM users WHERE created_at >= ?", since);
  const payingUsers = count(
    "SELECT COUNT(DISTINCT user_id) AS count FROM payments WHERE status = 'paid' AND created_at >= ?",
    since,
  );

  const seriesRows = db()
    .prepare(
      `SELECT substr(created_at, 1, 10) AS date, SUM(amount_cents) AS cents, COUNT(*) AS count
       FROM payments WHERE status = 'paid' AND created_at >= ? GROUP BY date`,
    )
    .all(new Date(Date.now() - (days - 1) * DAY).toISOString()) as unknown as { date: string; cents: number; count: number }[];
  const series = Array.from({ length: days }, (_, index) => {
    const date = new Date(Date.now() - (days - 1 - index) * DAY).toISOString().slice(0, 10);
    const row = seriesRows.find((item) => item.date === date);
    return { date, cents: Number(row?.cents ?? 0), count: Number(row?.count ?? 0) };
  });

  const byCurrency = db()
    .prepare("SELECT currency, SUM(amount_cents) AS cents, COUNT(*) AS count FROM payments WHERE status = 'paid' GROUP BY currency")
    .all() as unknown as { currency: string; cents: number; count: number }[];
  const byProvider = db()
    .prepare("SELECT provider, SUM(amount_cents) AS cents, COUNT(*) AS count FROM payments WHERE status = 'paid' GROUP BY provider")
    .all() as unknown as { provider: string; cents: number; count: number }[];

  const latest = db()
    .prepare(
      `SELECT p.id, u.email AS email, p.provider, p.amount_cents AS amountCents, p.currency, p.status, p.created_at AS createdAt
       FROM payments p JOIN users u ON u.id = p.user_id ORDER BY p.created_at DESC LIMIT 25`,
    )
    .all() as unknown as EconomyReport["latest"];

  const plans = db()
    .prepare("SELECT plan_status AS plan, COUNT(*) AS users FROM users GROUP BY plan_status")
    .all() as unknown as { plan: string; users: number }[];
  const agencies = db()
    .prepare("SELECT plan, COUNT(*) AS workspaces FROM agencies GROUP BY plan")
    .all() as unknown as { plan: string; workspaces: number }[];
  const published = count("SELECT COUNT(*) AS count FROM projects WHERE last_published_at IS NOT NULL");
  const total = count("SELECT COUNT(*) AS count FROM projects");

  return {
    windowDays: days,
    generatedAt: new Date().toISOString(),
    totals: {
      allTimeCents,
      windowCents,
      previousWindowCents,
      paidCount,
      refundedCount,
      arpuCents: active > 0 ? Math.round(windowCents / active) : null,
      mrrCents: windowCents,
    },
    subscribers: {
      active,
      trialing,
      canceled,
      disabled,
      payingShare: totalUsers > 0 ? Math.round((active / totalUsers) * 1000) / 10 : null,
    },
    conversion: {
      newUsers,
      payingUsers,
      trialToPaid: newUsers > 0 ? Math.round((payingUsers / newUsers) * 1000) / 10 : null,
    },
    series,
    byCurrency: byCurrency.map((row) => ({ currency: row.currency.toUpperCase(), cents: Number(row.cents), count: Number(row.count) })),
    byProvider: byProvider.map((row) => ({ provider: row.provider, cents: Number(row.cents), count: Number(row.count) })),
    latest: latest.map((row) => ({ ...row, amountCents: Number(row.amountCents) })),
    plans: plans.map((row) => ({ plan: String(row.plan), users: Number(row.users) })),
    agencies: agencies.map((row) => ({ plan: String(row.plan), workspaces: Number(row.workspaces) })),
    projects: { published, total },
  };
}
