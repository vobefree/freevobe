"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RoleDefinition } from "@/lib/admin/permissions";
import { RolesPanel } from "./RolesPanel";

type StaffRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: "invited" | "active" | "suspended";
  created_at: string;
  accepted_at: string | null;
  last_seen_at: string | null;
};

type Props = {
  canManage: boolean;
  canManageRoles: boolean;
  roles: RoleDefinition[];
  grantable: string[];
};

export function StaffPanel({ canManage, canManageRoles, roles: initialRoles, grantable }: Props) {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [owners, setOwners] = useState<string[]>([]);
  const [roles, setRoles] = useState(initialRoles);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<string>("");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const options = useMemo(
    () => roles.filter((item) => item.slug !== "owner" && grantable.includes(item.slug)),
    [roles, grantable],
  );
  const labelFor = useCallback((slug: string) => roles.find((item) => item.slug === slug)?.label ?? slug, [roles]);

  useEffect(() => {
    if (!role && options.length > 0) setRole(options[0].slug);
  }, [options, role]);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/staff", { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json()) as { staff: StaffRow[]; owners: string[]; roles?: RoleDefinition[] };
    setStaff(json.staff ?? []);
    setOwners(json.owners ?? []);
    if (json.roles) setRoles(json.roles);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const invite = useCallback(async () => {
    setBusy(true);
    setToast(null);
    setInviteUrl(null);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, role }),
      });
      const json = (await res.json()) as { inviteUrl?: string; error?: string };
      if (!res.ok || !json.inviteUrl) {
        setToast(`Kunde inte bjuda in: ${json.error ?? "fel"}`);
        return;
      }
      setInviteUrl(json.inviteUrl);
      setEmail("");
      setName("");
      await load();
    } finally {
      setBusy(false);
    }
  }, [email, name, role, load]);

  const update = useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      setBusy(true);
      try {
        const res = await fetch("/api/admin/staff", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...patch }),
        });
        const json = (await res.json()) as { inviteUrl?: string; error?: string };
        if (!res.ok) {
          setToast(`Kunde inte uppdatera: ${json.error ?? "fel"}`);
          return;
        }
        if (json.inviteUrl) setInviteUrl(json.inviteUrl);
        setToast("Sparat.");
        await load();
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const remove = useCallback(
    async (id: string) => {
      setBusy(true);
      try {
        await fetch("/api/admin/staff", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        setToast("Borttagen.");
        await load();
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  return (
    <section className="adm-section">
      <div className="adm-section__head">
        <div>
          <h2>Personal</h2>
          <p>
            Bjud in anställda med roll. Rollen styr vilka delar av panelen de kommer åt – allt annat är dolt. Nya roller skapas i
            rollmatrisen nedanför.
          </p>
        </div>
      </div>

      {toast && <div className="adm-toast">{toast}</div>}

      <div className="adm-panel">
        <div className="adm-panel__head">
          <span>Ägare (via ADMIN_EMAILS)</span>
          <small>{owners.length}</small>
        </div>
        {owners.map((owner) => (
          <div key={owner} className="adm-rowitem">
            <span>{owner}</span>
            <b>Ägare</b>
            <small>full kontroll – kan inte tas bort härifrån</small>
          </div>
        ))}
      </div>

      {canManage && (
        <div className="adm-panel">
          <div className="adm-panel__head">
            <span>Bjud in</span>
            <small>länken skickas manuellt</small>
          </div>
          <div className="adm-actions">
            <label className="adm-field">
              <span>E-post</span>
              <input className="adm-input" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="namn@byran.se" />
            </label>
            <label className="adm-field">
              <span>Namn</span>
              <input className="adm-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Förnamn Efternamn" />
            </label>
            <label className="adm-field">
              <span>Roll</span>
              <select className="adm-input" value={role} onChange={(event) => setRole(event.target.value)}>
                {options.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <button className="adm-btn" type="button" disabled={busy || !email.trim() || !role} onClick={() => void invite()}>
              Skapa inbjudan
            </button>
          </div>
          <p className="adm-empty">{roles.find((item) => item.slug === role)?.description ?? "Rollens behörigheter syns i matrisen."}</p>
          {inviteUrl && (
            <div className="adm-secret">
              <b>Inbjudningslänk</b>
              <code>{inviteUrl}</code>
              <small>Länken är personlig och slutar fungera när kontot har aktiverats.</small>
            </div>
          )}
        </div>
      )}

      <div className="adm-tablewrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Namn</th>
              <th>Roll</th>
              <th>Status</th>
              <th>Senast inne</th>
              <th>Åtgärder</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((row) => (
              <tr key={row.id}>
                <td>
                  <b>{row.name || row.email.split("@")[0]}</b>
                  <small>{row.email}</small>
                </td>
                <td>
                  {canManage ? (
                    <select
                      className="adm-input adm-input--sm"
                      value={row.role}
                      disabled={busy || !grantable.includes(row.role)}
                      onChange={(event) => void update(row.id, { role: event.target.value })}
                    >
                      {options.map((item) => (
                        <option key={item.slug} value={item.slug}>
                          {item.label}
                        </option>
                      ))}
                      {!grantable.includes(row.role) && <option value={row.role}>{labelFor(row.role)}</option>}
                    </select>
                  ) : (
                    labelFor(row.role)
                  )}
                </td>
                <td>
                  <span className={`adm-plan is-${row.status === "active" ? "active" : row.status === "invited" ? "trialing" : "off"}`}>{row.status}</span>
                </td>
                <td>{row.last_seen_at ? new Date(row.last_seen_at).toLocaleString("sv-SE") : "–"}</td>
                <td>
                  {canManage && (
                    <div className="adm-row">
                      {row.status !== "suspended" ? (
                        <button className="adm-btn adm-btn--sm" type="button" disabled={busy} onClick={() => void update(row.id, { status: "suspended" })}>
                          Stäng av
                        </button>
                      ) : (
                        <button className="adm-btn adm-btn--sm" type="button" disabled={busy} onClick={() => void update(row.id, { status: "active" })}>
                          Aktivera
                        </button>
                      )}
                      <button className="adm-btn adm-btn--sm" type="button" disabled={busy} onClick={() => void update(row.id, { reissue: true })}>
                        Ny länk
                      </button>
                      <button className="adm-btn adm-btn--sm adm-btn--danger" type="button" disabled={busy} onClick={() => void remove(row.id)}>
                        Ta bort
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {staff.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <p className="adm-empty">Ingen personal inbjuden ännu.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <RolesPanel canManage={canManageRoles} initialRoles={roles} onRolesChange={setRoles} />
    </section>
  );
}
