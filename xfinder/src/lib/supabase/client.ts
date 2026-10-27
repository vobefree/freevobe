"use client";

import { createBrowserClient } from "@supabase/ssr";

import { requirePublicSupabase } from "@/lib/env";
import type { Database } from "@/lib/types/database";

/**
 * Supabase-klient för webbläsaren. Använder anon-nyckeln, så allt den gör
 * begränsas av RLS.
 */
export function createClient() {
  const { url, anonKey } = requirePublicSupabase();
  return createBrowserClient<Database>(url, anonKey);
}
