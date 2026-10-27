/**
 * Miljövariabler på ett ställe.
 *
 * Appen ska kunna startas och byggas innan Supabase är kopplat: därför kastar
 * inget vid import, utan först när en funktion faktiskt behöver värdena.
 * Sidor som kräver Supabase kan i stället kolla isSupabaseConfigured() och visa
 * en tydlig svensk uppmaning.
 */

export type PublicSupabaseEnv = { url: string; anonKey: string };

const PUBLIC_KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;

/** Vilka publika nycklar som saknas just nu (tom lista = allt på plats). */
export function missingPublicSupabaseKeys(): string[] {
  const missing: string[] = [];

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push(PUBLIC_KEYS[0]);
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) missing.push(PUBLIC_KEYS[1]);

  return missing;
}

export function isSupabaseConfigured(): boolean {
  return missingPublicSupabaseKeys().length === 0;
}

/** Hämtar URL + anon-nyckel, eller kastar ett begripligt fel. */
export function requirePublicSupabase(): PublicSupabaseEnv {
  const missing = missingPublicSupabaseKeys();

  if (missing.length > 0) {
    throw new Error(
      `Supabase är inte konfigurerat. Lägg till ${missing.join(" och ")} i .env.local ` +
        `(se .env.example) och starta om servern.`,
    );
  }

  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  };
}

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/**
 * Service role-nyckeln får bara användas i serverkod (route handlers, server
 * actions, webhooks). Den går förbi RLS och ska aldrig nå webbläsaren.
 */
export function requireServiceRoleKey(): string {
  if (typeof window !== "undefined") {
    throw new Error("Service role-nyckeln får bara användas på servern.");
  }

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY saknas i .env.local. Den behövs för Stripe-webhooks " +
        "och adminfunktioner och får bara finnas på servern.",
    );
  }

  return key;
}

/** Antal AI-meddelanden en användare får skicka per dygn. */
export function aiDailyLimit(): number {
  const raw = Number.parseInt(process.env.AI_DAILY_MESSAGE_LIMIT ?? "40", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 40;
}

/** Stripe ska köra testläge tills vidare. */
export function isStripeTestMode(): boolean {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  return key.startsWith("sk_test_") || key === "";
}
