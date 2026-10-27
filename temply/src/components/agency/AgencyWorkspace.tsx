"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Locale, MoodId } from "@/lib/theme/types";
import { getAgencyStrings } from "@/lib/i18n/agency";
import { AGENCY_PLAN_ORDER, agencyPlan, type AgencyPlanId } from "@/lib/agency-plans";
import { Icon } from "@/components/Icon";

type Workspace = {
  agency: { id: string; name: string; plan: AgencyPlanId; brand_name: string; brand_color: string; white_label: number };
  plan: ReturnType<typeof agencyPlan>;
  usage: { copy: number; images: number };
  projects: {
    projectId: string;
    name: string;
    status: "draft" | "review" | "approved" | "delivered";
    clientName: string;
    shopDomain: string;
    updatedAt: string;
    versionCount: number;
    config: { shop: { name: string; tagline: string }; palette: { primary: string; background: string } };
    review: { token: string; status: string; clientName: string; comments: number } | null;
  }[];
  clients: { id: string; name: string; shopDomain: string; contactEmail: string }[];
  members: { id: string; email: string; name: string; role: string; status: string }[];
  library: { id: string; kind: string; name: string; createdAt: string }[];
  reviews: { id: string; projectId: string; token: string; clientName: string; status: string; comments: number; updatedAt: string }[];
};

const MOODS: MoodId[] = ["minimal", "warm", "playful", "luxe", "nature", "neon"];
const KINDS = ["theme", "section", "brand", "tokens", "conversion"] as const;

