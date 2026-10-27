import { NextResponse } from "next/server";
import { jsonError, requireAgency } from "@/lib/agency-server";
import { agencyPlan } from "@/lib/agency-plans";
import { applyLibraryPayload, attachProject, libraryPayload } from "@/lib/agency";
import {
  addLibraryItem,
  createProject,
  createVersion,
  deleteLibraryItem,
  getAgencyProject,
  getLibraryItem,
  getProject,
  listAgencyProjects,
  updateProject,
  upsertClient,
  type AgencyLibraryKind,
} from "@/lib/db";
import { parseConfig } from "@/lib/projects";

export const runtime = "nodejs";

const KINDS: AgencyLibraryKind[] = ["theme", "section", "brand", "tokens", "conversion"];

export async function POST(request: Request) {
  const session = await requireAgency();
  if (!session) return jsonError("unauthorized", 401);
  const body = (await request.json().catch(() => null)) as
    | { action?: string; projectId?: string; kind?: string; name?: string; itemId?: string; clientName?: string; targetName?: string }
    | null;
  if (!body) return jsonError("bad_request", 400);

  if (body.action === "save") {
    if (!body.projectId || !getAgencyProject(session.agency.id, body.projectId)) return jsonError("not_found", 404);
    const kind = KINDS.includes(body.kind as AgencyLibraryKind) ? (body.kind as AgencyLibraryKind) : "theme";
    const project = getProject(session.agency.owner_id, body.projectId);
    if (!project) return jsonError("not_found", 404);
    const payload = libraryPayload(parseConfig(project.config), kind);
    const item = addLibraryItem(session.agency.id, kind, (body.name ?? project.name).slice(0, 80), payload);
    return NextResponse.json({ itemId: item.id }, { status: 201 });
  }

  if (body.action === "apply") {
    if (!body.itemId) return jsonError("bad_request", 400);
    const item = getLibraryItem(session.agency.id, body.itemId);
    if (!item) return jsonError("not_found", 404);
    const plan = agencyPlan(session.agency.plan);

    if (item.kind === "theme") {
      if (listAgencyProjects(session.agency.id).length >= plan.projects) return jsonError("project_limit", 402);
      const config = applyLibraryPayload(parseConfig(item.payload), "theme", item.payload);
      const name = (body.clientName ?? body.targetName ?? item.name).slice(0, 80);
      config.name = name;
      const project = createProject(session.agency.owner_id, name, JSON.stringify(config));
      const client = body.clientName ? upsertClient(session.agency.id, { name: body.clientName }) : null;
      attachProject(session.agency.id, project.id, client?.id ?? null);
      return NextResponse.json({ projectId: project.id }, { status: 201 });
    }

    if (!body.projectId || !getAgencyProject(session.agency.id, body.projectId)) return jsonError("project_required", 400);
    const project = getProject(session.agency.owner_id, body.projectId);
    if (!project) return jsonError("not_found", 404);
    const next = applyLibraryPayload(parseConfig(project.config), item.kind, item.payload);
    updateProject(session.agency.owner_id, project.id, { config: JSON.stringify(next) });
    createVersion(session.user.id, project.id, `Byrå: ${item.name}`, JSON.stringify(next));
    return NextResponse.json({ projectId: project.id });
  }

  if (body.action === "delete" && body.itemId) {
    deleteLibraryItem(session.agency.id, body.itemId);
    return NextResponse.json({ ok: true });
  }

  return jsonError("bad_request", 400);
}

export async function DELETE(request: Request) {
  const session = await requireAgency();
  if (!session) return jsonError("unauthorized", 401);
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return jsonError("bad_request", 400);
  deleteLibraryItem(session.agency.id, id);
  return NextResponse.json({ ok: true });
}
