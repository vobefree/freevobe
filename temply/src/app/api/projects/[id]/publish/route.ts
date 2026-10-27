import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canBuild, getProject, updateProject, watermarkRequired } from "@/lib/db";
import { buildThemeFiles } from "@/lib/export/theme";
import { parseConfig } from "@/lib/projects";
import { listThemes, publishFilesToShopify, shopifyConfigured } from "@/lib/shopify";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!shopifyConfigured()) return NextResponse.json({ error: "shopify_not_configured" }, { status: 501 });
  if (!user.shopify_shop || !user.shopify_token) return NextResponse.json({ error: "not_connected" }, { status: 409 });
  await params;
  try {
    const themes = await listThemes(user.shopify_shop, user.shopify_token);
    return NextResponse.json({ shop: user.shopify_shop, themes });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "shopify_error" }, { status: 502 });
  }
}

export async function POST(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canBuild(user)) return NextResponse.json({ error: "locked" }, { status: 402 });
  if (!shopifyConfigured()) return NextResponse.json({ error: "shopify_not_configured" }, { status: 501 });
  if (!user.shopify_shop || !user.shopify_token) return NextResponse.json({ error: "not_connected" }, { status: 409 });

  const { id } = await params;
  const project = getProject(user.id, id);
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = (await request.json().catch(() => null)) as { targetThemeId?: string; publish?: boolean } | null;
  const config = parseConfig(project.config);
  const files = buildThemeFiles(config, { credit: watermarkRequired(user) });

  try {
    const result = await publishFilesToShopify({
      shop: user.shopify_shop,
      token: user.shopify_token,
      files,
      targetThemeId: body?.targetThemeId,
      publish: body?.publish !== false,
    });
    updateProject(user.id, id, { shopifyThemeId: result.themeId, published: true });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "publish_failed" }, { status: 502 });
  }
}
