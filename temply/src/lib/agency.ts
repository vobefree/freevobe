import {
  addAgencyProject,
  aiUsage,
  createAgency,
  getAgencyByOwner,
  getProject,
  getReviewForProject,
  listAgencyProjects,
  listClients,
  listComments,
  listLibrary,
  listMembers,
  listReviews,
  type AgencyRole,
  type AgencyRow,
  type UserRow,
} from "@/lib/db";
import { agencyPlan, type AgencyPlan } from "@/lib/agency-plans";
import { parseConfig } from "@/lib/projects";
import type { ThemeConfig } from "@/lib/theme/types";

export { AGENCY_PLANS, AGENCY_PLAN_ORDER, agencyPlan } from "@/lib/agency-plans";
export type { AgencyPlan } from "@/lib/agency-plans";

export function ensureAgency(user: UserRow): AgencyRow {
  const existing = getAgencyByOwner(user.id);
  if (existing) return existing;
  const first = user.name.trim().split(/\s+/)[0] || "Partner";
  return createAgency(user.id, `${first} Studio`);
}

export type RolePermission =
  | "project.create"
  | "project.edit"
  | "project.delete"
  | "library.manage"
  | "review.create"
  | "team.manage"
  | "billing"
  | "whiteLabel";

const ROLE_PERMISSIONS: Record<AgencyRole, RolePermission[]> = {
  owner: ["project.create", "project.edit", "project.delete", "library.manage", "review.create", "team.manage", "billing", "whiteLabel"],
  admin: ["project.create", "project.edit", "project.delete", "library.manage", "review.create", "team.manage"],
  designer: ["project.create", "project.edit", "library.manage", "review.create"],
  reviewer: [],
};

export function can(role: AgencyRole, permission: RolePermission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export type AgencyProjectView = {
  projectId: string;
  name: string;
  status: "draft" | "review" | "approved" | "delivered";
  clientId: string | null;
  clientName: string;
  shopDomain: string;
  updatedAt: string;
  config: ThemeConfig;
  versionCount: number;
  review: { token: string; status: "pending" | "approved" | "changes"; clientName: string; comments: number } | null;
};

export type AgencyWorkspaceData = {
  agency: AgencyRow;
  plan: AgencyPlan;
  usage: { copy: number; images: number };
  projects: AgencyProjectView[];
  clients: { id: string; name: string; shopDomain: string; contactEmail: string }[];
  members: ReturnType<typeof listMembers>;
  library: { id: string; kind: string; name: string; createdAt: string }[];
  reviews: { id: string; projectId: string; token: string; clientName: string; status: string; comments: number; updatedAt: string }[];
};

export function workspaceFor(agency: AgencyRow): AgencyWorkspaceData {
  const clients = listClients(agency.id);
  const clientById = new Map(clients.map((client) => [client.id, client]));
  const reviews = listReviews(agency.id);
  const reviewByProject = new Map<string, (typeof reviews)[number]>();
  for (const review of reviews) if (!reviewByProject.has(review.project_id)) reviewByProject.set(review.project_id, review);

  const projects: AgencyProjectView[] = [];
  for (const link of listAgencyProjects(agency.id)) {
    const project = getProject(agency.owner_id, link.project_id);
    if (!project) continue;
    const client = link.client_id ? clientById.get(link.client_id) : undefined;
    const review = reviewByProject.get(link.project_id);
    projects.push({
      projectId: project.id,
      name: project.name,
      status: link.status,
      clientId: link.client_id,
      clientName: client?.name ?? "Intern",
      shopDomain: client?.shop_domain ?? "",
      updatedAt: project.updated_at,
      config: parseConfig(project.config),
      versionCount: 0,
      review: review
        ? {
            token: review.token,
            status: review.status,
            clientName: review.client_name,
            comments: listComments(review.id).length,
          }
        : null,
    });
  }

  const usage = aiUsage(agency);
  return {
    // Raderna kommer från node:sqlite och har null-prototyp – kopiera dem till
    // vanliga objekt så att de kan skickas från en server- till en klientkomponent.
    agency: { ...agency },
    plan: agencyPlan(agency.plan),
    usage,
    projects,
    clients: clients.map((client) => ({
      id: client.id,
      name: client.name,
      shopDomain: client.shop_domain,
      contactEmail: client.contact_email,
    })),
    members: listMembers(agency.id).map((member) => ({ ...member })),
    library: listLibrary(agency.id).map((item) => ({ id: item.id, kind: item.kind, name: item.name, createdAt: item.created_at })),
    reviews: reviews.map((review) => ({
      id: review.id,
      projectId: review.project_id,
      token: review.token,
      clientName: review.client_name,
      status: review.status,
      comments: listComments(review.id).length,
      updatedAt: review.updated_at,
    })),
  };
}

/** Plockar ut rätt del av ett tema när byrån sparar det i sitt bibliotek. */
export function libraryPayload(config: ThemeConfig, kind: "theme" | "section" | "brand" | "tokens" | "conversion"): string {
  switch (kind) {
    case "section": {
      const hero = config.sections.find((section) => section.type === "hero") ?? config.sections[0];
      return JSON.stringify(hero);
    }
    case "brand":
      return JSON.stringify({ brand: config.brand, typography: config.typography, palette: config.palette });
    case "tokens":
      return JSON.stringify(config.tokens);
    case "conversion":
      return JSON.stringify(config.conversion);
    default:
      return JSON.stringify(config);
  }
}

export function applyLibraryPayload(config: ThemeConfig, kind: string, payload: string): ThemeConfig {
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (kind === "brand" && parsed && typeof parsed === "object") {
      const brand = parsed as Pick<ThemeConfig, "brand" | "typography" | "palette">;
      return { ...config, brand: brand.brand ?? config.brand, typography: brand.typography ?? config.typography, palette: brand.palette ?? config.palette };
    }
    if (kind === "tokens" && parsed && typeof parsed === "object") return { ...config, tokens: { ...config.tokens, ...(parsed as ThemeConfig["tokens"]) } };
    if (kind === "conversion" && parsed && typeof parsed === "object") return { ...config, conversion: { ...config.conversion, ...(parsed as ThemeConfig["conversion"]) } };
    if (kind === "section" && parsed && typeof parsed === "object") {
      const section = parsed as ThemeConfig["sections"][number];
      return { ...config, sections: [...config.sections, { ...section, id: `${section.type}-${crypto.randomUUID().slice(0, 8)}` }] };
    }
    if (kind === "theme" && parsed && typeof parsed === "object") return parsed as ThemeConfig;
  } catch {
    /* ogiltig payload – behåll temat */
  }
  return config;
}

/** Skapar en riktig projektrad och kopplar den till byrån och kunden. */
export function attachProject(agencyId: string, projectId: string, clientId: string | null): void {
  addAgencyProject(agencyId, projectId, clientId);
}

export function existingReview(agencyId: string, projectId: string) {
  return getReviewForProject(agencyId, projectId);
}
