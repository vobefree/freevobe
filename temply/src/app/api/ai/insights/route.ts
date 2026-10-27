import { getCurrentUser } from "@/lib/auth";
import { canBuild, getProject, latestHealthReport, latestInsight, latestStatsSnapshot, saveInsight } from "@/lib/db";
import { parseConfig } from "@/lib/projects";
import { runThemeHealth } from "@/lib/health/audit";
import type { HealthReport } from "@/lib/health/types";
import { generateInsights, type Insights } from "@/lib/ai/insights";
import { loadStoreStats, type StoreStats } from "@/lib/stats";
import { isLocale } from "@/lib/theme/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readHealth(raw: string | null): HealthReport | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as HealthReport;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId) return Response.json({ error: "missing_project" }, { status: 400 });
  if (!getProject(user.id, projectId)) return Response.json({ error: "not_found" }, { status: 404 });
  const row = latestInsight(projectId);
  if (!row) return Response.json({ insights: null });
  try {
    return Response.json({ insights: JSON.parse(row.body) as Insights, savedAt: row.created_at });
  } catch {
    return Response.json({ insights: null });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!canBuild(user)) return Response.json({ error: "locked" }, { status: 402 });

  const body = (await request.json().catch(() => ({}))) as { projectId?: string };
  if (!body.projectId) return Response.json({ error: "missing_project" }, { status: 400 });
  const project = getProject(user.id, body.projectId);
  if (!project) return Response.json({ error: "not_found" }, { status: 404 });

  const config = parseConfig(project.config);
  const healthRow = latestHealthReport(project.id);
  const health = readHealth(healthRow?.report ?? null) ?? runThemeHealth({ config, shop: user.shopify_shop });

  let stats: StoreStats | null = null;
  const snapshot = latestStatsSnapshot(project.id);
  if (snapshot) {
    try {
      stats = JSON.parse(snapshot.payload) as StoreStats;
    } catch {
      stats = null;
    }
  }
  if (!stats) stats = await loadStoreStats({ user, project, config, healthScore: health.score });

  const locale = isLocale(user.locale) ? user.locale : "sv";
  const insights = await generateInsights({ locale, projectName: config.shop.name || project.name, health, stats });
  saveInsight(user.id, project.id, "combined", insights.source, JSON.stringify(insights));

  return Response.json({
    insights,
    health: { score: health.score, grade: health.grade, critical: health.counts.critical },
    statsSource: stats.source,
  });
}
