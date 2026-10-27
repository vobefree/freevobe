import { shopifyGraphql, ShopifyError } from "@/lib/shopify";
import type { ChannelStat, ProductStat, StatsPeriod, StatsPoint, StoreStats } from "./types";

/**
 * Shopify-analys via ShopifyQL (Admin GraphQL). Kräver `read_reports` i appens
 * scopes. Varje fråga körs separat så att en otillåten metric inte slår ut hela
 * panelen – misslyckanden rapporteras som varningar.
 */

type ShopifyqlRow = Record<string, string | number | null>;

type ShopifyqlResponse = {
  shopifyqlQuery: {
    tableData: { columns: { name: string; dataType: string; displayName: string }[]; rows: ShopifyqlRow[] } | null;
    parseErrors: string[];
    parseWarnings: string[];
  } | null;
};

export class ShopifyqlError extends Error {
  missingScope: boolean;
  constructor(message: string, missingScope = false) {
    super(message);
    this.missingScope = missingScope;
  }
}

async function query(shop: string, token: string, ql: string): Promise<ShopifyqlRow[]> {
  try {
    const data = await shopifyGraphql<ShopifyqlResponse>(
      shop,
      token,
      `query Analytics($q: String!) { shopifyqlQuery(query: $q) { tableData { columns { name dataType displayName } rows } parseErrors parseWarnings } }`,
      { q: ql },
    );
    const result = data.shopifyqlQuery;
    if (!result) throw new ShopifyqlError("ShopifyQL svarade tomt");
    if (result.parseErrors?.length) throw new ShopifyqlError(result.parseErrors.join("; "));
    return result.tableData?.rows ?? [];
  } catch (error) {
    const message = error instanceof Error ? error.message : "ShopifyQL misslyckades";
    if (/access|scope|permission|denied/i.test(message)) {
      throw new ShopifyqlError("Appen saknar behörigheten read_reports", true);
    }
    if (error instanceof ShopifyError) throw new ShopifyqlError(message);
    throw error;
  }
}

const num = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

function normalizeRate(value: number): number {
  // ShopifyQL kan returnera 0.032 eller 3.2 beroende på metric.
  return value <= 1 ? Math.round(value * 1000) / 10 : Math.round(value * 10) / 10;
}

type Range = { since: string; until: string };

function period(label: string, range: Range, revenue: number, orders: number, sessions: number | null, conversion: number | null, addedToCart: number | null, addRate: number | null): StatsPeriod {
  return {
    label,
    since: range.since,
    until: range.until,
    revenue: Math.round(revenue * 100) / 100,
    orders,
    aov: orders > 0 ? Math.round((revenue / orders) * 100) / 100 : 0,
    conversionRate: conversion,
    sessions,
    addedToCart,
    addToCartRate: addRate,
  };
}

export async function fetchShopifyStats(input: {
  shop: string;
  token: string;
  currency: string;
  themeChangeAt: string | null;
}): Promise<StoreStats> {
  const warnings: string[] = [];
  const now = new Date();
  const days = 30;
  const change = input.themeChangeAt ? new Date(input.themeChangeAt) : null;
  const validChange = change && !Number.isNaN(change.getTime()) && now.getTime() - change.getTime() > 3 * 86_400_000;
  const afterStart = validChange ? new Date(Math.max(change.getTime(), now.getTime() - days * 86_400_000)) : new Date(now.getTime() - days * 86_400_000);
  const afterRange: Range = { since: isoDay(afterStart), until: isoDay(now) };
  const span = Math.max(1, Math.round((now.getTime() - afterStart.getTime()) / 86_400_000));
  const beforeEnd = new Date(afterStart.getTime() - 86_400_000);
  const beforeStart = new Date(beforeEnd.getTime() - span * 86_400_000);
  const beforeRange: Range = { since: isoDay(beforeStart), until: isoDay(beforeEnd) };

  const window = (range: Range) => `SINCE ${range.since} UNTIL ${range.until}`;

  const salesFor = async (range: Range, label: string): Promise<StatsPeriod> => {
    const rows = await query(
      input.shop,
      input.token,
      `FROM sales SHOW total_sales, orders, average_order_value ${window(range)}`,
    );
    const row = rows[0] ?? {};
    const revenue = num(row.total_sales ?? row.sales ?? row.totalSales);
    const orders = num(row.orders);
    let sessions: number | null = null;
    let conversion: number | null = null;
    let addedToCart: number | null = null;
    let addRate: number | null = null;
    try {
      const sessionRows = await query(
        input.shop,
        input.token,
        `FROM sessions SHOW sessions, conversion_rate, sessions_with_cart_additions, added_to_cart_rate ${window(range)}`,
      );
      const sessionsRow = sessionRows[0] ?? {};
      sessions = Math.round(num(sessionsRow.sessions));
      conversion = normalizeRate(num(sessionsRow.conversion_rate));
      addedToCart = Math.round(num(sessionsRow.sessions_with_cart_additions));
      addRate = normalizeRate(num(sessionsRow.added_to_cart_rate));
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "Kunde inte hämta sessionsdata");
    }
    return period(label, range, revenue, Math.round(orders), sessions, conversion, addedToCart, addRate);
  };

  const after = await salesFor(afterRange, validChange ? "Efter temaändring" : "Senaste 30 dagarna");
  const before = await salesFor(beforeRange, validChange ? "Före temaändring" : "Perioden före");

  let series: StatsPoint[] = [];
  try {
    const rows = await query(
      input.shop,
      input.token,
      `FROM sales SHOW total_sales, orders GROUP BY day ${window({ since: beforeRange.since, until: afterRange.until })} ORDER BY day`,
    );
    series = rows.map((row) => ({
      date: String(row.day ?? row.date ?? ""),
      revenue: num(row.total_sales),
      orders: Math.round(num(row.orders)),
      sessions: null,
    }));
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "Kunde inte hämta dagsdata");
  }

  let channels: ChannelStat[] = [];
  try {
    const rows = await query(
      input.shop,
      input.token,
      `FROM sales SHOW total_sales, orders GROUP BY sales_channel ${window(afterRange)} ORDER BY total_sales DESC`,
    );
    const total = rows.reduce((sum, row) => sum + num(row.total_sales), 0);
    channels = rows.map((row) => ({
      name: String(row.sales_channel ?? row.channel ?? "Övrigt"),
      revenue: Math.round(num(row.total_sales) * 100) / 100,
      orders: Math.round(num(row.orders)),
      sessions: null,
      share: total > 0 ? Math.round((num(row.total_sales) / total) * 1000) / 10 : 0,
    }));
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "Kunde inte hämta kanaler");
  }

  let products: ProductStat[] = [];
  try {
    const rows = await query(
      input.shop,
      input.token,
      `FROM sales SHOW net_items_sold, total_sales GROUP BY TOP 10 product_title ${window(afterRange)} ORDER BY total_sales DESC`,
    );
    products = rows.map((row) => ({
      title: String(row.product_title ?? row.product ?? "Produkt"),
      units: Math.round(num(row.net_items_sold)),
      revenue: Math.round(num(row.total_sales) * 100) / 100,
    }));
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "Kunde inte hämta populära produkter");
  }

  return {
    source: "shopify",
    currency: input.currency,
    shop: input.shop,
    themeChangeAt: input.themeChangeAt,
    before,
    after,
    series,
    channels,
    products,
    addToCart: { additions: after.addedToCart, rate: after.addToCartRate, sessionsWithCart: after.sessions },
    fetchedAt: new Date().toISOString(),
    warnings,
  };
}
