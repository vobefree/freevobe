"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Message = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  locale: string;
  handled: number;
  created_at: string;
};

type Counts = { total: number; unread: number; handled: number };
type Filter = "all" | "new" | "handled";

export function InboxPanel({ canManage }: { canManage: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [counts, setCounts] = useState<Counts>({ total: 0, unread: 0, handled: 0 });
  const [filter, setFilter] = useState<Filter>("new");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ status: filter, q: query });
    const res = await fetch(`/api/admin/inbox?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json()) as { messages: Message[]; counts: Counts };
    setMessages(json.messages ?? []);
    setCounts(json.counts ?? { total: 0, unread: 0, handled: 0 });
  }, [filter, query]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 180);
    return () => clearTimeout(timer);
  }, [load]);

  const selected = useMemo(() => messages.find((message) => message.id === selectedId) ?? null, [messages, selectedId]);

  const act = useCallback(
    async (payload: { id: string; handled?: boolean } | { id: string; remove: true }) => {
      setBusy(true);
      setToast(null);
      try {
        const remove = "remove" in payload;
        const res = await fetch("/api/admin/inbox", {
          method: remove ? "DELETE" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(remove ? { id: payload.id } : { id: payload.id, handled: payload.handled }),
        });
        const json = (await res.json()) as { counts?: Counts; error?: string };
        if (!res.ok) {
          setToast(`Kunde inte utföra: ${json.error ?? "fel"}`);
          return;
        }
        if (json.counts) setCounts(json.counts);
        if (remove) setSelectedId(null);
        setToast(remove ? "Meddelandet är borttaget." : payload.handled ? "Markerat som klart." : "Tillbaka som nytt.");
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
          <h2>Inkorg</h2>
          <p>
            Meddelanden som skickas via kontaktformuläret på sajten. Svara direkt på avsändarens adress och markera tråden som klar när
            den är hanterad.
          </p>
        </div>
        <input className="adm-input" value={query} placeholder="Sök avsändare, ämne eller text…" onChange={(event) => setQuery(event.target.value)} />
      </div>

      {toast && <div className="adm-toast">{toast}</div>}

      <div className="adm-kpis">
        <div className="adm-kpi">
          <span>Nya</span>
          <b>{counts.unread}</b>
          <small>väntar på svar</small>
        </div>
        <div className="adm-kpi">
          <span>Klara</span>
          <b>{counts.handled}</b>
          <small>hanterade ärenden</small>
        </div>
        <div className="adm-kpi">
          <span>Totalt</span>
          <b>{counts.total}</b>
          <small>meddelanden i inkorgen</small>
        </div>
      </div>

      <div className="adm-row" style={{ marginBottom: 12 }}>
        {(
          [
            ["new", `Nya (${counts.unread})`],
            ["handled", `Klara (${counts.handled})`],
            ["all", `Alla (${counts.total})`],
          ] as [Filter, string][]
        ).map(([value, label]) => (
          <button key={value} className={`adm-chip${filter === value ? " is-active" : ""}`} type="button" onClick={() => setFilter(value)}>
            {label}
          </button>
        ))}
      </div>

      <div className="adm-grid adm-grid--two">
        <div className="adm-tablewrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Från</th>
                <th>Ämne</th>
                <th>Inkom</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((message) => (
                <tr key={message.id} className={selectedId === message.id ? "is-selected" : ""} onClick={() => setSelectedId(message.id)}>
                  <td>
                    <span className={`adm-plan is-${message.handled ? "active" : "trialing"}`}>{message.handled ? "klar" : "ny"}</span>
                  </td>
                  <td>
                    <b>{message.name}</b>
                    <small>{message.email}</small>
                  </td>
                  <td>{message.subject}</td>
                  <td>{new Date(message.created_at).toLocaleDateString("sv-SE")}</td>
                </tr>
              ))}
              {messages.length === 0 && (
                <tr>
                  <td colSpan={4}>
                    <p className="adm-empty">{filter === "new" ? "Inga nya meddelanden. Allt är hanterat." : "Inga meddelanden här."}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="adm-panel">
          {!selected && <p className="adm-empty">Välj ett meddelande för att läsa och svara.</p>}
          {selected && (
            <>
              <div className="adm-panel__head">
                <span>{selected.subject}</span>
                <small>{new Date(selected.created_at).toLocaleString("sv-SE")}</small>
              </div>
              <p className="adm-empty">
                {selected.name} · {selected.email} · {selected.locale}
              </p>
              <div className="adm-message">{selected.message}</div>
              <div className="adm-row" style={{ marginTop: 12 }}>
                <a className="adm-btn" href={`mailto:${selected.email}?subject=${encodeURIComponent(`Re: ${selected.subject}`)}`}>
                  Svara via e-post
                </a>
                {canManage ? (
                  <>
                    <button
                      className="adm-btn"
                      type="button"
                      disabled={busy}
                      onClick={() => void act({ id: selected.id, handled: !selected.handled })}
                    >
                      {selected.handled ? "Öppna igen" : "Markera klar"}
                    </button>
                    <button
                      className="adm-btn adm-btn--danger"
                      type="button"
                      disabled={busy}
                      onClick={() => void act({ id: selected.id, remove: true })}
                    >
                      Ta bort
                    </button>
                  </>
                ) : (
                  <span className="adm-empty">Din roll får läsa men inte hantera inkorgen.</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
