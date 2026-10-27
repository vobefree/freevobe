import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isSupabaseConfigured, requirePublicSupabase } from "@/lib/env";
import type { Database } from "@/lib/types/database";

/**
 * Ytor som kräver inloggning. Middleware gör bara en grov kontroll – den
 * egentliga behörigheten avgörs alltid av RLS i databasen.
 */
export const PROTECTED_PREFIXES = [
  "/konto",
  "/boka",
  "/bokningar",
  "/chatt",
  "/ai",
  "/kompanjor/bli-kompanjor",
  "/admin",
] as const;

export const LOGIN_PATH = "/logga-in";

/**
 * Förnyar Supabase-sessionen på varje request och skickar utloggade användare
 * vidare till inloggningen med ?next= så att de kommer tillbaka dit de ville.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!isSupabaseConfigured()) {
    return response;
  }

  const { url, anonKey } = requirePublicSupabase();

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser (inte getSession) validerar token mot Supabase och förnyar den.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = LOGIN_PATH;
    loginUrl.search = "";
    loginUrl.searchParams.set("next", `${path}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
