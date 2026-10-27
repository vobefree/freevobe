import { db } from "@/lib/db";
import { geminiConfigured, geminiModel } from "@/lib/ai/gemini";
import { keylessEnabled, kiloModel } from "@/lib/ai/free-text";
import { hasValue, listSettings } from "@/lib/settings";
import { shopifyConfigured } from "@/lib/shopify";
import { listStaff, ownerEmails } from "@/lib/staff";

export type SystemChecks = {
  db: { ok: boolean; sizeKb: number | null; counts: Record<string, number> };
  runtime: { node: string; env: string; appUrl: string | null; uptimeSec: number };
  services: Record<string, boolean | string>;
  staff: { owners: number; rows: number };
  settingsOverview: {
    name: string;
    group: string;
    label: string;
    configured: boolean;
    source: string;
    updatedAt: string | null;
    updatedBy: string | null;
  }[];
};

export function systemChecks(): SystemChecks {
  const count = (table: string): number => {
    try {
      const row = db().prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as unknown as { c: number };
      return Number(row?.c ?? 0);
    } catch {
      return 0;
    }
  };
  const sizeKb = (() => {
    try {
      const pages = db().prepare("PRAGMA page_count").get() as unknown as { page_count?: number };
      const size = db().prepare("PRAGMA page_size").get() as unknown as { page_size?: number };
      return Math.round(((pages?.page_count ?? 0) * (size?.page_size ?? 0)) / 1024);
    } catch {
      return null;
    }
  })();

  return {
    db: {
      ok: true,
      sizeKb,
      counts: {
        users: count("users"),
        projects: count("projects"),
        payments: count("payments"),
        healthRuns: count("theme_health"),
        auditRows: count("admin_audit"),
      },
    },
    runtime: {
      node: process.version,
      env: process.env.NODE_ENV ?? "development",
      appUrl: process.env.APP_URL ?? null,
      uptimeSec: Math.round(process.uptime()),
    },
    services: {
      "Kilo (nyckelfri)": keylessEnabled() ? kiloModel() : false,
      "Pollinations (nyckelfri)": keylessEnabled(),
      Gemini: geminiConfigured() ? geminiModel() : false,
      Shopify: shopifyConfigured(),
      Stripe: hasValue("STRIPE_SECRET_KEY"),
      "OpenRouter (free)": hasValue("OPENROUTER_API_KEY"),
      PageSpeed: hasValue("PAGESPEED_API_KEY"),
      Inställningskrypto: hasValue("SETTINGS_SECRET") || hasValue("SHOPIFY_API_SECRET"),
    },
    staff: { owners: ownerEmails().length, rows: listStaff().length },
    settingsOverview: listSettings().map((setting) => ({
      name: setting.name,
      group: setting.group,
      label: setting.label,
      configured: setting.configured,
      source: setting.source,
      updatedAt: setting.updatedAt,
      updatedBy: setting.updatedBy,
    })),
  };
}
