import { getCurrentUser } from "@/lib/auth";
import { canBuild, getProject, watermarkRequired } from "@/lib/db";
import { buildThemeZip } from "@/lib/export/theme";
import { parseConfig, slugify } from "@/lib/projects";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!canBuild(user)) return Response.json({ error: "locked" }, { status: 402 });

  const { id } = await params;
  const project = getProject(user.id, id);
  if (!project) return Response.json({ error: "not_found" }, { status: 404 });

  const config = parseConfig(project.config);
  const zip = buildThemeZip(config, { credit: watermarkRequired(user) });
  const filename = `${slugify(config.name || project.name)}.zip`;

  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(zip.length),
      "Cache-Control": "no-store",
    },
  });
}
