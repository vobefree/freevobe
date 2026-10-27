import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { hashPassword, startSession } from "@/lib/auth";
import { createUser, findUserByEmail } from "@/lib/db";
import { socialProfile, socialProviderConfigured, socialProviderId, socialProviderName } from "@/lib/social";
import { isLocale } from "@/lib/theme/types";

export const runtime = "nodejs";

const STATE_COOKIE = "temply_social_state";

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const url = new URL(request.url);
  const { provider } = await params;
  const id = socialProviderId(provider);
  const jar = await cookies();

  let stored: { nonce: string; provider: string; locale: string } | null = null;
  try {
    const raw = jar.get(STATE_COOKIE)?.value;
    stored = raw ? (JSON.parse(raw) as { nonce: string; provider: string; locale: string }) : null;
  } catch {
    stored = null;
  }

  const locale = isLocale(stored?.locale) ? stored.locale : "sv";
  const failure = (reason: string) => {
    const target = new URL(`/${locale}/login`, url.origin);
    target.searchParams.set("social", reason);
    return NextResponse.redirect(target);
  };

  if (!id || !socialProviderConfigured(id)) return failure("config");
  if (!stored || stored.provider !== id) return failure("state");
  if (url.searchParams.get("state") !== stored.nonce) return failure("state");

  const error = url.searchParams.get("error");
  if (error) return failure(error === "access_denied" ? "denied" : "state");

  const code = url.searchParams.get("code");
  if (!code) return failure("state");

  try {
    const profile = await socialProfile(id, code);
    if (!profile.email) return failure("email");

    let user = findUserByEmail(profile.email);
    let created = false;
    if (!user) {
      created = true;
      user = createUser({
        email: profile.email,
        name: profile.name.slice(0, 80) || socialProviderName(id),
        passwordHash: hashPassword(randomBytes(32).toString("hex")),
        locale,
      });
    }

    jar.set(STATE_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
    await startSession(user.id);
    const target = new URL(`/${locale}/dashboard`, url.origin);
    if (created) target.searchParams.set("new", "1");
    return NextResponse.redirect(target);
  } catch {
    return failure("exchange");
  }
}
