/**
 * Migrationsmanifest. Används av /status och av README så att det som står i
 * dokumentationen är samma sak som ligger i supabase/migrations.
 */
export const MIGRATIONS = [
  {
    file: "20261027120000_xfinder_schema.sql",
    title: "Datamodell",
    description:
      "Enums, 13 tabeller (profiles, companion_listings, conversations, messages, bookings, reviews, reports, blocks, ai_sessions, ai_messages, ai_usage_daily, payments, stripe_events), index, dubbelbokningsskydd och check-villkor för priset.",
  },
  {
    file: "20261027120100_xfinder_functions.sql",
    title: "Funktioner och triggers",
    description:
      "Profil skapas automatiskt vid registrering, priset räknas fram av databasen, roll/pengar/escrow/betyg är skyddade, blockering stoppar meddelanden och AI-coachens dagliga räknare ökas atomiskt.",
  },
  {
    file: "20261027120200_xfinder_rls.sql",
    title: "Row Level Security",
    description:
      "RLS på samtliga tabeller med policies för ägare, motpart, deltagare, anon och admin. users kan bara läsa och ändra sina egna känsliga data.",
  },
  {
    file: "20261027120300_xfinder_storage.sql",
    title: "Storage",
    description:
      "Bucketar för kompanjonsfoton och avatrar (publika) samt verifieringsunderlag (privata). Uppladdning bara i sin egen mapp.",
  },
] as const;

/** Tabellerna som /status kontrollerar att API:t kan nå. */
export const CORE_TABLES = [
  "profiles",
  "companion_listings",
  "conversations",
  "messages",
  "bookings",
  "reviews",
  "reports",
  "blocks",
  "ai_sessions",
  "ai_messages",
  "ai_usage_daily",
  "payments",
  "stripe_events",
] as const;

export type CoreTable = (typeof CORE_TABLES)[number];
