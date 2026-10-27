import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createProject, listProjects } from "@/lib/db";
import { projectSummary } from "@/lib/projects";
import { applyMood, baseTheme } from "@/lib/theme/presets";
import { parsePrompt } from "@/lib/theme/prompt";
import { emptyCanvas } from "@/lib/advanced/canvas";
import { syncThemeToAdvanced } from "@/lib/advanced/sync";
import { isLocale, type MoodId } from "@/lib/theme/types";

export const runtime = "nodejs";

const MOODS: MoodId[] = ["minimal", "warm", "playful", "luxe", "nature", "neon"];

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ projects: listProjects(user.id).map(projectSummary) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { name?: string; prompt?: string; mood?: string; locale?: string; builderMode?: string } | null;
  const locale = isLocale(body?.locale) ? body.locale : isLocale(user.locale) ? user.locale : "sv";
  const prompt = (body?.prompt ?? "").trim();
  let config = baseTheme();

  if (body?.mood && MOODS.includes(body.mood as MoodId)) {
    config = applyMood(config, body.mood as MoodId);
  }
  if (prompt.length > 0) {
    config = parsePrompt(prompt, config, locale).config;
  }

  const requested = (body?.name ?? "").trim();
  const name = requested || config.shop.name;
  config.name = name;
  // Namnet användaren skriver i dialogrutan är butikens namn – annars skulle
  // förhandsvisningen visa en annan butik än den man just döpte.
  if (requested) config.shop = { ...config.shop, name };
  config.header.logoText = config.shop.name;

  // Advanced är opt-in. Tema-styrd är alltid standard. Väljs Advanced byggs
  // startsidan från temats riktiga sektioner, så båda lägena delar innehåll.
  const canvas = emptyCanvas();
  config.builder = { mode: body?.builderMode === "advanced" ? "advanced" : "theme", canvas, canvases: { home: canvas } };
  if (config.builder.mode === "advanced") config = syncThemeToAdvanced(config);

  const project = createProject(user.id, name, JSON.stringify(config));
  return NextResponse.json({ project: projectSummary(project) }, { status: 201 });
}
