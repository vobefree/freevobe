"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getInsightsStrings } from "@/lib/i18n/insights";
import { percentChange, type StoreStats } from "@/lib/stats/types";
import type { Locale } from "@/lib/theme/types";
import { Icon } from "@/components/Icon";
import { AiInsights } from "./AiInsights";

type Props = {
  locale: Locale;
  projectId: string;
  shopifyShop: string | null;
  shopifyConnected: boolean;
};

function money(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("sv-SE", { style: "currency", currency: currency.length === 3 ? currency : "SEK", maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${Math.round(value).toLocaleString("sv-SE")} ${currency}`;
  }
}

function Sparkline({ points, height = 54 }: { points: number[]; height?: number }) {
  const path = useMemo(() => {
    if (points.length === 0) return { line: "", area: "" };
    const width = 280;
    const max = Math.max(...points, 1);
    const min = Math.min(...points, 0);
    const span = Math.max(1, max - min);
    const step = width / Math.max(1, points.length - 1);
    const coordinates = points.map((value, index) => [index * step, height - ((value - min) / span) * (height - 8) - 4] as const);
    const line = coordinates.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const area = `${line} L${width},${height} L0,${height} Z`;
    return { line, area };
  }, [points, height]);

  if (!path.line) return null;
  return (
    <svg viewBox={`0 0 280 ${height}`} className="stats-spark" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="stats-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--orange)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--orange)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={path.area} fill="url(#stats-fill)" />
      <path d={path.line} fill="none" stroke="var(--orange)" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="stats-delta is-flat">–</span>;
  return (
    <span className={`stats-delta ${value > 0 ? "is-up" : value < 0 ? "is-down" : "is-flat"}`}>
      {value > 0 ? "+" : ""}
      {value}%
    </span>
  );
}

export function StatsPanel({ locale, projectId, shopifyShop, shopifyConnected }: Props) {
  const strings = getInsightsStrings(locale);
  const [stats, setStats] = useState<StoreStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [domain, setDomain] = useState(shopifyShop?.replace(".myshopify.com", "") ?? "");

  const load = useCallback(
    async (refresh = false) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/analytics/shopify?projectId=${projectId}${refresh ? "&refresh=1" : ""}`);
        const json = (await res.json()) as { stats?: StoreStats; error?: string };
        if (!res.ok || !json.stats) throw new Error(json.error ?? "failed");
        setStats(json.stats);
      } catch {
        setError(strings.statsNoData);
      } finally {
        setLoading(false);
      }
    },
    [projectId, strings.statsNoData],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const currency = stats?.currency ?? "SEK";
  const revenueDelta = stats ? percentChange(stats.before.revenue, stats.after.revenue) : null;
  const aovDelta = stats ? percentChange(stats.before.aov, stats.after.aov) : null;
  const cvrDelta = stats ? percentChange(stats.before.conversionRate, stats.after.conversionRate) : null;
  const cartDelta = stats ? percentChange(stats.before.addToCartRate, stats.after.addToCartRate) : null;

  return (
    <div>
      <div className="panel-section">
        <div className="panel-title">
          <span>{strings.statsTitle}</span>
          <button className="ui-btn ui-btn--ghost ui-btn--sm" type="button" onClick={() => load(true)} disabled={loading}>
            <Icon name="repeat" size="xs" /> {loading ? strings.statsLoading : strings.statsRefresh}
          </button>
        </div>
        <p className="hint" style={{ marginTop: 0 }}>{strings.statsSub}</p>

        {stats && (
          <div className={`stats-source${stats.source === "demo" ? " is-demo" : ""}`}>
            <span className="stats-source__dot" />
            {stats.source === "shopify" ? strings.statsLive : strings.statsDemo}
            <small>
              {stats.themeChangeAt
                ? `${strings.statsThemeChange}: ${new Date(stats.themeChangeAt).toLocaleDateString("sv-SE")}`
                : strings.statsNoChange}
            </small>
          </div>
        )}

        {stats?.source === "demo" && (
          <div className="stats-demo">
            <p>{strings.statsDemoBanner}</p>
            {!shopifyConnected && (
              <div className="stats-connect">
                <input
                  className="input"
                  value={domain}
                  placeholder="dinshop"
                  aria-label="Shopify-domän"
                  onChange={(event) => setDomain(event.target.value)}
                />
                <button
                  className="ui-btn ui-btn--accent ui-btn--sm"
                  type="button"
                  disabled={!domain.trim()}
                  onClick={() => {
                    window.location.href = `/api/shopify/install?shop=${encodeURIComponent(domain.trim())}&project=${projectId}`;
                  }}
                >
                  {strings.connectShop}
                </button>
              </div>
            )}
          </div>
        )}

        {error && <div className="banner banner--warn">{error}</div>}
        {loading && !stats && <p className="hint">{strings.statsLoading}</p>}

        {stats && (
          <>
            <div className="stats-kpis">
              <div className="stats-kpi">
                <span>{strings.statsRevenue}</span>
                <b>{money(stats.after.revenue, currency)}</b>
                <Delta value={revenueDelta} />
                <small>{money(stats.before.revenue, currency)} {strings.statsBefore.toLowerCase()}</small>
              </div>
              <div className="stats-kpi">
                <span>{strings.statsConversion}</span>
                <b>{stats.after.conversionRate ?? "–"}%</b>
                <Delta value={cvrDelta} />
                <small>{stats.before.conversionRate ?? "–"}% {strings.statsBefore.toLowerCase()}</small>
              </div>
              <div className="stats-kpi">
                <span>{strings.statsAov}</span>
                <b>{money(stats.after.aov, currency)}</b>
                <Delta value={aovDelta} />
                <small>{money(stats.before.aov, currency)} {strings.statsBefore.toLowerCase()}</small>
              </div>
              <div className="stats-kpi">
                <span>{strings.statsAddToCart}</span>
                <b>{stats.after.addToCartRate ?? "–"}%</b>
                <Delta value={cartDelta} />
                <small>{stats.after.addedToCart ?? 0} {strings.statsAdditions}</small>
              </div>
            </div>

            <div className="stats-chart">
              <div className="stats-chart__head">
                <span>{strings.statsTrend}</span>
                <span className="hint">{stats.after.orders} {strings.statsOrders.toLowerCase()}</span>
              </div>
              <Sparkline points={stats.series.map((point) => point.revenue)} />
            </div>

            <div className="stats-block">
              <div className="stats-block__title">{strings.statsChannels}</div>
              {stats.channels.length === 0 && <p className="hint">{strings.statsNoData}</p>}
              {stats.channels.map((channel) => (
                <div key={channel.name} className="stats-channel">
                  <span className="stats-channel__name">{channel.name}</span>
                  <span className="stats-channel__bar">
                    <i style={{ width: `${Math.max(2, channel.share)}%` }} />
                  </span>
                  <span className="stats-channel__value">{channel.share}%</span>
                  <small>{money(channel.revenue, currency)}</small>
                </div>
              ))}
            </div>

            <div className="stats-block">
              <div className="stats-block__title">{strings.statsProducts}</div>
              {stats.products.length === 0 && <p className="hint">{strings.statsNoData}</p>}
              {stats.products.map((product, index) => (
                <div key={`${product.title}-${index}`} className="stats-product">
                  <span className="stats-product__rank">{index + 1}</span>
                  <span className="stats-product__name">{product.title}</span>
                  <span className="stats-product__units">{product.units} {strings.statsProductUnits}</span>
                  <b>{money(product.revenue, currency)}</b>
                </div>
              ))}
            </div>

            {stats.warnings.length > 0 && (
              <div className="stats-warnings">
                {stats.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="panel-section">
        <AiInsights projectId={projectId} locale={locale} />
      </div>
    </div>
  );
}
