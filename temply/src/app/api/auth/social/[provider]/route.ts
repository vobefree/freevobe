import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { newState } from "@/lib/shopify";
import { socialAuthorizeUrl, socialProviderConfigured, socialProviderId } from "@/lib/social";
import { isLocale } from "@/lib/theme/types";

export const runtime = "nodejs";

const STATE_COOKIE = "temply_social_state";

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const url = new URL(request.url);
  const { provider } = await params;
  const id = socialProviderId(provider);
  const rawLocale = url.searchParams.get("locale");
  const locale = rawLocale && isLocale(rawLocale) ? rawLocale : "sv";
  const back = new URL(`/${locale}/login`, url.origin);

  if (!id || !socialProviderConfigured(id)) {
    back.searchParams.set("social", "config");
    return NextResponse.redirect(back);
  }

  const nonce = newState();
  const jar = await cookies();
  jar.set(STATE_COOKIE, JSON.stringify({ nonce, provider: id, locale }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(socialAuthorizeUrl(id, nonce));
}
