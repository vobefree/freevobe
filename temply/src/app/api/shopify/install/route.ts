import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { installUrl, newState, normalizeShop, shopifyConfigured } from "@/lib/shopify";
import { isLocale } from "@/lib/theme/types";

export const runtime = "nodejs";

export const SHOPIFY_STATE_COOKIE = "temply_shopify_state";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const user = await getCurrentUser();
  const locale = isLocale(user?.locale) ? user.locale : "sv";
  if (!user) return NextResponse.redirect(new URL(`/${locale}/login`, url.origin));

  const projectId = url.searchParams.get("project") ?? "";
  const back = projectId ? `/${locale}/studio/${projectId}` : `/${locale}/dashboard`;

  if (!shopifyConfigured()) {
    return NextResponse.redirect(new URL(`${back}?shopify=config`, url.origin));
  }

  const shop = normalizeShop(url.searchParams.get("shop") || user.shopify_shop || "");
  if (!shop) {
    return NextResponse.redirect(new URL(`${back}?shopify=invalid`, url.origin));
  }

  const nonce = newState();
  const jar = await cookies();
  jar.set(SHOPIFY_STATE_COOKIE, JSON.stringify({ nonce, mode: "link", userId: user.id, projectId, locale }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(installUrl(shop, nonce));
}
