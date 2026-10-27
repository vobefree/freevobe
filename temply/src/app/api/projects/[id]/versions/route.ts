import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createVersion, getProject, getVersion, listVersions, updateProject } from "@/lib/db";
import { projectSummary } from "@/lib/projects";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!getProject(user.id, id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const versions = listVersions(user.id, id).map((row) => ({ id: row.id, label: row.label, createdAt: row.created_at }));
  return NextResponse.json({ versions });
}

export async function POST(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { action?: "save" | "restore"; label?: string; versionId?: string } | null;
  const project = getProject(user.id, id);
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (body?.action === "restore") {
    if (!body.versionId) return NextResponse.json({ error: "version_required" }, { status: 400 });
    const version = getVersion(user.id, id, body.versionId);
    if (!version) return NextResponse.json({ error: "version_not_found" }, { status: 404 });
    // Nuvarande läge sparas först så att återställningen i sig går att ångra.
    createVersion(user.id, id, `Före återställning ${new Date().toLocaleString("sv-SE")}`, project.config);
    const updated = updateProject(user.id, id, { config: version.config });
    return NextResponse.json({ project: updated ? projectSummary(updated) : null, restored: version.id });
  }

  const label = (body?.label ?? "").trim() || new Date().toLocaleString("sv-SE");
  const version = createVersion(user.id, id, label, project.config);
  return NextResponse.json({ version: version ? { id: version.id, label: version.label, createdAt: version.created_at } : null });
}
