/** Statistik för butiken: före/efter temaändring, kanaler, produkter, kundvagn. */

export type StatsPeriod = {
  label: string;
  since: string;
  until: string;
  revenue: number;
  orders: number;
  aov: number;
  conversionRate: number | null;
  sessions: number | null;
  addedToCart: number | null;
  addToCartRate: number | null;
};

export type ChannelStat = { name: string; revenue: number; orders: number; sessions: number | null; share: number };

export type ProductStat = { title: string; units: number; revenue: number };

export type StatsPoint = { date: string; revenue: number; orders: number; sessions: number | null };

export type StoreStats = {
  /** "shopify" = hämtat via ShopifyQL, "demo" = exempeldata i väntan på behörighet. */
  source: "shopify" | "demo";
  currency: string;
  shop: string | null;
  themeChangeAt: string | null;
  before: StatsPeriod;
  after: StatsPeriod;
  series: StatsPoint[];
  channels: ChannelStat[];
  products: ProductStat[];
  addToCart: { additions: number | null; rate: number | null; sessionsWithCart: number | null };
  fetchedAt: string;
  warnings: string[];
};

export function percentChange(before: number | null, after: number | null): number | null {
  if (before === null || after === null || before === 0) return null;
  return Math.round(((after - before) / before) * 1000) / 10;
}
