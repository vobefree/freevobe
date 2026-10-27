import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createVersion, deleteProject, getProject, updateProject } from "@/lib/db";
import { isValidConfig, projectSummary } from "@/lib/projects";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const project = getProject(user.id, id);
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ project: projectSummary(project) });
}

export async function PATCH(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as { name?: string; config?: unknown; versionLabel?: string } | null;
  if (!body) return NextResponse.json({ error: "invalid" }, { status: 400 });
  if (body.config !== undefined && !isValidConfig(body.config)) {
    return NextResponse.json({ error: "invalid_config" }, { status: 400 });
  }

  const config = body.config as ReturnType<typeof projectSummary>["config"] | undefined;
  const project = updateProject(user.id, id, {
    name: (body.name ?? config?.name)?.slice(0, 80),
    config: config ? JSON.stringify(config) : undefined,
  });
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (body.versionLabel && config) {
    createVersion(user.id, id, body.versionLabel.slice(0, 90), JSON.stringify(config));
  }
  return NextResponse.json({ project: projectSummary(project) });
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  deleteProject(user.id, id);
  return NextResponse.json({ ok: true });
}
