import { NextResponse } from "next/server";
import { jsonError, requireAgency } from "@/lib/agency-server";
import { agencyPlan } from "@/lib/agency-plans";
import { attachProject } from "@/lib/agency";
import {
  addAiUsage,
  aiUsage,
  createProject,
  getLibraryItem,
  getProject,
  listAgencyProjects,
  upsertClient,
} from "@/lib/db";
import { parseConfig } from "@/lib/projects";
import { applyMood, baseTheme } from "@/lib/theme/presets";
import { parsePrompt } from "@/lib/theme/prompt";
import { isLocale, type MoodId, type ThemeConfig } from "@/lib/theme/types";

export const runtime = "nodejs";

const MOODS: MoodId[] = ["minimal", "warm", "playful", "luxe", "nature", "neon"];

export async function POST(request: Request) {
  const session = await requireAgency();
  if (!session) return jsonError("unauthorized", 401);
  const body = (await request.json().catch(() => null)) as
    | {
        name?: string;
        clientName?: string;
        shopDomain?: string;
        contactEmail?: string;
        prompt?: string;
        mood?: string;
        libraryId?: string;
        baseProjectId?: string;
      }
    | null;
  if (!body) return jsonError("bad_request", 400);

  const plan = agencyPlan(session.agency.plan);
  const linked = listAgencyProjects(session.agency.id);
  if (linked.length >= plan.projects) return jsonError("project_limit", 402);

  const locale = isLocale(session.user.locale) ? session.user.locale : "sv";
  const prompt = (body.prompt ?? "").trim();
  const clientName = (body.clientName ?? "").trim();
  const name = (body.name ?? "").trim() || clientName || "Nytt kundtema";

  let config: ThemeConfig = baseTheme();
  if (body.libraryId) {
    const item = getLibraryItem(session.agency.id, body.libraryId);
    if (item && item.kind === "theme") {
      try {
        config = parseConfig(item.payload);
      } catch {
        config = baseTheme();
      }
    }
  } else if (body.baseProjectId) {
    const base = getProject(session.agency.owner_id, body.baseProjectId);
    if (base) config = parseConfig(base.config);
  }

  if (body.mood && MOODS.includes(body.mood as MoodId)) config = applyMood(config, body.mood as MoodId);
  if (prompt) {
    const usage = aiUsage(session.agency);
    if (usage.copy >= plan.aiCopy) return jsonError("ai_limit", 402);
    config = parsePrompt(prompt, config, locale).config;
  }

  config.name = name;
  if (clientName) config = { ...config, shop: { ...config.shop, name: clientName }, header: { ...config.header, logoText: clientName } };
  if (body.shopDomain) config = { ...config, seo: { ...config.seo, title: `${clientName || name} · ${config.shop.tagline}` } };

  const project = createProject(session.agency.owner_id, name, JSON.stringify(config));
  const client = clientName
    ? upsertClient(session.agency.id, { name: clientName, shopDomain: body.shopDomain ?? "", contactEmail: body.contactEmail ?? "" })
    : null;
  attachProject(session.agency.id, project.id, client?.id ?? null);
  if (prompt) addAiUsage(session.agency.id, 1, 0);

  return NextResponse.json({ projectId: project.id }, { status: 201 });
}
