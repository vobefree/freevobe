import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { requirePublicSupabase } from "@/lib/env";
import type { Database } from "@/lib/types/database";

/**
 * Supabase-klient för server components, route handlers och server actions.
 * Läser och skriver sessionscookies, men använder fortfarande användarens
 * rättigheter – RLS gäller precis som i webbläsaren.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = requirePublicSupabase();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Anropas från en server component där cookies inte får skrivas.
          // Sessionen förnyas i middleware i stället.
        }
      },
    },
  });
}
