import type { Locale } from "@/lib/theme/types";
import type { HealthReport } from "@/lib/health/types";
import type { StoreStats } from "@/lib/stats/types";
import { percentChange } from "@/lib/stats/types";
import { parseGeminiJson } from "./gemini";
import { freeTextConfigured, freeTextWithProvider } from "./free-text";

export type Insight = {
  title: string;
  why: string;
  action: string;
  impact: "high" | "medium" | "low";
  /** Health-issues som insikten bygger på, så att panelen kan erbjuda "Åtgärda". */
  issues: string[];
};

export type Insights = {
  verdict: string;
  insights: Insight[];
  nextSteps: string[];
  source: "ai" | "rules";
  createdAt: string;
  error?: string;
};

const LANGUAGE: Record<Locale, string> = {
  sv: "svenska",
  nb: "norska",
  fi: "finska",
  da: "danska",
  en: "engelska",
  fr: "franska",
  de: "tyska",
  es: "spanska",
};

const IMPACT_SCORE = { high: 3, medium: 2, low: 1 } as const;

function money(value: number, currency: string): string {
  return `${Math.round(value).toLocaleString("sv-SE")} ${currency}`;
}

/** Deterministiska insikter när Gemini saknas eller svarar fel. */
export function ruleInsights(health: HealthReport | null, stats: StoreStats | null, currency = "SEK"): Insights {
  const insights: Insight[] = [];
  const nextSteps: string[] = [];

  if (health) {
    const critical = health.issues.filter((issue) => issue.severity === "critical").slice(0, 3);
    for (const issue of critical) {
      insights.push({
        title: issue.title,
        why: issue.detail,
        action: issue.fix,
        impact: issue.weight >= 20 ? "high" : "medium",
        issues: [issue.id],
      });
    }
    const used = new Set(critical.map((issue) => issue.id));
    const nextUp = health.issues
      .filter((issue) => !used.has(issue.id) && issue.severity !== "info")
      .sort((a, b) => (b.autoFix ? b.weight + 4 : b.weight) - (a.autoFix ? a.weight + 4 : a.weight))
      .slice(0, 3);
    for (const issue of nextUp) {
      insights.push({
        title: issue.title,
        why: issue.detail,
        action: issue.fix,
        impact: issue.weight >= 16 ? "high" : "medium",
        issues: [issue.id],
      });
    }
    if (!insights.length) {
      insights.push({
        title: "Temat är i gott skick",
        why: `Health score ${health.score}/100 utan kritiska brister.`,
        action: "Fokusera på innehåll och kampanjer i stället för teknik.",
        impact: "low",
        issues: [],
      });
    }
    nextSteps.push(
      health.counts.critical > 0
        ? `Åtgärda ${health.counts.critical} kritiska punkter först – de påverkar både SEO och konvertering.`
        : "Inga kritiska brister – ta snabbfixarna och lägg tiden på innehåll och kampanjer.",
    );
  }

  if (stats) {
    const revenue = percentChange(stats.before.revenue, stats.after.revenue);
    const cvr = percentChange(stats.before.conversionRate, stats.after.conversionRate);
    if (revenue !== null) {
      insights.unshift({
        title:
          revenue >= 0
            ? `Omsättningen ${revenue > 0 ? "ökar" : "är oförändrad"} efter temaändringen`
            : `Omsättningen faller ${Math.abs(revenue)} %`,
        why: `${money(stats.before.revenue, stats.currency)} → ${money(stats.after.revenue, stats.currency)}${cvr !== null ? `, konvertering ${stats.before.conversionRate}% → ${stats.after.conversionRate}%` : ""}. ${stats.source === "demo" ? "Siffrorna är exempeldata." : "Källa: Shopify Analytics."}`,
        action:
          revenue >= 0
            ? "Behåll strukturen och flytta budget till kanalen som växer snabbast."
            : "Jämför vilka sektioner som ändrades vid publiceringen och rulla tillbaka den svagaste.",
        impact: "high",
        issues: [],
      });
    }
    const topChannel = stats.channels[0];
    if (topChannel) {
      nextSteps.push(`Bygg en landningssida för ${topChannel.name} (${topChannel.share}% av omsättningen) med samma tema.`);
    }
    if (stats.after.addToCartRate !== null && stats.after.addToCartRate < 8) {
      insights.push({
        title: `Kundvagnstillägg ${stats.after.addToCartRate}%`,
        why: "Få besökare lägger något i korgen – det pekar oftast på otydliga produktsidor eller svag produktbild.",
        action: "Testa sticky köpknapp, tydligare pris och recensioner ovanför vikningen.",
        impact: "medium",
        issues: health ? ["conversion.sticky-atc", "conversion.reviews"] : [],
      });
    }
    if (stats.before.aov > 0 && stats.after.aov < stats.before.aov * 0.95) {
      insights.push({
        title: "Ordervärdet sjunker",
        why: `AOV ${money(stats.before.aov, stats.currency)} → ${money(stats.after.aov, stats.currency)}.`,
        action: "Lägg till mängdrabatt, kompletterande produkter och fri frakt-bar strax över snittordern.",
        impact: "medium",
        issues: health ? ["conversion.free-shipping"] : [],
      });
    }
  }

  if (!insights.length) {
    insights.push({
      title: "Kör en första analys",
      why: "Ingen health-rapport eller statistik finns för projektet ännu.",
      action: "Kör Theme Health i studion – den kombineras automatiskt med butiksstatistiken.",
      impact: "medium",
      issues: [],
    });
  }

  nextSteps.push("Kör om analysen efter nästa publicering för att se effekten i siffrorna.");

  return {
    verdict: health
      ? `Health ${health.score}/100 (${health.grade}) med ${health.counts.critical} kritiska punkter${stats ? ` och ${stats.source === "shopify" ? "skarp" : "exempel"}-statistik från butiken` : ""}.`
      : "Underlag saknas för en fullständig analys.",
    insights: insights.slice(0, 6),
    nextSteps: nextSteps.slice(0, 4),
    source: "rules",
    createdAt: new Date().toISOString(),
  };
}

