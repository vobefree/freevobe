import { NextResponse } from "next/server";
import { jsonError, requireAgency } from "@/lib/agency-server";
import { agencyPlan } from "@/lib/agency-plans";
import { createReview, getAgencyProject, setAgencyProjectStatus } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await requireAgency();
  if (!session) return jsonError("unauthorized", 401);
  if (!agencyPlan(session.agency.plan).clientReview) return jsonError("review_locked", 403);
  const body = (await request.json().catch(() => null)) as { projectId?: string; clientName?: string } | null;
  if (!body?.projectId || !getAgencyProject(session.agency.id, body.projectId)) return jsonError("not_found", 404);
  const review = createReview(session.agency.id, body.projectId, (body.clientName ?? "").slice(0, 80));
  return NextResponse.json({ token: review.token, status: review.status }, { status: 201 });
}

export async function PATCH(request: Request) {
  const session = await requireAgency();
  if (!session) return jsonError("unauthorized", 401);
  const body = (await request.json().catch(() => null)) as { projectId?: string; status?: string } | null;
  if (!body?.projectId || !getAgencyProject(session.agency.id, body.projectId)) return jsonError("not_found", 404);
  if (body.status !== "delivered") return jsonError("bad_request", 400);
  setAgencyProjectStatus(session.agency.id, body.projectId, "delivered");
  return NextResponse.json({ ok: true });
}
