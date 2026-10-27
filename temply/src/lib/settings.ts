import { db } from "./db";
import { open, seal } from "./secret-box";

/**
 * Inställningar och API-nycklar. Värden sparas krypterade i databasen och
 * överrider process.env vid läsning, så att en nyckel kan bytas från
 * adminpanelen utan omstart. Saknas värde i databasen används miljön.
 */

const encrypt = seal;
const decrypt = open;

type SettingGroup = "ai" | "shopify" | "auth" | "payments" | "site" | "referral" | "accounting";

export type SettingDefinition = {
  name: string;
  group: SettingGroup;
  label: string;
  secret: boolean;
  placeholder?: string;
  hint?: string;
};

export const SETTING_DEFINITIONS: SettingDefinition[] = [
  {
    name: "FREE_AI_KEYLESS",
    group: "ai",
    label: "Nyckelfri gratis AI (1/0)",
    secret: false,
    placeholder: "1",
    hint: "1 = Kilo Gateway och Pollinations används utan nyckel. 0 = endast dina egna gratistjänster nedan.",
  },
  {
    name: "KILO_MODEL",
    group: "ai",
    label: "Kilo-modell",
    secret: false,
    placeholder: "minimax/minimax-m3.1-flash:free",
    hint: "Måste vara kilo-auto/free eller sluta på :free. Standard är en snabb gratismodell; auto-routern används som reserv.",
  },
  { name: "GEMINI_API_KEY", group: "ai", label: "Gemini API-nyckel (reserv)", secret: true, placeholder: "AIza…", hint: "Frivillig. Används efter de nyckelfria vägarna, och bara med Flash-modeller." },
  { name: "GOOGLE_API_KEY", group: "ai", label: "Google API-nyckel (reserv)", secret: true, placeholder: "AIza…", hint: "Används om Gemini-nyckeln saknas" },
  { name: "GEMINI_API_BASE", group: "ai", label: "Gemini bas-URL", secret: false, placeholder: "https://generativelanguage.googleapis.com", hint: "Byt endast vid egen proxy" },
  {
    name: "GEMINI_MODEL",
    group: "ai",
    label: "Gemini-modell",
    secret: false,
    placeholder: "gemini-3.8-flash",
    hint: "Endast Flash-modeller i gratisnivån. Pro-, Argon- och bildmodeller ignoreras.",
  },
  {
    name: "OPENROUTER_API_KEY",
    group: "ai",
    label: "OpenRouter API-nyckel (gratis reserv)",
    secret: true,
    placeholder: "sk-or-…",
    hint: "Används bara om Gemini saknas. Tvingas alltid till gratismodeller.",
  },
  {
    name: "OPENROUTER_MODEL",
    group: "ai",
    label: "OpenRouter-modell",
    secret: false,
    placeholder: "openrouter/free",
    hint: "Måste vara openrouter/free eller sluta på :free – annars används free-routern.",
  },
  { name: "PAGESPEED_API_KEY", group: "ai", label: "PageSpeed-nyckel", secret: true, hint: "Höjer kvoten för hastighetsmätningen" },
  { name: "SHOPIFY_API_KEY", group: "shopify", label: "Shopify API-nyckel", secret: false },
  { name: "SHOPIFY_API_SECRET", group: "shopify", label: "Shopify API-secret", secret: true },
  { name: "SHOPIFY_SCOPES", group: "shopify", label: "Scopes", secret: false, placeholder: "read_themes,write_themes,read_reports" },
  { name: "SHOPIFY_API_VERSION", group: "shopify", label: "API-version", secret: false, placeholder: "2026-07" },
  { name: "GOOGLE_CLIENT_ID", group: "auth", label: "Google client id", secret: false },
  { name: "GOOGLE_CLIENT_SECRET", group: "auth", label: "Google client secret", secret: true },
  { name: "FACEBOOK_CLIENT_ID", group: "auth", label: "Facebook app id", secret: false },
  { name: "FACEBOOK_CLIENT_SECRET", group: "auth", label: "Facebook app secret", secret: true },
  { name: "STRIPE_SECRET_KEY", group: "payments", label: "Stripe secret key", secret: true, placeholder: "sk_…" },
  { name: "STRIPE_WEBHOOK_SECRET", group: "payments", label: "Stripe webhook secret", secret: true, placeholder: "whsec_…" },
  { name: "APP_URL", group: "site", label: "Publik basadress", secret: false, placeholder: "https://themefold.se", hint: "Används för OAuth-callbacks och inbjudningar" },
  { name: "SITE_SIGNUPS", group: "site", label: "Öppna för nya konton (1/0)", secret: false, placeholder: "1" },
  { name: "SITE_TRIAL_DAYS", group: "site", label: "Provperiod i dagar", secret: false, placeholder: "3" },
  { name: "SITE_SUPPORT_EMAIL", group: "site", label: "Supportadress", secret: false, placeholder: "hej@themefold.se" },
  { name: "SITE_ANNOUNCEMENT", group: "site", label: "Meddelande på dashboarden", secret: false, placeholder: "T.ex. planerat underhåll 22–23 oktober" },
  { name: "REFERRAL_ENABLED", group: "referral", label: "Värvningsprogram (1/0)", secret: false, placeholder: "1" },
  { name: "REFERRAL_TRIAL_BONUS_DAYS", group: "referral", label: "Extra provdagar till den inbjudne", secret: false, placeholder: "7" },
  { name: "REFERRAL_REWARD_DAYS", group: "referral", label: "Gratisdagar till den som bjuder in", secret: false, placeholder: "30" },
  { name: "REFERRAL_MAX_REWARDS", group: "referral", label: "Max antal belöningar per konto", secret: false, placeholder: "3" },
  { name: "ACCOUNTING_COMPANY_NAME", group: "accounting", label: "Företagsnamn", secret: false, placeholder: "ThemeFold AB" },
  { name: "ACCOUNTING_ORG_NUMBER", group: "accounting", label: "Organisationsnummer", secret: false, placeholder: "556000-0000" },
  { name: "ACCOUNTING_VAT_NUMBER", group: "accounting", label: "Momsregistreringsnummer", secret: false, placeholder: "SE556000000001" },
  { name: "ACCOUNTING_ADDRESS", group: "accounting", label: "Adress", secret: false, placeholder: "Storgatan 1, 111 22 Stockholm" },
  {
    name: "ACCOUNTING_FISCAL_START",
    group: "accounting",
    label: "Räkenskapsårets start (MM-DD)",
    secret: false,
    placeholder: "01-01",
    hint: "Kalenderår är vanligast. Används för SIE-filens räkenskapsår.",
  },
  {
    name: "ACCOUNTING_PRICES_INCL_VAT",
    group: "accounting",
    label: "Priser visas inklusive moms (1/0)",
    secret: false,
    placeholder: "1",
    hint: "Konsumentpriser ska anges inklusive moms. 1 = beloppet i Stripe är brutto.",
  },
  { name: "ACCOUNTING_VAT_RATE", group: "accounting", label: "Momssats i Sverige (%)", secret: false, placeholder: "25" },
  {
    name: "ACCOUNTING_VAT_BY_CURRENCY",
    group: "accounting",
    label: "Moms per valuta",
    secret: false,
    placeholder: "SEK:25,EUR:25,DKK:25,NOK:0,USD:0,GBP:0",
    hint: "25 = svensk moms (ruta 05/10). 0 = ingen svensk moms, bokförs som export (ruta 40). Under OSS-tröskeln (99 680 kr) får svensk moms användas för EU-konsumenter.",
  },
  {
    name: "ACCOUNTING_FX_RATES",
    group: "accounting",
    label: "Växelkurser till SEK",
    secret: false,
    placeholder: "USD:10.60,EUR:11.20,NOK:0.95,DKK:1.47,GBP:12.60",
    hint: "Används för att räkna om betalningar till SEK i bokföringen. SEK är alltid 1.",
  },
  {
    name: "ACCOUNTING_STRIPE_FEE_PERCENT",
    group: "accounting",
    label: "Stripe-avgift (%)",
    secret: false,
    placeholder: "1.5",
    hint: "Avgift som dras från varje betalning. Används för att bokföra kortavgiften.",
  },
  { name: "ACCOUNTING_STRIPE_FEE_FIXED_SEK", group: "accounting", label: "Stripe fast avgift (kr)", secret: false, placeholder: "1.80" },
  {
    name: "ACCOUNTING_STRIPE_VAT",
    group: "accounting",
    label: "Stripe-avgiftens moms",
    secret: false,
    placeholder: "reverse",
    hint: "reverse = omvänd skattskyldighet (25 %, ruta 21/30/48). none = ingen moms på avgiften.",
  },
  { name: "ACCOUNTING_BANK_ACCOUNT", group: "accounting", label: "Bankkonto (BAS)", secret: false, placeholder: "1930" },
  { name: "ACCOUNTING_CLEARING_ACCOUNT", group: "accounting", label: "Konto för Stripe-saldo (BAS)", secret: false, placeholder: "1580" },
];

