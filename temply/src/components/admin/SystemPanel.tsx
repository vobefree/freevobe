"use client";

import { useCallback, useEffect, useState } from "react";

type Checks = {
  db: { ok: boolean; sizeKb: number | null; counts: Record<string, number> };
  runtime: { node: string; env: string; appUrl: string | null; uptimeSec: number };
  services: Record<string, boolean | string>;
  staff: { owners: number; rows: number };
  settingsOverview: { name: string; group: string; label: string; configured: boolean; source: string; updatedAt: string | null; updatedBy: string | null }[];
};

type Site = { signups: boolean; trialDays: number; supportEmail: string; announcement: string };
type Referral = { enabled: boolean; trialBonusDays: number; rewardDays: number; maxRewards: number };

export function SystemPanel({ canManage, initial }: { canManage: boolean; initial: { checks: Checks; site: Site; referral: Referral } }) {
  const [checks, setChecks] = useState(initial.checks);
  const [site, setSite] = useState(initial.site);
  const [referral, setReferral] = useState(initial.referral);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/system", { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json()) as { checks: Checks; site: Site; referral?: Referral };
    setChecks(json.checks);
    setSite(json.site);
    if (json.referral) setReferral(json.referral);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/system", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flags: {
            SITE_SIGNUPS: site.signups ? "1" : "0",
            SITE_TRIAL_DAYS: String(site.trialDays),
            SITE_SUPPORT_EMAIL: site.supportEmail,
            SITE_ANNOUNCEMENT: site.announcement,
            REFERRAL_ENABLED: referral.enabled ? "1" : "0",
            REFERRAL_TRIAL_BONUS_DAYS: String(referral.trialBonusDays),
            REFERRAL_REWARD_DAYS: String(referral.rewardDays),
            REFERRAL_MAX_REWARDS: String(referral.maxRewards),
          },
        }),
      });
      const json = (await res.json()) as { ok?: boolean; site?: Site; referral?: Referral; error?: string };
      if (!res.ok) {
        setToast(`Kunde inte spara: ${json.error ?? "fel"}`);
        return;
      }
      if (json.site) setSite(json.site);
      if (json.referral) setReferral(json.referral);
      setToast("Inställningarna är sparade och aktiva direkt.");
    } finally {
      setBusy(false);
    }
  }, [site, referral]);

  const uptimeMinutes = Math.round(checks.runtime.uptimeSec / 60);

  return (
    <section className="adm-section">
      <div className="adm-section__head">
        <div>
          <h2>System</h2>
          <p>Driftstatus, databasen och sajtens regler – registrering, provperiod och meddelande till användarna.</p>
        </div>
        <button className="adm-btn" type="button" onClick={() => void load()}>
          Kör kontroll igen
        </button>
      </div>

      {toast && <div className="adm-toast">{toast}</div>}

      <div className="adm-kpis">
        <div className="adm-kpi">
          <span>Databas</span>
          <b>{checks.db.ok ? "ok" : "fel"}</b>
          <small>{checks.db.sizeKb === null ? "–" : `${checks.db.sizeKb} kB`}</small>
        </div>
        <div className="adm-kpi">
          <span>Konton</span>
          <b>{checks.db.counts.users}</b>
          <small>{checks.db.counts.payments} betalningar</small>
        </div>
        <div className="adm-kpi">
          <span>Projekt</span>
          <b>{checks.db.counts.projects}</b>
          <small>{checks.db.counts.healthRuns} health-körningar</small>
        </div>
        <div className="adm-kpi">
          <span>Personal</span>
          <b>{checks.staff.rows}</b>
          <small>{checks.staff.owners} ägare</small>
        </div>
        <div className="adm-kpi">
          <span>Uptime</span>
          <b>{uptimeMinutes} min</b>
          <small>
            Node {checks.runtime.node} · {checks.runtime.env}
          </small>
        </div>
        <div className="adm-kpi">
          <span>Logg</span>
          <b>{checks.db.counts.auditRows}</b>
          <small>händelser i audit-loggen</small>
        </div>
      </div>

      <div className="adm-grid adm-grid--two">
        <div className="adm-panel">
          <div className="adm-panel__head">
            <span>Tjänster</span>
            <small>nyckelkälla</small>
          </div>
          {Object.entries(checks.services).map(([name, value]) => (
            <div key={name} className="adm-sys">
              <span>{name}</span>
              <b className={value ? "is-on" : "is-off"}>{typeof value === "string" ? value : value ? "satt" : "saknas"}</b>
            </div>
          ))}
          <div className="adm-sys">
            <span>Publik adress</span>
            <b className="is-on">{checks.runtime.appUrl ?? "localhost"}</b>
          </div>
        </div>

        <div className="adm-panel">
          <div className="adm-panel__head">
            <span>Värvning</span>
            <small>{canManage ? "kan ändras" : "läsbar"}</small>
          </div>
          <label className="adm-field">
            <span>Värvningsprogram</span>
            <select
              className="adm-input"
              value={referral.enabled ? "1" : "0"}
              disabled={!canManage}
              onChange={(event) => setReferral({ ...referral, enabled: event.target.value === "1" })}
            >
              <option value="1">På – inbjudningar belönas</option>
              <option value="0">Av – inga nya belöningar</option>
            </select>
          </label>
          <label className="adm-field">
            <span>Extra provdagar till den inbjudne</span>
            <input
              className="adm-input"
              type="number"
              min={0}
              max={60}
              value={referral.trialBonusDays}
              disabled={!canManage}
              onChange={(event) => setReferral({ ...referral, trialBonusDays: Number(event.target.value) || 0 })}
            />
          </label>
          <label className="adm-field">
            <span>Gratisdagar till den som bjuder in</span>
            <input
              className="adm-input"
              type="number"
              min={0}
              max={180}
              value={referral.rewardDays}
              disabled={!canManage}
              onChange={(event) => setReferral({ ...referral, rewardDays: Number(event.target.value) || 0 })}
            />
          </label>
          <label className="adm-field">
            <span>Tak: max belöningar per konto</span>
            <input
              className="adm-input"
              type="number"
              min={1}
              max={50}
              value={referral.maxRewards}
              disabled={!canManage}
              onChange={(event) => setReferral({ ...referral, maxRewards: Number(event.target.value) || 1 })}
            />
            <small>Belöningen betalas ut först när den inbjudne blir betalande kund.</small>
          </label>
        </div>

        <div className="adm-panel">
          <div className="adm-panel__head">
            <span>Sajt & drift</span>
            <small>{canManage ? "kan ändras" : "läsbar"}</small>
          </div>
          <label className="adm-field">
            <span>Registrering öppen</span>
            <select
              className="adm-input"
              value={site.signups ? "1" : "0"}
              disabled={!canManage}
              onChange={(event) => setSite({ ...site, signups: event.target.value === "1" })}
            >
              <option value="1">Ja – nya konton tillåts</option>
              <option value="0">Nej – stängd för nya konton</option>
            </select>
          </label>
          <label className="adm-field">
            <span>Provperiod (dagar)</span>
            <input
              className="adm-input"
              type="number"
              min={1}
              max={90}
              value={site.trialDays}
              disabled={!canManage}
              onChange={(event) => setSite({ ...site, trialDays: Number(event.target.value) || 3 })}
            />
          </label>
          <label className="adm-field">
            <span>Supportadress</span>
            <input className="adm-input" value={site.supportEmail} disabled={!canManage} onChange={(event) => setSite({ ...site, supportEmail: event.target.value })} />
          </label>
          <label className="adm-field">
            <span>Meddelande på dashboarden</span>
            <textarea
              className="adm-input"
              rows={3}
              value={site.announcement}
              disabled={!canManage}
              placeholder="Visas för alla inloggade användare"
              onChange={(event) => setSite({ ...site, announcement: event.target.value })}
            />
          </label>
          {canManage ? (
            <button className="adm-btn" type="button" disabled={busy} onClick={() => void save()}>
              Spara sajtinställningar
            </button>
          ) : (
            <p className="adm-empty">Din roll kan se men inte ändra driftinställningar.</p>
          )}
        </div>
      </div>

      <div className="adm-panel">
        <div className="adm-panel__head">
          <span>Alla nycklar</span>
          <small>{checks.settingsOverview.filter((item) => item.configured).length} satta</small>
        </div>
        <div className="adm-tablewrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Namn</th>
                <th>Grupp</th>
                <th>Status</th>
                <th>Uppdaterad</th>
              </tr>
            </thead>
            <tbody>
              {checks.settingsOverview.map((item) => (
                <tr key={item.name}>
                  <td>
                    <b>{item.label}</b>
                    <small>{item.name}</small>
                  </td>
                  <td>{item.group}</td>
                  <td>
                    <span className={`adm-plan is-${item.configured ? "active" : "off"}`}>{item.source === "db" ? "panel" : item.source}</span>
                  </td>
                  <td>{item.updatedAt ? `${new Date(item.updatedAt).toLocaleDateString("sv-SE")} · ${item.updatedBy ?? "–"}` : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
