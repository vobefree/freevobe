import { getCurrentUser } from "@/lib/auth";
import { canBuild, getProject, saveHealthReport, updateProject } from "@/lib/db";
import { parseConfig } from "@/lib/projects";
import { applyHealthFixes } from "@/lib/health/fixes";
import { runThemeHealth } from "@/lib/health/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!canBuild(user)) return Response.json({ error: "locked" }, { status: 402 });

  const body = (await request.json().catch(() => ({}))) as { projectId?: string; issueIds?: string[] };
  if (!body.projectId || !Array.isArray(body.issueIds) || body.issueIds.length === 0) {
    return Response.json({ error: "missing_input" }, { status: 400 });
  }
  const project = getProject(user.id, body.projectId);
  if (!project) return Response.json({ error: "not_found" }, { status: 404 });

  const config = parseConfig(project.config);
  const { config: next, applied } = applyHealthFixes(config, body.issueIds.slice(0, 40));
  if (applied.length === 0) {
    return Response.json({ error: "nothing_to_fix", applied }, { status: 422 });
  }

  updateProject(user.id, project.id, { config: JSON.stringify(next) });
  const report = runThemeHealth({ config: next, shop: user.shopify_shop });
  saveHealthReport(user.id, project.id, report.score, JSON.stringify(report));

  return Response.json({ ok: true, config: next, applied, report });
}
