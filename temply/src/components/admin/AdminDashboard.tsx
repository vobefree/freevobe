"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AdminOverview } from "@/lib/admin";
import type { InsightsStrings } from "@/lib/i18n/insights";
import type { Locale } from "@/lib/theme/types";

type Props = {
  locale: Locale;
  strings: InsightsStrings;
  email: string;
  role: string;
  canEconomy: boolean;
  canInbox: boolean;
  initial: AdminOverview;
};

function money(cents: number, currency = "SEK"): string {
  const value = cents / 100;
  try {
    return new Intl.NumberFormat("sv-SE", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${Math.round(value).toLocaleString("sv-SE")} ${currency}`;
  }
}

function relative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "nu";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.round(hours / 24)} d`;
}

function Gauge({ value, max = 100, label, sub }: { value: number; max?: number; label: string; sub: string }) {
  const radius = 46;
  const circumference = Math.PI * radius;
  const ratio = Math.max(0, Math.min(1, value / max));
  return (
    <div className="adm-gauge">
      <svg viewBox="0 0 120 68" width="150" height="86" aria-hidden>
        <defs>
          <linearGradient id="adm-gauge-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1c4a3a" />
            <stop offset="60%" stopColor="#6c8a2c" />
            <stop offset="100%" stopColor="#ff5a2a" />
          </linearGradient>
        </defs>
        <path d="M14 60 A46 46 0 0 1 106 60" fill="none" stroke="rgba(19,19,16,.12)" strokeWidth="9" strokeLinecap="round" />
        <path
          d="M14 60 A46 46 0 0 1 106 60"
          fill="none"
          stroke="url(#adm-gauge-grad)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
        />
      </svg>
      <div className="adm-gauge__value">
        <b>{value}</b>
        <span>{label}</span>
      </div>
      <small>{sub}</small>
    </div>
  );
}

function RevenueChart({ series }: { series: AdminOverview["series"] }) {
  const max = Math.max(...series.map((point) => point.revenueCents), 1);
  const width = 320;
  const height = 72;
  const points = series.map((point, index) => {
    const x = (index / Math.max(1, series.length - 1)) * width;
    const y = height - (point.revenueCents / max) * (height - 8) - 4;
    return [x, y] as const;
  });
  const line = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="adm-line" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="adm-line-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff5a2a" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#ff5a2a" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${width},${height} L0,${height} Z`} fill="url(#adm-line-fill)" />
      <path d={line} fill="none" stroke="#1c4a3a" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function AdminDashboard({ locale, strings, email, role, canEconomy, canInbox, initial }: Props) {
  const [overview, setOverview] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/overview", { cache: "no-store" });
      if (res.ok) {
        const json = (await res.json()) as { overview: AdminOverview };
        if (json.overview) setOverview(json.overview);
      }
    } catch {
      /* behåll senaste vyn */
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(refresh, 30_000);
    return () => clearInterval(timer);
  }, [refresh]);

  const economy = overview.economy;
  const currency = economy.byCurrency[0]?.currency ?? "SEK";
  const maxGrade = Math.max(...overview.health.distribution.map((item) => item.count), 1);
  const spark = useMemo(() => overview.series.slice(-14), [overview.series]);

  return (
    <>
      <div className="adm-toolbar">
        <span className="adm-live">
          <i className="adm-pulse" /> {strings.adminLive} · {new Date(overview.generatedAt).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}
        </span>
        <span className="adm-role">{role}</span>
        <span className="adm-toolbar__email">{email}</span>
        <button className="adm-btn" type="button" onClick={refresh} disabled={refreshing}>
          {refreshing ? "…" : strings.statsRefresh}
        </button>
      </div>

      <section className="adm-hero">
        <div className="adm-tile">
          <span className="adm-eyebrow">{strings.adminHealth}</span>
          <Gauge value={overview.health.avg ?? 0} label="/100" sub={`${overview.counts.healthReports} ${strings.adminHealthReports.toLowerCase()}`} />
          <div className="adm-grades">
            {overview.health.distribution.map((item) => (
              <div key={item.grade} className="adm-grade">
                <span>{item.grade}</span>
                <i style={{ height: `${Math.max(3, (item.count / maxGrade) * 100)}%` }} />
                <small>{item.count}</small>
              </div>
            ))}
          </div>
        </div>

        {canEconomy && (
          <div className="adm-tile">
            <span className="adm-eyebrow">{strings.adminRevenue}</span>
            <div className="adm-metric">
              <b>{money(economy.totals.allTimeCents, currency)}</b>
              <span>
                {money(economy.totals.windowCents, currency)} · {strings.adminRevenue30}
              </span>
            </div>
            <RevenueChart series={spark} />
            <div className="adm-split">
              <span>
                <b>{economy.subscribers.active}</b>
                {strings.adminActive}
              </span>
              <span>
                <b>{economy.subscribers.trialing}</b>
                {strings.adminTrials}
              </span>
              <span>
                <b>{economy.totals.arpuCents === null ? "–" : money(economy.totals.arpuCents, currency)}</b>
                ARPU
              </span>
            </div>
          </div>
        )}

        <div className="adm-tile">
          <span className="adm-eyebrow">{strings.adminUsers}</span>
          <div className="adm-metric">
            <b>{overview.counts.users}</b>
            <span className="adm-up">
              +{overview.counts.newUsers7d} · {strings.adminNewUsers}
            </span>
          </div>
          <div className="adm-split">
            <span>
              <b>{overview.counts.trials}</b>
              {strings.adminTrials}
            </span>
            <span>
              <b>{overview.counts.active}</b>
              {strings.adminActive}
            </span>
            <span>
              <b>{overview.counts.shopifyConnected}</b>
              {strings.adminShopify}
            </span>
            <span>
              <b>{overview.referrals.total}</b>
              värvningar
            </span>
          </div>
        </div>

        <div className="adm-tile">
          <span className="adm-eyebrow">{strings.adminProjects}</span>
          <div className="adm-metric">
            <b>{overview.counts.projects}</b>
            <span>
              {overview.counts.publishedProjects} {strings.adminPublished.toLowerCase()} · {overview.counts.workspaces} {strings.adminWorkspaces.toLowerCase()}
            </span>
          </div>
          <div className="adm-split">
            <span>
              <b>{overview.systems.staff.active}</b> aktiv personal
            </span>
            <span>
              <b>{overview.systems.staff.invited}</b> inbjudna
            </span>
            <span>
              <b>{overview.counts.insights}</b> {strings.adminInsights.toLowerCase()}
            </span>
          </div>
        </div>
      </section>

      <section className="adm-grid">
        <div className="adm-panel">
          <div className="adm-panel__head">
            <span>{strings.adminLatestReports}</span>
            <small>{strings.adminHealthReports}</small>
          </div>
          {overview.health.latest.length === 0 && <p className="adm-empty">{strings.adminNoData}</p>}
          {overview.health.latest.map((report) => (
            <div key={`${report.project}-${report.createdAt}`} className="adm-report">
              <span className={`adm-score${report.score >= 80 ? " is-good" : report.score >= 60 ? " is-warn" : " is-bad"}`}>{report.score}</span>
              <div>
                <b>{report.project}</b>
                <small>{report.email}</small>
              </div>
              <span className="adm-time">{relative(report.createdAt)}</span>
            </div>
          ))}
        </div>

        <div className="adm-panel">
          <div className="adm-panel__head">
            <span>{strings.adminRecentUsers}</span>
            <small>{strings.adminNewUsers}</small>
          </div>
          {overview.recentUsers.map((user) => (
            <div key={user.email} className="adm-user">
              <span className="adm-avatar">{user.name.slice(0, 1).toUpperCase()}</span>
              <div>
                <b>{user.name}</b>
                <small>{user.email}</small>
              </div>
              <span className={`adm-plan is-${user.plan}`}>{user.plan}</span>
              <span className="adm-time">{relative(user.createdAt)}</span>
            </div>
          ))}
        </div>

        <div className="adm-panel">
          <div className="adm-panel__head">
            <span>{strings.adminTopProjects}</span>
            <small>{strings.adminPublished}</small>
          </div>
          {overview.topProjects.map((project) => (
            <div key={`${project.name}-${project.email}`} className="adm-project">
              <div>
                <b>{project.name}</b>
                <small>{project.email}</small>
              </div>
              {project.score !== null ? (
                <span className={`adm-score${project.score >= 80 ? " is-good" : project.score >= 60 ? " is-warn" : " is-bad"}`}>{project.score}</span>
              ) : (
                <span className="adm-score is-none">–</span>
              )}
              <span className="adm-time">{relative(project.updatedAt)}</span>
            </div>
          ))}
        </div>

        {canInbox && (
          <div className="adm-panel">
            <div className="adm-panel__head">
              <span>Inkorg</span>
              <small>{overview.inbox.unread} nya</small>
            </div>
            {overview.inbox.latest.length === 0 && <p className="adm-empty">Inga meddelanden ännu.</p>}
            {overview.inbox.latest.map((message) => (
              <div key={message.id} className="adm-rowitem">
                <span>{message.subject}</span>
                <b>{message.handled ? "klar" : "ny"}</b>
                <small>
                  {message.email} · {relative(message.createdAt)}
                </small>
              </div>
            ))}
            <Link className="adm-btn adm-btn--block" href={`/${locale}/admin/inbox`}>
              Öppna inkorgen
            </Link>
          </div>
        )}

        <div className="adm-panel adm-panel--systems">
          <div className="adm-panel__head">
            <span>{strings.adminSystems}</span>
            <small>{new Date(overview.generatedAt).toLocaleTimeString("sv-SE")}</small>
          </div>
          <div className="adm-sys">
            <span>Gemini</span>
            <b className={overview.systems.gemini ? "is-on" : "is-off"}>{overview.systems.gemini ? strings.adminConfigured : strings.adminMissing}</b>
            <small>{overview.systems.geminiModel}</small>
          </div>
          <div className="adm-sys">
            <span>Shopify App</span>
            <b className={overview.systems.shopify ? "is-on" : "is-off"}>{overview.systems.shopify ? strings.adminConfigured : strings.adminMissing}</b>
            <small>{overview.counts.shopifyConnected} kopplade</small>
          </div>
          <div className="adm-sys">
            <span>Stripe</span>
            <b className={overview.systems.stripe ? "is-on" : "is-off"}>{overview.systems.stripe ? strings.adminConfigured : strings.adminMissing}</b>
            <small>Checkout & webhook</small>
          </div>
          <div className="adm-sys">
            <span>PageSpeed</span>
            <b className={overview.systems.pageSpeedKey ? "is-on" : "is-off"}>{overview.systems.pageSpeedKey ? strings.adminConfigured : "publik kvot"}</b>
            <small>Lighthouse</small>
          </div>
          <Link className="adm-btn adm-btn--block" href={`/${locale}/admin/keys`}>
            Hantera API-nycklar
          </Link>
        </div>
      </section>

      <footer className="adm-foot">
        <span>ThemeFold control plane</span>
        <span>
          {strings.adminUpdated}: {new Date(overview.generatedAt).toLocaleString("sv-SE")}
        </span>
      </footer>
    </>
  );
}
