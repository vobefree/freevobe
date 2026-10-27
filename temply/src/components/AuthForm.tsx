"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Dict } from "@/lib/i18n";
import { getAuthSocialStrings } from "@/lib/i18n/auth-social";
import { getReferralStrings } from "@/lib/i18n/referral";
import { Icon } from "@/components/Icon";
import type { Locale } from "@/lib/theme/types";

type Props = {
  mode: "login" | "signup";
  locale: Locale;
  dict: Dict;
  socialProviders?: string[];
  shopifyReady?: boolean;
  showShopify?: boolean;
  notice?: string | null;
};

export function AuthForm({ mode, locale, dict, socialProviders = [], shopifyReady = false, showShopify = true, notice = null }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shop, setShop] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ref, setRef] = useState("");
  const [refState, setRefState] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [refBonus, setRefBonus] = useState(0);
  const router = useRouter();
  const social = getAuthSocialStrings(locale);
  const referral = getReferralStrings(locale);

  // Värvningskoden kan komma med i länken (/signup?ref=KOD) eller skrivas in manuellt.
  useEffect(() => {
    if (mode !== "signup") return;
    const fromUrl = new URLSearchParams(window.location.search).get("ref");
    if (fromUrl) setRef(fromUrl.trim().toUpperCase());
  }, [mode]);

  useEffect(() => {
    if (mode !== "signup") return;
    const code = ref.trim().toUpperCase();
    if (!code) {
      setRefState("idle");
      return;
    }
    setRefState("checking");
    const timer = setTimeout(() => {
      fetch(`/api/referral/check?code=${encodeURIComponent(code)}`, { cache: "no-store" })
        .then((res) => res.json())
        .then((json: { valid?: boolean; bonusDays?: number }) => {
          setRefBonus(json.bonusDays ?? 0);
          setRefState(json.valid ? "valid" : "invalid");
        })
        .catch(() => setRefState("invalid"));
    }, 350);
    return () => clearTimeout(timer);
  }, [ref, mode]);

  const errorText = (code: string) =>
    code === "exists" ? dict.auth.errorExists : code === "weak" ? dict.auth.errorWeak : code === "required" ? dict.auth.errorRequired : dict.auth.errorInvalid;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "signup" ? { name, email, password, locale, ref: ref.trim() } : { email, password }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(errorText(json.error ?? "invalid"));
        return;
      }
      router.push(`/${locale}/dashboard${mode === "signup" ? "?new=1" : ""}`);
      router.refresh();
    } catch {
      setError(dict.common.error);
    } finally {
      setBusy(false);
    }
  };

  const startShopify = () => {
    if (!shopifyReady || !shop.trim()) return;
    window.location.assign(`/api/auth/shopify?shop=${encodeURIComponent(shop.trim())}&locale=${locale}`);
  };

  const startSocial = (provider: string) => {
    window.location.assign(`/api/auth/social/${provider}?locale=${locale}`);
  };

  return (
    <>
      <form onSubmit={submit} style={{ marginTop: 26 }}>
        {error && <div className="auth-error">{error}</div>}
        {mode === "signup" && (
          <div className="input-group">
            <label htmlFor="name">{dict.auth.name}</label>
            <input id="name" className="input" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
          </div>
        )}
        <div className="input-group">
          <label htmlFor="email">{dict.auth.email}</label>
          <input id="email" className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
        </div>
        <div className="input-group">
          <label htmlFor="password">{dict.auth.password}</label>
          <input
            id="password"
            className="input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            minLength={8}
            required
          />
        </div>
        {mode === "signup" && (
          <div className="input-group">
            <label htmlFor="ref">{referral.field}</label>
            <input
              id="ref"
              className="input"
              value={ref}
              onChange={(event) => setRef(event.target.value.toUpperCase())}
              placeholder="ABCD1234"
              autoComplete="off"
              spellCheck={false}
              aria-describedby="ref-hint"
            />
            <small id="ref-hint" className={`auth-hint${refState === "valid" ? " is-ok" : refState === "invalid" ? " is-bad" : ""}`}>
              {refState === "valid"
                ? referral.fieldApplied.replace("{bonus}", String(refBonus))
                : refState === "invalid"
                  ? referral.fieldUnknown
                  : referral.fieldHint}
            </small>
          </div>
        )}
        <button className="ui-btn ui-btn--accent ui-btn--lg ui-btn--block" type="submit" disabled={busy}>
          {busy ? dict.common.loading : mode === "signup" ? dict.auth.signupCta : dict.auth.loginCta}
        </button>
        {mode === "signup" && (
          <p className="auth-note">
            <Icon name="check" size="sm" strokeWidth={2} /> {dict.auth.trialNote}
          </p>
        )}
      </form>

      <div className="auth-divider"><span>{social.divider}</span></div>
      {notice && <div className="auth-notice">{notice}</div>}

      {showShopify && (
        <div className="auth-alt">
          <b>{social.shopifyTitle}</b>
          <p>{social.shopifySub}</p>
          <div className="auth-shopify">
            <input
              className="input"
              value={shop}
              onChange={(event) => setShop(event.target.value)}
              placeholder={social.shopPlaceholder}
              aria-label={social.shopPlaceholder}
              autoComplete="organization"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  startShopify();
                }
              }}
            />
            <button className="ui-btn ui-btn--block" type="button" onClick={startShopify} disabled={!shopifyReady || !shop.trim()}>
              {social.shopifyCta}
            </button>
          </div>
          {!shopifyReady && <p className="auth-hint">{social.shopifyNotConfigured}</p>}
        </div>
      )}

      <div className="auth-alt">
        <b>{social.socialTitle}</b>
        <p>{social.socialSub}</p>
        <div className="auth-social">
          {(["google", "facebook"] as const).map((provider) => (
            <button
              key={provider}
              className={`auth-social__btn${socialProviders.includes(provider) ? "" : " is-pending"}`}
              type="button"
              onClick={() => startSocial(provider)}
            >
              <span className="auth-social__mark" aria-hidden="true">{provider === "google" ? "G" : "f"}</span>
              {provider === "google" ? "Google" : "Facebook"}
            </button>
          ))}
        </div>
        {socialProviders.length === 0 && <p className="auth-hint">{social.socialNotConfigured}</p>}
      </div>

      <p className="auth-switch">
        {mode === "signup" ? (
          <Link href={`/${locale}/login`}>{dict.auth.toLogin}</Link>
        ) : (
          <Link href={`/${locale}/signup`}>{dict.auth.toSignup}</Link>
        )}
      </p>
    </>
  );
}
