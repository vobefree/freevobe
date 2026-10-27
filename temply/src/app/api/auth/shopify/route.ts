import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { installUrl, newState, normalizeShop, shopifyConfigured } from "@/lib/shopify";
import { isLocale } from "@/lib/theme/types";

export const runtime = "nodejs";

const STATE_COOKIE = "temply_shopify_state";

/**
 * Butiksbaserad inloggning: Shopify OAuth bevisar åtkomst till butiken och
 * knyter den till ett befintligt Temply-konto. Det är butiksauktorisering,
 * inte en fristående Shopify-identitet – därför krävs ett kopplat konto.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const locale = url.searchParams.get("locale");
  const safeLocale = locale && isLocale(locale) ? locale : "sv";
  const back = new URL(`/${safeLocale}/login`, url.origin);

  if (!shopifyConfigured()) {
    back.searchParams.set("shopify", "config");
    return NextResponse.redirect(back);
  }

  const shop = normalizeShop(url.searchParams.get("shop") ?? "");
  if (!shop) {
    back.searchParams.set("shopify", "invalid");
    return NextResponse.redirect(back);
  }

  const nonce = newState();
  const jar = await cookies();
  jar.set(STATE_COOKIE, JSON.stringify({ nonce, mode: "login", locale: safeLocale }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(installUrl(shop, nonce));
}
