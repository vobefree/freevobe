import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { requirePublicSupabase, requireServiceRoleKey } from "@/lib/env";
import type { Database } from "@/lib/types/database";

/**
 * Klient med service role – går förbi RLS.
 *
 * Används BARA av:
 *   * Stripe-webhooks (bekräfta bokning, släppa escrow, återbetala)
 *   * admin-actions (godkänna kompanjörer, stänga av konton)
 *   * AI-route handlers (skriva ai_messages och öka dagens räknare)
 *
 * Varje anropande route måste själv kontrollera att användaren har rätt roll.
 * Nyckeln får aldrig importeras i en komponent som kan hamna i webbläsaren.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("Service role-klienten får bara skapas på servern.");
  }

  const { url } = requirePublicSupabase();

  return createSupabaseClient<Database>(url, requireServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
