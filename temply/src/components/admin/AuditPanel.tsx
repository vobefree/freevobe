"use client";

import { useCallback, useEffect, useState } from "react";

type Entry = {
  id: string;
  actor_email: string;
  action: string;
  target: string;
  meta: string;
  created_at: string;
};

export function AuditPanel() {
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/audit?q=${encodeURIComponent(query)}&limit=200`, { cache: "no-store" });
      if (res.ok) {
        const json = (await res.json()) as { entries: Entry[] };
        setEntries(json.entries ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="adm-section">
      <div className="adm-section__head">
        <div>
          <h2>Logg</h2>
          <p>Varje ändring i panelen loggas med vem, vad och när. Värden på nycklar loggas aldrig.</p>
        </div>
        <input className="adm-input" value={query} placeholder="Sök aktör, åtgärd eller mål…" onChange={(event) => setQuery(event.target.value)} />
      </div>

      {loading && entries.length === 0 && <p className="adm-empty">Hämtar…</p>}

      <div className="adm-tablewrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Tid</th>
              <th>Aktör</th>
              <th>Åtgärd</th>
              <th>Mål</th>
              <th>Detaljer</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{new Date(entry.created_at).toLocaleString("sv-SE")}</td>
                <td>{entry.actor_email}</td>
                <td>
                  <code className="adm-code">{entry.action}</code>
                </td>
                <td>{entry.target || "–"}</td>
                <td>
                  <small>{entry.meta}</small>
                </td>
              </tr>
            ))}
            {entries.length === 0 && !loading && (
              <tr>
                <td colSpan={5}>
                  <p className="adm-empty">Inga händelser ännu.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
