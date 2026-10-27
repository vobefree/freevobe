import type { ProjectRow, UserRow } from "@/lib/db";
import type { ThemeConfig } from "@/lib/theme/types";
import { buildDemoStats } from "./demo";
import { fetchShopifyStats, ShopifyqlError } from "./shopifyql";
import type { StoreStats } from "./types";

export type { StoreStats, StatsPeriod, ChannelStat, ProductStat, StatsPoint } from "./types";
export { percentChange } from "./types";

/** Hämtar butiksstatistik. Shopify först, demodata som tydligt märkt fallback. */
export async function loadStoreStats(input: {
  user: UserRow;
  project: ProjectRow;
  config: ThemeConfig;
  healthScore?: number;
}): Promise<StoreStats> {
  const { user, project, config } = input;
  if (user.shopify_shop && user.shopify_token) {
    try {
      return await fetchShopifyStats({
        shop: user.shopify_shop,
        token: user.shopify_token,
        currency: config.shop.currency,
        themeChangeAt: project.last_published_at,
      });
    } catch (error) {
      const message =
        error instanceof ShopifyqlError
          ? error.missingScope
            ? "Shopify-appen saknar behörigheten read_reports – koppla om butiken för att läsa analysdata."
            : error.message
          : "Kunde inte läsa Shopify Analytics just nu.";
      const demo = buildDemoStats({
        seed: project.id,
        config,
        themeChangeAt: project.last_published_at,
        healthScore: input.healthScore,
      });
      return { ...demo, warnings: [message, ...demo.warnings] };
    }
  }

  const demo = buildDemoStats({
    seed: project.id,
    config,
    themeChangeAt: project.last_published_at,
    healthScore: input.healthScore,
  });
  return {
    ...demo,
    warnings: [
      user.shopify_shop ? demo.warnings[0] : "Butiken är inte kopplad till Shopify ännu – siffrorna är exempeldata.",
      ...demo.warnings.slice(1),
    ],
  };
}

/** Kort text som AI:n (och adminpanelen) kan läsa i stället för hela datasetet. */
export function statsDigest(stats: StoreStats): string {
  const currency = stats.currency || "SEK";
  const money = (value: number) => `${Math.round(value).toLocaleString("sv-SE")} ${currency}`;
  const delta = (before: number, after: number) =>
    before > 0 ? `${Math.round(((after - before) / before) * 1000) / 10 > 0 ? "+" : ""}${Math.round(((after - before) / before) * 1000) / 10}%` : "–";
  return [
    `Källa: ${stats.source === "shopify" ? "Shopify Analytics (ShopifyQL)" : "exempeldata"}`,
    `Period: ${stats.before.since}→${stats.before.until} jämfört med ${stats.after.since}→${stats.after.until}`,
    `Omsättning: ${money(stats.before.revenue)} → ${money(stats.after.revenue)} (${delta(stats.before.revenue, stats.after.revenue)})`,
    `Ordrar: ${stats.before.orders} → ${stats.after.orders}, AOV ${money(stats.before.aov)} → ${money(stats.after.aov)}`,
    `Konvertering: ${stats.before.conversionRate ?? "?"}% → ${stats.after.conversionRate ?? "?"}%`,
    `Kundvagnstillägg: ${stats.after.addedToCart ?? "?"} (${stats.after.addToCartRate ?? "?"}%)`,
    `Kanaler: ${stats.channels.slice(0, 4).map((channel) => `${channel.name} ${channel.share}%`).join(", ")}`,
    `Toppprodukter: ${stats.products.slice(0, 3).map((product) => `${product.title} (${product.units} st)`).join(", ")}`,
  ].join("\n");
}
