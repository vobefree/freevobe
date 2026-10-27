import {
  findUserById,
  getAgencyById,
  getProject,
  getReviewByToken,
  setAgencyProjectStatus,
  watermarkRequired,
} from "@/lib/db";
import { buildThemeZip } from "@/lib/export/theme";
import { parseConfig, slugify } from "@/lib/projects";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const review = getReviewByToken(token);
  if (!review) return Response.json({ error: "not_found" }, { status: 404 });
  if (review.status !== "approved") return Response.json({ error: "not_approved" }, { status: 403 });

  const agency = getAgencyById(review.agency_id);
  if (!agency) return Response.json({ error: "not_found" }, { status: 404 });
  const project = getProject(agency.owner_id, review.project_id);
  if (!project) return Response.json({ error: "not_found" }, { status: 404 });

  // Granskningens nedladdning sker på uppdragsgivarens konto, så vattenmärket
  // följer dennes provperiod – annars vore granskningslänken en genväg runt det.
  const owner = findUserById(agency.owner_id);
  const config = parseConfig(project.config);
  const zip = buildThemeZip(config, { credit: owner ? watermarkRequired(owner) : false });
  setAgencyProjectStatus(agency.id, project.id, "delivered");

  const filename = `${slugify(config.name || project.name)}.zip`;
  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