const BY_NAME = new Map(SETTING_DEFINITIONS.map((definition) => [definition.name, definition]));

type StoredRow = { name: string; value: string; updated_by: string | null; updated_at: string };

function stored(name: string): StoredRow | null {
  const row = db().prepare("SELECT * FROM settings WHERE name = ?").get(name) as unknown as StoredRow | undefined;
  return row ?? null;
}

/** Databasen först, därefter miljön. */
export function envValue(name: string): string {
  const row = stored(name);
  if (row) {
    const value = decrypt(row.value);
    if (value) return value;
  }
  return process.env[name] ?? "";
}

export function hasValue(name: string): boolean {
  return envValue(name).trim().length > 0;
}

export type SettingView = SettingDefinition & {
  configured: boolean;
  source: "db" | "env" | "none";
  updatedAt: string | null;
  updatedBy: string | null;
  /** Endast icke-hemliga värden skickas till klienten. */
  value: string | null;
};

export function listSettings(): SettingView[] {
  return SETTING_DEFINITIONS.map((definition) => {
    const row = stored(definition.name);
    const dbValue = row ? decrypt(row.value) : "";
    const fallback = process.env[definition.name] ?? "";
    return {
      ...definition,
      configured: Boolean(dbValue || fallback),
      source: dbValue ? "db" : fallback ? "env" : "none",
      updatedAt: row?.updated_at ?? null,
      updatedBy: row?.updated_by ?? null,
      value: definition.secret ? null : dbValue || null,
    };
  });
}

