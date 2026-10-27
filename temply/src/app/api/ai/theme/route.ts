import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canBuild, getProject } from "@/lib/db";
import { parseConfig } from "@/lib/projects";
import { applyMood, baseTheme } from "@/lib/theme/presets";
import { parsePrompt } from "@/lib/theme/prompt";
import { applyDna, dnaPrompt } from "@/lib/brand/dna";
import { FONTS, isLocale, type FontKey, type MoodId, type ThemeConfig } from "@/lib/theme/types";
import { freeText } from "@/lib/ai/free-text";
import { parseGeminiJson } from "@/lib/ai/gemini";

export const runtime = "nodejs";

const MOODS: MoodId[] = ["minimal", "warm", "playful", "luxe", "nature", "neon"];
const HEX = /^#[0-9a-fA-F]{6}$/;

type AiDesign = {
  mood?: string;
  primary?: string;
  accent?: string;
  background?: string;
  radius?: number;
  buttonRadius?: number;
  headingFont?: string;
  bodyFont?: string;
  scale?: number;
  shopName?: string;
  tagline?: string;
  heroTitle?: string;
  heroSubtitle?: string;
};

async function aiDesign(prompt: string, brandDna: string): Promise<AiDesign | null> {
  try {
    const raw = await freeText({
      system: `You are a senior Shopify art director. Turn the user's shop description into a design direction. Respond with JSON only: mood (minimal|warm|playful|luxe|nature|neon), primary and accent as hex, radius 0-32, buttonRadius 0-999, headingFont and bodyFont from [inter,dm,manrope,space,sora,archivo,playfair,fraunces,instrument,libre], scale 1.1-1.5, shopName, tagline, heroTitle, heroSubtitle. Keep copy in the user's language.${brandDna ? " A brand DNA is provided – follow its palette, typography, imagery and tone; keep its language and do not invent claims it does not support." : ""}`,
      prompt: brandDna ? `${prompt}\n\nBRAND DNA\n${brandDna}` : prompt,
      json: true,
      temperature: 0.7,
      maxTokens: 1000,
      timeoutMs: 28_000,
    });
    return parseGeminiJson<AiDesign>(raw);
  } catch {
    return null;
  }
}

function applyDesign(config: ThemeConfig, design: AiDesign): ThemeConfig {
  let next = config;
  const mood = MOODS.includes(design.mood as MoodId) ? (design.mood as MoodId) : null;
  if (mood) next = applyMood(next, mood);
  if (design.primary && HEX.test(design.primary)) next = { ...next, palette: { ...next.palette, primary: design.primary } };
  if (design.accent && HEX.test(design.accent)) next = { ...next, palette: { ...next.palette, accent: design.accent } };
  if (design.background && HEX.test(design.background)) next = { ...next, palette: { ...next.palette, background: design.background } };
  if (typeof design.radius === "number") next = { ...next, shape: { ...next.shape, radius: Math.max(0, Math.min(40, design.radius)) } };
  if (typeof design.buttonRadius === "number") next = { ...next, shape: { ...next.shape, buttonRadius: Math.max(0, Math.min(999, design.buttonRadius)) } };
  if (typeof design.scale === "number") next = { ...next, typography: { ...next.typography, scale: Math.max(1, Math.min(1.6, design.scale)) } };
  if (design.headingFont && FONTS[design.headingFont as FontKey]) next = { ...next, typography: { ...next.typography, heading: design.headingFont as FontKey } };
  if (design.bodyFont && FONTS[design.bodyFont as FontKey]) next = { ...next, typography: { ...next.typography, body: design.bodyFont as FontKey } };
  const shopName = design.shopName?.trim();
  const tagline = design.tagline?.trim();
  const heroTitle = design.heroTitle?.trim();
  const heroSubtitle = design.heroSubtitle?.trim();
  if (shopName) {
    next = { ...next, shop: { ...next.shop, name: shopName }, header: { ...next.header, logoText: shopName } };
  }
  if (tagline) next = { ...next, shop: { ...next.shop, tagline } };
  if (heroTitle || heroSubtitle) {
    next = {
      ...next,
      sections: next.sections.map((section) =>
        section.type === "hero"
          ? { ...section, ...(heroTitle ? { title: heroTitle } : {}), ...(heroSubtitle ? { subtitle: heroSubtitle } : {}), ...(tagline ? { eyebrow: tagline } : {}) }
          : section,
      ),
    };
  }
  return next;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canBuild(user)) return NextResponse.json({ error: "locked" }, { status: 402 });

  const body = (await request.json().catch(() => null)) as { prompt?: string; projectId?: string } | null;
  const prompt = (body?.prompt ?? "").trim();
  if (prompt.length < 3) return NextResponse.json({ error: "prompt_required" }, { status: 400 });
  const locale = isLocale(user.locale) ? user.locale : "sv";

  let base = baseTheme();
  if (body?.projectId) {
    const project = getProject(user.id, body.projectId);
    if (project) base = parseConfig(project.config);
  }
  // Brand DNA:t är utgångspunkt: palett, typsnitt, copy, produkter och sektioner.
  if (base.brand.dna) base = applyDna(base, base.brand.dna);

  const design = await aiDesign(prompt, dnaPrompt(base.brand.dna));
  let config: ThemeConfig = parsePrompt(prompt, base, locale).config;
  if (design) config = applyDesign(config, design);
  config.name = config.shop.name;

  return NextResponse.json({ config, source: design ? "ai" : "local" });
}
