"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Invite = { email: string; name: string; role: string; roleLabel: string; existingAccount: boolean };

export function StaffJoin({ token, locale }: { token: string; locale: string }) {
  const router = useRouter();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/staff/accept?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((json: { invite?: Invite; error?: string }) => {
        if (!active) return;
        if (json.invite) {
          setInvite(json.invite);
          setName(json.invite.name || "");
        } else {
          setError(json.error ?? "invalid_token");
        }
      })
      .catch(() => setError("invalid_token"));
    return () => {
      active = false;
    };
  }, [token]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name, password, currentPassword }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "failed");
        return;
      }
      router.push(`/${locale}/admin`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const messages: Record<string, string> = {
    invalid_token: "Länken är ogiltig eller redan använd.",
    weak_password: "Lösenordet måste vara minst 8 tecken.",
    needs_password: "Kontot finns redan – ange ditt nuvarande lösenord för att koppla rollen.",
    failed: "Kunde inte aktivera rollen. Försök igen.",
  };

  return (
    <div className="adm adm--locked">
      <div className="adm-lock" style={{ textAlign: "left", maxWidth: 520 }}>
        <h1 style={{ fontSize: 22 }}>Aktivera din roll i ThemeFold</h1>
        {!invite && !error && <p>Laddar inbjudan…</p>}
        {error && <p style={{ color: "#fb7185" }}>{messages[error] ?? error}</p>}
        {invite && (
          <>
            <p>
              {invite.email} · rollen <b>{invite.roleLabel}</b>
            </p>
            <label className="adm-field">
              <span>Namn</span>
              <input className="adm-input" value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            {invite.existingAccount ? (
              <label className="adm-field">
                <span>Nuvarande lösenord</span>
                <input
                  className="adm-input"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </label>
            ) : (
              <label className="adm-field">
                <span>Välj lösenord (minst 8 tecken)</span>
                <input
                  className="adm-input"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
            )}
            <button className="adm-btn" type="button" disabled={busy} onClick={() => void submit()}>
              {busy ? "Aktiverar…" : "Aktivera rollen"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
