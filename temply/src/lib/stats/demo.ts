import type { ThemeConfig } from "@/lib/theme/types";
import type { ChannelStat, ProductStat, StatsPeriod, StatsPoint, StoreStats } from "./types";

/**
 * Exempeldata när butiken inte är kopplad eller appen saknar read_reports.
 * Determinists per projekt-id så att siffrorna inte hoppar mellan omladdningar,
 * och alltid märkta som demo i UI och API.
 */

function hash(seed: string): () => number {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function parsePrice(value: string): number {
  const parsed = Number(value.replace(/[^0-9,.]/g, "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 499;
}

const DAY = 86_400_000;

export function buildDemoStats(input: {
  seed: string;
  config: ThemeConfig;
  themeChangeAt: string | null;
  healthScore?: number;
}): StoreStats {
  const random = hash(input.seed);
  const now = new Date();
  const days = 60;
  const price = parsePrice(input.config.shop.products[0]?.price ?? "499 kr");
  const baseAov = Math.round(price * (1.15 + random() * 0.55) * 100) / 100;
  const baseSessions = Math.round(380 + random() * 520);
  const baseCvr = 0.014 + random() * 0.016;
  /** Temat kan lyfta konverteringen – använd health-score som en försiktig proxy. */
  const lift = input.healthScore === undefined ? 0.12 : Math.max(0.02, Math.min(0.35, (input.healthScore - 55) / 180));
  const change = input.themeChangeAt ? new Date(input.themeChangeAt) : null;
  const hasChange = change && !Number.isNaN(change.getTime());

  const series: StatsPoint[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getTime() - offset * DAY);
    const weekday = date.getDay();
    const weekend = weekday === 0 || weekday === 6 ? 0.82 : 1;
    const beforePhase = offset >= 30;
    const trend = beforePhase ? 1 : 1 + lift;
    const noise = 0.82 + random() * 0.36;
    const sessions = Math.round(baseSessions * weekend * trend * noise);
    const cvr = baseCvr * trend * (0.9 + random() * 0.2);
    const orders = Math.max(0, Math.round(sessions * cvr));
    const revenue = Math.round(orders * baseAov * (0.92 + random() * 0.2) * 100) / 100;
    series.push({ date: date.toISOString().slice(0, 10), revenue, orders, sessions });
  }

  const sum = (slice: StatsPoint[]): { revenue: number; orders: number; sessions: number } => ({
    revenue: Math.round(slice.reduce((total, point) => total + point.revenue, 0) * 100) / 100,
    orders: slice.reduce((total, point) => total + point.orders, 0),
    sessions: slice.reduce((total, point) => total + (point.sessions ?? 0), 0),
  });

  const toPeriod = (slice: StatsPoint[], label: string, since: string, until: string): StatsPeriod => {
    const totals = sum(slice);
    const cvr = totals.sessions > 0 ? Math.round((totals.orders / totals.sessions) * 1000) / 10 : 0;
    const additions = Math.round(totals.sessions * (0.08 + random() * 0.05));
    return {
      label,
      since,
      until,
      revenue: totals.revenue,
      orders: totals.orders,
      aov: totals.orders ? Math.round((totals.revenue / totals.orders) * 100) / 100 : 0,
      conversionRate: cvr,
      sessions: totals.sessions,
      addedToCart: additions,
      addToCartRate: totals.sessions ? Math.round((additions / totals.sessions) * 1000) / 10 : 0,
    };
  };

  const beforeSlice = series.slice(0, 30);
  const afterSlice = series.slice(30);
  const before = toPeriod(beforeSlice, hasChange ? "Före temaändring" : "Perioden före", beforeSlice[0].date, beforeSlice[beforeSlice.length - 1].date);
  const after = toPeriod(afterSlice, hasChange ? "Efter temaändring" : "Senaste 30 dagarna", afterSlice[0].date, afterSlice[afterSlice.length - 1].date);

  const channelNames = ["Direkt", "Organisk sök", "Betald social", "E-post", "Referral"];
  const weights = [0.32, 0.27, 0.21, 0.13, 0.07];
  const channels: ChannelStat[] = channelNames.map((name, index) => ({
    name,
    revenue: Math.round(after.revenue * weights[index] * (0.92 + random() * 0.16) * 100) / 100,
    orders: Math.round(after.orders * weights[index]),
    sessions: Math.round((after.sessions ?? 0) * weights[index]),
    share: Math.round(weights[index] * 1000) / 10,
  }));

  const catalog = input.config.shop.products.length
    ? input.config.shop.products
    : [
        { name: "Klassisk skjorta", price: String(baseAov) },
        { name: "Linnekavaj", price: String(baseAov * 1.4) },
        { name: "Ullmössa", price: String(baseAov * 0.4) },
      ];
  const productWeights = catalog.map((_, index) => 1 / (index + 1.35));
  const totalWeight = productWeights.reduce((total, weight) => total + weight, 0);
  const products: ProductStat[] = catalog.slice(0, 8).map((product, index) => {
    const units = Math.max(1, Math.round(after.orders * (productWeights[index] / totalWeight) * (0.9 + random() * 0.3)));
    return { title: product.name, units, revenue: Math.round(units * parsePrice(product.price) * 100) / 100 };
  });

  return {
    source: "demo",
    currency: input.config.shop.currency,
    shop: null,
    themeChangeAt: input.themeChangeAt,
    before,
    after,
    series,
    channels,
    products,
    addToCart: { additions: after.addedToCart, rate: after.addToCartRate, sessionsWithCart: after.sessions },
    fetchedAt: new Date().toISOString(),
    warnings: ["Exempeldata: koppla Shopify med behörigheten read_reports för butikens riktiga siffror."],
  };
}
