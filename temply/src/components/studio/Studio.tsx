"use client";

import Link from "next/link";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { Access } from "@/lib/db";
import type { Dict } from "@/lib/i18n";
import { interpolate } from "@/lib/i18n";
import type { ProjectSummary } from "@/lib/projects";
import type { ThemeConfig, Section, Locale, SectionType } from "@/lib/theme/types";
import { FONTS } from "@/lib/theme/types";
import { emptySection } from "@/lib/theme/presets";
import { SECTION_LABELS } from "@/lib/theme/labels";
import StorefrontPreview, { type PreviewPage } from "@/components/StorefrontPreview";
import { LanguageMenu } from "@/components/marketing/LanguageMenu";
import { Brand } from "@/components/marketing/Brand";
import { QuickShape, SpacingWidget, TypeButtons } from "./controls";
import { AiPanel, ContentPanel, DesignPanel, EasyPanel, SectionsPanel } from "./panels";
import { BrandPanel, ConversionPanel, CopyPanel, HistoryPanel, MediaPanel, PAGE_LABELS, TokensPanel } from "./panels2";
import { CanvaPanel, IntegrationsPanel } from "./IntegrationsPanel";
import { LayoutPanel, MarketPanel } from "./panels3";
import { getLayoutStrings } from "@/lib/i18n/layout";
import { getPro } from "@/lib/i18n/pro";
import { getIntegrationStrings } from "@/lib/i18n/integrations";
import { getInsightsStrings } from "@/lib/i18n/insights";
import { HealthPanel } from "./HealthPanel";
import { StatsPanel } from "./StatsPanel";
import { Inspector } from "./Inspector";
import { AdvancedInspector, AdvancedSidebar, AdvancedStage, type AdvancedTool } from "./advanced/AdvancedWorkspace";
import { getAdvanced } from "@/lib/i18n/advanced";
import { canvasForPage, canvasHasContent, pageStarterCanvas, withPageCanvas } from "@/lib/advanced/canvas";
import { syncAdvancedToTheme, syncThemeToAdvanced } from "@/lib/advanced/sync";
import { Icon } from "@/components/Icon";

type Props = {
  locale: Locale;
  dict: Dict;
  project: ProjectSummary;
  access: Access;
  shopifyConfigured: boolean;
  shopifyShop: string | null;
  shopifyConnected: boolean;
  notice?: string;
};

type State = { config: ThemeConfig; past: ThemeConfig[]; future: ThemeConfig[]; pendingVersion: string | null };
type Action =
  | { type: "commit"; recipe: (config: ThemeConfig) => ThemeConfig; label?: string }
  | { type: "versionSaved" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "rename"; name: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "commit": {
      const next = action.recipe(state.config);
      if (next === state.config) return state;
      return { config: next, past: [...state.past.slice(-59), state.config], future: [], pendingVersion: action.label ?? state.pendingVersion };
    }
    case "versionSaved":
      return { ...state, pendingVersion: null };
    case "rename":
      return { ...state, config: { ...state.config, name: action.name } };
    case "undo": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return { config: previous, past: state.past.slice(0, -1), future: [state.config, ...state.future].slice(0, 60), pendingVersion: null };
    }
    case "redo": {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return { config: next, past: [...state.past, state.config].slice(-60), future: state.future.slice(1), pendingVersion: null };
    }
  }
}

function FontLoader({ config }: { config: ThemeConfig }) {
  useEffect(() => {
    const href = `https://fonts.googleapis.com/css2?family=${FONTS[config.typography.heading].google}&family=${FONTS[config.typography.body].google}&display=swap`;
    let link = document.getElementById("temply-theme-fonts") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = "temply-theme-fonts";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = href;
  }, [config.typography.heading, config.typography.body]);
  return null;
}

type ShopifyTheme = { id: string; name: string; role: string };

const PAGE_KEYS: PreviewPage[] = ["home", "product", "collection", "search", "about", "contact", "cart", "404"];

