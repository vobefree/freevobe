import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canBuild, getProject } from "@/lib/db";
import { parseConfig } from "@/lib/projects";
import { baseTheme } from "@/lib/theme/presets";
import { localArtwork } from "@/lib/ai/image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Bildgenerering utan kostnad.
 *
 * Googles bildmodeller (Nano Banana) ingår inte i gratisnivån längre, så
 * ThemeFold använder i stället den lokala generatorn: deterministisk grafik i
 * varumärkets färger. Inga nycklar, inga anrop och ingen kvot att ta hänsyn
 * till – funktionen fungerar även helt offline.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ configured: true, free: true });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canBuild(user)) return NextResponse.json({ error: "locked" }, { status: 402 });

  const body = (await request.json().catch(() => null)) as { projectId?: string; prompt?: string } | null;
  const prompt = (body?.prompt ?? "").trim().slice(0, 600);
  if (prompt.length < 3) return NextResponse.json({ error: "prompt_required" }, { status: 400 });

  let config = baseTheme();
  if (body?.projectId) {
    const project = getProject(user.id, body.projectId);
    if (project) config = parseConfig(project.config);
  }

  return NextResponse.json({
    url: localArtwork(prompt, config.palette, "lifestyle"),
    source: "local",
    configured: true,
    free: true,
    model: null,
  });
}
