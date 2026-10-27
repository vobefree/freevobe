import { NextResponse } from "next/server";
import {
  addComment,
  getAgencyById,
  getProject,
  getReviewByToken,
  listComments,
  setReviewStatus,
} from "@/lib/db";
import { agencyPlan } from "@/lib/agency-plans";
import { parseConfig } from "@/lib/projects";

export const runtime = "nodejs";

function payload(token: string) {
  const review = getReviewByToken(token);
  if (!review) return null;
  const agency = getAgencyById(review.agency_id);
  if (!agency) return null;
  const project = getProject(agency.owner_id, review.project_id);
  if (!project) return null;
  const plan = agencyPlan(agency.plan);
  return {
    review: { status: review.status, clientName: review.client_name, updatedAt: review.updated_at },
    project: { id: project.id, name: project.name, config: parseConfig(project.config) },
    agency: {
      name: agency.name,
      displayName: plan.whiteLabel && agency.white_label ? agency.brand_name || agency.name : "ThemeFold",
      brandColor: agency.brand_color,
      whiteLabel: Boolean(plan.whiteLabel && agency.white_label),
    },
    comments: listComments(review.id).map((comment) => ({
      id: comment.id,
      author: comment.author,
      body: comment.body,
      createdAt: comment.created_at,
    })),
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = payload(token);
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const review = getReviewByToken(token);
  if (!review) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = (await request.json().catch(() => null)) as { action?: string; author?: string; body?: string } | null;
  if (!body?.action) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  if (body.action === "comment") {
    const text = (body.body ?? "").trim();
    if (text.length < 2) return NextResponse.json({ error: "comment_required" }, { status: 400 });
    addComment(review.id, (body.author ?? "").trim().slice(0, 60) || "Kund", text);
  } else if (body.action === "approve") {
    setReviewStatus(review.id, "approved");
  } else if (body.action === "changes") {
    setReviewStatus(review.id, "changes");
  } else {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  return NextResponse.json(payload(token));
}
