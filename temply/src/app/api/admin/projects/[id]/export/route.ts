import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/admin/guard";
import { db, type ProjectRow } from "@/lib/db";
import { buildThemeZip } from "@/lib/export/theme";
import { parseConfig, slugify } from "@/lib/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission("projects.view");
  if ("response" in guard) return guard.response;
  const { id } = await params;

  const project = db().prepare("SELECT * FROM projects WHERE id = ?").get(id) as unknown as ProjectRow | undefined;
  if (!project) return Response.json({ error: "not_found" }, { status: 404 });

  const config = parseConfig(project.config);
  const zip = buildThemeZip(config);
  logAudit({ id: guard.actor.user.id, email: guard.actor.user.email }, "projects.export", project.name);

  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${slugify(config.name || project.name)}.zip"`,
      "Content-Length": String(zip.length),
      "Cache-Control": "no-store",
    },
  });
}
