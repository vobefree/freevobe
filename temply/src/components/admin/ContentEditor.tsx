"use client";

import { useCallback, useMemo, useState } from "react";
import type { ContentEntry } from "@/lib/content";

type LocaleOption = { code: string; label: string; short: string };

type Props = {
  canManage: boolean;
  initialLocale: string;
  initialEntries: ContentEntry[];
  initialCount: number;
  locales: LocaleOption[];
};

type Payload = {
  entries?: ContentEntry[];
  count?: number;
  saved?: number;
  removed?: number;
  copied?: number;
  error?: string;
};

const SCOPE_TITLES: Record<string, string> = { dict: "Gränssnitt", site: "Sajttexter" };

const GROUP_TITLES: Record<string, string> = {
  root: "Toppen",
  nav: "Meny",
  landing: "Förstasidan",
  start: "Start",
  errors: "Felmeddelanden",
  signIn: "Inloggning",
  signup: "Registrering",
  agency: "Byrå",
  projects: "Projekt",
  review: "Kundgranskning",
  integrations: "Integrationer",
  export: "Export",
  hero: "Förstasidan",
  features: "Funktioner",
  how: "Så funkar det",
  pricing: "Priser",
  auth: "Inloggning",
  dashboard: "Dashboard",
  studio: "Studio",
  common: "Gemensamt",
  contact: "Kontakt",
  cookie: "Cookies",
  terms: "Villkor",
  privacy: "Integritet",
  trademark: "Varumärken",
  stripe: "Betalningar",
  footer: "Sidfot",
  health: "Temahealth",
  stats: "Statistik",
  insights: "Insikter",
};

function groupKey(entry: ContentEntry): string {
  return `${entry.scope}:${entry.group}`;
}

function groupLabel(key: string): string {
  const [scope, group] = key.split(":");
  return `${SCOPE_TITLES[scope] ?? scope} · ${GROUP_TITLES[group] ?? group}`;
}

function keyLabel(entry: ContentEntry): string {
  return entry.key.split(".").slice(2).join(".") || entry.key;
}

