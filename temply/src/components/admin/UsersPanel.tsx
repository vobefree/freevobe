"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminUserDetail, AdminUserListRow } from "@/lib/admin/users";

type Props = {
  canManage: boolean;
  canManageStaff: boolean;
  isOwner: boolean;
  selfId: string;
  roles: { slug: string; label: string }[];
  grantable: string[];
};

export function UsersPanel({ canManage, canManageStaff, isOwner, selfId, roles, grantable }: Props) {
  const roleLabel = (slug: string | null) => (slug ? roles.find((role) => role.slug === slug)?.label ?? slug : "–");
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AdminUserListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/users?q=${encodeURIComponent(query)}&limit=100`, { cache: "no-store" });
    const json = (await res.json()) as { users: AdminUserListRow[]; total: number };
    setUsers(json.users ?? []);
    setTotal(json.total ?? 0);
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  const open = useCallback(async (id: string) => {
    setToast(null);
    setTempPassword(null);
    setConfirm("");
    const res = await fetch(`/api/admin/users?id=${id}`, { cache: "no-store" });
    if (res.ok) setDetail(((await res.json()) as { detail: AdminUserDetail }).detail);
  }, []);

  const patch = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!detail) return;
      setBusy(true);
      try {
        const res = await fetch("/api/admin/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: detail.user.id, ...payload }),
        });
        const json = (await res.json()) as { ok?: boolean; applied?: string[]; temporaryPassword?: string | null; error?: string };
        if (!res.ok) {
          setToast(`Kunde inte utföra: ${json.error ?? "fel"}`);
          return;
        }
        if (json.temporaryPassword) setTempPassword(json.temporaryPassword);
        setToast(`Utfört: ${(json.applied ?? []).join(", ")}`);
        await open(detail.user.id);
        await load();
      } finally {
        setBusy(false);
      }
    },
    [detail, load, open],
  );

  const remove = useCallback(async () => {
    if (!detail) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: detail.user.id, confirm }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setToast(`Kunde inte radera: ${json.error ?? "fel"}`);
        return;
      }
      setToast("Kontot är raderat.");
      setDetail(null);
      await load();
    } finally {
      setBusy(false);
    }
  }, [confirm, detail, load]);

  return (
    <section className="adm-section">
      <div className="adm-section__head">
        <div>
          <h2>Användare</h2>
          <p>{total} konton. Sök på e-post, namn eller butik.</p>
        </div>
        <input className="adm-input" value={query} placeholder="Sök…" onChange={(event) => setQuery(event.target.value)} />
      </div>

      {toast && <div className="adm-toast">{toast}</div>}

      <div className="adm-tablewrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>E-post</th>
              <th>Plan</th>
              <th>Roll</th>
              <th>Projekt</th>
              <th>Betalat</th>
              <th>Butik</th>
              <th>Skapad</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className={detail?.user.id === user.id ? "is-selected" : ""} onClick={() => void open(user.id)}>
                <td>
                  <b>{user.name}</b>
                  <small>{user.email}</small>
                </td>
                <td>
                  <span className={`adm-plan is-${user.plan}`}>{user.plan}</span>
                  {user.disabled ? <span className="adm-plan is-off">inaktiv</span> : null}
                </td>
                <td>{roleLabel(user.staffRole)}</td>
                <td>{user.projects}</td>
                <td>{Math.round(user.paidCents / 100).toLocaleString("sv-SE")}</td>
                <td>{user.shopifyShop ?? "–"}</td>
                <td>{new Date(user.createdAt).toLocaleDateString("sv-SE")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail && (
        <div className="adm-panel" style={{ marginTop: 14 }}>
          <div className="adm-panel__head">
            <span>
              {detail.user.name} · {detail.user.email}
            </span>
            <button className="adm-btn adm-btn--ghost" type="button" onClick={() => setDetail(null)}>
              Stäng
            </button>
          </div>

          <div className="adm-kpis">
            <div className="adm-kpi">
              <span>Plan</span>
              <b>{detail.user.plan_status}</b>
              <small>Provperiod till {new Date(detail.user.trial_ends_at).toLocaleDateString("sv-SE")}</small>
            </div>
            <div className="adm-kpi">
              <span>Projekt</span>
              <b>{detail.projects.length}</b>
              <small>{detail.projects.filter((project) => project.last_published_at).length} publicerade</small>
            </div>
            <div className="adm-kpi">
              <span>Betalningar</span>
              <b>{detail.payments.length}</b>
              <small>{detail.payments[0] ? new Date(detail.payments[0].created_at).toLocaleDateString("sv-SE") : "–"}</small>
            </div>
            <div className="adm-kpi">
              <span>Roll</span>
              <b>{detail.staff ? roleLabel(detail.staff.role) : "kund"}</b>
              <small>{detail.staff?.status ?? "–"}</small>
            </div>
          </div>

          {canManageStaff && (
            <div className="adm-actions">
              <label className="adm-field">
                <span>Personalroll</span>
                <select
                  className="adm-input"
                  value={detail.staff?.role ?? ""}
                  disabled={busy || (detail.staff ? !grantable.includes(detail.staff.role) : false)}
                  onChange={(event) => void patch({ staffRole: event.target.value || null })}
                >
                  <option value="">Ingen roll – vanligt kundkonto</option>
                  {grantable.map((slug) => (
                    <option key={slug} value={slug}>
                      {roleLabel(slug)}
                    </option>
                  ))}
                  {detail.staff && !grantable.includes(detail.staff.role) && (
                    <option value={detail.staff.role}>{roleLabel(detail.staff.role)}</option>
                  )}
                </select>
                <small>Ger kontot åtkomst till adminpanelen direkt – ingen inbjudan behövs.</small>
              </label>
            </div>
          )}

          {canManage ? (
            <div className="adm-actions">
              <label className="adm-field">
                <span>Plan</span>
                <select
                  className="adm-input"
                  value={detail.user.plan_status}
                  disabled={busy}
                  onChange={(event) => void patch({ plan: event.target.value })}
                >
                  <option value="trialing">trialing</option>
                  <option value="active">active</option>
                  <option value="canceled">canceled</option>
                </select>
              </label>
              <button className="adm-btn" type="button" disabled={busy} onClick={() => void patch({ extendTrialDays: 30 })}>
                Förläng prov 30 dagar
              </button>
              <button className="adm-btn" type="button" disabled={busy} onClick={() => void patch({ resetPassword: true })}>
                Nytt tillfälligt lösenord
              </button>
              <button className="adm-btn" type="button" disabled={busy} onClick={() => void patch({ disconnectShopify: true })}>
                Koppla från Shopify
              </button>
              <button
                className="adm-btn"
                type="button"
                disabled={busy || detail.user.id === selfId}
                onClick={() => void patch({ disabled: !detail.user.disabled })}
              >
                {detail.user.disabled ? "Aktivera konto" : "Inaktivera konto"}
              </button>
            </div>
          ) : (
            <p className="adm-empty">Din roll får se användare men inte ändra dem.</p>
          )}

          {tempPassword && (
            <div className="adm-secret">
              <b>Tillfälligt lösenord (visas bara nu)</b>
              <code>{tempPassword}</code>
              <small>Be användaren byta lösenord efter inloggning.</small>
            </div>
          )}

          {isOwner && canManage && detail.user.id !== selfId && (
            <div className="adm-danger">
              <b>Radera konto</b>
              <p>Tar bort kontot med projekt, versioner och betalningshistorik. Skriv e-postadressen för att bekräfta.</p>
              <div className="adm-row">
                <input className="adm-input" value={confirm} placeholder={detail.user.email} onChange={(event) => setConfirm(event.target.value)} />
                <button
                  className="adm-btn adm-btn--danger"
                  type="button"
                  disabled={busy || confirm.trim().toLowerCase() !== detail.user.email.toLowerCase()}
                  onClick={() => void remove()}
                >
                  Radera
                </button>
              </div>
            </div>
          )}

          {detail.projects.length > 0 && (
            <>
              <div className="adm-panel__head" style={{ marginTop: 14 }}>
                <span>Projekt</span>
              </div>
              {detail.projects.map((project) => (
                <div key={project.id} className="adm-rowitem">
                  <span>{project.name}</span>
                  <b>{project.health === null ? "–" : project.health}</b>
                  <small>
                    {project.last_published_at ? `publicerad ${new Date(project.last_published_at).toLocaleDateString("sv-SE")}` : "ej publicerad"} ·{" "}
                    <a href={`/api/admin/projects/${project.id}/export`}>ladda ner</a>
                  </small>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </section>
  );
}
