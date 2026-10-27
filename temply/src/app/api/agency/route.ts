import { NextResponse } from "next/server";
import { requireAgency, jsonError } from "@/lib/agency-server";
import { AGENCY_PLAN_ORDER, agencyPlan } from "@/lib/agency-plans";
import { updateAgency } from "@/lib/db";
import { workspaceFor } from "@/lib/agency";

export const runtime = "nodejs";

export async function GET() {
  const session = await requireAgency();
  if (!session) return jsonError("unauthorized", 401);
  return NextResponse.json(workspaceFor(session.agency));
}

export async function PATCH(request: Request) {
  const session = await requireAgency();
  if (!session) return jsonError("unauthorized", 401);
  const body = (await request.json().catch(() => null)) as
    | { name?: string; plan?: string; brandName?: string; brandColor?: string; whiteLabel?: boolean }
    | null;
  if (!body) return jsonError("bad_request", 400);

  const plan = body.plan && AGENCY_PLAN_ORDER.includes(body.plan as never) ? (body.plan as "starter" | "pro" | "unlimited") : session.agency.plan;
  const target = agencyPlan(plan);
  const whiteLabel = body.whiteLabel === undefined ? Boolean(session.agency.white_label) : Boolean(body.whiteLabel);
  if (whiteLabel && !target.whiteLabel) return jsonError("white_label_locked", 403);

  const agency = updateAgency(session.agency.id, {
    name: (body.name ?? session.agency.name).slice(0, 80) || session.agency.name,
    plan,
    brand_name: (body.brandName ?? session.agency.brand_name).slice(0, 80),
    brand_color: /^#[0-9a-fA-F]{6}$/.test(body.brandColor ?? "") ? (body.brandColor as string) : session.agency.brand_color,
    white_label: whiteLabel && target.whiteLabel ? 1 : 0,
  });
  return NextResponse.json(workspaceFor(agency));
}
