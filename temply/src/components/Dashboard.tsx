"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ProjectSummary } from "@/lib/projects";
import type { Access } from "@/lib/db";
import type { Dict } from "@/lib/i18n";
import { formatDate, interpolate } from "@/lib/i18n";
import { getInsightsStrings } from "@/lib/i18n/insights";
import { getReferralStrings } from "@/lib/i18n/referral";
import type { ReferralSummary } from "@/lib/referrals";
import type { Locale, MoodId } from "@/lib/theme/types";
import { MOODS, PRESET_ORDER } from "@/lib/theme/presets";
import { MOOD_LABELS } from "@/lib/theme/labels";
import { getAdvanced } from "@/lib/i18n/advanced";
import StorefrontPreview from "./StorefrontPreview";
import { AdvancedCanvasView } from "./studio/advanced/AdvancedCanvasView";
import { Brand } from "./marketing/Brand";
import { LanguageMenu } from "./marketing/LanguageMenu";
import { Icon } from "./Icon";

type Props = {
  locale: Locale;
  dict: Dict;
  user: { name: string; email: string; shopifyShop: string | null; shopifyConnected: boolean };
  access: Access;
  admin?: boolean;
  announcement?: string;
  referral: ReferralSummary;
  projects: ProjectSummary[];
  shopifyConfigured: boolean;
  notice?: string;
};