type GeminiInsights = { verdict?: string; insights?: Partial<Insight>[]; nextSteps?: string[] };

export async function generateInsights(input: {
  locale: Locale;
  projectName: string;
  health: HealthReport | null;
  stats: StoreStats | null;
}): Promise<Insights> {
  const fallback = ruleInsights(input.health, input.stats, input.stats?.currency ?? "SEK");
  if (!freeTextConfigured()) return fallback;

  const allowedIds = input.health?.issues.map((issue) => issue.id) ?? [];
  const prompt = [
    `Butik: ${input.projectName}`,
    `Marknadsspråk: ${LANGUAGE[input.locale]}`,
    "",
    "THEME HEALTH",
    input.health?.digest ?? "Ingen health-rapport körd.",
    "",
    "BUTIKSSTATISTIK",
    input.stats
      ? [
          `Källa: ${input.stats.source === "shopify" ? "Shopify Analytics" : "exempeldata (inte skarp data)"}`,
          `Period: ${input.stats.before.since}–${input.stats.before.until} mot ${input.stats.after.since}–${input.stats.after.until}`,
          `Omsättning ${money(input.stats.before.revenue, input.stats.currency)} → ${money(input.stats.after.revenue, input.stats.currency)}`,
          `Ordrar ${input.stats.before.orders} → ${input.stats.after.orders}, AOV ${money(input.stats.before.aov, input.stats.currency)} → ${money(input.stats.after.aov, input.stats.currency)}`,
          `Konvertering ${input.stats.before.conversionRate ?? "?"}% → ${input.stats.after.conversionRate ?? "?"}%, kundvagnstillägg ${input.stats.after.addToCartRate ?? "?"}%`,
          `Kanaler: ${input.stats.channels.map((channel) => `${channel.name} ${channel.share}%`).join(", ")}`,
          `Toppprodukter: ${input.stats.products.slice(0, 5).map((product) => `${product.title} ${product.units} st`).join(", ")}`,
        ].join("\n")
      : "Ingen statistik hämtad.",
    "",
    "Uppdrag: skriv konkreta insikter som kopplar temat till butikens siffror. Var specifik, undvik generella råd.",
    "Varje insikt ska ha en åtgärd som går att göra i temat eller butiken inom en timme.",
    `Om en insikt bygger på en health-issue får "issues" endast innehålla dessa id:n: ${allowedIds.join(", ") || "inga"}.`,
    "Max 6 insikter. Svara på marknadsspråket.",
  ].join("\n");

  try {
    // Gratisvägarna har inget schemaargument, så formen beskrivs i prompten och
    // svaret tolkas tolerant (kodblock och extra text tillåts).
    const { text: raw } = await freeTextWithProvider({
      system:
        "Du är senior Shopify CRO- och performance-konsult. Du läser Theme Health och butiksstatistik och ger kortfattade, prioriterade råd. Svara alltid med giltig JSON: {\"verdict\": string, \"insights\": [{\"title\": string, \"why\": string, \"action\": string, \"impact\": \"high\"|\"medium\"|\"low\", \"issues\": string[]}], \"nextSteps\": string[]}.",
      prompt,
      json: true,
      temperature: 0.35,
      maxTokens: 2400,
      timeoutMs: 40_000,
    });
    const parsed = parseGeminiJson<GeminiInsights>(raw);
    const impactOf = (value: unknown): Insight["impact"] => (value === "high" || value === "low" ? value : "medium");
    const insights: Insight[] = (parsed.insights ?? [])
      .filter((insight) => Boolean(insight.title && insight.why && insight.action))
      .map((insight) => ({
        title: String(insight.title),
        why: String(insight.why),
        action: String(insight.action),
        impact: impactOf(insight.impact),
        issues: (insight.issues ?? []).filter((id) => allowedIds.includes(id)),
      }))
      .sort((a, b) => IMPACT_SCORE[b.impact] - IMPACT_SCORE[a.impact])
      .slice(0, 6);
    if (!insights.length) throw new Error("Tomt insights-svar");
    return {
      verdict: parsed.verdict?.trim() || fallback.verdict,
      insights,
      nextSteps: (parsed.nextSteps ?? []).filter(Boolean).slice(0, 4),
      source: "ai",
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      ...fallback,
      error: error instanceof Error ? error.message : "AI-analysen misslyckades",
    };
  }
}
