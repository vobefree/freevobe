import { notFound } from "next/navigation";
import { getAgencyById, getProject, getReviewByToken, listComments } from "@/lib/db";
import { parseConfig } from "@/lib/projects";
import { isLocale } from "@/lib/i18n";
import { agencyPlan } from "@/lib/agency-plans";
import { ClientReview } from "@/components/agency/ClientReview";
import type { Metadata } from "next";

type Props = { params: Promise<{ locale: string; token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const review = getReviewByToken(token);
  return { title: review ? `Review · ${review.client_name || "Theme"}` : "Review" };
}

export const dynamic = "force-dynamic";

export default async function ReviewPage({ params }: Props) {
  const { locale, token } = await params;
  if (!isLocale(locale)) notFound();
  const review = getReviewByToken(token);
  if (!review) notFound();
  const agency = getAgencyById(review.agency_id);
  if (!agency) notFound();
  const project = getProject(agency.owner_id, review.project_id);
  if (!project) notFound();
  const plan = agencyPlan(agency.plan);
  const whiteLabel = Boolean(plan.whiteLabel && agency.white_label);

  return (
    <ClientReview
      locale={locale}
      token={token}
      projectName={project.name}
      clientName={review.client_name}
      displayName={whiteLabel ? agency.brand_name || agency.name : "ThemeFold"}
      brandColor={agency.brand_color}
      whiteLabel={whiteLabel}
      config={parseConfig(project.config)}
      initialStatus={review.status}
      initialComments={listComments(review.id).map((comment) => ({
        id: comment.id,
        author: comment.author,
        body: comment.body,
        createdAt: comment.created_at,
      }))}
    />
  );
}