export function Dashboard({ locale, dict, user, access, admin, announcement, referral, projects, shopifyConfigured, notice }: Props) {
  const router = useRouter();
  const referralCopy = getReferralStrings(locale);
  const adv = getAdvanced(locale);
  const [copied, setCopied] = useState(false);
  const [modal, setModal] = useState<null | "new" | "shopify">(null);
  const [prompt, setPrompt] = useState("");
  const [name, setName] = useState("");
  const [mood, setMood] = useState<MoodId>("warm");
  const [builderMode, setBuilderMode] = useState<"theme" | "advanced">("theme");
  const [busy, setBusy] = useState(false);
  const [shopDomain, setShopDomain] = useState(user.shopifyShop?.replace(".myshopify.com", "") ?? "");
  const [toast, setToast] = useState<string | null>(notice ?? null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let saved = "";
    try {
      saved = localStorage.getItem("temply_prompt") ?? "";
    } catch {
      saved = "";
    }
    if (params.get("new") === "1" || saved) setModal("new");
    if (saved) {
      setPrompt(saved);
      try {
        localStorage.removeItem("temply_prompt");
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const createTheme = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, prompt, mood, locale, builderMode }),
      });
      const json = (await res.json()) as { project?: ProjectSummary; error?: string };
      if (res.ok && json.project) {
        router.push(`/${locale}/studio/${json.project.id}`);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm(`${dict.common.delete}?`)) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    router.refresh();
  };

  const rename = async (project: ProjectSummary) => {
    const next = window.prompt(dict.common.rename, project.name);
    if (!next || next.trim() === project.name) return;
    const config = { ...project.config, name: next.trim() };
    await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: next.trim(), config }),
    });
    router.refresh();
  };

  const referralLink = () => {
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    return `${origin}/${locale}/signup?ref=${referral.code}`;
  };

  const copyReferral = async () => {
    try {
      await navigator.clipboard.writeText(referralLink());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push(`/${locale}`);
    router.refresh();
  };

  const connectShopify = () => {
    const domain = shopDomain.trim();
    if (!domain) return;
    window.location.href = `/api/shopify/install?shop=${encodeURIComponent(domain)}`;
  };

  const trialLabel =
    access.status === "active"
      ? dict.dashboard.active
      : access.status === "expired"
        ? dict.dashboard.trialEnded
        : access.daysLeft <= 1
          ? dict.dashboard.trialToday
          : interpolate(dict.dashboard.trialLeft, { days: access.daysLeft });

  return (
    <>
      <div className="wrap">
        <header className="dash-top">
          <Brand href={`/${locale}`} />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {admin && (
              <Link className="ui-btn ui-btn--ghost ui-btn--sm" href={`/${locale}/admin`}>
                {getInsightsStrings(locale).adminTitle}
              </Link>
            )}
            <LanguageMenu locale={locale} label={dict.common.language} />
            <div className="dash-user">
              <span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span>
              <span style={{ fontSize: 12 }}>{user.name}</span>
            </div>
            <button className="ui-btn ui-btn--ghost ui-btn--sm" type="button" onClick={logout}>{dict.common.logout}</button>
          </div>
        </header>
      </div>

      <main className="wrap dash-main">
        {announcement && <div className="dash-announce">{announcement}</div>}
        <div className="dash-head">
          <div>
            <h1>{interpolate(dict.dashboard.greeting, { name: user.name.split(" ")[0] })}</h1>
            <p>{projects.length > 0 ? interpolate(dict.dashboard.themeCount, { count: projects.length }) : dict.dashboard.empty}</p>
          </div>
          <button className="ui-btn ui-btn--accent" type="button" onClick={() => setModal("new")}>
            <Icon name="plus" size="sm" /> {dict.dashboard.newTheme}
          </button>
        </div>

        <div className={`plan-banner${access.status === "active" ? " plan-banner--active" : access.status === "expired" ? " plan-banner--warn" : ""}`}>
          <div className="plan-banner__text">
            <span className="plan-banner__dot" />
            <span>{trialLabel}</span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {user.shopifyConnected && <span className="pill">Shopify: {user.shopifyShop}</span>}
            <button className="ui-btn ui-btn--ghost ui-btn--sm" type="button" onClick={() => setModal("shopify")}>
              {user.shopifyConnected ? dict.dashboard.shopifyConnected.replace("{shop}", user.shopifyShop ?? "") : dict.dashboard.connectShopify}
            </button>
            {access.status !== "active" && (
              <Link className="ui-btn ui-btn--sm" href={`/${locale}/pricing`}>{dict.dashboard.upgrade}</Link>
            )}
          </div>
        </div>

        {referral.enabled && (
          <section className="referral">
            <div className="referral__head">
              <div>
                <h3>{referralCopy.title}</h3>
                <p>{referralCopy.sub}</p>
              </div>
              <span className="referral__code">
                {referralCopy.code} <b>{referral.code}</b>
              </span>
            </div>
            <div className="referral__row">
              <input className="input" readOnly value={referralLink()} onFocus={(event) => event.currentTarget.select()} aria-label={referralCopy.link} />
              <button className="ui-btn ui-btn--sm" type="button" onClick={() => void copyReferral()}>
                {copied ? referralCopy.copied : referralCopy.copy}
              </button>
            </div>
            <div className="referral__stats">
              <span>
                <b>{referral.invited}</b> {referralCopy.invited}
              </span>
              <span>
                <b>{referral.paying}</b> {referralCopy.paying}
              </span>
              <span>
                <b>{referral.earnedDays}</b> {referralCopy.earned}
              </span>
              <span>
                <b>{referral.remaining}</b> {referralCopy.remaining.replace("{max}", String(referral.maxRewards))}
              </span>
            </div>
            <p className="hint">
              {referralCopy.rule.replace("{bonus}", String(referral.trialBonusDays)).replace("{reward}", String(referral.rewardDays)).replace("{max}", String(referral.maxRewards))}
            </p>
          </section>
        )}

        {projects.length === 0 ? (
          <div className="empty-state">
            <h3>{dict.dashboard.newTheme}</h3>
            <p>{dict.dashboard.empty}</p>
            <button className="ui-btn ui-btn--accent" type="button" onClick={() => setModal("new")}>{dict.dashboard.createFirst}</button>
          </div>
        ) : (
          <div className="theme-grid">
            {projects.map((project) => (
              <article className="theme-card" key={project.id}>
                <div className="theme-card__preview">
                  <div style={{ width: "300%", transform: "scale(0.3334)", transformOrigin: "top left", pointerEvents: "none" }}>
                    {project.config.builder?.mode === "advanced" ? (
                      <AdvancedCanvasView config={project.config} canvas={project.config.builder.canvas} />
                    ) : (
                      <StorefrontPreview config={project.config} />
                    )}
                  </div>
                </div>
                <div className="theme-card__body">
                  <div className="theme-card__title">
                    <h3>{project.name}</h3>
                    {project.config.builder?.mode === "advanced" && <span className="pill" style={{ fontSize: 9.5, padding: "3px 7px" }}>{adv.badge}</span>}
                    {project.publishedAt && <span className="pill" style={{ fontSize: 9.5, padding: "3px 7px" }}>Live</span>}
                  </div>
                  <div className="theme-card__meta">
                    <span>{project.config.shop.name}</span>
                    <span className="dot-sep" />
                    <span>{interpolate(dict.dashboard.lastEdited, { when: formatDate(locale, project.updatedAt) })}</span>
                  </div>
                  <div className="theme-card__actions">
                    <Link className="ui-btn ui-btn--sm" href={`/${locale}/studio/${project.id}`}>{dict.dashboard.openStudio}</Link>
                    <button className="ui-btn ui-btn--ghost ui-btn--sm" type="button" onClick={() => rename(project)}>{dict.common.rename}</button>
                    <button className="ui-btn ui-btn--ghost ui-btn--sm" type="button" onClick={() => remove(project.id)} aria-label={dict.common.delete}>
                      <Icon name="close" size="sm" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="dash-connect">
          <span>{shopifyConfigured ? "Shopify API" : dict.studio.shopifyNotConfigured}</span>
        </div>
      </main>

      {modal === "new" && (
        <div className="modal-back" onClick={() => setModal(null)}>
          <div className="modal" style={{ position: "relative" }} onClick={(event) => event.stopPropagation()}>
            <button className="modal__close" type="button" aria-label={dict.common.close} onClick={() => setModal(null)}>
              <Icon name="close" size="md" tone="ink" />
            </button>
            <h2>{dict.dashboard.newTheme}</h2>
            <p>{dict.dashboard.newThemeHint}</p>
            <div className="input-group">
              <label htmlFor="theme-name">{dict.studio.shopName}</label>
              <input id="theme-name" className="input" value={name} placeholder={dict.studio.shopName} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="input-group">
              <label htmlFor="theme-prompt">{dict.studio.aiTitle}</label>
              <textarea id="theme-prompt" className="textarea" value={prompt} placeholder={dict.landing.promptPlaceholder} onChange={(event) => setPrompt(event.target.value)} />
            </div>
            <div className="input-group">
              <label>{adv.modeSwitch}</label>
              <div className="segmented" style={{ width: "100%" }}>
                <button type="button" className={builderMode === "theme" ? "is-active" : ""} onClick={() => setBuilderMode("theme")}>{adv.themeMode}</button>
                <button type="button" className={builderMode === "advanced" ? "is-active" : ""} onClick={() => setBuilderMode("advanced")}>{adv.advancedMode}</button>
              </div>
              <p className="hint" style={{ marginTop: 6 }}>{builderMode === "advanced" ? adv.newThemeHint : adv.modeSwitchHint}</p>
            </div>
            <div className="input-group">
              <label>{dict.studio.mood}</label>
              <div className="mood-picker">
                {PRESET_ORDER.map((id) => (
                  <button type="button" key={id} className={`mood-pick${mood === id ? " is-active" : ""}`} onClick={() => setMood(id)}>
                    <span className="mood-pick__colors">
                      <i style={{ background: MOODS[id].palette.background }} />
                      <i style={{ background: MOODS[id].palette.primary }} />
                      <i style={{ background: MOODS[id].palette.accent }} />
                    </span>
                    <span>{MOOD_LABELS[locale][id]}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="modal__actions">
              <button className="ui-btn ui-btn--ghost" type="button" onClick={() => setModal(null)}>{dict.common.cancel}</button>
              <button className="ui-btn ui-btn--accent" type="button" onClick={createTheme} disabled={busy}>
                {busy ? dict.common.loading : dict.landing.promptCta}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === "shopify" && (
        <div className="modal-back" onClick={() => setModal(null)}>
          <div className="modal" style={{ position: "relative", maxWidth: 460 }} onClick={(event) => event.stopPropagation()}>
            <button className="modal__close" type="button" aria-label={dict.common.close} onClick={() => setModal(null)}>
              <Icon name="close" size="md" tone="ink" />
            </button>
            <h2>{dict.studio.connectShopify}</h2>
            <p>{dict.studio.shopifyHint}</p>
            {!shopifyConfigured && <div className="banner banner--warn">{dict.studio.shopifyNotConfigured}</div>}
            {user.shopifyConnected ? (
              <div className="banner banner--ok">{dict.studio.connected.replace("{shop}", user.shopifyShop ?? "")}</div>
            ) : (
              <>
                <div className="input-group">
                  <label htmlFor="shop-domain">Shopify</label>
                  <input id="shop-domain" className="input" value={shopDomain} placeholder={dict.studio.shopDomain} onChange={(event) => setShopDomain(event.target.value)} />
                </div>
                <button className="ui-btn ui-btn--accent ui-btn--block" type="button" onClick={connectShopify} disabled={!shopifyConfigured}>
                  {dict.studio.connect}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
