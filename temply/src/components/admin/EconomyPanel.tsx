"use client";

import { useCallback, useEffect, useState } from "react";
import type { EconomyReport } from "@/lib/admin/economy";
import type { ReferralAdminRow, ReferralAdminStats } from "@/lib/referrals";

function money(cents: number, currency = "SEK"): string {
  try {
    return new Intl.NumberFormat("sv-SE", { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);
  } catch {
    return `${Math.round(cents / 100).toLocaleString("sv-SE")} ${currency}`;
  }
}

function delta(before: number, after: number): string | null {
  if (!before) return null;
  return `${after >= before ? "+" : ""}${Math.round(((after - before) / before) * 1000) / 10}%`;
}

export function EconomyPanel({ canManage }: { canManage: boolean }) {
  const [days, setDays] = useState(30);
  const [report, setReport] = useState<EconomyReport | null>(null);
  const [referrals, setReferrals] = useState<ReferralAdminStats | null>(null);
  const [latestReferrals, setLatestReferrals] = useState<ReferralAdminRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (window: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/economy?days=${window}`, { cache: "no-store" });
      if (res.ok) {
        const json = (await res.json()) as {
          report: EconomyReport;
          referrals?: ReferralAdminStats;
          latestReferrals?: ReferralAdminRow[];
        };
        setReport(json.report);
        if (json.referrals) setReferrals(json.referrals);
        if (json.latestReferrals) setLatestReferrals(json.latestReferrals);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(days);
  }, [days, load]);

  const currency = report?.byCurrency[0]?.currency ?? "SEK";
  const maxDay = Math.max(...(report?.series.map((point) => point.cents) ?? [0]), 1);

  return (
    <section className="adm-section">
      <div className="adm-section__head">
        <div>
          <h2>Ekonomi</h2>
          <p>Intäkter, abonnemang, konvertering och betalningar – samma siffror som faktureringen.</p>
        </div>
        <div className="adm-row">
          {[7, 30, 90, 365].map((window) => (
            <button key={window} className={`adm-chip${days === window ? " is-active" : ""}`} type="button" onClick={() => setDays(window)}>
              {window} d
            </button>
          ))}
          <a className="adm-btn" href="/api/admin/economy?format=csv">
            CSV
          </a>
        </div>
      </div>

      {loading && !report && <p className="adm-empty">Hämtar…</p>}

      {report && (
        <>
          <div className="adm-kpis">
            <div className="adm-kpi">
              <span>Intäkter {report.windowDays} d</span>
              <b>{money(report.totals.windowCents, currency)}</b>
              <small>{delta(report.totals.previousWindowCents, report.totals.windowCents) ?? "–"} mot föregående period</small>
            </div>
            <div className="adm-kpi">
              <span>Totalt</span>
              <b>{money(report.totals.allTimeCents, currency)}</b>
              <small>{report.totals.paidCount} betalningar i perioden</small>
            </div>
            <div className="adm-kpi">
              <span>ARPU</span>
              <b>{report.totals.arpuCents === null ? "–" : money(report.totals.arpuCents, currency)}</b>
              <small>{report.subscribers.active} betalande konton</small>
            </div>
            <div className="adm-kpi">
              <span>Betalande andel</span>
              <b>{report.subscribers.payingShare === null ? "–" : `${report.subscribers.payingShare}%`}</b>
              <small>
                {report.subscribers.trialing} prov · {report.subscribers.canceled} avslutade
              </small>
            </div>
            <div className="adm-kpi">
              <span>Nya → betalande</span>
              <b>{report.conversion.trialToPaid === null ? "–" : `${report.conversion.trialToPaid}%`}</b>
              <small>
                {report.conversion.payingUsers} betalande av {report.conversion.newUsers} nya
              </small>
            </div>
            <div className="adm-kpi">
              <span>Projekt</span>
              <b>
                {report.projects.published}/{report.projects.total}
              </b>
              <small>publicerade teman</small>
            </div>
          </div>

          <div className="adm-panel">
            <div className="adm-panel__head">
              <span>Intäkter per dag</span>
              <small>{report.windowDays} dagar</small>
            </div>
            <div className="adm-daybars">
              {report.series.map((point) => (
                <div key={point.date} className="adm-daybar" title={`${point.date}: ${money(point.cents, currency)} (${point.count})`}>
                  <i style={{ height: `${Math.max(2, (point.cents / maxDay) * 100)}%` }} />
                </div>
              ))}
            </div>
          </div>

          <div className="adm-grid adm-grid--two">
            <div className="adm-panel">
              <div className="adm-panel__head">
                <span>Per valuta</span>
                <small>{report.byCurrency.length}</small>
              </div>
              {report.byCurrency.length === 0 && <p className="adm-empty">Inga betalningar ännu.</p>}
              {report.byCurrency.map((row) => (
                <div key={row.currency} className="adm-rowitem">
                  <span>{row.currency}</span>
                  <b>{money(row.cents, row.currency)}</b>
                  <small>{row.count} st</small>
                </div>
              ))}
              <div className="adm-panel__head" style={{ marginTop: 12 }}>
                <span>Per leverantör</span>
              </div>
              {report.byProvider.length === 0 && <p className="adm-empty">–</p>}
              {report.byProvider.map((row) => (
                <div key={row.provider} className="adm-rowitem">
                  <span>{row.provider}</span>
                  <b>{money(row.cents, currency)}</b>
                  <small>{row.count} st</small>
                </div>
              ))}
              <div className="adm-panel__head" style={{ marginTop: 12 }}>
                <span>Konto-planer</span>
              </div>
              {report.plans.map((row) => (
                <div key={row.plan} className="adm-rowitem">
                  <span>{row.plan}</span>
                  <b>{row.users}</b>
                </div>
              ))}
              {report.agencies.length > 0 && (
                <>
                  <div className="adm-panel__head" style={{ marginTop: 12 }}>
                    <span>Byråplaner</span>
                  </div>
                  {report.agencies.map((row) => (
                    <div key={row.plan} className="adm-rowitem">
                      <span>{row.plan}</span>
                      <b>{row.workspaces}</b>
                    </div>
                  ))}
                </>
              )}
            </div>

            <div className="adm-panel">
              <div className="adm-panel__head">
                <span>Senaste betalningar</span>
                <small>{report.latest.length}</small>
              </div>
              {report.latest.length === 0 && <p className="adm-empty">Inga betalningar registrerade.</p>}
              {report.latest.map((payment) => (
                <div key={payment.id} className="adm-rowitem">
                  <span>{payment.email}</span>
                  <b>{money(payment.amountCents, payment.currency.toUpperCase())}</b>
                  <small>
                    {payment.provider} · {payment.status} · {new Date(payment.createdAt).toLocaleDateString("sv-SE")}
                  </small>
                </div>
              ))}
              {report.subscribers.disabled > 0 && (
                <p className="adm-empty" style={{ marginTop: 10 }}>
                  {report.subscribers.disabled} inaktiverade konton
                </p>
              )}
              {!canManage && <p className="adm-empty">Din roll kan se ekonomin men inte ändra planer.</p>}
            </div>
          </div>

          {referrals && (
            <div className="adm-panel" style={{ marginTop: 14 }}>
              <div className="adm-panel__head">
                <span>Värvning</span>
                <small>
                  {referrals.config.enabled ? "aktiv" : "pausad"} · belöning först vid betalning
                </small>
              </div>
              <div className="adm-kpis">
                <div className="adm-kpi">
                  <span>Inbjudna</span>
                  <b>{referrals.total}</b>
                  <small>{referrals.pending} väntar på betalning</small>
                </div>
                <div className="adm-kpi">
                  <span>Belönade</span>
                  <b>{referrals.rewarded}</b>
                  <small>{referrals.rewardDaysGiven} gratisdagar utbetalade</small>
                </div>
                <div className="adm-kpi">
                  <span>Tak nått</span>
                  <b>{referrals.capped}</b>
                  <small>{referrals.config.maxRewards} belöningar per konto</small>
                </div>
                <div className="adm-kpi">
                  <span>Provdagar givna</span>
                  <b>{referrals.bonusDaysGiven}</b>
                  <small>{referrals.config.trialBonusDays} dagar per inbjuden</small>
                </div>
              </div>

              {referrals.topInviters.length > 0 && (
                <>
                  <div className="adm-panel__head">
                    <span>Flitigaste värvarna</span>
                  </div>
                  {referrals.topInviters.map((inviter) => (
                    <div key={inviter.email} className="adm-rowitem">
                      <span>{inviter.email}</span>
                      <b>{inviter.rewarded}/{inviter.invited}</b>
                      <small>belönade av inbjudna</small>
                    </div>
                  ))}
                </>
              )}

              {latestReferrals.length > 0 && (
                <>
                  <div className="adm-panel__head" style={{ marginTop: 12 }}>
                    <span>Senaste inbjudningar</span>
                    <small>{latestReferrals.length}</small>
                  </div>
                  {latestReferrals.map((row) => (
                    <div key={row.id} className="adm-rowitem">
                      <span>
                        {row.inviterEmail} → {row.inviteeEmail}
                      </span>
                      <b>{row.status === "rewarded" ? `+${row.rewardDays} d` : row.status}</b>
                      <small>{new Date(row.createdAt).toLocaleDateString("sv-SE")}</small>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
