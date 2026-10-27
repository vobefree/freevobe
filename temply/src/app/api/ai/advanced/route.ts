import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canBuild, getProject } from "@/lib/db";
import { parseConfig } from "@/lib/projects";
import { dnaPrompt } from "@/lib/brand/dna";
import { parseGeminiJson, GeminiError } from "@/lib/ai/gemini";
import { freeTextWithProvider, type FreeProvider } from "@/lib/ai/free-text";
import { applyAdvancedCopy, localAdvancedCopy, sectionFromCopy, type AdvancedCopy } from "@/lib/advanced/prompt";
import { designScope, readPromptIntent, type DesignPlan } from "@/lib/advanced/design";
import type { AdvancedNode, AdvancedSectionPreset, ThemeConfig } from "@/lib/theme/types";

export const runtime = "nodejs";

const PRESETS: AdvancedSectionPreset[] = ["hero", "campaign", "products", "features", "testimonial", "banner"];

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validate(raw: Record<string, unknown> | null, fallback: AdvancedCopy): AdvancedCopy {
  if (!raw) return fallback;
  const preset = PRESETS.includes(raw.preset as AdvancedSectionPreset) ? (raw.preset as AdvancedSectionPreset) : fallback.preset;
  return {
    eyebrow: clean(raw.eyebrow, 120) || fallback.eyebrow,
    title: clean(raw.title, 200) || fallback.title,
    text: clean(raw.text, 700) || fallback.text,
    ctaLabel: clean(raw.ctaLabel, 80) || fallback.ctaLabel,
    badge: clean(raw.badge, 40),
    preset,
  };
}

/** Markeringen kan ligga på vilken sida som helst – leta i alla ytor. */
function findNode(config: ThemeConfig, id: string | null): AdvancedNode | null {
  if (!id) return null;
  const canvases = [
    config.builder.canvas,
    ...Object.values(config.builder.canvases ?? {}),
    config.builder.chrome,
    config.builder.header,
    config.builder.footer,
  ];
  for (const canvas of canvases) {
    const node = canvas?.nodes.find((item) => item.id === id);
    if (node) return node;
  }
  return null;
}

const SYSTEM = `You are a senior Shopify conversion copywriter. Rewrite or create one campaign section for a store.
Return JSON only with these keys: eyebrow (max 8 words), title (max 14 words), text (max 35 words), ctaLabel (max 5 words), badge (max 3 words, may be empty), preset (one of hero, campaign, products, features, testimonial, banner).
Write in the same language as the user's prompt. Follow the Brand DNA when provided: palette, tone, audience and claims. Never invent discounts, prices, certifications or guarantees that the prompt or Brand DNA does not support. Keep it concrete and scannable.
Never repeat the instruction itself as a headline. If the prompt is a design instruction rather than content, answer with copy that fits the store instead of echoing the words.`;

async function aiCopy(input: {
  prompt: string;
  selected: AdvancedNode | null;
  config: ThemeConfig;
}): Promise<{ copy: AdvancedCopy; provider: FreeProvider } | null> {
  const context = input.selected
    ? `Current section:\n${JSON.stringify({
        type: input.selected.type,
        eyebrow: input.selected.eyebrow,
        title: input.selected.title,
        text: input.selected.text,
        ctaLabel: input.selected.ctaLabel,
      })}`
    : "No section is selected. Create a new section.";
  const brand = dnaPrompt(input.config.brand.dna) || `Brand: ${input.config.shop.name}. Tone: ${input.config.brand.tone}.`;
  const user = `${input.prompt}\n\n${context}\n\nBrand DNA:\n${brand}`;

  try {
    const { text, provider } = await freeTextWithProvider({
      system: SYSTEM,
      prompt: user,
      json: true,
      temperature: 0.65,
      maxTokens: 700,
      timeoutMs: 25_000,
    });
    return {
      copy: validate(parseGeminiJson<Record<string, unknown>>(text), localAdvancedCopy(input.prompt, input.config)),
      provider,
    };
  } catch (error) {
    if (error instanceof GeminiError) return null;
    return null;
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canBuild(user)) return NextResponse.json({ error: "locked" }, { status: 402 });

  const body = (await request.json().catch(() => null)) as { projectId?: string; prompt?: string; selectionId?: string | null } | null;
  const prompt = (body?.prompt ?? "").trim().slice(0, 600);
  if (prompt.length < 3) return NextResponse.json({ error: "prompt_required" }, { status: 400 });
  if (!body?.projectId) return NextResponse.json({ error: "project_required" }, { status: 400 });

  const project = getProject(user.id, body.projectId);
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const config = parseConfig(project.config);
  const selected = findNode(config, body.selectionId ?? null);

  const intent = readPromptIntent(prompt);

  // En stilinstruktion ("gör sidan mer premium") är inte copy. Den blir en
  // designplan som ändrar typografi, luft och form – aldrig en textnod.
  if (intent.kind === "design") {
    const plan: DesignPlan = {
      moods: intent.moods,
      // Mörkt läge är alltid en yta, aldrig ett enskilt element: en mörk text
      // på en ljus canvas vore oläslig.
      scope: intent.moods.includes("dark") ? "canvas" : designScope(prompt, Boolean(selected)),
    };
    return NextResponse.json({ kind: "design", plan, source: "local" });
  }

  // Utan igenkännbart innehåll eller stil gissar vi hellre inget: då slipper
  // användaren få sin egen mening utskriven som rubrik.
  if (intent.kind === "unclear") {
    return NextResponse.json({ error: "prompt_unclear" }, { status: 422 });
  }

  // Text- och knappnoder behåller sin typ; bara innehållet byts ut. Är något
  // annat markerat (form, bild, koppling) skapas i stället en ny sektion.
  const copyTarget = selected && ["text", "heading", "button", "section"].includes(selected.type) ? selected : null;
  const ai = await aiCopy({ prompt, selected: copyTarget, config });
  const copy = ai?.copy ?? localAdvancedCopy(prompt, config);
  const source = ai ? "ai" : "local";
  const node = copyTarget
    ? applyAdvancedCopy(copyTarget, copy, Math.max(1, ...config.builder.canvas.nodes.map((item) => item.z)), config.builder.canvas)
    : sectionFromCopy(config, copy);

  return NextResponse.json({ kind: "copy", node, copy, source, provider: ai?.provider ?? null });
}
