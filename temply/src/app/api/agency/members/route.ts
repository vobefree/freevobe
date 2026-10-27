import { NextResponse } from "next/server";
import { jsonError, requireAgency } from "@/lib/agency-server";
import { agencyPlan } from "@/lib/agency-plans";
import { addMember, listMembers, removeMember, updateMemberRole, type AgencyRole } from "@/lib/db";

export const runtime = "nodejs";

const ROLES: AgencyRole[] = ["admin", "designer", "reviewer"];

export async function POST(request: Request) {
  const session = await requireAgency();
  if (!session) return jsonError("unauthorized", 401);
  const body = (await request.json().catch(() => null)) as { email?: string; name?: string; role?: string } | null;
  const email = (body?.email ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return jsonError("invalid_email", 400);

  const plan = agencyPlan(session.agency.plan);
  const members = listMembers(session.agency.id);
  if (members.length + 1 >= plan.members) return jsonError("member_limit", 402);
  if (members.some((member) => member.email === email)) return jsonError("already_member", 409);

  const role = ROLES.includes(body?.role as AgencyRole) ? (body?.role as AgencyRole) : "designer";
  const member = addMember(session.agency.id, { email, name: (body?.name ?? "").slice(0, 60), role });
  return NextResponse.json({ member }, { status: 201 });
}

export async function PATCH(request: Request) {
  const session = await requireAgency();
  if (!session) return jsonError("unauthorized", 401);
  const body = (await request.json().catch(() => null)) as { id?: string; role?: string } | null;
  if (!body?.id || !ROLES.includes(body.role as AgencyRole)) return jsonError("bad_request", 400);
  updateMemberRole(session.agency.id, body.id, body.role as AgencyRole);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await requireAgency();
  if (!session) return jsonError("unauthorized", 401);
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return jsonError("bad_request", 400);
  removeMember(session.agency.id, id);
  return NextResponse.json({ ok: true });
}
