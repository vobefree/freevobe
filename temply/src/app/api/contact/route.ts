import { NextResponse } from "next/server";
import { saveContactMessage } from "@/lib/db";
import { isLocale, type Locale } from "@/lib/theme/types";

export const runtime = "nodejs";

/** Enkel broms per IP så att formuläret inte kan spammas i blindo. */
const recent = new Map<string, number>();
const WINDOW_MS = 60_000;

const clean = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const last = recent.get(ip) ?? 0;
  if (Date.now() - last < WINDOW_MS) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const name = clean(body.name, 80);
  const email = clean(body.email, 160);
  const subject = clean(body.subject, 120) || "ThemeFold";
  const message = clean(body.message, 4000);
  const locale = isLocale(clean(body.locale, 2)) ? (clean(body.locale, 2) as Locale) : "sv";
  const honeypot = clean(body.website, 200);

  if (honeypot) return NextResponse.json({ ok: true });
  if (!name || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  saveContactMessage({ name, email, subject, message, locale });
  recent.set(ip, Date.now());
  return NextResponse.json({ ok: true });
}
