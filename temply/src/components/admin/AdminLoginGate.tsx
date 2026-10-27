"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/marketing/Brand";

type Props = {
  signedIn: boolean;
  email: string | null;
  roleLabel: string | null;
  enrolled: boolean;
  recoveryLeft: number;
  lockSeconds: number;
  locale: string;
};

type Step = "credentials" | "enrol" | "code" | "recovery" | "locked" | "denied";

/** Inloggning till adminpanelen: e-post, lösenord och kod från autentiseraren. */
export function AdminLoginGate({ signedIn, email, roleLabel, enrolled, recoveryLeft, lockSeconds, locale }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(
    lockSeconds > 0 ? "locked" : !signedIn ? "credentials" : enrolled ? "code" : "enrol",
  );
  const [mail, setMail] = useState(email ?? "");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [secret, setSecret] = useState<{ formatted: string; uri: string } | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(lockSeconds);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setInterval(() => setWait((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [wait]);

  useEffect(() => {
    if (wait === 0 && step === "locked") setStep("code");
  }, [wait, step]);

  const call = useCallback(async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/admin/mfa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as {
      ok?: boolean;
      error?: string;
      needsEnrolment?: boolean;
      secret?: string;
      formatted?: string;
      uri?: string;
      recoveryCodes?: string[];
      lockSeconds?: number;
    };
    return { ok: res.ok, status: res.status, json };
  }, []);

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { ok, json } = await call({ action: "password", email: mail, password });
      if (!ok) {
        if (json.error === "locked") {
          setWait(json.lockSeconds ?? 900);
          setStep("locked");
          return;
        }
        setError(
          json.error === "not_staff"
            ? "Kontot har ingen roll i adminpanelen."
            : json.error === "bad_credentials"
              ? "Fel e-post eller lösenord."
              : "Kunde inte logga in just nu.",
        );
        return;
      }
      setPassword("");
      setStep(json.needsEnrolment ? "enrol" : "code");
    } finally {
      setBusy(false);
    }
  };

  const startEnrolment = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const { ok, json } = await call({ action: "enrol" });
      if (!ok || !json.formatted || !json.uri) {
        setError(json.error === "already_enrolled" ? "Autentiseraren är redan registrerad." : "Kunde inte starta registreringen.");
        return;
      }
      setSecret({ formatted: json.formatted, uri: json.uri });
    } finally {
      setBusy(false);
    }
  }, [call]);

  useEffect(() => {
    if (step === "enrol" && signedIn && !secret) void startEnrolment();
  }, [step, signedIn, secret, startEnrolment]);

  const submitCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { ok, json } = await call(step === "enrol" ? { action: "confirm", code } : { action: "verify", code });
      if (!ok) {
        if (json.error === "locked") {
          setWait(json.lockSeconds ?? 600);
          setStep("locked");
          return;
        }
        setError(json.error === "not_enrolled" ? "Ingen autentiserare är registrerad på kontot." : "Koden stämde inte. Försök igen.");
        return;
      }
      setCode("");
      if (json.recoveryCodes?.length) {
        setRecoveryCodes(json.recoveryCodes);
        setStep("recovery");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
  };

  return (
    <div className="adm adm--locked">
      <div className="adm-lock adm-lock--login">
        <div className="adm-gate__brand">
          <Brand href={`/${locale}`} />
        </div>
        <h1>Kontrollpanel</h1>

        {step === "credentials" && (
          <>
            <p>Logga in med ett konto som har en roll i panelen. Därefter krävs en kod från din autentiserare.</p>
            <form onSubmit={submitPassword} className="adm-login-form">
              <label className="adm-field">
                <span>E-post</span>
                <input className="adm-input" type="email" autoComplete="email" value={mail} onChange={(event) => setMail(event.target.value)} required />
              </label>
              <label className="adm-field">
                <span>Lösenord</span>
                <input
                  className="adm-input"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>
              <button className="adm-btn" type="submit" disabled={busy}>
                {busy ? "Kontrollerar…" : "Fortsätt"}
              </button>
            </form>
          </>
        )}

        {step === "enrol" && (
          <>
            <p>
              Registrera en autentiserare för <b>{email}</b>. Öppna Google Authenticator (eller 1Password, Authy, Apple Lösenordshanterare),
              välj ”Lägg till konto” och skriv in nyckeln nedan — eller klistra in länken.
            </p>
            {secret ? (
              <>
                <div className="adm-secret">
                  <b>Nyckel</b>
                  <code>{secret.formatted}</code>
                  <small>Klistra in i appen om du inte kan skanna.</small>
                </div>
                <p className="adm-empty" style={{ wordBreak: "break-all" }}>{secret.uri}</p>
              </>
            ) : (
              <p className="adm-empty">Skapar ny nyckel…</p>
            )}
            <form onSubmit={submitCode} className="adm-login-form">
              <label className="adm-field">
                <span>Kod från appen</span>
                <input
                  className="adm-input"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
              </label>
              <button className="adm-btn" type="submit" disabled={busy || !secret}>
                {busy ? "Kontrollerar…" : "Aktivera skyddet"}
              </button>
            </form>
          </>
        )}

        {step === "code" && (
          <>
            <p>
              Inloggad som <b>{email}</b>
              {roleLabel ? ` · ${roleLabel}` : ""}. Ange koden från din autentiserare.
            </p>
            <form onSubmit={submitCode} className="adm-login-form">
              <label className="adm-field">
                <span>Kod eller engångskod</span>
                <input
                  className="adm-input"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  autoFocus
                />
                <small>{recoveryLeft} engångskoder kvar om telefonen är borta.</small>
              </label>
              <button className="adm-btn" type="submit" disabled={busy}>
                {busy ? "Kontrollerar…" : "Lås upp panelen"}
              </button>
              <button className="adm-btn adm-btn--ghost" type="button" onClick={() => void logout()}>
                Logga ut
              </button>
            </form>
          </>
        )}

        {step === "locked" && (
          <>
            <p>
              För många felaktiga försök. Av säkerhetsskäl är inloggningen spärrad i <b>{wait}</b> sekunder.
            </p>
            <button className="adm-btn adm-btn--ghost" type="button" onClick={() => void logout()}>
              Logga ut
            </button>
          </>
        )}

        {step === "recovery" && (
          <>
            <p>
              Skyddet är aktiverat. Spara engångskoderna på ett säkert ställe — de visas bara en gång och fungerar i stället för koden från
              appen.
            </p>
            <div className="adm-secret">
              <b>Engångskoder</b>
              <code>{recoveryCodes.join("\n")}</code>
              <small>{recoveryCodes.length} koder kvar</small>
            </div>
            <button className="adm-btn" type="button" onClick={() => router.refresh()}>
              Jag har sparat dem
            </button>
          </>
        )}

        {error && <div className="adm-toast adm-toast--error">{error}</div>}

        <p className="adm-foot adm-foot--login">
          Skyddet gäller alla administratörer. Tappar du både telefon och engångskoder kan ägaren sätta ADMIN_MFA_DISABLED=1 i miljön och
          registrera en ny autentiserare.
        </p>
        <p className="adm-empty">
          <a href={`/${locale}/login`}>Logga in som vanlig användare</a>
        </p>
      </div>
    </div>
  );
}
