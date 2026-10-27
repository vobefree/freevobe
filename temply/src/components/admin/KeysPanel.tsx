"use client";

import { useCallback, useEffect, useState } from "react";

type SettingView = {
  name: string;
  group: string;
  label: string;
  secret: boolean;
  placeholder?: string;
  hint?: string;
  configured: boolean;
  source: "db" | "env" | "none";
  updatedAt: string | null;
  updatedBy: string | null;
  value: string | null;
};

type Group = { id: string; label: string; description: string };

type Props = { canManage: boolean; initial: { settings: SettingView[]; groups: Group[] } };

export function KeysPanel({ canManage, initial }: Props) {
  const [groups] = useState(initial.groups);
  const [settings, setSettings] = useState(initial.settings);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [openGroup, setOpenGroup] = useState<string>(initial.groups[0]?.id ?? "ai");

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/keys", { cache: "no-store" });
    if (res.ok) {
      const json = (await res.json()) as { settings: SettingView[] };
      setSettings(json.settings ?? []);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(
    async (group: string) => {
      const values: Record<string, string> = {};
      for (const setting of settings.filter((item) => item.group === group)) {
        if (drafts[setting.name] !== undefined) values[setting.name] = drafts[setting.name];
      }
      if (Object.keys(values).length === 0) {
        setToast("Inget att spara i gruppen.");
        return;
      }
      setBusy(true);
      try {
        const res = await fetch("/api/admin/keys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ values }),
        });
        const json = (await res.json()) as { ok?: boolean; saved?: number; settings?: SettingView[]; error?: string };
        if (!res.ok) {
          setToast(`Kunde inte spara: ${json.error ?? "fel"}`);
          return;
        }
        if (json.settings) setSettings(json.settings);
        setDrafts((current) => {
          const next = { ...current };
          for (const key of Object.keys(values)) delete next[key];
          return next;
        });
        setToast(`Sparat (${json.saved ?? 0} fält). Nya nycklar används direkt.`);
      } finally {
        setBusy(false);
      }
    },
    [drafts, settings],
  );

  return (
    <section className="adm-section">
      <div className="adm-section__head">
        <div>
          <h2>API-nycklar & inställningar</h2>
          <p>
            Nycklar sparas krypterat i databasen och överrider miljövariabler direkt – ingen omstart behövs. Lämna ett fält tomt för att
            återgå till miljöns värde.
          </p>
        </div>
      </div>

      {toast && <div className="adm-toast">{toast}</div>}

      {groups.map((group) => {
        const items = settings.filter((setting) => setting.group === group.id);
        const isOpen = openGroup === group.id;
        return (
          <div key={group.id} className="adm-panel">
            <button className="adm-panel__head adm-panel__head--button" type="button" onClick={() => setOpenGroup(isOpen ? "" : group.id)}>
              <span>{group.label}</span>
              <small>
                {items.filter((item) => item.configured).length}/{items.length} satta · {isOpen ? "dölj" : "visa"}
              </small>
            </button>
            {isOpen && (
              <>
                <p className="adm-empty">{group.description}</p>
                <div className="adm-keygrid">
                  {items.map((setting) => (
                    <label key={setting.name} className="adm-field">
                      <span>
                        {setting.label}
                        <em className={`adm-badge is-${setting.source}`}>
                          {setting.source === "db" ? "panel" : setting.source === "env" ? "miljö" : "saknas"}
                        </em>
                      </span>
                      <input
                        className="adm-input"
                        type={setting.secret ? "password" : "text"}
                        autoComplete="off"
                        disabled={!canManage}
                        value={drafts[setting.name] ?? setting.value ?? ""}
                        placeholder={setting.secret ? (setting.configured ? "••••••• (sparat)" : setting.placeholder ?? "") : setting.placeholder ?? ""}
                        onChange={(event) => setDrafts((current) => ({ ...current, [setting.name]: event.target.value }))}
                      />
                      <small>
                        {setting.hint ?? setting.name}
                        {setting.updatedAt && ` · ändrad ${new Date(setting.updatedAt).toLocaleString("sv-SE")} av ${setting.updatedBy ?? "–"}`}
                      </small>
                    </label>
                  ))}
                </div>
                {canManage ? (
                  <button className="adm-btn" type="button" disabled={busy} onClick={() => void save(group.id)}>
                    Spara {group.label.toLowerCase()}
                  </button>
                ) : (
                  <p className="adm-empty">Din roll får se nycklar men inte ändra dem.</p>
                )}
              </>
            )}
          </div>
        );
      })}
    </section>
  );
}
