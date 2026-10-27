"use client";

import { useCallback, useEffect, useState } from "react";

type Row = {
  id: string;
  name: string;
  updatedAt: string;
  publishedAt: string | null;
  themeId: string | null;
  email: string;
  owner: string;
  locale: string;
  health: number | null;
};

export function ProjectsPanel() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/projects?q=${encodeURIComponent(query)}&limit=200`, { cache: "no-store" });
      if (res.ok) {
        const json = (await res.json()) as { projects: Row[] };
        setRows(json.projects ?? []);
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
          <h2>Projekt</h2>
          <p>Alla teman i systemet. Ladda ner ett tema som zip, eller öppna kundens studio via kundens konto.</p>
        </div>
        <input className="adm-input" value={query} placeholder="Sök projekt eller ägare…" onChange={(event) => setQuery(event.target.value)} />
      </div>

      {loading && rows.length === 0 && <p className="adm-empty">Hämtar…</p>}

      <div className="adm-tablewrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Projekt</th>
              <th>Ägare</th>
              <th>Health</th>
              <th>Status</th>
              <th>Uppdaterad</th>
              <th>Tema</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <b>{row.name}</b>
                  <small>{row.locale}</small>
                </td>
                <td>
                  <b>{row.owner}</b>
                  <small>{row.email}</small>
                </td>
                <td>
                  <span className={`adm-score${row.health === null ? " is-none" : row.health >= 80 ? " is-good" : row.health >= 60 ? " is-warn" : " is-bad"}`}>
                    {row.health ?? "–"}
                  </span>
                </td>
                <td>{row.publishedAt ? `publicerad ${new Date(row.publishedAt).toLocaleDateString("sv-SE")}` : "utkast"}</td>
                <td>{new Date(row.updatedAt).toLocaleString("sv-SE")}</td>
                <td>
                  <a className="adm-btn adm-btn--sm" href={`/api/admin/projects/${row.id}/export`}>
                    Zip
                  </a>
                  {row.themeId && <small>{row.themeId.split("/").pop()}</small>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={6}>
                  <p className="adm-empty">Inga projekt hittades.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
