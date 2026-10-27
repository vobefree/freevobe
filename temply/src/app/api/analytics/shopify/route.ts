import { getCurrentUser } from "@/lib/auth";
import { canBuild, getProject, latestHealthReport, latestStatsSnapshot, saveStatsSnapshot } from "@/lib/db";
import { parseConfig } from "@/lib/projects";
import { loadStoreStats, type StoreStats } from "@/lib/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_AGE_MS = 5 * 60_000;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!canBuild(user)) return Response.json({ error: "locked" }, { status: 402 });

  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  if (!projectId) return Response.json({ error: "missing_project" }, { status: 400 });
  const project = getProject(user.id, projectId);
  if (!project) return Response.json({ error: "not_found" }, { status: 404 });

  const refresh = url.searchParams.get("refresh") === "1";
  const cached = latestStatsSnapshot(project.id);
  if (!refresh && cached) {
    const age = Date.now() - new Date(cached.created_at).getTime();
    if (age < MAX_AGE_MS) {
      try {
        return Response.json({ stats: JSON.parse(cached.payload) as StoreStats, cached: true, savedAt: cached.created_at });
      } catch {
        /* fall igenom till ny hämtning */
      }
    }
  }

  const healthRow = latestHealthReport(project.id);
  const healthScore = healthRow ? Number(healthRow.score) : undefined;
  const stats = await loadStoreStats({ user, project, config: parseConfig(project.config), healthScore });
  saveStatsSnapshot(user.id, project.id, stats.shop, stats.source, JSON.stringify(stats));
  return Response.json({ stats, cached: false });
}
