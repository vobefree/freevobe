import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser, startSession } from "@/lib/auth";
import { findUserByShopifyShop, updateUser } from "@/lib/db";
import { exchangeCode, normalizeShop, shopifyConfigured, verifyOAuthHmac } from "@/lib/shopify";
import { isLocale } from "@/lib/theme/types";

export const runtime = "nodejs";

const STATE_COOKIE = "temply_shopify_state";

type StoredState = {
  nonce: string;
  mode?: "link" | "login";
  userId?: string;
  projectId?: string;
  locale?: string;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = url.searchParams;
  const jar = await cookies();

  const rawState = jar.get(STATE_COOKIE)?.value;
  let stored: StoredState | null = null;
  try {
    stored = rawState ? (JSON.parse(rawState) as StoredState) : null;
  } catch {
    stored = null;
  }

  const user = await getCurrentUser();
  const locale = isLocale(stored?.locale) ? stored.locale : isLocale(user?.locale) ? user.locale : "sv";
  const loginMode = stored?.mode === "login";
  const loginPath = `/${locale}/login`;

  const failure = (reason: string) => {
    const target = loginMode || !user ? new URL(loginPath, url.origin) : new URL(stored?.projectId ? `/${locale}/studio/${stored.projectId}` : `/${locale}/dashboard`, url.origin);
    target.searchParams.set("shopify", reason);
    return NextResponse.redirect(target);
  };

  const shop = normalizeShop(params.get("shop") ?? "");
  if (!shopifyConfigured() || !shop) return failure("config");
  if (!stored) return failure("state");
  if (params.get("state") !== stored.nonce) return failure("state");
  if (!verifyOAuthHmac(params)) return failure("state");

  if (loginMode) {
    if (user) return NextResponse.redirect(new URL(`/${locale}/dashboard`, url.origin));
  } else if (!user || stored.userId !== user.id) {
    return NextResponse.redirect(new URL(loginPath, url.origin));
  }

  const code = params.get("code");
  if (!code) return failure("code");

  try {
    const token = await exchangeCode(shop, code);
    if (loginMode) {
      const account = findUserByShopifyShop(shop);
      if (!account) return failure("noaccount");
      updateUser(account.id, {
        shopify_shop: shop,
        shopify_token: token.accessToken,
        shopify_scope: token.scope,
        shopify_connected_at: new Date().toISOString(),
      });
      await startSession(account.id);
      jar.set(STATE_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
      return NextResponse.redirect(new URL(`/${locale}/dashboard?shopify=connected`, url.origin));
    }

    if (!user) return NextResponse.redirect(new URL(loginPath, url.origin));
    updateUser(user.id, {
      shopify_shop: shop,
      shopify_token: token.accessToken,
      shopify_scope: token.scope,
      shopify_connected_at: new Date().toISOString(),
    });
  } catch {
    return failure("exchange");
  }

  jar.set(STATE_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  const back = stored?.projectId ? `/${locale}/studio/${stored.projectId}` : `/${locale}/dashboard`;
  return NextResponse.redirect(new URL(`${back}?shopify=connected`, url.origin));
}
