export type AgencyPlanId = "starter" | "pro" | "unlimited";

export type AgencyPlan = {
  id: AgencyPlanId;
  name: string;
  priceUsd: number;
  projects: number;
  members: number;
  aiCopy: number;
  aiImages: number;
  whiteLabel: boolean;
  clientReview: boolean;
  versions: boolean;
  api: boolean;
  support: "standard" | "priority" | "dedicated";
  fairUse: boolean;
};

export const AGENCY_PLANS: Record<AgencyPlanId, AgencyPlan> = {
  starter: {
    id: "starter",
    name: "Partner Starter",
    priceUsd: 99,
    projects: 3,
    members: 2,
    aiCopy: 100,
    aiImages: 50,
    whiteLabel: false,
    clientReview: false,
    versions: false,
    api: false,
    support: "standard",
    fairUse: false,
  },
  pro: {
    id: "pro",
    name: "Partner Pro",
    priceUsd: 249,
    projects: 10,
    members: 5,
    aiCopy: 500,
    aiImages: 250,
    whiteLabel: true,
    clientReview: true,
    versions: true,
    api: false,
    support: "priority",
    fairUse: false,
  },
  unlimited: {
    id: "unlimited",
    name: "Partner Unlimited",
    priceUsd: 499,
    projects: Number.POSITIVE_INFINITY,
    members: Number.POSITIVE_INFINITY,
    aiCopy: 5000,
    aiImages: 2500,
    whiteLabel: true,
    clientReview: true,
    versions: true,
    api: true,
    support: "dedicated",
    fairUse: true,
  },
};

export const AGENCY_PLAN_ORDER: AgencyPlanId[] = ["starter", "pro", "unlimited"];

export function agencyPlan(id: string): AgencyPlan {
  return AGENCY_PLANS[(id as AgencyPlanId) in AGENCY_PLANS ? (id as AgencyPlanId) : "starter"];
}