/** Sparar värden. Tom sträng tar bort databas-overriden och faller tillbaka på miljön. */
export function saveSettings(values: Record<string, string>, actor: string): { saved: number; skipped: string[] } {
  const skipped: string[] = [];
  let saved = 0;
  const statement = db().prepare(
    "INSERT INTO settings (name, value, updated_by, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at",
  );
  const remove = db().prepare("DELETE FROM settings WHERE name = ?");
  for (const [name, raw] of Object.entries(values)) {
    if (!BY_NAME.has(name)) {
      skipped.push(name);
      continue;
    }
    const value = String(raw ?? "").trim();
    if (!value) {
      remove.run(name);
      saved += 1;
      continue;
    }
    statement.run(name, encrypt(value), actor, new Date().toISOString());
    saved += 1;
  }
  return { saved, skipped };
}

export type SiteConfig = {
  signups: boolean;
  trialDays: number;
  supportEmail: string;
  announcement: string;
};

export function siteConfig(): SiteConfig {
  const trial = Number(envValue("SITE_TRIAL_DAYS") || 3);
  return {
    signups: envValue("SITE_SIGNUPS") !== "0",
    trialDays: Number.isFinite(trial) ? Math.max(1, Math.min(90, Math.round(trial))) : 3,
    supportEmail: envValue("SITE_SUPPORT_EMAIL") || "support@themefold.se",
    announcement: envValue("SITE_ANNOUNCEMENT") || "",
  };
}

export type ReferralConfig = {
  enabled: boolean;
  /** Extra provdagar till den som blir inbjuden. */
  trialBonusDays: number;
  /** Gratisdagar till den som bjöd in, när den inbjudne blir betalande. */
  rewardDays: number;
  /** Tak: så många belöningar kan ett konto få, sedan växer bara kundbasen. */
  maxRewards: number;
};

function clampNumber(raw: string, fallback: number, min: number, max: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function referralConfig(): ReferralConfig {
  return {
    enabled: envValue("REFERRAL_ENABLED") !== "0",
    trialBonusDays: clampNumber(envValue("REFERRAL_TRIAL_BONUS_DAYS") || "7", 7, 0, 60),
    rewardDays: clampNumber(envValue("REFERRAL_REWARD_DAYS") || "30", 30, 0, 180),
    maxRewards: clampNumber(envValue("REFERRAL_MAX_REWARDS") || "3", 3, 1, 50),
  };
}

export function settingGroups(): { id: SettingGroup; label: string; description: string }[] {
  return [
    {
      id: "ai",
      label: "AI & analys",
      description:
        "Endast gratistjänster. Bygg med AI svarar först via de nyckelfria vägarna (Kilo Gateway, Pollinations), sedan Gemini gratisnivå och OpenRouter free. PageSpeed används av Theme Health.",
    },
    { id: "shopify", label: "Shopify", description: "App-uppgifter för OAuth, temapublicering och ShopifyQL." },
    { id: "auth", label: "Inloggning", description: "Google och Facebook. Redirect-URI: {APP_URL}/api/auth/social/{provider}/callback" },
    { id: "payments", label: "Betalningar", description: "Stripe Checkout och webhook-signering." },
    { id: "site", label: "Sajt & drift", description: "Publik adress, registrering, provperiod och meddelanden." },
    {
      id: "referral",
      label: "Värvning",
      description:
        "Belöningar som gör att fler bjuder in: extra provdagar till den inbjudne och gratisdagar till den som bjöd in när den inbjudne blir betalande. Taket skyddar intäkterna.",
    },
    {
      id: "accounting",
      label: "Bokföring",
      description:
        "Företagsuppgifter, momssats, valutaomräkning och Stripe-avgifter för SIE4-exporten, momsrapporten och verifikationslistan.",
    },
  ];
}
