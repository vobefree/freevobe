import { db, type UserRow } from "./db";
import { geminiConfigured, geminiModel } from "./ai/gemini";
import { hasValue } from "./settings";
import { shopifyConfigured } from "./shopify";
import { identityFor, listStaff, ownerEmails } from "./staff";
import { economyReport } from "./admin/economy";
import { inboxCounts, latestInbox } from "./admin/inbox";
import { referralStats, type ReferralAdminStats } from "./referrals";

/**
 * Adminpanelens översikt. Åtkomst styrs av ADMIN_EMAILS (ägare) plus personal
 * med roll i staff-tabellen.
 */
export function adminEmails(): string[] {
  return ownerEmails();
}

export function isAdmin(user: UserRow | null): boolean {
  return Boolean(identityFor(user));
}

type CountRow = { count: number };

function count(sql: string, ...params: (string | number)[]): number {
  const row = db().prepare(sql).get(...params) as unknown as CountRow | undefined;
  return Number(row?.count ?? 0);
}

export type AdminOverview = {
  generatedAt: string;
  counts: {
    users: number;
    newUsers7d: number;
    trials: number;
    active: number;
    shopifyConnected: number;
    projects: number;
    publishedProjects: number;
    workspaces: number;
    healthReports: number;
    insights: number;
    aiCopy: number;
    aiImages: number;
  };
  revenue: { totalCents: number; last30Cents: number; currencies: { currency: string; cents: number }[] };
  series: { date: string; users: number; revenueCents: number; projects: number }[];
  health: {
    avg: number | null;
    distribution: { grade: string; count: number }[];
    latest: { project: string; email: string; score: number; createdAt: string }[];
  };
  stats: { snapshots: number; live: number; demo: number };
  recentUsers: { email: string; name: string; createdAt: string; locale: string; plan: string; shop: string | null }[];
  topProjects: { name: string; email: string; updatedAt: string; score: number | null; publishedAt: string | null }[];
  systems: {
    gemini: boolean;
    geminiModel: string;
    shopify: boolean;
    pageSpeedKey: boolean;
    stripe: boolean;
    appUrl: string | null;
    adminCount: number;
    staff: { total: number; active: number; invited: number; suspended: number };
  };
  inbox: { unread: number; total: number; latest: { id: string; email: string; subject: string; createdAt: string; handled: number }[] };
  referrals: ReferralAdminStats;
  economy: ReturnType<typeof economyReport>;
};