export function Studio({ locale, dict, project, access, shopifyConfigured, shopifyShop, shopifyConnected, notice }: Props) {
  const [state, dispatch] = useReducer(reducer, { config: project.config, past: [], future: [], pendingVersion: null });
  const config = state.config;
  const [name, setName] = useState(project.name);
  const [selected, setSelected] = useState<string | null>(
    config.builder?.mode === "advanced" ? canvasForPage(config, "home").nodes[0]?.id ?? null : config.sections[0]?.id ?? null,
  );
  const [tab, setTab] = useState<
    | "easy"
    | "sections"
    | "layout"
    | "markets"
    | "design"
    | "brand"
    | "media"
    | "integrations"
    | "conversion"
    | "copy"
    | "content"
    | "ai"
    | "health"
    | "stats"
    | "history"
  >("easy");
  const pro = getPro(locale);
  const adv = getAdvanced(locale);
  const insightStrings = getInsightsStrings(locale);
  const integrationsStrings = getIntegrationStrings(locale);
  const layoutStrings = getLayoutStrings(locale);
  const [mode, setMode] = useState<"easy" | "pro">("easy");
  const [builderMode, setBuilderMode] = useState<"theme" | "advanced">(config.builder?.mode ?? "theme");
  const [advancedTool, setAdvancedTool] = useState<AdvancedTool>("select");
  const [advancedInspectorOpen, setAdvancedInspectorOpen] = useState(false);
  const [chromeMode, setChromeMode] = useState(false);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [page, setPage] = useState<PreviewPage>("home");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [modal, setModal] = useState<null | "export" | "publish">(null);
  const [toast, setToast] = useState<string | null>(notice ?? null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [prefsReady, setPrefsReady] = useState(false);

  useEffect(() => {
    if (window.innerWidth < 680) setPanelOpen(true);
  }, []);
  const [themes, setThemes] = useState<ShopifyTheme[] | null>(null);
  const [targetTheme, setTargetTheme] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ adminUrl: string; uploaded: number; errors: string[] } | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [shopDomain, setShopDomain] = useState(shopifyShop?.replace(".myshopify.com", "") ?? "");
  const lastSaved = useRef(project.config);
  const lastSelection = useRef<{ theme: string | null; advanced: string | null }>({ theme: null, advanced: null });

  const commit = useCallback((recipe: (current: ThemeConfig) => ThemeConfig) => dispatch({ type: "commit", recipe }), []);
  const commitVersioned = useCallback(
    (recipe: (current: ThemeConfig) => ThemeConfig, label: string) => dispatch({ type: "commit", recipe, label }),
    [],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod || event.key.toLowerCase() !== "z") return;
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      event.preventDefault();
      dispatch({ type: event.shiftKey ? "redo" : "undo" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (config === lastSaved.current) return;
    setSaveState("saving");
    const timer = setTimeout(async () => {
      try {
        const payload = { name, config: { ...config, name }, versionLabel: state.pendingVersion ?? undefined };
        const res = await fetch(`/api/projects/${project.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          setSaveState("error");
          return;
        }
        lastSaved.current = config;
        setSaveState("saved");
        if (state.pendingVersion) dispatch({ type: "versionSaved" });
      } catch {
        setSaveState("error");
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [config, name, project.id, state.pendingVersion]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (modal !== "publish" || !shopifyConnected || !shopifyConfigured) return;
    let active = true;
    fetch(`/api/projects/${project.id}/publish`)
      .then((res) => res.json())
      .then((json: { themes?: ShopifyTheme[] }) => {
        if (active && json.themes) setThemes(json.themes);
      })
      .catch(() => {
        if (active) setPublishError(dict.common.error);
      });
    return () => {
      active = false;
    };
  }, [modal, shopifyConnected, shopifyConfigured, project.id, dict.common.error]);

  const sections = config.sections;
  const selectedSection = sections.find((section) => section.id === selected) ?? null;

  const action = (kind: "up" | "down" | "duplicate" | "delete", id: string) => {
    if (kind === "delete") {
      commit((current) => ({ ...current, sections: current.sections.filter((section) => section.id !== id) }));
      setSelected(null);
      return;
    }
    if (kind === "duplicate") {
      commit((current) => {
        const index = current.sections.findIndex((section) => section.id === id);
        if (index < 0) return current;
        const clone = { ...current.sections[index], id: `${current.sections[index].type}-${Math.random().toString(36).slice(2, 7)}` } as Section;
        const next = [...current.sections];
        next.splice(index + 1, 0, clone);
        return { ...current, sections: next };
      });
      return;
    }
    commit((current) => {
      const index = current.sections.findIndex((section) => section.id === id);
      if (index < 0) return current;
      const swap = kind === "up" ? index - 1 : index + 1;
      if (swap < 0 || swap >= current.sections.length) return current;
      const next = [...current.sections];
      [next[index], next[swap]] = [next[swap], next[index]];
      return { ...current, sections: next };
    });
  };

  const switchBuilder = (next: "theme" | "advanced") => {
    if (next === builderMode) return;
    // Båda lägena delar samma innehåll: sektioner synkas in i canvasen när
    // Advanced öppnas och tillbaka till sektionerna när temat väljs igen.
    lastSelection.current[builderMode] = selected;
    let nextConfig = next === "advanced" ? syncThemeToAdvanced(config) : syncAdvancedToTheme(config);
    if (next === "advanced" && page !== "home" && !canvasHasContent(canvasForPage(nextConfig, page))) {
      nextConfig = withPageCanvas(nextConfig, page, pageStarterCanvas(nextConfig, page));
    }
    const home = canvasForPage(nextConfig, "home");
    const pageCanvas = canvasForPage(nextConfig, page);
    const selectionCanvas = chromeMode ? (nextConfig.builder.chrome ?? pageCanvas) : pageCanvas;
    commit(() => ({
      ...nextConfig,
      builder: { ...nextConfig.builder, mode: next, canvas: home, canvases: { ...nextConfig.builder.canvases, home, [page]: pageCanvas } },
    }));
    setBuilderMode(next);
    setAdvancedTool("select");
    const remembered = lastSelection.current[next];
    const stillExists =
      next === "advanced"
        ? remembered === "__header" || remembered === "__footer" || selectionCanvas.nodes.some((node) => node.id === remembered)
        : nextConfig.sections.some((section) => section.id === remembered);
    setSelected(
      stillExists
        ? remembered
        : next === "advanced"
          ? selectionCanvas.nodes[0]?.id ?? null
          : nextConfig.sections[0]?.id ?? null,
    );
  };

  const changeAdvancedPage = (next: PreviewPage) => {
    setChromeMode(false);
    setPage(next);
    setSelected(null);
    setAdvancedTool("select");
    if (builderMode !== "advanced") return;
    commit((current) => {
      const canvas = canvasForPage(current, next);
      if (canvasHasContent(canvas)) return current;
      return withPageCanvas(current, next, pageStarterCanvas(current, next));
    });
  };

  useEffect(() => {
    setBuilderMode(config.builder?.mode ?? "theme");
  }, [config.builder?.mode]);

  // Kom ihåg senaste sidan, läget och panel-fliken per projekt. Då tappar man
  // inte sin plats när man växlar mellan tema-styrt, Advanced, Enkelt och Pro.
  useEffect(() => {
    setPrefsReady(false);
    try {
      const raw = window.localStorage.getItem(`temply:studio:${project.id}`);
      if (raw) {
        const saved = JSON.parse(raw) as { page?: string; builderMode?: string; mode?: string; tab?: string };
        if (saved.page && PAGE_KEYS.includes(saved.page as PreviewPage)) setPage(saved.page as PreviewPage);
        if (saved.builderMode === "theme" || saved.builderMode === "advanced") setBuilderMode(saved.builderMode);
        if (saved.mode === "easy" || saved.mode === "pro") setMode(saved.mode);
        const validTabs = ["easy", "sections", "layout", "markets", "design", "brand", "media", "integrations", "conversion", "copy", "content", "ai", "health", "stats", "history"];
        if (saved.tab && validTabs.includes(saved.tab)) setTab(saved.tab as typeof tab);
      }
    } catch {
      /* localStorage kan vara blockerat – studion fungerar ändå */
    }
    setPrefsReady(true);
    // `tab` används bara som typ – sparade värden valideras av panelen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  useEffect(() => {
    if (!prefsReady) return;
    try {
      window.localStorage.setItem(
        `temply:studio:${project.id}`,
        JSON.stringify({ page, builderMode, mode, tab }),
      );
    } catch {
      /* ignorera otillgänglig localStorage */
    }
  }, [prefsReady, project.id, page, builderMode, mode, tab]);

  const addSection = (type: SectionType) => {
    const section = emptySection(type);
    commit((current) => ({ ...current, sections: [...current.sections, section] }));
    setSelected(section.id);
    setTab("sections");
  };

  const publish = async () => {
    setPublishing(true);
    setPublishError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetThemeId: targetTheme || undefined, publish: true }),
      });
      const json = (await res.json()) as { ok?: boolean; adminUrl?: string; uploaded?: number; errors?: string[]; error?: string };
      if (!res.ok || !json.ok) {
        setPublishError(json.error ?? dict.studio.publishErr);
        return;
      }
      setPublishResult({ adminUrl: json.adminUrl ?? "", uploaded: json.uploaded ?? 0, errors: json.errors ?? [] });
      setToast(dict.studio.publishOk);
    } catch {
      setPublishError(dict.common.error);
    } finally {
      setPublishing(false);
    }
  };

  const saveLabel = saveState === "saving" ? dict.common.saving : saveState === "error" ? dict.studio.saveError : dict.common.saved;

  return (
    <div className="studio">
      <FontLoader config={config} />
      <header className="studio-bar">
        <div className="studio-bar__left">
          <Link href={`/${locale}/dashboard`} className="icon-btn" aria-label={dict.common.back} title={dict.common.back}>
            <Icon name="arrowLeft" size="md" />
          </Link>
          <button className="icon-btn studio-menu" type="button" aria-label={dict.studio.sections} onClick={() => setPanelOpen((open) => !open)}>
            <Icon name="menu" size="md" />
          </button>
          <Brand href={`/${locale}/dashboard`} />
          <input
            className="studio-name"
            value={name}
            aria-label={dict.studio.projectName}
            onChange={(event) => {
              setName(event.target.value);
              dispatch({ type: "rename", name: event.target.value });
            }}
            onBlur={() => {
              if (name.trim()) commit((current) => ({ ...current, name: name.trim() }));
              else setName(config.name);
            }}
          />
          <span className={`save-state is-${saveState}`}>
            <i />
            {saveLabel}
          </span>
        </div>

        <div className="studio-bar__center">
          <div className="segmented builder-switch" style={{ width: 194 }} title={adv.modeSwitchHint}>
            <button type="button" className={builderMode === "theme" ? "is-active" : ""} onClick={() => switchBuilder("theme")}>{adv.themeMode}</button>
            <button type="button" className={builderMode === "advanced" ? "is-active" : ""} onClick={() => switchBuilder("advanced")}>{adv.advancedMode}</button>
          </div>
          {builderMode === "theme" && (
            <div className="segmented" style={{ width: 150 }}>
              <button type="button" className={mode === "easy" ? "is-active" : ""} onClick={() => { setMode("easy"); setTab("easy"); }}>
                {dict.studio.easy}
              </button>
              <button
                type="button"
                className={mode === "pro" ? "is-active" : ""}
                onClick={() => {
                  setMode("pro");
                  if (tab === "easy") setTab("sections");
                }}
              >
                {dict.studio.pro}
              </button>
            </div>
          )}
          <button className="icon-btn" type="button" aria-label={dict.common.undo} onClick={() => dispatch({ type: "undo" })} disabled={state.past.length === 0} title={dict.common.undo}>
            <Icon name="undo" size="md" />
          </button>
          <button className="icon-btn" type="button" aria-label={dict.common.redo} onClick={() => dispatch({ type: "redo" })} disabled={state.future.length === 0} title={dict.common.redo}>
            <Icon name="redo" size="md" />
          </button>
        </div>

        <div className="studio-bar__right">
          {access.status === "trial" && (
            <span className="pill" style={{ fontSize: 10 }}>
              {interpolate(dict.studio.trialBanner, { days: access.daysLeft })}
            </span>
          )}
          <div className="segmented" style={{ width: 116 }}>
            <button type="button" className={device === "desktop" ? "is-active" : ""} aria-label={dict.common.desktop} onClick={() => setDevice("desktop")} title={dict.common.desktop}>
              <Icon name="desktop" size="sm" />
            </button>
            <button type="button" className={device === "mobile" ? "is-active" : ""} aria-label={dict.common.mobile} onClick={() => setDevice("mobile")} title={dict.common.mobile}>
              <Icon name="mobile" size="sm" />
            </button>
          </div>
          <button className="ui-btn ui-btn--ghost ui-btn--sm" type="button" onClick={() => setModal("export")}>
            {dict.common.export}
          </button>
          <button className="ui-btn ui-btn--sm" type="button" onClick={() => setModal("publish")}>
            {dict.common.publish}
          </button>
        </div>
      </header>

      <div className="studio-body">
        <aside className={`studio-left${panelOpen ? " is-open" : ""}`}>
          <div className="studio-mode-mobile">
            <div className="segmented" style={{ width: 194 }}>
              <button type="button" className={builderMode === "theme" ? "is-active" : ""} onClick={() => switchBuilder("theme")}>{adv.themeMode}</button>
              <button type="button" className={builderMode === "advanced" ? "is-active" : ""} onClick={() => switchBuilder("advanced")}>{adv.advancedMode}</button>
            </div>
            {builderMode === "theme" && (
              <div className="segmented" style={{ width: 150 }}>
                <button type="button" className={mode === "easy" ? "is-active" : ""} onClick={() => { setMode("easy"); setTab("easy"); }}>
                  {dict.studio.easy}
                </button>
                <button
                  type="button"
                  className={mode === "pro" ? "is-active" : ""}
                  onClick={() => {
                    setMode("pro");
                    if (tab === "easy") setTab("sections");
                  }}
                >
                  {dict.studio.pro}
                </button>
              </div>
            )}
            <button type="button" className="icon-btn" aria-label={dict.common.close} onClick={() => setPanelOpen(false)}>
              <Icon name="close" size="md" />
            </button>
          </div>
          {builderMode === "advanced" ? (
            <AdvancedSidebar
              config={config}
              update={commit}
              locale={locale}
              selectedId={selected}
              onSelect={setSelected}
              page={page}
              chromeMode={chromeMode}
              tool={advancedTool}
              onTool={setAdvancedTool}
            />
          ) : mode === "easy" ? (
            <div className="studio-panel">
              <EasyPanel config={config} update={commit} locale={locale} dict={dict} />
            </div>
          ) : (
            <>
              <div className="studio-tabs">
                {(
                  [
                    ["sections", dict.studio.sections],
                    ["layout", layoutStrings.title],
                    ["markets", layoutStrings.marketTitle],
                    ["design", dict.studio.design],
                    ["brand", pro.brandTitle],
                    ["media", pro.mediaTitle],
                    ["integrations", integrationsStrings.tab],
                    ["conversion", pro.convTitle],
                    ["copy", pro.copyTitle],
                    ["content", dict.studio.content],
                    ["ai", dict.studio.ai],
                    ["health", insightStrings.healthTitle],
                    ["stats", insightStrings.statsTitle],
                    ["history", pro.historyTitle],
                  ] as const
                ).map(([id, label]) => (
                  <button key={id} type="button" className={`studio-tab${tab === id ? " is-active" : ""}`} onClick={() => setTab(id)}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="studio-panel">
                {tab === "sections" && (
                  <SectionsPanel config={config} update={commit} dict={dict} locale={locale} selectedId={selected} onSelect={(id) => setSelected(id)} />
                )}
                {tab === "layout" && <LayoutPanel config={config} update={commit} locale={locale} />}
                {tab === "markets" && <MarketPanel config={config} update={commit} locale={locale} />}
                {tab === "design" && (
                  <>
                    <DesignPanel config={config} update={commit} dict={dict} locale={locale} />
                    <TokensPanel config={config} update={commit} locale={locale} dict={dict} pro={pro} />
                  </>
                )}
                {tab === "brand" && <BrandPanel config={config} update={commit} locale={locale} dict={dict} projectId={project.id} pro={pro} />}
                {tab === "media" && <MediaPanel config={config} update={commit} locale={locale} dict={dict} projectId={project.id} pro={pro} />}
                {tab === "integrations" && (
                  <>
                    <IntegrationsPanel
                      config={config}
                      update={commit}
                      versioned={commitVersioned}
                      locale={locale}
                      shopifyShop={shopifyShop}
                      onToast={setToast}
                    />
                    <CanvaPanel config={config} update={commit} versioned={commitVersioned} locale={locale} onToast={setToast} />
                  </>
                )}
                {tab === "conversion" && (
                  <ConversionPanel config={config} update={commit} locale={locale} dict={dict} pro={pro} />
                )}
                {tab === "copy" && <CopyPanel config={config} update={commit} locale={locale} dict={dict} projectId={project.id} pro={pro} />}
                {tab === "health" && (
                  <HealthPanel
                    config={config}
                    update={commit}
                    locale={locale}
                    projectId={project.id}
                    shopConnected={shopifyConnected}
                    onToast={setToast}
                  />
                )}
                {tab === "stats" && (
                  <StatsPanel locale={locale} projectId={project.id} shopifyShop={shopifyShop} shopifyConnected={shopifyConnected} />
                )}
                {tab === "history" && <HistoryPanel pro={pro} projectId={project.id} onRestore={(restored) => commit(() => restored)} />}
                {tab === "content" && <ContentPanel config={config} update={commit} dict={dict} />}
                {tab === "ai" && (
                  <AiPanel
                    dict={dict}
                    examples={dict.landing.chips}
                    projectId={project.id}
                    onApply={(next) => {
                      commit(() => next);
                      setToast(dict.common.saved);
                    }}
                  />
                )}
              </div>
            </>
          )}
        </aside>

        <section className={`studio-canvas${builderMode === "advanced" ? " studio-canvas--advanced" : ""}`}>
          {builderMode === "advanced" ? (
            <AdvancedStage
              config={config}
              update={commit}
              locale={locale}
              selectedId={selected}
              onSelect={setSelected}
              page={page}
              tool={advancedTool}
              onTool={setAdvancedTool}
              projectId={project.id}
              onToast={setToast}
              device={device}
              onToggleInspector={() => setAdvancedInspectorOpen((open) => !open)}
              pages={PAGE_KEYS}
              pageLabels={PAGE_LABELS[locale]}
              onPage={changeAdvancedPage}
              chromeMode={chromeMode}
              onChrome={setChromeMode}
            />
          ) : (
          <>
          <div className="canvas-toolbar">
            <div className="segmented page-tabs" style={{ width: "min(620px, 100%)", flexShrink: 0 }}>
              {PAGE_KEYS.map((key, index) => (
                <button key={key} type="button" className={page === key ? "is-active" : ""} onClick={() => setPage(key)}>
                  {PAGE_LABELS[locale][index]}
                </button>
              ))}
            </div>
            <span className="dot-sep" />
            <span className="hint">{dict.studio.selectHint}</span>
          </div>
          <div className="canvas-scroll">
            <div className={`device-frame${device === "mobile" ? " device-frame--mobile" : ""}`}>
              <div className="device-frame__bar">
                <span className="browser-card__dots"><i /><i /><i /></span>
                <span className="device-frame__url">{config.shop.name.toLowerCase().replace(/[^a-z0-9]+/g, "")}.se</span>
                <span style={{ width: 24 }} />
              </div>
              <div className="preview-scroll">
                <StorefrontPreview
                  config={config}
                  editable
                  selectedId={selected}
                  page={page}
                  locale={locale}
                  labels={SECTION_LABELS[locale]}
                  onChange={commit}
                  onSelect={setSelected}
                  onAction={action}
                  advancedCanvases={{ ...config.builder.canvases, home: config.builder.canvas }}
                />
              </div>
            </div>
          </div>
          <div className="quickbar">
            <QuickShape
              radius={config.shape.radius}
              label={dict.studio.quickShape}
              hint={dict.studio.dragShape}
              onChange={(radius) => commit((current) => ({ ...current, shape: { ...current.shape, radius } }))}
            />
            <span className="quickbar__divider" />
            <TypeButtons
              size={config.typography.baseSize}
              dict={dict}
              onChange={(size) => commit((current) => ({ ...current, typography: { ...current.typography, baseSize: size } }))}
            />
            <span className="quickbar__divider" />
            <SpacingWidget
              value={config.layout.sectionSpacing}
              label={dict.studio.quickSpace}
              onChange={(value) => commit((current) => ({ ...current, layout: { ...current.layout, sectionSpacing: value } }))}
            />
          </div>
          </>
          )}
        </section>

        {builderMode === "advanced" ? (
          <aside className={`studio-right studio-right--advanced${advancedInspectorOpen ? " is-open" : ""}`}>
            <AdvancedInspector
              config={config}
              update={commit}
              locale={locale}
              selectedId={selected}
              onSelect={setSelected}
              page={page}
              chromeMode={chromeMode}
            />
          </aside>
        ) : mode === "pro" && (
          <aside className="studio-right">
            {selectedSection ? (
              <Inspector
                config={config}
                update={commit}
                dict={dict}
                pro={pro}
                locale={locale}
                section={selectedSection}
                onDelete={(id) => action("delete", id)}
                onDuplicate={(id) => action("duplicate", id)}
              />
            ) : (
              <div style={{ padding: 10 }}>
                <p className="hint">{dict.studio.selectHint}</p>
              </div>
            )}
          </aside>
        )}
      </div>

      {modal === "export" && (
        <div className="modal-back" onClick={() => setModal(null)}>
          <div className="modal" style={{ position: "relative" }} onClick={(event) => event.stopPropagation()}>
            <button className="modal__close" type="button" aria-label={dict.common.close} onClick={() => setModal(null)}>
              <Icon name="close" size="md" tone="ink" />
            </button>
            <h2>{dict.studio.exportTitle}</h2>
            <p>{dict.studio.exportSub}</p>
            {access.status === "trial" && (
              <div className="banner banner--warn" style={{ marginTop: 12 }}>{dict.studio.watermarkNote}</div>
            )}
            <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 12, padding: 14, fontFamily: "monospace", fontSize: 11, lineHeight: 1.7 }}>
              layout/theme.liquid<br />
              sections/… · snippets/…<br />
              {builderMode === "advanced" && <>sections/advanced-canvas.liquid<br /></>}
              templates/index.json<br />
              config/settings_schema.json<br />
              locales/en.default.json
            </div>
            <div className="modal__actions" style={{ justifyContent: "space-between" }}>
              <button className="ui-btn ui-btn--ghost" type="button" onClick={() => setModal("publish")}>{dict.common.publish}</button>
              <a className="ui-btn ui-btn--accent" href={`/api/projects/${project.id}/export`} download onClick={() => setToast(dict.studio.exportTitle)}>
                <Icon name="downloadZip" size="sm" /> {dict.studio.downloadZip}
              </a>
            </div>
          </div>
        </div>
      )}

      {modal === "publish" && (
        <div className="modal-back" onClick={() => setModal(null)}>
          <div className="modal" style={{ position: "relative" }} onClick={(event) => event.stopPropagation()}>
            <button className="modal__close" type="button" aria-label={dict.common.close} onClick={() => setModal(null)}>
              <Icon name="close" size="md" tone="ink" />
            </button>
            <h2>{dict.studio.publishTitle}</h2>
            <p>{dict.studio.publishSub}</p>

            {!shopifyConfigured && <div className="banner banner--warn">{dict.studio.shopifyNotConfigured}</div>}

            {shopifyConfigured && !shopifyConnected && (
              <>
                <div className="banner banner--warn">{dict.studio.connectShopify}</div>
                <div className="input-group">
                  <label htmlFor="publish-shop">Shopify</label>
                  <input id="publish-shop" className="input" value={shopDomain} placeholder={dict.studio.shopDomain} onChange={(event) => setShopDomain(event.target.value)} />
                </div>
                <button
                  className="ui-btn ui-btn--accent ui-btn--block"
                  type="button"
                  onClick={() => {
                    window.location.href = `/api/shopify/install?shop=${encodeURIComponent(shopDomain)}&project=${project.id}`;
                  }}
                  disabled={!shopDomain.trim()}
                >
                  {dict.studio.connect}
                </button>
              </>
            )}

            {shopifyConfigured && shopifyConnected && !publishResult && (
              <>
                <div className="shopify-shop">
                  <Icon name="checkCircle" size="sm" /> {dict.studio.connected.replace("{shop}", shopifyShop ?? "")}
                </div>
                <div className="panel-title" style={{ marginTop: 16 }}>{dict.studio.chooseTheme}</div>
                <div className="theme-list">
                  <label className={`theme-option${targetTheme === "" ? " is-active" : ""}`}>
                    <input type="radio" name="target" checked={targetTheme === ""} onChange={() => setTargetTheme("")} />
                    {dict.studio.newThemeOption}
                  </label>
                  {themes?.map((theme) => (
                    <label key={theme.id} className={`theme-option${targetTheme === theme.id ? " is-active" : ""}`}>
                      <input type="radio" name="target" checked={targetTheme === theme.id} onChange={() => setTargetTheme(theme.id)} />
                      {theme.name} {theme.role === "main" ? "· live" : ""}
                    </label>
                  ))}
                  {!themes && <span className="hint">{dict.common.loading}</span>}
                </div>
                {publishError && <div className="banner banner--warn" style={{ marginTop: 12 }}>{publishError}</div>}
                <button className="ui-btn ui-btn--accent ui-btn--block" type="button" style={{ marginTop: 16 }} onClick={publish} disabled={publishing}>
                  {publishing ? dict.studio.publishing : dict.studio.publishBtn}
                </button>
              </>
            )}

            {publishResult && (
              <>
                <div className="banner banner--ok">{dict.studio.publishOk} · {publishResult.uploaded}</div>
                {publishResult.errors.length > 0 && (
                  <div className="banner banner--warn">
                    {publishResult.errors.slice(0, 4).map((error) => <div key={error}>{error}</div>)}
                  </div>
                )}
                <a className="ui-btn ui-btn--accent ui-btn--block" href={publishResult.adminUrl} target="_blank" rel="noreferrer">
                  {dict.studio.openInShopify} <Icon name="external" size="sm" />
                </a>
              </>
            )}

            <div style={{ borderTop: "1px solid var(--line)", marginTop: 20, paddingTop: 14, display: "flex", justifyContent: "space-between", gap: 10 }}>
              <button className="ui-btn ui-btn--ghost ui-btn--sm" type="button" onClick={() => setModal("export")}>{dict.common.export}</button>
              <button className="ui-btn ui-btn--ghost ui-btn--sm" type="button" onClick={() => setModal(null)}>{dict.common.close}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
