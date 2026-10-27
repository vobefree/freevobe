"use client";

import { useCallback, useMemo, useState } from "react";
import {
  PERMISSIONS,
  PERMISSION_GROUPS,
  PERMISSION_META,
  RESERVED_ROLE,
  type Permission,
  type RoleDefinition,
} from "@/lib/admin/permissions";

type Draft = { slug: string | null; label: string; description: string; permissions: Permission[] };

type Props = { canManage: boolean; initialRoles: RoleDefinition[]; onRolesChange?: (roles: RoleDefinition[]) => void };

const EMPTY: Draft = { slug: null, label: "", description: "", permissions: ["overview.view"] };

/**
 * Rollmatrisen: varje roll är en kombination av behörigheter. Ägaren kan skapa
 * nya roller och justera de inbyggda, så panelen kan växa med teamet.
 */
export function RolesPanel({ canManage, initialRoles, onRolesChange }: Props) {
  const [roles, setRoles] = useState(initialRoles);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const startEdit = useCallback((role: RoleDefinition) => {
    setToast(null);
    setDraft({ slug: role.slug, label: role.label, description: role.description, permissions: [...role.permissions] });
  }, []);

  const toggle = useCallback((permission: Permission) => {
    setDraft((current) => {
      if (!current) return current;
      const has = current.permissions.includes(permission);
      return { ...current, permissions: has ? current.permissions.filter((item) => item !== permission) : [...current.permissions, permission] };
    });
  }, []);

  const save = useCallback(async () => {
    if (!draft) return;
    if (!draft.label.trim()) {
      setToast("Rollen behöver ett namn.");
      return;
    }
    setBusy(true);
    setToast(null);
    try {
      const res = await fetch("/api/admin/roles", {
        method: draft.slug ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: draft.slug ?? undefined,
          label: draft.label,
          description: draft.description,
          permissions: draft.permissions,
        }),
      });
      const json = (await res.json()) as { roles?: RoleDefinition[]; error?: string };
      if (!res.ok) {
        setToast(`Kunde inte spara: ${json.error ?? "fel"}`);
        return;
      }
      if (json.roles) {
        setRoles(json.roles);
        onRolesChange?.(json.roles);
      }
      setDraft(null);
      setToast(draft.slug ? "Rollen är uppdaterad. Nya behörigheter gäller direkt." : "Rollen är skapad och kan delas ut.");
    } finally {
      setBusy(false);
    }
  }, [draft, onRolesChange]);

  const remove = useCallback(
    async (role: RoleDefinition) => {
      if (!window.confirm(`Ta bort rollen ${role.label}?`)) return;
      setBusy(true);
      try {
        const res = await fetch("/api/admin/roles", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: role.slug }),
        });
        const json = (await res.json()) as { roles?: RoleDefinition[]; error?: string };
        if (!res.ok) {
          setToast(
            json.error === "role_in_use"
              ? "Rollen används av personal och kan inte tas bort. Byt roll på dem först."
              : `Kunde inte ta bort: ${json.error ?? "fel"}`,
          );
          return;
        }
        if (json.roles) {
          setRoles(json.roles);
          onRolesChange?.(json.roles);
        }
        setToast("Rollen är borttagen.");
      } finally {
        setBusy(false);
      }
    },
    [onRolesChange],
  );

  const matrix = useMemo(
    () =>
      PERMISSION_GROUPS.map((group) => ({
        ...group,
        permissions: PERMISSIONS.filter((permission) => PERMISSION_META[permission].group === group.id),
      })),
    [],
  );

  return (
    <div className="adm-panel">
      <div className="adm-panel__head">
        <span>Roller & behörigheter</span>
        {canManage ? (
          <button className="adm-btn adm-btn--sm" type="button" disabled={busy} onClick={() => setDraft({ ...EMPTY })}>
            Ny roll
          </button>
        ) : (
          <small>endast ägaren kan ändra</small>
        )}
      </div>

      {toast && <div className="adm-toast">{toast}</div>}

      {roles.map((role) => {
        const locked = role.slug === RESERVED_ROLE;
        const isEditing = draft?.slug === role.slug;
        return (
          <div key={role.slug} className="adm-rolecard">
            <div className="adm-rolecard__head">
              <div>
                <b>{role.label}</b>
                <small>
                  {role.description || "Ingen beskrivning"} · {role.permissions.length} av {PERMISSIONS.length} behörigheter
                </small>
              </div>
              <div className="adm-row">
                {role.system && <span className="adm-badge">inbyggd</span>}
                {locked ? (
                  <span className="adm-badge is-db">låst</span>
                ) : canManage ? (
                  <>
                    <button className="adm-btn adm-btn--sm" type="button" disabled={busy} onClick={() => startEdit(role)}>
                      Redigera
                    </button>
                    {!role.system && (
                      <button className="adm-btn adm-btn--sm adm-btn--danger" type="button" disabled={busy} onClick={() => void remove(role)}>
                        Ta bort
                      </button>
                    )}
                  </>
                ) : null}
              </div>
            </div>
            {!isEditing && (
              <div className="adm-permlist">
                {role.permissions.length === 0 && <small>Inga behörigheter.</small>}
                {role.permissions.map((permission) => (
                  <span key={permission} className="adm-permtag">
                    {PERMISSION_META[permission].label}
                  </span>
                ))}
              </div>
            )}
            {isEditing && draft && (
              <div className="adm-roleditor">
                <div className="adm-actions">
                  <label className="adm-field">
                    <span>Namn</span>
                    <input className="adm-input" value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} />
                  </label>
                  <label className="adm-field" style={{ flex: 1 }}>
                    <span>Beskrivning</span>
                    <input
                      className="adm-input"
                      value={draft.description}
                      placeholder="Vad rollen ansvarar för"
                      onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                    />
                  </label>
                </div>
                <div className="adm-permgrid">
                  {matrix.map((group) => (
                    <div key={group.id} className="adm-permgroup">
                      <span className="adm-permgroup__title">{group.label}</span>
                      {group.permissions.map((permission) => (
                        <label key={permission} className="adm-permtoggle">
                          <input
                            type="checkbox"
                            checked={draft.permissions.includes(permission)}
                            onChange={() => toggle(permission)}
                          />
                          <span>
                            {PERMISSION_META[permission].label}
                            <small>{PERMISSION_META[permission].description}</small>
                          </span>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="adm-row">
                  <button className="adm-btn" type="button" disabled={busy} onClick={() => void save()}>
                    {busy ? "Sparar…" : "Spara rollen"}
                  </button>
                  <button className="adm-btn adm-btn--ghost" type="button" disabled={busy} onClick={() => setDraft(null)}>
                    Avbryt
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {draft && draft.slug === null && (
        <div className="adm-rolecard is-new">
          <div className="adm-rolecard__head">
            <div>
              <b>Ny roll</b>
              <small>Välj vad rollen får göra. Behörigheterna gäller direkt när rollen delas ut.</small>
            </div>
          </div>
          <div className="adm-roleditor">
            <div className="adm-actions">
              <label className="adm-field">
                <span>Namn</span>
                <input
                  className="adm-input"
                  value={draft.label}
                  placeholder="T.ex. SEO-specialist"
                  onChange={(event) => setDraft({ ...draft, label: event.target.value })}
                />
              </label>
              <label className="adm-field" style={{ flex: 1 }}>
                <span>Beskrivning</span>
                <input
                  className="adm-input"
                  value={draft.description}
                  placeholder="Vad rollen ansvarar för"
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                />
              </label>
            </div>
            <div className="adm-permgrid">
              {matrix.map((group) => (
                <div key={group.id} className="adm-permgroup">
                  <span className="adm-permgroup__title">{group.label}</span>
                  {group.permissions.map((permission) => (
                    <label key={permission} className="adm-permtoggle">
                      <input type="checkbox" checked={draft.permissions.includes(permission)} onChange={() => toggle(permission)} />
                      <span>
                        {PERMISSION_META[permission].label}
                        <small>{PERMISSION_META[permission].description}</small>
                      </span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
            <div className="adm-row">
              <button className="adm-btn" type="button" disabled={busy} onClick={() => void save()}>
                {busy ? "Sparar…" : "Skapa roll"}
              </button>
              <button className="adm-btn adm-btn--ghost" type="button" disabled={busy} onClick={() => setDraft(null)}>
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
