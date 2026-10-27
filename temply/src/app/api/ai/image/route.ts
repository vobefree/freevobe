import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canBuild, getProject } from "@/lib/db";
import { parseConfig } from "@/lib/projects";
import { baseTheme } from "@/lib/theme/presets";
import { generateImage, type ImageKind } from "@/lib/ai/image";

export const runtime = "nodejs";

const KINDS: ImageKind[] = ["hero", "banner", "lifestyle", "product"];

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canBuild(user)) return NextResponse.json({ error: "locked" }, { status: 402 });

  const body = (await request.json().catch(() => null)) as { projectId?: string; prompt?: string; kind?: string } | null;
  const prompt = (body?.prompt ?? "").trim();
  if (prompt.length < 3) return NextResponse.json({ error: "prompt_required" }, { status: 400 });
  const kind = KINDS.includes(body?.kind as ImageKind) ? (body?.kind as ImageKind) : "hero";

  let config = baseTheme();
  if (body?.projectId) {
    const project = getProject(user.id, body.projectId);
    if (project) config = parseConfig(project.config);
  }

  const image = await generateImage({
    prompt: prompt.slice(0, 600),
    palette: config.palette,
    kind,
    imagery: config.brand.dna?.imagery ?? null,
  });
  return NextResponse.json({ ...image, ai: image.source === "ai" });
}