export function ContentEditor({ canManage, initialLocale, initialEntries, initialCount, locales }: Props) {
  const [locale, setLocale] = useState(initialLocale);
  const [entries, setEntries] = useState<ContentEntry[]>(initialEntries);
  const [count, setCount] = useState(initialCount);
  const [dirty, setDirty] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [onlyEdited, setOnlyEdited] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string>(() => (initialEntries[0] ? groupKey(initialEntries[0]) : ""));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const applyPayload = useCallback((payload: Payload) => {
    if (payload.entries) setEntries(payload.entries);
    if (typeof payload.count === "number") setCount(payload.count);
  }, []);

  const request = useCallback(
    async (body: Record<string, unknown>): Promise<Payload | null> => {
      setBusy(true);
      setNotice(null);
      try {
        const res = await fetch("/api/admin/content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as Payload;
        if (!res.ok) {
          setNotice({ kind: "error", text: json.error === "forbidden" ? "Din roll får inte ändra innehållet." : "Kunde inte spara." });
          return null;
        }
        applyPayload(json);
        return json;
      } catch {
        setNotice({ kind: "error", text: "Nätverket svarade inte." });
        return null;
      } finally {
        setBusy(false);
      }
    },
    [applyPayload],
  );

  const switchLocale = async (code: string) => {
    setLocale(code);
    setDirty({});
    setSearch("");
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/content?locale=${code}`, { cache: "no-store" });
      if (res.ok) {
        const payload = (await res.json()) as Payload;
        applyPayload(payload);
        if (payload.entries?.[0]) setActiveGroup(groupKey(payload.entries[0]));
      }
    } finally {
      setBusy(false);
    }
  };

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; label: string; total: number; edited: number }>();
    for (const entry of entries) {
      const key = groupKey(entry);
      const current = map.get(key) ?? { key, label: groupLabel(key), total: 0, edited: 0 };
      current.total += 1;
      if (entry.overridden) current.edited += 1;
      map.set(key, current);
    }
    return [...map.values()];
  }, [entries]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base = term || onlyEdited ? entries : entries.filter((entry) => groupKey(entry) === activeGroup);
    return base
      .filter((entry) => (onlyEdited ? entry.overridden || entry.key in dirty : true))
      .filter((entry) => (term ? entry.value.toLowerCase().includes(term) || entry.key.toLowerCase().includes(term) : true))
      .slice(0, 200);
  }, [entries, activeGroup, search, onlyEdited, dirty]);

  const dirtyKeys = Object.keys(dirty);
  const valueOf = (entry: ContentEntry) => (entry.key in dirty ? dirty[entry.key] : entry.value);

  const change = (entry: ContentEntry, value: string) => {
    setDirty((current) => {
      if (value === entry.value) {
        const next = { ...current };
        delete next[entry.key];
        return next;
      }
      return { ...current, [entry.key]: value };
    });
  };

  const save = async () => {
    if (dirtyKeys.length === 0) return;
    const values = { ...dirty };
    const result = await request({ action: "save", locale, values });
    if (result) {
      setDirty({});
      const saved = result.saved ?? 0;
      setNotice({ kind: "ok", text: saved === 1 ? "Sparat. 1 text uppdaterad." : `Sparat. ${saved} texter uppdaterade.` });
    }
  };

  const resetKey = async (entry: ContentEntry) => {
    const result = await request({ action: "reset", locale, key: entry.key });
    if (result) {
      setDirty((current) => {
        const next = { ...current };
        delete next[entry.key];
        return next;
      });
      setNotice({ kind: "ok", text: "Texten är tillbaka till originalet." });
    }
  };

  const resetAll = async () => {
    if (!window.confirm(`Återställ alla ändrade texter för ${locale.toUpperCase()}? Originaltexterna används igen.`)) return;
    const result = await request({ action: "reset", locale });
    if (result) {
      setDirty({});
      setNotice({ kind: "ok", text: `${result.removed ?? 0} texter återställda.` });
    }
  };

  const copyFromSwedish = async () => {
    if (!window.confirm("Kopiera alla svenska ändringar hit? Texter som redan är ändrade här skrivs över.")) return;
    const result = await request({ action: "copy", locale, from: "sv" });
    if (result) {
      setDirty({});
      setNotice({ kind: "ok", text: `${result.copied ?? 0} texter kopierade från svenska.` });
    }
  };

  return (
    <section className="adm-section cn">
      <div className="adm-section__head">
        <div>
          <h2>Innehåll</h2>
          <p>
            All text på sajten, per språk. Ändringar slår igenom direkt och originaltexten finns kvar som reserv – töm ett fält för att
            återställa det.
          </p>
        </div>
        <div className="adm-row">
          <span className="adm-chip is-active">{count} ändrade</span>
          {locale !== "sv" && canManage && (
            <button className="adm-btn adm-btn--ghost" type="button" onClick={() => void copyFromSwedish()} disabled={busy}>
              Kopiera från svenska
            </button>
          )}
          {canManage && (
            <button className="adm-btn adm-btn--ghost" type="button" onClick={() => void resetAll()} disabled={busy || count === 0}>
              Återställ språket
            </button>
          )}
        </div>
      </div>

      <div className="cn-locales">
        {locales.map((option) => (
          <button
            key={option.code}
            type="button"
            className={`adm-chip${locale === option.code ? " is-active" : ""}`}
            onClick={() => void switchLocale(option.code)}
            title={option.label}
          >
            {option.short}
            <small>{option.label}</small>
          </button>
        ))}
      </div>

      <div className="cn-bar">
        <input
          className="adm-input cn-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Sök text eller nyckel…"
          aria-label="Sök i texter"
        />
        <label className="cn-toggle">
          <input type="checkbox" checked={onlyEdited} onChange={(event) => setOnlyEdited(event.target.checked)} />
          Endast ändrade
        </label>
        <span className="cn-spacer" />
        <span className={`cn-dirty${dirtyKeys.length > 0 ? " is-dirty" : ""}`}>{dirtyKeys.length} osparade</span>
        <button className="adm-btn" type="button" onClick={() => void save()} disabled={!canManage || busy || dirtyKeys.length === 0}>
          {busy ? "Sparar…" : "Spara"}
        </button>
      </div>

      {notice && <div className={`adm-toast ${notice.kind === "error" ? "adm-toast--error" : ""}`}>{notice.text}</div>}

      <div className="cn-grid">
        <aside className="cn-groups" aria-label="Grupper">
          {groups.map((group) => (
            <button
              key={group.key}
              type="button"
              className={`cn-group${activeGroup === group.key && !search && !onlyEdited ? " is-active" : ""}`}
              onClick={() => {
                setActiveGroup(group.key);
                setSearch("");
                setOnlyEdited(false);
              }}
            >
              <span>{group.label}</span>
              <small>
                {group.edited > 0 && <i className="cn-dot" />}
                {group.total}
              </small>
            </button>
          ))}
        </aside>

        <div className="cn-fields">
          {visible.length === 0 && <p className="adm-empty">Inga texter matchar.</p>}
          {visible.map((entry) => {
            const value = valueOf(entry);
            const dirtyField = entry.key in dirty;
            const long = value.length > 90 || value.includes("\n");
            return (
              <label key={entry.key} className={`cn-field${dirtyField ? " is-dirty" : ""}`}>
                <span className="cn-field__head">
                  <b>{keyLabel(entry)}</b>
                  <small>
                    {SCOPE_TITLES[entry.scope] ?? entry.scope}
                    {entry.overridden ? " · ändrad" : ""}
                  </small>
                  {entry.overridden && canManage && (
                    <button
                      type="button"
                      className="cn-reset"
                      onClick={(event) => {
                        event.preventDefault();
                        void resetKey(entry);
                      }}
                    >
                      Återställ
                    </button>
                  )}
                </span>
                {long ? (
                  <textarea
                    className="adm-input cn-area"
                    rows={Math.min(8, Math.max(3, Math.ceil(value.length / 90)))}
                    value={value}
                    readOnly={!canManage}
                    onChange={(event) => change(entry, event.target.value)}
                  />
                ) : (
                  <input className="adm-input" value={value} readOnly={!canManage} onChange={(event) => change(entry, event.target.value)} />
                )}
              </label>
            );
          })}
        </div>
      </div>
    </section>
  );
}