export function adminOverview(): AdminOverview {
  const staff = listStaff();
  const economy = economyReport(30);
  const users = count("SELECT COUNT(*) AS count FROM users");
  const newUsers7d = count("SELECT COUNT(*) AS count FROM users WHERE created_at >= ?", new Date(Date.now() - 7 * 86_400_000).toISOString());
  const trials = count("SELECT COUNT(*) AS count FROM users WHERE plan_status = 'trialing'");
  const active = count("SELECT COUNT(*) AS count FROM users WHERE plan_status = 'active'");
  const shopifyConnected = count("SELECT COUNT(*) AS count FROM users WHERE shopify_token IS NOT NULL AND shopify_shop IS NOT NULL");
  const projects = count("SELECT COUNT(*) AS count FROM projects");
  const publishedProjects = count("SELECT COUNT(*) AS count FROM projects WHERE last_published_at IS NOT NULL");
  const workspaces = count("SELECT COUNT(*) AS count FROM agencies");
  const healthReports = count("SELECT COUNT(*) AS count FROM theme_health");
  const insights = count("SELECT COUNT(*) AS count FROM ai_insights");

  const revenueRow = db()
    .prepare("SELECT COALESCE(SUM(amount_cents), 0) AS cents FROM payments WHERE status = 'paid'")
    .get() as unknown as { cents: number };
  const revenue30 = db()
    .prepare("SELECT COALESCE(SUM(amount_cents), 0) AS cents FROM payments WHERE status = 'paid' AND created_at >= ?")
    .get(new Date(Date.now() - 30 * 86_400_000).toISOString()) as unknown as { cents: number };
  const currencies = db()
    .prepare("SELECT currency, SUM(amount_cents) AS cents FROM payments WHERE status = 'paid' GROUP BY currency")
    .all() as unknown as { currency: string; cents: number }[];

  const aiRow = db()
    .prepare("SELECT COALESCE(SUM(ai_copy_used), 0) AS copy, COALESCE(SUM(ai_images_used), 0) AS images FROM agencies")
    .get() as unknown as { copy: number; images: number };

  const statsRows = db().prepare("SELECT source, COUNT(*) AS count FROM stats_snapshots GROUP BY source").all() as unknown as {
    source: string;
    count: number;
  }[];
  const statsSource = (source: string) => Number(statsRows.find((row) => row.source === source)?.count ?? 0);

  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(Date.now() - (13 - index) * 86_400_000);
    return date.toISOString().slice(0, 10);
  });
  const userSeries = db()
    .prepare("SELECT substr(created_at, 1, 10) AS date, COUNT(*) AS count FROM users GROUP BY date")
    .all() as unknown as { date: string; count: number }[];
  const projectSeries = db()
    .prepare("SELECT substr(created_at, 1, 10) AS date, COUNT(*) AS count FROM projects GROUP BY date")
    .all() as unknown as { date: string; count: number }[];
  const paymentSeries = db()
    .prepare(
      "SELECT substr(created_at, 1, 10) AS date, SUM(amount_cents) AS cents FROM payments WHERE status = 'paid' GROUP BY date",
    )
    .all() as unknown as { date: string; cents: number }[];
  const series = days.map((date) => ({
    date,
    users: Number(userSeries.find((row) => row.date === date)?.count ?? 0),
    projects: Number(projectSeries.find((row) => row.date === date)?.count ?? 0),
    revenueCents: Number(paymentSeries.find((row) => row.date === date)?.cents ?? 0),
  }));

  const reports = db()
    .prepare("SELECT score FROM theme_health")
    .all() as unknown as { score: number }[];
  const avg = reports.length ? Math.round(reports.reduce((sum, row) => sum + row.score, 0) / reports.length) : null;
  const gradeOf = (score: number) => (score >= 90 ? "A" : score >= 78 ? "B" : score >= 64 ? "C" : score >= 50 ? "D" : "E");
  const distribution = ["A", "B", "C", "D", "E"].map((grade) => ({
    grade,
    count: reports.filter((row) => gradeOf(row.score) === grade).length,
  }));

  const latest = db()
    .prepare(
      `SELECT p.name AS project, u.email AS email, h.score AS score, h.created_at AS createdAt
       FROM theme_health h JOIN projects p ON p.id = h.project_id JOIN users u ON u.id = h.user_id
       ORDER BY h.created_at DESC LIMIT 6`,
    )
    .all() as unknown as { project: string; email: string; score: number; createdAt: string }[];

  const recentUsers = db()
    .prepare("SELECT email, name, created_at AS createdAt, locale, plan_status AS plan, shopify_shop AS shop FROM users ORDER BY created_at DESC LIMIT 8")
    .all() as unknown as AdminOverview["recentUsers"];

  const topProjects = db()
    .prepare(
      `SELECT p.name AS name, u.email AS email, p.updated_at AS updatedAt, p.last_published_at AS publishedAt,
        (SELECT score FROM theme_health h WHERE h.project_id = p.id ORDER BY h.created_at DESC LIMIT 1) AS score
       FROM projects p JOIN users u ON u.id = p.user_id ORDER BY p.updated_at DESC LIMIT 8`,
    )
    .all() as unknown as AdminOverview["topProjects"];

  return {
    generatedAt: new Date().toISOString(),
    counts: {
      users,
      newUsers7d,
      trials,
      active,
      shopifyConnected,
      projects,
      publishedProjects,
      workspaces,
      healthReports,
      insights,
      aiCopy: Number(aiRow?.copy ?? 0),
      aiImages: Number(aiRow?.images ?? 0),
    },
    revenue: {
      totalCents: Number(revenueRow?.cents ?? 0),
      last30Cents: Number(revenue30?.cents ?? 0),
      currencies: currencies.map((row) => ({ currency: row.currency.toUpperCase(), cents: Number(row.cents) })),
    },
    series,
    health: {
      avg,
      distribution,
      latest: latest.map((report) => ({
        project: String(report.project),
        email: String(report.email),
        score: Number(report.score),
        createdAt: String(report.createdAt),
      })),
    },
    stats: { snapshots: statsSource("shopify") + statsSource("demo"), live: statsSource("shopify"), demo: statsSource("demo") },
    recentUsers: recentUsers.map((user) => ({
      email: String(user.email),
      name: String(user.name),
      createdAt: String(user.createdAt),
      locale: String(user.locale),
      plan: String(user.plan),
      shop: user.shop ? String(user.shop) : null,
    })),
    topProjects: topProjects.map((project) => ({
      name: String(project.name),
      email: String(project.email),
      updatedAt: String(project.updatedAt),
      publishedAt: project.publishedAt ? String(project.publishedAt) : null,
      score: project.score === null ? null : Number(project.score),
    })),
    systems: {
      gemini: geminiConfigured(),
      geminiModel: geminiModel(),
      shopify: shopifyConfigured(),
      pageSpeedKey: hasValue("PAGESPEED_API_KEY"),
      stripe: hasValue("STRIPE_SECRET_KEY"),
      appUrl: process.env.APP_URL ?? null,
      adminCount: adminEmails().length,
      staff: {
        total: staff.length,
        active: staff.filter((row) => row.status === "active").length,
        invited: staff.filter((row) => row.status === "invited").length,
        suspended: staff.filter((row) => row.status === "suspended").length,
      },
    },
    inbox: { ...inboxCounts(), latest: latestInbox(4) },
    referrals: referralStats(),
    economy,
  };
}
