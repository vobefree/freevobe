import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canBuild, getProject } from "@/lib/db";
import { parseConfig } from "@/lib/projects";
import { baseTheme } from "@/lib/theme/presets";
import { isLocale, type Locale } from "@/lib/theme/types";
import { aiCopy, localCopy, type CopyTarget } from "@/lib/ai/copy";

export const runtime = "nodejs";

const TARGETS: CopyTarget[] = ["hero", "products", "seo", "cta", "campaign"];

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canBuild(user)) return NextResponse.json({ error: "locked" }, { status: 402 });

  const body = (await request.json().catch(() => null)) as
    | { projectId?: string; target?: string; keyword?: string; locale?: string }
    | null;
  const target = TARGETS.includes(body?.target as CopyTarget) ? (body?.target as CopyTarget) : "hero";
  const locale: Locale = isLocale(body?.locale) ? body.locale : isLocale(user.locale) ? user.locale : "sv";

  let config = baseTheme();
  if (body?.projectId) {
    const project = getProject(user.id, body.projectId);
    if (project) config = parseConfig(project.config);
  }

  const hero = config.sections.find((section) => section.type === "hero");
  const input = {
    locale,
    target,
    shopName: config.shop.name,
    tagline: config.shop.tagline,
    styleId: config.brand.styleId,
    tone: config.brand.tone,
    keyword: (body?.keyword ?? "").trim().slice(0, 80),
    products: config.shop.products.map((product) => product.name).filter(Boolean),
    heroTitle: hero && hero.type === "hero" ? hero.title : "",
    dna: config.brand.dna ?? null,
  };

  const generated = await aiCopy(input);
  const items = generated ?? localCopy(input);
  return NextResponse.json({ items, source: generated ? "ai" : "local", target, locale });
}