export function AgencyWorkspace({ locale, initial }: { locale: Locale; initial: Workspace }) {
  const t = getAgencyStrings(locale);
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState<"overview" | "projects" | "library" | "team" | "reviews" | "settings">("overview");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const [clientName, setClientName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [shopDomain, setShopDomain] = useState("");
  const [prompt, setPrompt] = useState("");
  const [mood, setMood] = useState<MoodId>("warm");
  const [libraryId, setLibraryId] = useState("");

  const [memberEmail, setMemberEmail] = useState("");
  const [memberName, setMemberName] = useState("");
  const [memberRole, setMemberRole] = useState("designer");

  const [saveKind, setSaveKind] = useState<Record<string, (typeof KINDS)[number]>>({});
  const [target, setTarget] = useState<Record<string, string>>({});

  const [agencyName, setAgencyName] = useState(data.agency.name);
  const [brandName, setBrandName] = useState(data.agency.brand_name);
  const [brandColor, setBrandColor] = useState(data.agency.brand_color);
  const [planId, setPlanId] = useState<AgencyPlanId>(data.agency.plan);
  const [whiteLabel, setWhiteLabel] = useState(Boolean(data.agency.white_label));

  const plan = agencyPlan(planId);
  const seatsUsed = data.members.length + 1;
  const statusLabel = (status: string) =>
    status === "approved"
      ? t.statusApproved
      : status === "review" || status === "pending"
        ? t.statusReview
        : status === "changes"
          ? t.statusChanges
          : status === "delivered"
            ? t.delivered
            : t.statusDraft;

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  };

  const refresh = async () => {
    const res = await fetch("/api/agency", { cache: "no-store" });
    if (res.ok) {
      const next = (await res.json()) as Workspace;
      setData(next);
      setPlanId(next.agency.plan);
      setWhiteLabel(Boolean(next.agency.white_label));
      return next;
    }
    return null;
  };

  const run = async (work: () => Promise<Response>, success?: string) => {
    setBusy(true);
    try {
      const res = await work();
      const json = (await res.json().catch(() => ({}))) as { error?: string; projectId?: string };
      if (!res.ok) {
        flash(json.error === "project_limit" ? t.projectLimit : json.error === "ai_limit" ? t.aiLimit : json.error === "review_locked" ? t.reviewLocked : json.error === "member_limit" ? t.projectLimit : (json.error ?? dictError()));
        return null;
      }
      await refresh();
      if (success) flash(success);
      return json;
    } finally {
      setBusy(false);
    }
  };

  const dictError = () => (locale === "sv" ? "Något gick fel. Försök igen." : "Something went wrong. Try again.");

  const createProject = async () => {
    const result = await run(
      () =>
        fetch("/api/agency/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientName, name: projectName, shopDomain, prompt, mood, libraryId: libraryId || undefined }),
        }),
      t.createProject,
    );
    if (result?.projectId) {
      setModal(false);
      setClientName("");
      setProjectName("");
      setShopDomain("");
      setPrompt("");
      router.push(`/${locale}/studio/${result.projectId}`);
    }
  };

  const requestReview = async (projectId: string, name: string) => {
    const result = await run(
      () => fetch("/api/agency/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, clientName: name }) }),
      t.requestReview,
    );
    if (result && typeof result === "object" && "token" in result) {
      const token = (result as { token?: string }).token;
      if (token) {
        await navigator.clipboard.writeText(`${window.location.origin}/${locale}/review/${token}`).catch(() => undefined);
        setCopied(token);
      }
    }
  };

  const copyReview = async (token: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/${locale}/review/${token}`).catch(() => undefined);
    setCopied(token);
    flash(t.copied);
    window.setTimeout(() => setCopied(null), 2200);
  };

  const saveToLibrary = async (projectId: string, kind: (typeof KINDS)[number]) => {
    await run(
      () => fetch("/api/agency/library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", projectId, kind }) }),
      t.saved,
    );
  };

  const applyItem = async (itemId: string, kind: string) => {
    // Väljaren visar första projektet tills kunden ändrar den – använd samma
    // standardvärde här så att "Använd" gör något även utan ett aktivt val.
    const targetId = target[itemId] ?? data.projects[0]?.projectId;
    if (kind === "theme") {
      const name = window.prompt(t.clientLabel);
      if (!name) return;
      const result = await run(
        () => fetch("/api/agency/library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "apply", itemId, clientName: name }) }),
        t.applied,
      );
      if (result?.projectId) router.push(`/${locale}/studio/${result.projectId}`);
      return;
    }
    if (!targetId) return;
    await run(
      () => fetch("/api/agency/library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "apply", itemId, projectId: targetId }) }),
      t.applied,
    );
  };

  const invite = async () => {
    await run(
      () => fetch("/api/agency/members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: memberEmail, name: memberName, role: memberRole }) }),
      t.invited,
    );
    setMemberEmail("");
    setMemberName("");
  };

  const saveSettings = async () => {
    await run(
      () =>
        fetch("/api/agency", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: agencyName, plan: planId, brandName, brandColor, whiteLabel }),
        }),
      t.saveSettings,
    );
  };

  const tabs: { id: typeof tab; label: string; icon: "grid" | "layers" | "palette" | "shield" | "eye" | "settings" }[] = [
    { id: "overview", label: t.tabOverview, icon: "grid" },
    { id: "projects", label: t.tabProjects, icon: "layers" },
    { id: "library", label: t.tabLibrary, icon: "palette" },
    { id: "team", label: t.tabTeam, icon: "shield" },
    { id: "reviews", label: t.tabReviews, icon: "eye" },
    { id: "settings", label: t.tabSettings, icon: "settings" },
  ];

  return (
    <div className="agw">
      <header className="agw-top">
        <div className="wrap agw-top__inner">
          <Link className="agw-brand" href={`/${locale}/agency`}>
            <span className="agw-brand__mark" style={{ background: data.agency.brand_color }}>TG</span>
            <span><b>{data.agency.name}</b><small>{t.wsTitle}</small></span>
          </Link>
          <div className="agw-top__actions">
            <span className="pill agw-plan">{agencyPlan(planId).name}</span>
            <Link className="ui-btn ui-btn--ghost ui-btn--sm" href={`/${locale}/dashboard`}>{t.nav === "Byrå" ? "Studio" : "Studio"}</Link>
            <button className="ui-btn ui-btn--accent ui-btn--sm" type="button" onClick={() => setModal(true)}>
              <Icon name="plus" size="xs" /> {t.newProject}
            </button>
          </div>
        </div>
      </header>

      <div className="wrap agw-shell">
        <nav className="agw-tabs" aria-label={t.wsTitle}>
          {tabs.map((item) => (
            <button key={item.id} type="button" className={tab === item.id ? "is-active" : ""} onClick={() => setTab(item.id)}>
              <Icon name={item.icon} size="xs" /> {item.label}
            </button>
          ))}
        </nav>

        {tab === "overview" && (
          <div className="agw-stack">
            <div className="agw-stats">
              <article><strong>{data.projects.length}</strong><span>{t.tabProjects}</span><small>{data.plan.projects === Number.POSITIVE_INFINITY ? "∞" : `${data.plan.projects} ${t.usageOf}`}</small></article>
              <article><strong>{data.projects.filter((p) => p.status === "review").length}</strong><span>{t.statusReview}</span><small>{t.tabReviews}</small></article>
              <article><strong>{data.projects.filter((p) => p.status === "approved" || p.status === "delivered").length}</strong><span>{t.statusApproved}</span><small>{t.download}</small></article>
              <article><strong>{seatsUsed}</strong><span>{t.seats}</span><small>{data.plan.members === Number.POSITIVE_INFINITY ? "∞" : `${data.plan.members} max`}</small></article>
            </div>

            <div className="agw-cols">
              <section className="agw-panel">
                <div className="agw-panel__head">
                  <b>{t.tabProjects}</b>
                  <button className="ag-inline-link" type="button" onClick={() => setModal(true)}>{t.newProject} <Icon name="arrowRight" size="xs" /></button>
                </div>
                {data.projects.length === 0 ? (
                  <p className="hint">{t.emptyProjects}</p>
                ) : (
                  data.projects.slice(0, 5).map((project) => (
                    <div className="agw-row" key={project.projectId}>
                      <span className="agw-row__swatch" style={{ background: project.config.palette.primary }} />
                      <span className="agw-row__main"><b>{project.name}</b><small>{project.clientName} {project.shopDomain ? `· ${project.shopDomain}` : ""}</small></span>
                      <span className={`ag-chip ag-chip--${project.status === "review" ? "review" : project.status === "approved" || project.status === "delivered" ? "approved" : "draft"}`}>{statusLabel(project.status)}</span>
                      <Link className="ui-btn ui-btn--ghost ui-btn--sm" href={`/${locale}/studio/${project.projectId}`}>{t.openStudio}</Link>
                    </div>
                  ))
                )}
              </section>

              <aside className="agw-panel agw-usage">
                <div className="agw-panel__head"><b>{t.usageTitle}</b><span className="pill">{agencyPlan(planId).name}</span></div>
                <div className="agw-usage__item">
                  <span><Icon name="sparkles" size="xs" /> {t.usageCopy}</span>
                  <b>{data.usage.copy} <small>/ {data.plan.aiCopy}</small></b>
                  <div className="ag-meter"><i style={{ width: `${Math.min(100, (data.usage.copy / data.plan.aiCopy) * 100)}%` }} /></div>
                </div>
                <div className="agw-usage__item">
                  <span><Icon name="image" size="xs" /> {t.usageImages}</span>
                  <b>{data.usage.images} <small>/ {data.plan.aiImages}</small></b>
                  <div className="ag-meter"><i style={{ width: `${Math.min(100, (data.usage.images / data.plan.aiImages) * 100)}%` }} /></div>
                </div>
                <p className="hint">{t.planDemo}</p>
              </aside>
            </div>
          </div>
        )}

        {tab === "projects" && (
          <div className="agw-stack">
            <div className="agw-section-head">
              <div><h2>{t.tabProjects}</h2><p>{t.wsSub}</p></div>
              <button className="ui-btn ui-btn--accent" type="button" onClick={() => setModal(true)}><Icon name="plus" size="xs" /> {t.newProject}</button>
            </div>
            {data.projects.length === 0 && <div className="agw-empty"><p>{t.emptyProjects}</p></div>}
            <div className="agw-grid">
              {data.projects.map((project) => (
                <article className="agw-card" key={project.projectId}>
                  <div className="agw-card__visual" style={{ background: `linear-gradient(135deg, ${project.config.palette.background}, ${project.config.palette.primary})` }}>
                    <span>{project.config.shop.name}</span>
                    <i>{project.name.slice(0, 1)}</i>
                  </div>
                  <div className="agw-card__body">
                    <div className="agw-card__title">
                      <h3>{project.name}</h3>
                      <span className={`ag-chip ag-chip--${project.status === "review" ? "review" : project.status === "approved" || project.status === "delivered" ? "approved" : "draft"}`}>{statusLabel(project.status)}</span>
                    </div>
                    <p>{project.clientName}{project.shopDomain ? ` · ${project.shopDomain}` : ""}</p>
                    <div className="agw-card__links">
                      <Link className="ui-btn ui-btn--ghost ui-btn--sm" href={`/${locale}/studio/${project.projectId}`}>{t.openStudio}</Link>
                      {project.review ? (
                        <button className="ui-btn ui-btn--ghost ui-btn--sm" type="button" onClick={() => copyReview(project.review!.token)}>
                          <Icon name="copy" size="xs" /> {copied === project.review.token ? t.copied : t.copyLink}
                        </button>
                      ) : (
                        <button className="ui-btn ui-btn--ghost ui-btn--sm" type="button" onClick={() => requestReview(project.projectId, project.clientName)} disabled={busy || !data.plan.clientReview} title={!data.plan.clientReview ? t.reviewLocked : undefined}>
                          <Icon name="eye" size="xs" /> {data.plan.clientReview ? t.requestReview : t.reviewLocked}
                        </button>
                      )}
                      {project.review?.status === "approved" && (
                        <a className="ui-btn ui-btn--ghost ui-btn--sm" href={`/api/review/${project.review.token}/download`}>{t.download}</a>
                      )}
                    </div>
                    <div className="agw-card__save">
                      <span>{t.saveBase}</span>
                      <div className="agw-select-row">
                        <select className="select" value={saveKind[project.projectId] ?? "theme"} onChange={(event) => setSaveKind({ ...saveKind, [project.projectId]: event.target.value as (typeof KINDS)[number] })}>
                          {KINDS.map((kind) => <option key={kind} value={kind}>{kindLabel(kind, t)}</option>)}
                        </select>
                        <button className="ui-btn ui-btn--ghost ui-btn--sm" type="button" onClick={() => saveToLibrary(project.projectId, saveKind[project.projectId] ?? "theme")} disabled={busy}>
                          <Icon name="save" size="xs" /> {t.apply}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {tab === "library" && (
          <div className="agw-stack">
            <div className="agw-section-head">
              <div><h2>{t.libraryTitle}</h2><p>{t.librarySub}</p></div>
            </div>
            {data.library.length === 0 ? (
              <div className="agw-empty"><p>{t.libraryEmpty}</p></div>
            ) : (
              <div className="agw-grid">
                {data.library.map((item) => (
                  <article className="agw-lib" key={item.id}>
                    <span className={`agw-lib__kind agw-lib__kind--${item.kind}`}>{kindLabel(item.kind as (typeof KINDS)[number], t)}</span>
                    <h3>{item.name}</h3>
                    <small>{new Date(item.createdAt).toLocaleDateString(locale)}</small>
                    <div className="agw-select-row">
                      <select className="select" value={target[item.id] ?? data.projects[0]?.projectId ?? ""} onChange={(event) => setTarget({ ...target, [item.id]: event.target.value })}>
                        {data.projects.map((project) => <option key={project.projectId} value={project.projectId}>{project.name}</option>)}
                      </select>
                      <button className="ui-btn ui-btn--accent ui-btn--sm" type="button" onClick={() => applyItem(item.id, item.kind)} disabled={busy || (item.kind !== "theme" && data.projects.length === 0)}>
                        {item.kind === "theme" ? t.createProject : t.apply}
                      </button>
                    </div>
                    <button className="int-link" type="button" onClick={() => run(() => fetch(`/api/agency/library?action=delete&id=${item.id}`, { method: "DELETE" }))} aria-label={t.delete}>
                      <Icon name="trash" size="xs" />
                    </button>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "team" && (
          <div className="agw-stack agw-cols">
            <section className="agw-panel">
              <div className="agw-panel__head"><b>{t.teamTitle}</b><span className="pill">{seatsUsed} / {data.plan.members === Number.POSITIVE_INFINITY ? "∞" : data.plan.members} {t.seats}</span></div>
              <p className="hint">{t.teamSub}</p>
              <div className="agw-row">
                <span className="ag-avatar">{data.agency.name.slice(0, 2).toUpperCase()}</span>
                <span className="agw-row__main"><b>{data.agency.name}</b><small>{t.ownerRole}</small></span>
                <span className="ag-chip ag-chip--approved">{t.ownerRole}</span>
              </div>
              {data.members.map((member) => (
                <div className="agw-row" key={member.id}>
                  <span className="ag-avatar">{(member.name || member.email).slice(0, 2).toUpperCase()}</span>
                  <span className="agw-row__main"><b>{member.name || member.email}</b><small>{member.email} · {member.status === "invited" ? t.invited : member.role}</small></span>
                  <select className="select" value={member.role} onChange={(event) => run(() => fetch("/api/agency/members", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: member.id, role: event.target.value }) }))}>
                    <option value="admin">{t.adminRole}</option>
                    <option value="designer">{t.designerRole}</option>
                    <option value="reviewer">{t.reviewerRole}</option>
                  </select>
                  <button className="int-link" type="button" onClick={() => run(() => fetch(`/api/agency/members?id=${member.id}`, { method: "DELETE" }))} aria-label={t.delete}><Icon name="trash" size="xs" /></button>
                </div>
              ))}
            </section>
            <aside className="agw-panel">
              <div className="agw-panel__head"><b>{t.invite}</b></div>
              <div className="agw-form">
                <input className="input" placeholder={t.name} value={memberName} onChange={(event) => setMemberName(event.target.value)} />
                <input className="input" placeholder={t.email} value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} />
                <select className="select" value={memberRole} onChange={(event) => setMemberRole(event.target.value)}>
                  <option value="admin">{t.adminRole}</option>
                  <option value="designer">{t.designerRole}</option>
                  <option value="reviewer">{t.reviewerRole}</option>
                </select>
                <button className="ui-btn ui-btn--accent ui-btn--block" type="button" onClick={invite} disabled={busy || !memberEmail.trim()}>{t.invite}</button>
              </div>
            </aside>
          </div>
        )}

        {tab === "reviews" && (
          <div className="agw-stack">
            <div className="agw-section-head">
              <div><h2>{t.reviewsTitle}</h2><p>{t.reviewsSub}</p></div>
            </div>
            {!data.plan.clientReview && <div className="banner banner--warn">{t.reviewLocked}</div>}
            {data.reviews.length === 0 ? (
              <div className="agw-empty"><p>{t.reviewsEmpty}</p></div>
            ) : (
              data.reviews.map((review) => (
                <div className="agw-row" key={review.id}>
                  <span className={`ag-chip ag-chip--${review.status === "approved" ? "approved" : review.status === "changes" ? "draft" : "review"}`}>
                    {review.status === "approved" ? t.statusApproved : t.statusReview}
                  </span>
                  <span className="agw-row__main"><b>{data.projects.find((project) => project.projectId === review.projectId)?.name ?? t.tabProjects}</b><small>{review.clientName} · {review.comments} {t.commentCount}</small></span>
                  <button className="ui-btn ui-btn--ghost ui-btn--sm" type="button" onClick={() => copyReview(review.token)}><Icon name="copy" size="xs" /> {copied === review.token ? t.copied : t.copyLink}</button>
                  <Link className="ui-btn ui-btn--accent ui-btn--sm" href={`/${locale}/review/${review.token}`}>{t.reviewOpen}</Link>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "settings" && (
          <div className="agw-stack agw-cols">
            <section className="agw-panel">
              <div className="agw-panel__head"><b>{t.settingsTitle}</b></div>
              <p className="hint">{t.settingsSub}</p>
              <div className="agw-form">
                <label>{t.agencyName}<input className="input" value={agencyName} onChange={(event) => setAgencyName(event.target.value)} /></label>
                <label>{t.brandName}<input className="input" value={brandName} onChange={(event) => setBrandName(event.target.value)} /></label>
                <label>{t.brandColor}<input className="input" type="color" value={brandColor} onChange={(event) => setBrandColor(event.target.value)} /></label>
                <label>{t.planLabel}
                  <select className="select" value={planId} onChange={(event) => { const next = event.target.value as AgencyPlanId; setPlanId(next); if (!agencyPlan(next).whiteLabel) setWhiteLabel(false); }}>
                    {AGENCY_PLAN_ORDER.map((id) => <option key={id} value={id}>{agencyPlan(id).name} · ${agencyPlan(id).priceUsd}</option>)}
                  </select>
                </label>
                <label className="agw-toggle">
                  <span>{t.whiteLabel}{!plan.whiteLabel && <small>{t.whiteLabelHint}</small>}</span>
                  <button type="button" className={`toggle${whiteLabel ? " is-on" : ""}`} aria-pressed={whiteLabel} disabled={!plan.whiteLabel} onClick={() => setWhiteLabel(!whiteLabel)}><i /></button>
                </label>
                <button className="ui-btn ui-btn--accent ui-btn--block" type="button" onClick={saveSettings} disabled={busy}>{t.saveSettings}</button>
                <p className="hint">{t.planDemo}</p>
              </div>
            </section>
            <aside className="agw-panel agw-usage">
              <div className="agw-panel__head"><b>{t.usageTitle}</b></div>
              <div className="agw-usage__item">
                <span>{t.usageCopy}</span>
                <b>{data.usage.copy} <small>/ {data.plan.aiCopy}</small></b>
                <div className="ag-meter"><i style={{ width: `${Math.min(100, (data.usage.copy / data.plan.aiCopy) * 100)}%` }} /></div>
              </div>
              <div className="agw-usage__item">
                <span>{t.usageImages}</span>
                <b>{data.usage.images} <small>/ {data.plan.aiImages}</small></b>
                <div className="ag-meter"><i style={{ width: `${Math.min(100, (data.usage.images / data.plan.aiImages) * 100)}%` }} /></div>
              </div>
              <p className="hint">{t.fairNote ?? ""}</p>
            </aside>
          </div>
        )}
      </div>

      {modal && (
        <div className="modal-back" onClick={() => setModal(false)}>
          <div className="modal" style={{ position: "relative", maxWidth: 520 }} onClick={(event) => event.stopPropagation()}>
            <button className="modal__close" type="button" aria-label={t.cancel} onClick={() => setModal(false)}><Icon name="close" size="md" tone="ink" /></button>
            <h2>{t.newProject}</h2>
            <p>{t.wsSub}</p>
            <div className="agw-form">
              <label>{t.clientLabel}<input className="input" value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Lera & Sol" /></label>
              <label>{t.projectLabel}<input className="input" value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Keramik · höst" /></label>
              <label>{t.shopLabel}<input className="input" value={shopDomain} onChange={(event) => setShopDomain(event.target.value)} placeholder="lera-och-sol.myshopify.com" /></label>
              <label>{t.promptLabel}<textarea className="textarea" rows={3} value={prompt} onChange={(event) => setPrompt(event.target.value)} /></label>
              <label>{t.moodLabel}
                <select className="select" value={mood} onChange={(event) => setMood(event.target.value as MoodId)}>
                  {MOODS.map((id) => <option key={id} value={id}>{id}</option>)}
                </select>
              </label>
              {data.library.some((item) => item.kind === "theme") && (
                <label>{t.libTheme}
                  <select className="select" value={libraryId} onChange={(event) => setLibraryId(event.target.value)}>
                    <option value="">{t.libNone}</option>
                    {data.library.filter((item) => item.kind === "theme").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
              )}
              <div className="modal__actions">
                <button className="ui-btn ui-btn--ghost" type="button" onClick={() => setModal(false)}>{t.cancel}</button>
                <button className="ui-btn ui-btn--accent" type="button" onClick={createProject} disabled={busy || !clientName.trim()}>{busy ? "…" : t.createProject}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function kindLabel(kind: (typeof KINDS)[number], t: ReturnType<typeof getAgencyStrings>): string {
  return kind === "theme" ? t.libTheme : kind === "section" ? t.libSection : kind === "brand" ? t.libBrand : kind === "tokens" ? t.libTokens : t.libConversion;
}
