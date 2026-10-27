import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, isLocale, LOCALES, type Locale } from "@/lib/theme/types";
import { localeForCountry } from "@/lib/i18n/countries";

/**
 * Väljer språk för besökaren innan sidan renderas:
 * 1. ett tidigare val (cookie) vinner alltid,
 * 2. annars landskoden från edge/CDN (Cloudflare, Vercel, Fastly m.fl.),
 * 3. annars webbläsarens Accept-Language,
 * 4. annars svenska.
 */

const COUNTRY_HEADERS = ["cf-ipcountry", "x-vercel-ip-country", "x-country-code", "x-geo-country", "x-fastly-geo-country"];

function fromHeaderCountry(request: NextRequest): Locale | null {
  for (const header of COUNTRY_HEADERS) {
    const locale = localeForCountry(request.headers.get(header));
    if (locale) return locale;
  }
  return null;
}

function fromAcceptLanguage(request: NextRequest): Locale | null {
  const header = request.headers.get("accept-language") ?? "";
  const preferred = header
    .split(",")
    .map((part) => part.split(";")[0].trim().toLowerCase())
    .map((tag) => tag.slice(0, 2))
    .find((code): code is Locale => isLocale(code) && (LOCALES as readonly string[]).includes(code));
  return preferred ?? null;
}

export function middleware(request: NextRequest) {
  const saved = request.cookies.get("temply_locale")?.value;
  const locale = (isLocale(saved) ? saved : null) ?? fromHeaderCountry(request) ?? fromAcceptLanguage(request) ?? DEFAULT_LOCALE;
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/"],
};
