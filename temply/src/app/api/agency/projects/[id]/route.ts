import { NextResponse } from "next/server";
import { jsonError, requireAgency } from "@/lib/agency-server";
import { deleteProject, getAgencyProject, removeAgencyProject } from "@/lib/db";

export const runtime = "nodejs";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAgency();
  if (!session) return jsonError("unauthorized", 401);
  const { id } = await params;
  if (!getAgencyProject(session.agency.id, id)) return jsonError("not_found", 404);
  removeAgencyProject(session.agency.id, id);
  deleteProject(session.agency.owner_id, id);
  return NextResponse.json({ ok: true });
}
