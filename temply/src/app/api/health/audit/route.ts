import { getCurrentUser } from "@/lib/auth";
import { canBuild, getProject, latestHealthReport, saveHealthReport } from "@/lib/db";
import { parseConfig } from "@/lib/projects";
import { runThemeHealth } from "@/lib/health/audit";
import { fetchPsi } from "@/lib/health/psi";
import { checkStoreLinks } from "@/lib/health/linkcheck";
import type { HealthReport } from "@/lib/health/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId) return Response.json({ error: "missing_project" }, { status: 400 });
  if (!getProject(user.id, projectId)) return Response.json({ error: "not_found" }, { status: 404 });

  const row = latestHealthReport(projectId);
  if (!row) return Response.json({ report: null });
  try {
    return Response.json({ report: JSON.parse(row.report) as HealthReport, savedAt: row.created_at });
  } catch {
    return Response.json({ report: null });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!canBuild(user)) return Response.json({ error: "locked" }, { status: 402 });

  const body = (await request.json().catch(() => ({}))) as { projectId?: string; psi?: boolean; crawl?: boolean };
  if (!body.projectId) return Response.json({ error: "missing_project" }, { status: 400 });
  const project = getProject(user.id, body.projectId);
  if (!project) return Response.json({ error: "not_found" }, { status: 404 });

  const config = parseConfig(project.config);
  const shop = user.shopify_shop;
  const publicUrl = shop ? `https://${shop}` : null;

  const [psi, links] = await Promise.all([
    body.psi && publicUrl ? fetchPsi(publicUrl) : Promise.resolve(null),
    body.crawl && shop ? checkStoreLinks(shop) : Promise.resolve(null),
  ]);

  const report = runThemeHealth({ config, psi, shop, links });
  saveHealthReport(user.id, project.id, report.score, JSON.stringify(report));
  return Response.json({ report });
}
