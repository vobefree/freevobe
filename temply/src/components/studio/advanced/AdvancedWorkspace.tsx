"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { Icon } from "@/components/Icon";
import { interpolate } from "@/lib/i18n";
import { getAdvanced } from "@/lib/i18n/advanced";
import { FONTS } from "@/lib/theme/types";
import type {
  AdvancedCanvas,
  AdvancedColorToken,
  AdvancedNode,
  AdvancedNodeType,
  AdvancedPage,
  Locale,
  ThemeConfig,
} from "@/lib/theme/types";
import {
  canvasForChrome,
  canvasForFooter,
  canvasForHeader,
  canvasForPage,
  centeredPlacement,
  cloneNode,
  colorFor,
  createNode,
  growCanvasToFit,
  HOVER_EFFECTS,
  isColorValue,
  MAX_CANVAS_HEIGHT,
  MIN_CANVAS_HEIGHT,
  nextZ,
  pageStarterCanvas,
  REVEAL_EFFECTS,
  uid,
  resizeCanvasHeight,
  withChromeCanvas,
  withFooterCanvas,
  withHeaderCanvas,
  withPageCanvas,
} from "@/lib/advanced/canvas";
import { removeLinkedSection, updateSectionFromNode } from "@/lib/advanced/sync";
import { applyDesignPlan, designVariants, type DesignPlan } from "@/lib/advanced/design";
import { canvaBrief } from "@/lib/integrations/catalog";
import { EXPORT_ICON_LABELS, EXPORT_ICON_NAMES } from "@/lib/export/icons";
import { iconifySvgUrl, sanitizeSvg, svgElement } from "@/lib/advanced/icons";
import { AdvancedCanvasView } from "./AdvancedCanvasView";

export type AdvancedTool = "select" | "draw" | "connect";

type Update = (recipe: (config: ThemeConfig) => ThemeConfig) => void;
type AdvancedTarget = AdvancedPage | "chrome" | "header" | "footer";
type Common = {
  config: ThemeConfig;
  update: Update;
  locale: Locale;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  page: AdvancedPage;
  chromeMode?: boolean;
};

function targetFor(page: AdvancedPage, chromeMode?: boolean): AdvancedTarget {
  return chromeMode ? "chrome" : page;
}

function canvasOf(config: ThemeConfig, target: AdvancedTarget): AdvancedCanvas {
  if (target === "chrome") return canvasForChrome(config);
  if (target === "header") return canvasForHeader(config);
  if (target === "footer") return canvasForFooter(config);
  return canvasForPage(config, target);
}

function withCanvas(config: ThemeConfig, target: AdvancedTarget, canvas: AdvancedCanvas): ThemeConfig {
  if (target === "chrome") return withChromeCanvas(config, canvas);
  if (target === "header") return withHeaderCanvas(config, canvas);
  if (target === "footer") return withFooterCanvas(config, canvas);
  return withPageCanvas(config, target, canvas);
}

/** Hitta en nod oavsett om den ligger i sidhuvudet, sidfoten eller sidan. */
function locateNode(
  config: ThemeConfig,
  target: AdvancedTarget,
  id: string | null,
): { target: AdvancedTarget; canvas: AdvancedCanvas; node: AdvancedNode } | null {
  if (!id) return null;
  const order: AdvancedTarget[] = [target, "header", "footer", "chrome", "home", "product", "collection", "search", "about", "contact", "cart", "404"];
  for (const entry of order) {
    const canvas = canvasOf(config, entry);
    const node = canvas.nodes.find((item) => item.id === id);
    if (node) return { target: entry, canvas, node };
  }
  return null;
}

function withNodes(config: ThemeConfig, target: AdvancedTarget, nodes: AdvancedNode[]): ThemeConfig {
  const base = canvasOf(config, target);
  // Sidhuvud, sidfot och det globala lagret har sin egen höjd. Bara en vanlig
  // sida växer automatiskt när något dras långt ned.
  const next = target === "header" || target === "footer" || target === "chrome" ? { ...base, nodes } : growCanvasToFit({ ...base, nodes });
  return withCanvas(config, target, next);
}

function patchNode(config: ThemeConfig, target: AdvancedTarget, id: string, patch: Partial<AdvancedNode>): ThemeConfig {
  const canvas = canvasOf(config, target);
  const current = canvas.nodes.find((node) => node.id === id);
  if (!current) return config;
  const nextNode = { ...current, ...patch };
  let next = withNodes(
    config,
    target,
    canvas.nodes.map((node) => (node.id === id ? nextNode : node)),
  );
  // Länkade sektionsnoder skriver direkt till temasektionen, så rubriker,
  // brödtext och CTA:er är samma innehåll i båda lägena.
  if (target === "home" && nextNode.sectionId) next = updateSectionFromNode(next, nextNode);
  return next;
}

/** Uppdaterar flera noder i en och samma rendering (t.ex. en hel rad). */
function patchNodes(config: ThemeConfig, target: AdvancedTarget, patches: Map<string, Partial<AdvancedNode>>): ThemeConfig {
  if (!patches.size) return config;
  const canvas = canvasOf(config, target);
  return withNodes(
    config,
    target,
    canvas.nodes.map((node) => {
      const patch = patches.get(node.id);
      return patch ? { ...node, ...patch } : node;
    }),
  );
}

/**
 * Liten, skalad förhandsvisning av en yta. Används av variantväljaren så att
 * tre stilar kan jämföras sida vid sida innan något sparas.
 */
function VariantPreview({ config, canvas }: { config: ThemeConfig; canvas: AdvancedCanvas }) {
  const box = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(280);
  const height = 300;

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const measure = () => setWidth(element.clientWidth || 280);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Fyll bredden och visa toppen av ytan. Att krympa hela höjden gör
  // förhandsvisningen oläsbar på en lång sida.
  const scale = width / canvas.width;
  return (
    <div className="adv-variant__preview" ref={box} style={{ height }}>
      <div
        className="adv-variant__frame"
        style={{
          width: canvas.width,
          height: canvas.height,
          transform: `scale(${scale})`,
          left: 0,
          top: 0,
        }}
      >
        <AdvancedCanvasView config={config} canvas={canvas} vertical="canvas" />
      </div>
    </div>
  );
}

function addNode(config: ThemeConfig, target: AdvancedTarget, node: AdvancedNode): ThemeConfig {
  return withNodes(config, target, [...canvasOf(config, target).nodes, node]);
}

function removeNode(config: ThemeConfig, target: AdvancedTarget, id: string): ThemeConfig {
  const canvas = canvasOf(config, target);
  const removed = canvas.nodes.find((node) => node.id === id) ?? null;
  let next = withNodes(
    config,
    target,
    canvas.nodes.filter((node) => node.id !== id && node.fromId !== id && node.toId !== id),
  );
  // En borttagen sektionsnod ska ta bort sin sektion också, annars skulle
  // synken lägga tillbaka den vid nästa lägesbyte.
  if (target === "home" && removed?.sectionId) next = removeLinkedSection(next, removed);
  return next;
}

function duplicateForCanvas(node: AdvancedNode): AdvancedNode {
  const clone = cloneNode(node);
  // En dubblerad sektionsnod ska bli en egen sektion i temat, inte redigera
  // samma sektion som originalet.
  if (clone.sectionId) delete clone.sectionId;
  return clone;
}

function numberValue(value: string, fallback: number): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

const TOKENS: AdvancedColorToken[] = ["text", "muted", "primary", "accent", "surface", "background", "onPrimary"];

/** Räkna ut ett #rrggbb-värde till webbläsarens färgväljare. */
function pickerColor(value: string | undefined, config: ThemeConfig, fallback: AdvancedColorToken = "text"): string {
  const resolved = colorFor(value, config, fallback).trim();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(resolved);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  if (/^#[0-9a-f]{6}$/i.test(resolved)) return resolved.toLowerCase();
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(resolved);
  if (rgb) {
    return `#${[rgb[1], rgb[2], rgb[3]].map((part) => Math.max(0, Math.min(255, Number(part))).toString(16).padStart(2, "0")).join("")}`;
  }
  return "#000000";
}

/**
 * Färg är helt fritt: välj en palettnyckel, en egen hex, rgb()/hsl() eller
 * vilket färgnamn som helst. Den lilla rutan öppnar webbläsarens färghjul.
 */
function ColorField({
  label,
  value,
  onChange,
  allowEmpty,
  config,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
  allowEmpty?: boolean;
  config: ThemeConfig;
}) {
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);
  const resolved = colorFor(value, config, "text");
  const picker = pickerColor(value, config);
  const isToken = TOKENS.includes((value ?? "") as AdvancedColorToken);

  return (
    <div className="adv-field adv-color">
      <span>{label}</span>
      <div className="adv-color__row">
        <label className="adv-color__swatch" style={{ background: resolved }} title={resolved}>
          <input
            type="color"
            value={picker}
            aria-label={`${label}: ${resolved}`}
            onChange={(event) => {
              setDraft(event.target.value);
              onChange(event.target.value);
            }}
          />
        </label>
        <input
          className="input adv-color__hex"
          value={draft}
          placeholder="#FF5A2A"
          aria-label={`${label} hex`}
          onChange={(event) => {
            const next = event.target.value;
            setDraft(next);
            const trimmed = next.trim();
            if (!trimmed) {
              if (allowEmpty) onChange("");
              return;
            }
            if (isColorValue(trimmed)) onChange(trimmed);
          }}
          onBlur={() => setDraft(value ?? "")}
        />
        <select
          className="select adv-color__token"
          value={isToken ? value : ""}
          aria-label={`${label} palett`}
          onChange={(event) => {
            if (!event.target.value) return;
            setDraft(event.target.value);
            onChange(event.target.value);
          }}
        >
          <option value="">{allowEmpty ? "—" : "Egen"}</option>
          {TOKENS.map((token) => (
            <option key={token} value={token}>
              {token}
            </option>
          ))}
        </select>
        {allowEmpty ? (
          <button type="button" className="icon-btn" title="Rensa" aria-label="Rensa" onClick={() => { setDraft(""); onChange(""); }}>
            <Icon name="close" size="xs" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Typsnitt, skiftläge och kursiv – samma kontroller för varje textelement. */
function TypographyExtra({ node, patch }: { node: AdvancedNode; patch: (value: Partial<AdvancedNode>) => void }) {
  const custom = !node.font && Boolean(node.fontFamily);
  return (
    <>
      <label className="adv-field"><span>Typsnitt (Google Fonts)</span>
        <select
          className="select"
          value={node.font ?? (custom ? "__custom" : "")}
          onChange={(event) => {
            const value = event.target.value;
            if (value === "__custom") patch({ font: undefined, fontFamily: node.fontFamily || "Inter" });
            else patch({ font: value || undefined, fontFamily: undefined });
          }}
        >
          <option value="">Temats typsnitt</option>
          {Object.entries(FONTS).map(([key, font]) => <option key={key} value={key}>{font.label}</option>)}
          <option value="__custom">Egen Google Font…</option>
        </select>
      </label>
      {custom ? (
        <label className="adv-field"><span>Egen familj</span>
          <input className="input" value={node.fontFamily ?? ""} onChange={(event) => patch({ fontFamily: event.target.value })} placeholder="t.ex. Bebas Neue" />
        </label>
      ) : null}
      <label className="adv-field"><span>Skiftlägen</span>
        <select className="select" value={node.textTransform ?? "none"} onChange={(event) => patch({ textTransform: event.target.value as AdvancedNode["textTransform"] })}>
          <option value="none">Som skrivet</option>
          <option value="uppercase">VERSALER</option>
          <option value="lowercase">gemener</option>
          <option value="capitalize">Första Bokstav</option>
        </select>
      </label>
      <div className="toggle-row"><span>Kursiv</span>
        <button type="button" className={`toggle${node.italic ? " is-on" : ""}`} aria-pressed={Boolean(node.italic)} onClick={() => patch({ italic: !node.italic })}><i /></button>
      </div>
    </>
  );
}

/**
 * Ikonväljare med tre källor: appens inbyggda exportikoner, hela Iconifys
 * bibliotek (400 000+ ikoner i 240+ set, gratis och utan nyckel) och egna
 * uppladdningar. SVG saneras och bäddas in; PNG/JPG/WebP sparas som data-URL.
 * Båda följer med i exporten utan externa beroenden i butiken.
 */
const POPULAR_SETS = ["lucide", "tabler", "mdi", "ph", "solar", "hugeicons", "heroicons", "material-symbols", "ri", "mingcute", "carbon", "fluent"];
const MAX_ICON_BYTES = 300_000;

/** Hämtade ikonkroppar cachas så biblioteket bara kostar en request per set. */
const iconBodyCache = new Map<string, string>();

async function fetchIconBodies(names: string[]): Promise<Record<string, string>> {
  const byPrefix = new Map<string, string[]>();
  for (const name of names) {
    const [prefix, icon] = name.split(":");
    if (!prefix || !icon) continue;
    byPrefix.set(prefix, [...(byPrefix.get(prefix) ?? []), icon]);
  }
  const found: Record<string, string> = {};
  await Promise.all(
    [...byPrefix].map(async ([prefix, icons]) => {
      try {
        // En batch per set i stället för en bild per ikon – undviker rate limits.
        const res = await fetch(`https://api.iconify.design/${encodeURIComponent(prefix)}.json?icons=${icons.map(encodeURIComponent).join(",")}&height=24`);
        if (!res.ok) return;
        const json = (await res.json()) as {
          icons?: Record<string, { body?: string }>;
          aliases?: Record<string, { parent?: string }>;
        };
        const bodyFor = (icon: string, depth = 0): string | null => {
          const direct = json.icons?.[icon]?.body;
          if (direct) return direct;
          const parent = json.aliases?.[icon]?.parent;
          // Alias kan peka på en annan ikon i samma set, max några steg.
          return parent && depth < 3 ? bodyFor(parent, depth + 1) : null;
        };
        for (const icon of icons) {
          const body = bodyFor(icon);
          if (body) found[`${prefix}:${icon}`] = body;
        }
      } catch {
        /* nästa omgång får försöka igen */
      }
    }),
  );
  for (const [name, body] of Object.entries(found)) iconBodyCache.set(name, body);
  return found;
}

function IconPicker({ node, patch }: { node: AdvancedNode; patch: (value: Partial<AdvancedNode>) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [browseOpen, setBrowseOpen] = useState(false);
  const [setPrefix, setSetPrefix] = useState("lucide");
  const [setIcons, setSetIcons] = useState<string[]>([]);
  const [collectionTotal, setCollectionTotal] = useState(0);
  const [bodies, setBodies] = useState<Record<string, string>>({});

  useEffect(() => {
    const names = [...results, ...setIcons].filter((name) => !iconBodyCache.has(name));
    if (!names.length) return;
    let alive = true;
    void fetchIconBodies(names.slice(0, 240)).then((found) => {
      if (!alive || !Object.keys(found).length) return;
      setBodies((current) => ({ ...current, ...found }));
    });
    return () => { alive = false; };
  }, [results, setIcons]);

  const runSearch = async (start = 0) => {
    const text = query.trim();
    if (text.length < 2 || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`https://api.iconify.design/search?query=${encodeURIComponent(text)}&limit=60&start=${start}`);
      const json = (await res.json()) as { icons?: string[]; total?: number };
      const icons = Array.isArray(json.icons) ? json.icons : [];
      setResults((current) => (start === 0 ? icons : [...current, ...icons.filter((icon) => !current.includes(icon))]));
      setSearchTotal(Number(json.total ?? icons.length));
      if (!icons.length && start === 0) setError("Inga ikoner hittades. Prova ett annat ord.");
    } catch {
      setError("Kunde inte nå ikonbiblioteket. Kontrollera anslutningen.");
    } finally {
      setBusy(false);
    }
  };

  /** Hämtar hela ett ikonset (t.ex. lucide) och visar de första ikonerna. */
  const openSet = async (prefix: string) => {
    setBrowseOpen(true);
    setSetPrefix(prefix);
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`https://api.iconify.design/collection?prefix=${encodeURIComponent(prefix)}`);
      const json = (await res.json()) as { uncategorized?: string[]; categories?: Record<string, string[]>; error?: string };
      if (json.error) throw new Error(json.error);
      const names = [...(json.uncategorized ?? []), ...Object.values(json.categories ?? {}).flat()];
      const unique = [...new Set(names)];
      setSetIcons(unique.slice(0, 180).map((name) => `${prefix}:${name}`));
      setCollectionTotal(unique.length);
      if (!unique.length) setError("Setet kunde inte läsas. Prova ett annat set.");
    } catch {
      setError("Kunde inte hämta ikonset.");
    } finally {
      setBusy(false);
    }
  };

  const choose = async (name: string) => {
    setBusy(true);
    setError("");
    try {
      let body = iconBodyCache.get(name);
      if (!body) {
        body = (await fetchIconBodies([name]))[name];
      }
      let inner = sanitizeSvg(body ?? "");
      if (!inner) {
        // Reserv: hämta det färdiga SVG-dokumentet och sanera det.
        const res = await fetch(iconifySvgUrl(name));
        if (res.ok) inner = sanitizeSvg(await res.text());
      }
      if (!inner) throw new Error("empty");
      patch({ icon: name, iconSvg: inner, iconImage: undefined });
    } catch {
      setError("Kunde inte hämta ikonen.");
    } finally {
      setBusy(false);
    }
  };

  const thumb = (name: string) => {
    const body = bodies[name] ?? iconBodyCache.get(name);
    if (!body) return <span className="adv-icon-thumb adv-icon-thumb--empty" />;
    return <span className="adv-icon-thumb" dangerouslySetInnerHTML={{ __html: svgElement(body) }} />;
  };

  const upload = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_ICON_BYTES) {
      setError("Filen är för stor. Max 300 kB.");
      return;
    }
    const isSvg = file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
    const isRaster = /^image\/(png|jpeg|webp|gif)$/.test(file.type) || /\.(png|jpe?g|webp|gif)$/i.test(file.name);
    if (!isSvg && !isRaster) {
      setError("Välj en SVG, PNG, JPG eller WebP.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (isSvg) {
        const inner = sanitizeSvg(String(reader.result ?? ""));
        if (!inner) {
          setError("Filen innehöll ingen giltig SVG.");
          return;
        }
        setError("");
        patch({ icon: "custom", iconSvg: inner, iconImage: undefined });
        return;
      }
      setError("");
      patch({ icon: "custom", iconImage: String(reader.result ?? ""), iconSvg: undefined });
    };
    if (isSvg) reader.readAsText(file);
    else reader.readAsDataURL(file);
  };

  const custom = Boolean(node.iconSvg || node.iconImage);

  return (
    <div className="adv-icon-picker">
      <div className="panel-title">Ikon</div>
      <div className="adv-icon-current">
        <span className="adv-icon-preview">
          {node.iconImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={node.iconImage} alt="" />
          ) : node.iconSvg ? (
            <span dangerouslySetInnerHTML={{ __html: svgElement(node.iconSvg) }} />
          ) : (
            <Icon name={(node.icon ?? "cart") as Parameters<typeof Icon>[0]["name"]} size="md" strokeWidth={node.iconStroke} />
          )}
        </span>
        <select
          className="select"
          value={custom ? "__custom" : node.icon ?? "cart"}
          onChange={(event) => {
            const value = event.target.value;
            if (value === "__custom") return;
            patch({ icon: value, iconSvg: undefined, iconImage: undefined });
          }}
        >
          {custom ? <option value="__custom">Egen / uppladdad</option> : null}
          {EXPORT_ICON_NAMES.map((name) => <option key={name} value={name}>{EXPORT_ICON_LABELS[name] ?? name}</option>)}
        </select>
        <label className="ui-btn ui-btn--ghost ui-btn--sm adv-icon-upload">
          Ladda upp ikon
          <input type="file" accept=".svg,image/svg+xml,.png,image/png,.jpg,.jpeg,image/jpeg,.webp,image/webp,.gif,image/gif" onChange={(event) => upload(event.target.files?.[0])} />
        </label>
      </div>
      {custom ? (
        <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => patch({ icon: "cart", iconSvg: undefined, iconImage: undefined })}>
          Ta bort egen ikon
        </button>
      ) : null}

      <div className="adv-icon-search">
        <input
          className="input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void runSearch(0); } }}
          placeholder="Sök bland 400 000+ ikoner…"
          aria-label="Sök ikoner"
        />
        <button type="button" className="ui-btn ui-btn--sm" disabled={busy || query.trim().length < 2} onClick={() => void runSearch(0)}>
          {busy ? "Söker…" : "Sök"}
        </button>
      </div>

      <div className="adv-icon-sets">
        <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => setBrowseOpen((open) => !open)}>
          {browseOpen ? "Dölj biblioteket" : "Bläddra i 240+ set"}
        </button>
        <select
          className="select"
          value={setPrefix}
          aria-label="Välj ikonset"
          onChange={(event) => void openSet(event.target.value)}
        >
          {POPULAR_SETS.map((prefix) => <option key={prefix} value={prefix}>{prefix}</option>)}
        </select>
      </div>

      {error ? <p className="hint">{error}</p> : null}
      {results.length ? (
        <div className="adv-icon-grid">
          {results.map((name) => (
            <button key={name} type="button" title={name} onClick={() => void choose(name)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {thumb(name)}
            </button>
          ))}
        </div>
      ) : null}
      {results.length && results.length < searchTotal ? (
        <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" disabled={busy} onClick={() => void runSearch(results.length)}>
          Visa fler ({searchTotal - results.length} kvar)
        </button>
      ) : null}

      {browseOpen ? (
        <div className="adv-icon-browse">
          {setIcons.length ? (
            <div className="adv-icon-grid adv-icon-grid--set">
              {setIcons.map((name) => (
                <button key={name} type="button" title={name} onClick={() => void choose(name)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {thumb(name)}
                </button>
              ))}
            </div>
          ) : null}
          {setIcons.length < collectionTotal ? (
            <p className="hint">Visar {setIcons.length} av {collectionTotal} ikoner i {setPrefix}. Använd sökningen för att hitta fler.</p>
          ) : null}
        </div>
      ) : null}
      <p className="hint">Egna SVG:er saneras. PNG/JPG/WebP sparas som data-URL (max 300 kB) och båda bäddas in i exporten – inga externa ikonberoenden i butiken.</p>
    </div>
  );
}

function chromeStyle(config: ThemeConfig): CSSProperties {
  return {
    "--sf-bg": config.palette.background,
    "--sf-surface": config.palette.surface,
    "--sf-text": config.palette.text,
    "--sf-muted": config.palette.muted,
    "--sf-primary": config.palette.primary,
    "--sf-accent": config.palette.accent,
    "--sf-border": config.palette.border,
    "--sf-on-primary": colorFor("onPrimary", config),
    "--sf-heading": FONTS[config.typography.heading]?.stack ?? FONTS.manrope.stack,
    "--sf-body": FONTS[config.typography.body]?.stack ?? FONTS.inter.stack,
    "--sf-base": config.typography.baseSize,
    "--sf-scale": config.typography.scale,
    "--sf-heading-weight": config.typography.headingWeight,
    "--sf-tracking": `${config.typography.tracking}em`,
    "--sf-max": config.layout.maxWidth,
    "--sf-space": config.layout.sectionSpacing,
    "--sf-radius": `${config.tokens.cardRadius}px`,
    "--sf-input-radius": `${config.tokens.inputRadius}px`,
  } as CSSProperties;
}

/** Header i Advanced är samma riktiga header som i butiken – klicka för att redigera. */
function AdvancedHeader({ config, onSelect, compact }: { config: ThemeConfig; onSelect: (id: string) => void; compact?: boolean }) {
  return (
    <div className={`sf adv-chrome${compact ? " adv-chrome--mobile" : ""}`} style={chromeStyle(config)} onPointerDown={(event) => event.stopPropagation()}>
      {config.header.announcement ? <div className="announcement">{config.header.announcement}</div> : null}
      <header
        className={`site-header adv-chrome__click${config.header.sticky ? " site-header--sticky" : ""}`}
        title="Header"
        onClick={() => onSelect("__header")}
      >
        <div className={`container header__inner header__inner--${config.header.actionsPosition ?? "right"}`}>
          <span className="header__logo">{config.header.logoText || config.shop.name}</span>
          <nav className="header__nav">
            {config.header.links.map((link) => <span key={link}>{link}</span>)}
          </nav>
          <div className={`header__actions header__actions--${config.header.actionsPosition ?? "right"}`}>
            {config.header.showSearch ? <span className="header__action"><Icon name="search" size="md" /></span> : null}
            {config.header.showCart ? (
              <span className="header__action">
                <Icon name="cart" size="md" />
                <span className="header__cart-count">2</span>
              </span>
            ) : null}
          </div>
        </div>
      </header>
    </div>
  );
}

/** Samma footer som i butiken, så att den går att redigera även i Advanced. */
function AdvancedFooter({ config, onSelect, compact }: { config: ThemeConfig; onSelect: (id: string) => void; compact?: boolean }) {
  return (
    <div className={`sf adv-chrome${compact ? " adv-chrome--mobile" : ""}`} style={chromeStyle(config)} onPointerDown={(event) => event.stopPropagation()}>
      <footer className="site-footer adv-chrome__click" title="Footer" onClick={() => onSelect("__footer")}>
        <div className="container">
          <div className="footer__grid">
            <div>
              <b className="footer__brand">{config.shop.name}</b>
              <p className="footer__about">{config.footer.text || config.shop.tagline}</p>
            </div>
            {config.footer.columns.map((column) => (
              <div className="footer__col" key={column.title}>
                <h4>{column.title}</h4>
                {column.links.map((link) => <span key={link}>{link}</span>)}
              </div>
            ))}
          </div>
          <div className="footer__bottom">
            <span>© {new Date().getFullYear()} {config.shop.name}</span>
            <span>{config.footer.social.join(" · ")}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

const HANDLE_DIRS = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;

/**
 * En yta i den sammanhängande Advanced-scenen. Sidhuvud, sida och sidfot
 * använder exakt samma mekanik: klicka för att välja, håll inne och dra för
 * att flytta, dra i hörnen för att ändra storlek, dubbelklicka för att skriva.
 */
function EditableRegion({
  config,
  canvas,
  region,
  label,
  selectedId,
  selectedIds,
  guide,
  editingId,
  editingText,
  onEditingText,
  onCommitText,
  onCancelText,
  onSelect,
  onNodePointerDown,
  onNodeDoubleClick,
  onResize,
}: {
  config: ThemeConfig;
  canvas: AdvancedCanvas;
  region: string;
  label: string;
  selectedId: string | null;
  selectedIds?: string[];
  guide?: { x?: number; y?: number } | null;
  editingId: string | null;
  editingText: string;
  onEditingText: (value: string) => void;
  onCommitText: () => void;
  onCancelText: () => void;
  onSelect: (id: string | null) => void;
  onNodePointerDown: (event: ReactPointerEvent<HTMLDivElement>, node: AdvancedNode) => void;
  onNodeDoubleClick: (node: AdvancedNode) => void;
  onResize: (event: ReactPointerEvent<HTMLElement>, node: AdvancedNode, dir: string) => void;
}) {
  const node = selectedId ? canvas.nodes.find((item) => item.id === selectedId) ?? null : null;
  const editingNode = editingId ? canvas.nodes.find((item) => item.id === editingId) ?? null : null;
  return (
    <div className="adv-region" data-adv-region={region}>
      <div className="adv-region__bar">
        <span>{label}</span>
      </div>
      <div className="adv-region__view">
        <AdvancedCanvasView
          config={config}
          canvas={canvas}
          selectedId={node?.id ?? null}
          selectedIds={selectedIds}
          interactive
          onSelect={onSelect}
          onNodePointerDown={onNodePointerDown}
          onNodeDoubleClick={onNodeDoubleClick}
        />
        {guide?.y != null ? (
          <div className="adv-guide" style={{ top: `${(guide.y / canvas.height) * 100}%` }} aria-hidden="true" />
        ) : null}
        {guide?.x != null ? (
          <div className="adv-guide adv-guide--v" style={{ left: `${(guide.x / canvas.width) * 100}%` }} aria-hidden="true" />
        ) : null}
        {node && !node.locked && !node.hidden ? (
          <div
            className="adv-handles"
            style={{
              left: `${(node.x / canvas.width) * 100}%`,
              top: `${(node.y / canvas.height) * 100}%`,
              width: `${(node.w / canvas.width) * 100}%`,
              height: `${(node.h / canvas.height) * 100}%`,
              transform: node.rotation ? `rotate(${node.rotation}deg)` : undefined,
              zIndex: node.z + 1,
            }}
          >
            {HANDLE_DIRS.map((dir) => (
              <span
                key={dir}
                className={`adv-handle adv-handle--${dir}`}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onResize(event, node, dir);
                }}
              />
            ))}
          </div>
        ) : null}

        {editingNode ? (
          <textarea
            className="adv-inline-editor"
            autoFocus
            value={editingText}
            onChange={(event) => onEditingText(event.target.value)}
            onBlur={onCommitText}
            onKeyDown={(event) => {
              if (event.key === "Escape") onCancelText();
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") onCommitText();
            }}
            style={{
              left: `${(editingNode.x / canvas.width) * 100}%`,
              top: `${(editingNode.y / canvas.height) * 100}%`,
              width: `${(editingNode.w / canvas.width) * 100}%`,
              minHeight: `${(editingNode.h / canvas.height) * 100}%`,
              zIndex: editingNode.z + 3,
              fontSize: `${((editingNode.fontSize ?? 28) / canvas.width) * 100}cqw`,
              fontWeight: editingNode.fontWeight ?? config.typography.headingWeight,
              textAlign: editingNode.align ?? "left",
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Vänsterpanel: verktyg, element och lager                            */
/* ------------------------------------------------------------------ */

export function AdvancedSidebar({
  config,
  update,
  locale,
  selectedId,
  onSelect,
  page,
  chromeMode,
  tool,
  onTool,
}: Common & { tool: AdvancedTool; onTool: (tool: AdvancedTool) => void }) {
  const adv = getAdvanced(locale);
  const target = targetFor(page, chromeMode);
  const canvas = canvasOf(config, target);
  const [addRegion, setAddRegion] = useState<"header" | "page" | "footer">("page");
  const region: AdvancedTarget = chromeMode ? "chrome" : addRegion === "page" ? page : addRegion;
  const regionCanvas = canvasOf(config, region);

  const add = (type: AdvancedNodeType) => {
    if (type === "drawing") {
      onTool("draw");
      return;
    }
    if (type === "connector") {
      onTool("connect");
      return;
    }
    const base = createNode(type, config, {}, region === "chrome" ? "home" : region === "header" || region === "footer" ? page : region);
    let placement = centeredPlacement(base, regionCanvas);
    // En ny produkt läggs bredvid den förra i stället för ovanpå, så att två
    // produkter direkt bildar en rad. Sedan kan man dra dem fritt eller
    // använda "Lägg på rad" för jämna mellanrum.
    if (type === "product") {
      const products = regionCanvas.nodes.filter((item) => item.type === "product").sort((a, b) => a.x - b.x);
      const last = products[products.length - 1];
      if (last) {
        const gap = 24;
        const nextX = last.x + last.w + gap;
        placement = nextX + base.w <= regionCanvas.width - 16
          ? { x: nextX, y: last.y }
          : { x: 16, y: last.y + last.h + gap };
        base.h = last.h;
      }
    }
    const node = { ...base, z: nextZ(regionCanvas.nodes), ...placement };
    update((current) => addNode(current, region, node));
    onSelect(node.id);
    onTool("select");
  };

  const layers = [...canvas.nodes].sort((a, b) => b.z - a.z);

  return (
    <div className="studio-panel adv-sidebar">
      <div className="panel-title">{adv.storefront.title}</div>
      <p className="hint">{chromeMode ? adv.chrome.globalHint : adv.storefront.hint}</p>
      {!chromeMode ? (
        <div className="segmented adv-region-switch" aria-label="Lägg till i">
          {([["header", adv.chrome.header], ["page", adv.canvas.pages], ["footer", adv.chrome.footer]] as const).map(([key, label]) => (
            <button key={key} type="button" className={addRegion === key ? "is-active" : ""} onClick={() => setAddRegion(key)}>
              {label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="adv-add-grid" style={{ marginBottom: 16 }}>
        <button type="button" className="adv-add" onClick={() => add("logo")}><Icon name="type" size="sm" /><span>{adv.add.logo}</span></button>
        <button type="button" className="adv-add" onClick={() => add("nav")}><Icon name="menu" size="sm" /><span>{adv.add.nav}</span></button>
        <button type="button" className="adv-add" onClick={() => add("search")}><Icon name="search" size="sm" /><span>{adv.add.search}</span></button>
        <button type="button" className="adv-add" onClick={() => add("cart")}><Icon name="cart" size="sm" /><span>{adv.add.cart}</span></button>
      </div>
      <div className="panel-title">{adv.add.title}</div>
      <div className="adv-add-grid">
        <button type="button" className="adv-add" onClick={() => add("heading")}><Icon name="type" size="sm" /><span>{adv.add.heading}</span></button>
        <button type="button" className="adv-add" onClick={() => add("text")}><Icon name="edit" size="sm" /><span>{adv.add.text}</span></button>
        <button type="button" className="adv-add" onClick={() => add("image")}><Icon name="image" size="sm" /><span>{adv.add.image}</span></button>
        <button type="button" className="adv-add" onClick={() => add("button")}><Icon name="mouse" size="sm" /><span>{adv.add.button}</span></button>
        <button type="button" className="adv-add" onClick={() => add("product")}><Icon name="store" size="sm" /><span>{adv.add.product}</span></button>
        <button type="button" className="adv-add" onClick={() => add("products")}><Icon name="grid" size="sm" /><span>Produktrad</span></button>
        <button type="button" className="adv-add" onClick={() => add("section")}><Icon name="blocks" size="sm" /><span>{adv.add.section}</span></button>
        <button type="button" className="adv-add" onClick={() => add("shape")}><Icon name="circle" size="sm" /><span>{adv.add.shape}</span></button>
        <button type="button" className={`adv-add${tool === "draw" ? " is-active" : ""}`} onClick={() => add("drawing")}><Icon name="edit" size="sm" /><span>{adv.add.drawing}</span></button>
        <button type="button" className={`adv-add${tool === "connect" ? " is-active" : ""}`} onClick={() => add("connector")}><Icon name="plug" size="sm" /><span>{adv.add.connector}</span></button>
      </div>

      <div className="panel-title" style={{ marginTop: 20 }}>{adv.canvas.layers}</div>
      {layers.length === 0 ? <p className="hint">{adv.canvas.empty}</p> : null}
      <div className="adv-layers">
        {layers.map((node) => (
          <div key={node.id} className={`adv-layer${selectedId === node.id ? " is-active" : ""}`}>
            <button type="button" className="adv-layer__main" onClick={() => onSelect(node.id)}>
              <span>{node.type === "connector" ? adv.add.connector : node.type === "drawing" ? adv.add.drawing : node.type === "section" ? node.title || adv.add.section : node.type === "image" ? node.alt || adv.add.image : node.type === "product" ? adv.add.product : node.type === "products" ? "Produktrad" : node.type === "button" ? node.ctaLabel || adv.add.button : node.type === "shape" ? adv.add.shape : node.type === "logo" ? node.text?.slice(0, 36) || adv.add.logo : node.type === "nav" ? adv.add.nav : node.type === "cart" ? adv.add.cart : node.type === "search" ? adv.add.search : node.text?.slice(0, 36) || adv.add.text}</span>
              <small>{node.type}</small>
            </button>
            <button type="button" className={`adv-layer__icon${node.hidden ? " is-on" : ""}`} aria-label={node.hidden ? adv.canvas.show : adv.canvas.hide} title={node.hidden ? adv.canvas.show : adv.canvas.hide} onClick={() => {
              update((current) => patchNode(current, target, node.id, { hidden: !node.hidden }));
              if (!node.hidden && selectedId === node.id) onSelect(null);
            }}>
              <Icon name={node.hidden ? "eyeOff" : "eye"} size="xs" />
            </button>
            <button type="button" className={`adv-layer__icon${node.locked ? " is-on" : ""}`} aria-label={node.locked ? adv.canvas.unlock : adv.canvas.lock} title={node.locked ? adv.canvas.unlock : adv.canvas.lock} onClick={() => {
              update((current) => patchNode(current, target, node.id, { locked: !node.locked }));
            }}>
              <Icon name="lock" size="xs" />
            </button>
            <button type="button" className="adv-layer__icon" aria-label={adv.canvas.duplicate} title={adv.canvas.duplicate} onClick={() => {
              const clone = duplicateForCanvas(node);
              update((current) => addNode(current, target, clone));
              onSelect(clone.id);
            }}>
              <Icon name="copy" size="xs" />
            </button>
            <button type="button" className="adv-layer__icon" aria-label={adv.canvas.delete} title={adv.canvas.delete} onClick={() => {
              update((current) => removeNode(current, target, node.id));
              if (selectedId === node.id) onSelect(null);
            }}>
              <Icon name="trash" size="xs" />
            </button>
          </div>
        ))}
      </div>

      {!chromeMode && (addRegion === "header" || addRegion === "footer") ? (
        <>
          <div className="panel-title" style={{ marginTop: 20 }}>{addRegion === "header" ? adv.chrome.header : adv.chrome.footer}</div>
          <label className="adv-field"><span>{adv.canvas.height}</span>
            <input
              className="input"
              type="number"
              min={80}
              max={MAX_CANVAS_HEIGHT}
              value={Math.round(regionCanvas.height)}
              onChange={(event) => update((current) => withCanvas(current, region, resizeCanvasHeight(canvasOf(current, region), numberValue(event.target.value, regionCanvas.height), 80)))}
            />
          </label>
        </>
      ) : null}
      <div className="panel-title" style={{ marginTop: 20 }}>{adv.canvas.background}</div>
      <ColorField
        label={adv.canvas.background}
        config={config}
        value={canvas.background === "transparent" ? "" : canvas.background}
        allowEmpty
        onChange={(value) => update((current) => withCanvas(current, target, { ...canvasOf(current, target), background: value || "transparent" }))}
      />
      <div className="adv-actions">
        <button type="button" className={`ui-btn ui-btn--ghost ui-btn--sm${canvas.background === "transparent" ? " is-active" : ""}`} onClick={() => update((current) => withCanvas(current, target, { ...canvasOf(current, target), background: canvasOf(current, target).background === "transparent" ? "background" : "transparent" }))}>
          transparent
        </button>
      </div>
      <p className="hint" style={{ marginTop: 10 }}>{adv.modeSwitchHint}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Canvas + verktygsrad + AI/Canva                                     */
/* ------------------------------------------------------------------ */

export function AdvancedStage({
  config,
  update,
  locale,
  selectedId,
  onSelect,
  page,
  chromeMode,
  tool,
  onTool,
  projectId,
  onToast,
  device,
  onToggleInspector,
  pages,
  pageLabels,
  onPage,
  onChrome,
}: Common & {
  tool: AdvancedTool;
  onTool: (tool: AdvancedTool) => void;
  projectId: string;
  onToast?: (message: string) => void;
  device?: "desktop" | "mobile";
  onToggleInspector?: () => void;
  pages: AdvancedPage[];
  pageLabels: string[];
  onPage: (page: AdvancedPage) => void;
  onChrome: (chrome: boolean) => void;
}) {
  const adv = getAdvanced(locale);
  const target = targetFor(page, chromeMode);
  const canvas = canvasOf(config, target);
  const headerCanvas = canvasForHeader(config);
  const footerCanvas = canvasForFooter(config);
  const located = locateNode(config, target, selectedId);
  const selected = located?.node ?? null;
  const shell = useRef<HTMLDivElement>(null);

  // En ny primär markering nollställer gruppen; Shift-klick lägger till extra.
  useEffect(() => {
    setMulti(selected?.id ? [selected.id] : []);
  }, [selected?.id]);

  // Space håller panoreringsläget aktivt så länge tangenten är nedtryckt.
  useEffect(() => {
    const onDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      event.preventDefault();
      setSpaceHeld(true);
    };
    const onUp = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpaceHeld(false);
    };
    const onBlur = () => setSpaceHeld(false);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);
  const [draft, setDraft] = useState<AdvancedNode | null>(null);
  const [groupDraft, setGroupDraft] = useState<AdvancedNode[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [drawing, setDrawing] = useState<{ x: number; y: number }[] | null>(null);
  const [penColor, setPenColor] = useState<string>(config.palette.primary);
  const [penWidth, setPenWidth] = useState(5);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [promptBusy, setPromptBusy] = useState(false);
  /** Tre stilförslag som väntar på ett val. Inget skrivs förrän man väljer. */
  const [variants, setVariants] = useState<DesignPlan[] | null>(null);
  const [nanoPrompt, setNanoPrompt] = useState("");
  const [nanoBusy, setNanoBusy] = useState(false);
  const [canvaOpen, setCanvaOpen] = useState(false);
  const [canvaUrl, setCanvaUrl] = useState("");
  const [canvaName, setCanvaName] = useState("");
  const [heightDraft, setHeightDraft] = useState<number | null>(null);
  /** Extra markerade noder utöver den primära (Shift/Cmd-klick). */
  const [multi, setMulti] = useState<string[]>([]);
  const [magnets, setMagnets] = useState(true);
  const [guide, setGuide] = useState<{ region: AdvancedTarget; x?: number; y?: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const chromeCanvas = canvasForChrome(config);
  const hasCustomChrome = chromeCanvas.nodes.some((node) => node.type !== "connector");

  const nodes = useMemo(() => {
    const moving = new Map((groupDraft ?? []).map((node) => [node.id, node]));
    if (draft) moving.set(draft.id, draft);
    return moving.size ? canvas.nodes.map((node) => moving.get(node.id) ?? node) : canvas.nodes;
  }, [canvas.nodes, draft, groupDraft]);
  const shownCanvas = heightDraft ? { ...canvas, height: heightDraft } : canvas;
  const shownFor = (value: AdvancedCanvas): AdvancedCanvas => {
    const moving = new Map((groupDraft ?? []).map((node) => [node.id, node]));
    if (draft) moving.set(draft.id, draft);
    if (!moving.size || !value.nodes.some((node) => moving.has(node.id))) return value;
    return { ...value, nodes: value.nodes.map((node) => moving.get(node.id) ?? node) };
  };

  const rectOfRegion = (region: string, event?: ReactPointerEvent<HTMLElement>) => {
    const fromEvent = event?.currentTarget.closest(`[data-adv-region="${region}"]`)?.querySelector(".adv-canvas");
    const element = fromEvent ?? shell.current?.querySelector(`[data-adv-region="${region}"] .adv-canvas`);
    return element?.getBoundingClientRect() ?? null;
  };
  const rectOfCanvas = () => rectOfRegion("page");

  const beginDrag = (
    event: ReactPointerEvent<HTMLElement>,
    node: AdvancedNode,
    mode: "move" | "resize",
    dir: string,
    region: AdvancedTarget,
    regionCanvas: AdvancedCanvas,
  ) => {
    const rect = rectOfRegion(region, event) ?? rectOfCanvas();
    if (!rect) return;
    // preventDefault på pointerdown blockerar webbläsarens dblclick, och då kan
    // man inte längre dubbelklicka för att skriva. I stället stänger CSS av
    // textmarkering och touch-scroll på noderna.
    const scaleX = regionCanvas.width / rect.width;
    const scaleY = regionCanvas.height / rect.height;
    const startX = event.clientX;
    const startY = event.clientY;
    const start = { ...node };
    // Gruppmedlemmar flyttas med samma delta som den nod man drar i.
    const groupMembers = mode === "move" && node.groupId
      ? regionCanvas.nodes.filter((item) => item.groupId === node.groupId && item.id !== node.id && !item.locked && !item.hidden)
      : [];
    let latest = start;
    let latestGroup: AdvancedNode[] = [];
    setDraft(null);
    setGroupDraft(null);

    const onMove = (move: PointerEvent) => {
      const dx = (move.clientX - startX) * scaleX;
      const dy = (move.clientY - startY) * scaleY;
      let next = { ...start };
      if (mode === "move") {
        // Håll bara en liten del inom ytan så att elementet aldrig tappas bort,
        // men låt resten ligga utanför om användaren vill det.
        next.x = Math.max(-start.w + 12, Math.min(regionCanvas.width - 12, start.x + dx));
        // Tillåt att dra nedanför kanten: ytan växer när noden släpps.
        next.y = Math.max(-start.h + 12, Math.min(regionCanvas.height + 4000, start.y + dy));
      } else {
        const min = 4;
        if (dir.includes("e")) next.w = Math.max(min, start.w + dx);
        if (dir.includes("s")) next.h = Math.max(min, start.h + dy);
        if (dir.includes("w")) {
          next.w = Math.max(min, start.w - dx);
          next.x = start.x + (start.w - next.w);
        }
        if (dir.includes("n")) {
          next.h = Math.max(min, start.h - dy);
          next.y = start.y + (start.h - next.h);
        }
        // En logotyp eller meny ska växa med rutan. Annars kan man göra rutan
        // enorm utan att själva texten följer med.
        if (start.type === "logo" || start.type === "nav") {
          const factor = Math.max(next.w / Math.max(1, start.w), next.h / Math.max(1, start.h));
          next.fontSize = Math.max(4, Math.min(2000, Math.round((start.fontSize ?? (start.type === "logo" ? 64 : 18)) * factor)));
        }
      }
      // Magneter: kanter och mittpunkter snappar mot närliggande element och
      // visar en guide. Håll Alt för fri placering.
      if (mode === "move" && magnets && !move.altKey) {
        const threshold = 10;
        const others = regionCanvas.nodes.filter((item) => item.id !== start.id && item.type !== "connector" && !item.hidden);
        const myX = [next.x, next.x + next.w / 2, next.x + next.w];
        const myY = [next.y, next.y + next.h / 2, next.y + next.h];
        let xDelta = 0;
        let yDelta = 0;
        let guideX: number | null = null;
        let guideY: number | null = null;
        let bestX = Number.POSITIVE_INFINITY;
        let bestY = Number.POSITIVE_INFINITY;
        for (const other of others) {
          const otherX = [other.x, other.x + other.w / 2, other.x + other.w];
          const otherY = [other.y, other.y + other.h / 2, other.y + other.h];
          for (const mine of myX) {
            for (const target of otherX) {
              const diff = Math.abs(target - mine);
              if (diff <= threshold && diff < bestX) {
                bestX = diff;
                xDelta = target - mine;
                guideX = target;
              }
            }
          }
          for (const mine of myY) {
            for (const target of otherY) {
              const diff = Math.abs(target - mine);
              if (diff <= threshold && diff < bestY) {
                bestY = diff;
                yDelta = target - mine;
                guideY = target;
              }
            }
          }
        }
        next.x += xDelta;
        next.y += yDelta;
        setGuide(guideX !== null || guideY !== null
          ? { region, ...(guideX !== null ? { x: guideX } : {}), ...(guideY !== null ? { y: guideY } : {}) }
          : null);
      } else if (mode === "resize") {
        setGuide(null);
      }
      latest = next;
      if (groupMembers.length) {
        const gx = next.x - start.x;
        const gy = next.y - start.y;
        latestGroup = [next, ...groupMembers.map((item) => ({ ...item, x: item.x + gx, y: item.y + gy }))];
        setGroupDraft(latestGroup);
      } else {
        setDraft(next);
      }
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDraft(null);
      setGroupDraft(null);
      setGuide(null);
      if (latestGroup.length) {
        const patches = new Map(latestGroup.map((item) => [item.id, { x: item.x, y: item.y }]));
        update((current) => patchNodes(current, region, patches));
      } else {
        update((current) => patchNode(current, region, node.id, latest));
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const beginPageResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = rectOfCanvas();
    if (!rect) return;
    const scale = canvas.height / rect.height;
    const startY = event.clientY;
    const startHeight = canvas.height;
    let latest = startHeight;
    setHeightDraft(startHeight);
    const onMove = (move: PointerEvent) => {
      const next = Math.max(MIN_CANVAS_HEIGHT, Math.min(MAX_CANVAS_HEIGHT, Math.round(startHeight + (move.clientY - startY) * scale)));
      latest = next;
      setHeightDraft(next);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setHeightDraft(null);
      update((current) => withCanvas(current, target, resizeCanvasHeight(canvasOf(current, target), latest)));
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const onNodePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
    node: AdvancedNode,
    region: AdvancedTarget,
    regionCanvas: AdvancedCanvas,
  ) => {
    if (spaceHeld) return;
    if (tool === "draw") return;
    if (tool === "connect") {
      event.preventDefault();
      if (!connectFrom) {
        setConnectFrom(node.id);
        onSelect(node.id);
        onToast?.(adv.tools.connectFirst);
        return;
      }
      if (connectFrom === node.id) {
        setConnectFrom(null);
        return;
      }
      const connector = {
        ...createNode("connector", config, {}, region === "header" || region === "footer" || region === "chrome" ? page : region),
        fromId: connectFrom,
        toId: node.id,
        x: 0,
        y: 0,
        w: 0,
        h: 0,
        z: 1,
        stroke: "primary",
        strokeWidth: 3,
      };
      update((current) => addNode(current, region, connector));
      setConnectFrom(null);
      onSelect(connector.id);
      onToast?.(adv.tools.connectDone);
      return;
    }
    if (event.shiftKey || event.metaKey || event.ctrlKey) {
      event.preventDefault();
      // Den primära noden ligger kvar (den styr panelen). Shift-klick lägger
      // till eller tar bort extra noder i radmarkeringen.
      if (node.id === selected?.id) return;
      setMulti((current) => (current.includes(node.id) ? current.filter((id) => id !== node.id) : [...current, node.id]));
      if (!selected) onSelect(node.id);
      return;
    }
    beginDrag(event, node, "move", "", region, regionCanvas);
  };

  const onCanvasPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (spaceHeld || tool !== "draw") return;
    const rect = rectOfCanvas();
    if (!rect) return;
    event.preventDefault();
    const point = {
      x: Math.max(0, Math.min(canvas.width, ((event.clientX - rect.left) / rect.width) * canvas.width)),
      y: Math.max(0, Math.min(canvas.height, ((event.clientY - rect.top) / rect.height) * canvas.height)),
    };
    const points = [point];
    setDrawing(points);
    const onMove = (move: PointerEvent) => {
      const next = {
        x: Math.max(0, Math.min(canvas.width, ((move.clientX - rect.left) / rect.width) * canvas.width)),
        y: Math.max(0, Math.min(canvas.height, ((move.clientY - rect.top) / rect.height) * canvas.height)),
      };
      const last = points[points.length - 1];
      if (last && Math.hypot(next.x - last.x, next.y - last.y) < 2) return;
      points.push(next);
      setDrawing([...points]);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDrawing(null);
      if (points.length < 2) return;
      const minX = Math.min(...points.map((p) => p.x));
      const minY = Math.min(...points.map((p) => p.y));
      const maxX = Math.max(...points.map((p) => p.x));
      const maxY = Math.max(...points.map((p) => p.y));
      const base = createNode("drawing", config, {}, page);
      const node: AdvancedNode = {
        ...base,
        x: minX,
        y: minY,
        w: Math.max(12, maxX - minX),
        h: Math.max(12, maxY - minY),
        points: points.map((p) => ({ x: (p.x - minX) / Math.max(1, maxX - minX), y: (p.y - minY) / Math.max(1, maxY - minY) })),
        stroke: penColor,
        strokeWidth: penWidth,
      };
      update((current) => addNode(current, target, node));
      onSelect(node.id);
      onTool("select");
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const element = event.target as HTMLElement | null;
      if (element && (element.tagName === "INPUT" || element.tagName === "TEXTAREA" || element.isContentEditable)) return;
      if (event.key === "Escape") {
        setEditing(null);
        setConnectFrom(null);
        setMulti([]);
        onTool("select");
        return;
      }
      if (!selected) return;
      const where = locateNode(config, target, selected.id);
      if (!where || where.node.locked) return;
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        const ids = [selected.id, ...multi]
          .filter((id, index, list) => list.indexOf(id) === index)
          .filter((id) => {
            const hit = locateNode(config, target, id);
            return Boolean(hit && !hit.node.locked);
          });
        update((current) => {
          let next = current;
          for (const id of ids) {
            const hit = locateNode(next, target, id);
            if (hit) next = removeNode(next, hit.target, id);
          }
          return next;
        });
        setMulti([]);
        onSelect(null);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        const clone = duplicateForCanvas(where.node);
        update((current) => addNode(current, where.target, clone));
        onSelect(clone.id);
        return;
      }
      const step = event.shiftKey ? 10 : 1;
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        event.preventDefault();
        const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
        const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
        update((current) => patchNode(current, where.target, where.node.id, { x: where.node.x + dx, y: where.node.y + dy }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [config, multi, onSelect, onTool, page, selected, target, update]);

  const commitText = () => {
    if (!editing) return;
    update((current) => {
      const where = locateNode(current, target, editing);
      return where ? patchNode(current, where.target, editing, { text: editingText }) : current;
    });
    setEditing(null);
  };

  const runPrompt = async () => {
    if (prompt.trim().length < 3 || promptBusy) return;
    setPromptBusy(true);
    try {
      const res = await fetch("/api/ai/advanced", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, prompt: prompt.trim(), selectionId: selected?.id ?? null }),
      });
      const json = (await res.json()) as {
        kind?: "design" | "copy";
        plan?: DesignPlan;
        node?: AdvancedNode;
        source?: string;
        error?: string;
      };

      // En stilinstruktion kommer tillbaka som en designplan. Den öppnar tre
      // varianter i stället för att ändra ytan direkt – användaren väljer först.
      if (res.ok && json.kind === "design" && json.plan) {
        const plan = json.plan;
        setVariants(designVariants(plan.moods).map((moods) => ({ ...plan, moods })));
        setPrompt("");
        return;
      }

      if (!res.ok || json.kind !== "copy" || !json.node) {
        onToast?.(res.status === 422 ? adv.prompt.unclear : adv.prompt.failed);
        return;
      }

      // Bara noder med text kan skrivas om; övriga får en ny sektion.
      const node = json.node;
      update((current) => {
        const region = locateNode(current, target, node.id)?.target ?? target;
        const nodesNow = canvasOf(current, region).nodes;
        const exists = nodesNow.some((item) => item.id === node.id);
        return withNodes(
          current,
          region,
          exists ? nodesNow.map((item) => (item.id === node.id ? node : item)) : [...nodesNow, node],
        );
      });
      onSelect(node.id);
      setPrompt("");
      // Utan AI-nyckel bygger den inbyggda motorn texten. Det ska synas, så
      // ingen tror att en betald modell svarade.
      onToast?.(json.source === "local" ? adv.prompt.localCopy : adv.prompt.applied);
    } catch {
      onToast?.(adv.prompt.failed);
    } finally {
      setPromptBusy(false);
    }
  };

  /** Markeringen kan ligga i sidhuvudet eller sidfoten – varianten ska träffa rätt yta. */
  const variantRegion = locateNode(config, target, selected?.id ?? null)?.target ?? target;

  const chooseVariant = (plan: DesignPlan) => {
    update((current) => applyDesignPlan(current, variantRegion, plan, selected?.id ?? null));
    setVariants(null);
    onToast?.(adv.prompt.designApplied);
  };

  const variantLabel = (plan: DesignPlan) =>
    plan.moods.map((mood) => adv.variants.moods[mood]).join(" + ");

  useEffect(() => {
    if (!variants) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setVariants(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [variants]);

  const runNano = async () => {
    if (nanoPrompt.trim().length < 3 || nanoBusy) return;
    setNanoBusy(true);
    try {
      const res = await fetch("/api/ai/nano-banana", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, prompt: nanoPrompt.trim() }),
      });
      const json = (await res.json()) as { url?: string; source?: "ai" | "local"; error?: string };
      if (!res.ok || !json.url) {
        onToast?.(adv.nano.failed);
        return;
      }
      const base = createNode("image", config, {}, page);
      const node: AdvancedNode = {
        ...base,
        ...centeredPlacement(base, canvas),
        w: 460,
        h: 460,
        radius: config.tokens.imageRadius,
        src: json.url,
        alt: nanoPrompt.trim().slice(0, 120),
        fit: "cover",
      };
      update((current) => addNode(current, target, node));
      onSelect(node.id);
      onToast?.(json.source === "ai" ? adv.nano.added : adv.nano.local);
      setNanoPrompt("");
    } catch {
      onToast?.(adv.nano.failed);
    } finally {
      setNanoBusy(false);
    }
  };

  const addCanvaImage = (url: string, name: string) => {
    if (!url.trim()) return;
    const base = createNode("image", config, {}, page);
    const node: AdvancedNode = {
      ...base,
      ...centeredPlacement(base, canvas),
      w: 440,
      h: 540,
      radius: config.tokens.imageRadius,
      src: url.trim(),
      alt: name || "Canva",
      fit: "cover",
    };
    update((current) => addNode(current, target, node));
    onSelect(node.id);
    onToast?.(adv.canva.added);
    setCanvaOpen(false);
  };

  const copyBrief = async () => {
    const text = `${canvaBrief(config, "campaign")}\nFormat: ${canvas.width} × ${canvas.height} px (Advanced canvas)\nSektioner: ${canvas.nodes.filter((node) => node.type === "section").length}`;
    try {
      await navigator.clipboard.writeText(text);
      onToast?.(adv.canva.copied);
    } catch {
      onToast?.(text);
    }
  };

  const selectedNode = selected ? nodes.find((node) => node.id === selected.id) ?? selected : null;
  const handleDirs = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

  /** Space eller mittenmus: panorera den scrollbara scenen. */
  const onStagePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 1 && !spaceHeld) return;
    event.preventDefault();
    const element = event.currentTarget;
    const start = { x: event.clientX, y: event.clientY, left: element.scrollLeft, top: element.scrollTop };
    const onMove = (move: PointerEvent) => {
      element.scrollLeft = start.left - (move.clientX - start.x);
      element.scrollTop = start.top - (move.clientY - start.y);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const selectedIds = selected ? [selected.id, ...multi.filter((id) => id !== selected.id)] : multi;
  const rowNodes = canvas.nodes.filter((node) => selectedIds.includes(node.id) && node.type !== "connector");
  const allProducts = canvas.nodes.filter((node) => node.type === "product");
  // Utan shift-markering räcker det att en produkt är vald: då gäller raden
  // alla produkter på sidan, så valet fungerar direkt efter att man lagt ut
  // sin andra produkt.
  const rowTargets = rowNodes.length > 1
    ? rowNodes
    : selected?.type === "product" && allProducts.length > 1
      ? allProducts
      : [];

  /**
   * Lägger de markerade elementen på samma rad: samma överkant och höjd,
   * jämna mellanrum och ordning från vänster till höger. Om raden inte får
   * plats skalas bredderna ned proportionellt i stället för att hamna utanför.
   */
  const alignSelectedRow = () => {
    if (rowTargets.length < 2) return;
    const sorted = [...rowTargets].sort((a, b) => a.x - b.x);
    const gap = 24;
    const margin = 16;
    const totalW = sorted.reduce((sum, node) => sum + node.w, 0);
    const maxW = Math.max(120, canvas.width - margin * 2 - gap * (sorted.length - 1));
    const scale = totalW > maxW ? maxW / totalW : 1;
    const widths = sorted.map((node) => Math.max(4, Math.round(node.w * scale)));
    const total = widths.reduce((sum, width) => sum + width, 0) + gap * (sorted.length - 1);
    const startX = Math.round(Math.max(margin, Math.min(sorted[0].x, canvas.width - margin - total)));
    const top = Math.round(sorted[0].y);
    const height = Math.round(Math.max(...sorted.map((node) => node.h)));
    const patches = new Map<string, Partial<AdvancedNode>>();
    let x = startX;
    sorted.forEach((node, index) => {
      patches.set(node.id, { x, y: top, w: widths[index], h: height });
      x += widths[index] + gap;
    });
    update((current) => patchNodes(current, target, patches));
    setMulti([]);
    onToast?.(adv.row.aligned);
  };

  const groupSelected = () => {
    if (rowNodes.length < 2) return;
    const groupId = uid("group");
    const patches = new Map(rowNodes.map((node) => [node.id, { groupId }]));
    update((current) => patchNodes(current, target, patches));
    onToast?.(adv.canvas.group);
  };

  const ungroupSelected = () => {
    if (!selected?.groupId) return;
    const members = canvas.nodes.filter((node) => node.groupId === selected.groupId);
    const patches = new Map(members.map((node) => [node.id, { groupId: undefined }]));
    update((current) => patchNodes(current, target, patches));
    onToast?.(adv.canvas.ungroup);
  };

  return (
    <div
      className={`adv-stage${device === "mobile" ? " adv-stage--mobile" : ""}${spaceHeld ? " adv-stage--pan" : ""}`}
      onPointerDownCapture={onStagePointerDown}
    >
      <div className="adv-page-row">
      <div className="segmented adv-page-switch" aria-label={adv.canvas.pages}>
        {pages.map((entry, index) => (
          <button
            key={entry}
            type="button"
            className={!chromeMode && entry === page ? "is-active" : ""}
            onClick={() => {
              onChrome(false);
              onPage(entry);
              onSelect(null);
              onTool("select");
            }}
          >
            {pageLabels[index] ?? entry}
          </button>
        ))}
      </div>
      </div>
      <div className="adv-toolbar">
        <div className="segmented adv-tool-switch">
          <button type="button" className={tool === "select" ? "is-active" : ""} onClick={() => onTool("select")} title={adv.tools.select}><Icon name="mouse" size="sm" /></button>
          <button type="button" className={tool === "draw" ? "is-active" : ""} onClick={() => onTool("draw")} title={adv.tools.draw}><Icon name="edit" size="sm" /></button>
          <button type="button" className={tool === "connect" ? "is-active" : ""} onClick={() => onTool("connect")} title={adv.tools.connect}><Icon name="plug" size="sm" /></button>
        </div>
        <form className="adv-prompt" onSubmit={(event) => { event.preventDefault(); void runPrompt(); }}>
          <Icon name="sparkles" size="sm" />
          <input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={adv.prompt.placeholder} aria-label={adv.prompt.title} />
          <button className="ui-btn ui-btn--accent ui-btn--sm" type="submit" disabled={promptBusy || prompt.trim().length < 3}>
            {promptBusy ? adv.prompt.working : adv.prompt.cta}
          </button>
        </form>
        <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => setCanvaOpen((open) => !open)}>
          <Icon name="image" size="sm" /> {adv.canva.title}
        </button>
        <button
          type="button"
          className={`ui-btn ui-btn--ghost ui-btn--sm${magnets ? " is-active" : ""}`}
          title={adv.canvas.magnetsHint}
          aria-pressed={magnets}
          onClick={() => {
            setMagnets((current) => !current);
            setGuide(null);
          }}
        >
          <Icon name="target" size="sm" /> {magnets ? adv.canvas.magnetsOn : adv.canvas.magnetsOff}
        </button>
        <div className="adv-zoom" role="group" aria-label={adv.canvas.zoom} title={adv.canvas.panHint}>
          <button type="button" className="adv-zoom__btn" aria-label="−" onClick={() => setZoom((value) => Math.max(0.25, Math.round((value - 0.1) * 100) / 100))}>
            <Icon name="minus" size="xs" />
          </button>
          <button type="button" className="adv-zoom__value" title={adv.canvas.zoomReset} onClick={() => setZoom(1)}>
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" className="adv-zoom__btn" aria-label="+" onClick={() => setZoom((value) => Math.min(2, Math.round((value + 0.1) * 100) / 100))}>
            <Icon name="plus" size="xs" />
          </button>
        </div>
        <button
          type="button"
          className="ui-btn ui-btn--ghost ui-btn--sm"
          title={adv.canvas.heightHint}
          onClick={() => update((current) => withCanvas(current, target, resizeCanvasHeight(canvasOf(current, target), canvas.height + 600)))}
        >
          <Icon name="plus" size="sm" /> {adv.canvas.addHeight}
        </button>
        <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm adv-inspector-toggle" onClick={() => onToggleInspector?.()}>
          <Icon name="settings" size="sm" /> {adv.canvas.properties}
        </button>
      </div>

      {variants ? (
        <div className="adv-variants" role="dialog" aria-modal="true" aria-label={adv.variants.title}>
          <div className="adv-variants__panel">
          <div className="adv-variants__head">
            <Icon name="sparkles" size="sm" />
            <b>{adv.variants.title}</b>
            <span className="hint">{adv.variants.hint}</span>
            <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => setVariants(null)}>
              {adv.variants.close}
            </button>
          </div>
          <div className="adv-variants__row">
            {variants.map((plan, index) => {
              const preview = applyDesignPlan(config, variantRegion, plan, selected?.id ?? null);
              return (
                <div className={`adv-variant${index === 0 ? " is-primary" : ""}`} key={plan.moods.join("-")}>
                  <VariantPreview config={preview} canvas={canvasOf(preview, variantRegion)} />
                  <div className="adv-variant__body">
                    <span className="adv-variant__label">
                      {variantLabel(plan)}
                      {index === 0 ? <i>{adv.variants.recommended}</i> : null}
                    </span>
                    <button type="button" className="ui-btn ui-btn--accent ui-btn--sm" onClick={() => chooseVariant(plan)}>
                      {adv.variants.apply}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        </div>
      ) : null}

      {rowTargets.length > 1 ? (
        <div className="adv-rowbar">
          <span>
            {interpolate(rowNodes.length > 1 ? adv.row.selected : adv.row.products, { count: rowTargets.length })}
          </span>
          <button type="button" className="ui-btn ui-btn--accent ui-btn--sm" onClick={alignSelectedRow}>
            <Icon name="grid" size="sm" /> {adv.row.align}
          </button>
          <button
            type="button"
            className="ui-btn ui-btn--ghost ui-btn--sm"
            onClick={() => {
              setMulti([]);
              setMagnets(false);
              onToast?.(adv.row.freeHint);
            }}
          >
            {adv.row.free}
          </button>
          {selected?.groupId ? (
            <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={ungroupSelected}>
              <Icon name="layers" size="sm" /> {adv.canvas.ungroup}
            </button>
          ) : rowNodes.length > 1 ? (
            <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={groupSelected}>
              <Icon name="layers" size="sm" /> {adv.canvas.group}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="adv-hint">
        {tool === "draw" ? adv.tools.drawHint : tool === "connect" ? (connectFrom ? adv.tools.connectFirst : adv.tools.connectHint) : adv.tools.selectHint}
        {selected ? <span className="dot-sep" /> : null}
        {selected ? `${adv.canvas.properties}: ${selected.type}` : adv.prompt.hint}
      </div>

      {tool === "draw" ? (
        <div className="adv-pen">
          <ColorField config={config} label="Pennfärg" value={penColor} onChange={setPenColor} />
          <label className="adv-field adv-pen__width"><span>Pennbredd</span>
            <div className="adv-pair">
              <input className="input" type="number" min={0.5} max={80} step={0.5} value={penWidth} onChange={(event) => setPenWidth(numberValue(event.target.value, penWidth))} />
              <input className="adv-range" type="range" min={0.5} max={40} step={0.5} value={penWidth} onChange={(event) => setPenWidth(numberValue(event.target.value, penWidth))} />
            </div>
          </label>
        </div>
      ) : null}

      {canvaOpen ? (
        <div className="adv-pop">
          <div className="adv-pop__head"><b>{adv.canva.title}</b><button type="button" className="icon-btn" onClick={() => setCanvaOpen(false)} aria-label="Stäng"><Icon name="close" size="sm" /></button></div>
          <p className="hint">{adv.canva.hint}</p>
          {config.integrations.canva.designs.length === 0 ? <p className="hint">{adv.canva.empty}</p> : (
            <div className="adv-canva-list">
              {config.integrations.canva.designs.map((design) => (
                <button key={design.id} type="button" onClick={() => addCanvaImage(design.url, design.name)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={design.url} alt={design.name} />
                  <span>{design.name}</span>
                </button>
              ))}
            </div>
          )}
          <div className="adv-canva-form">
            <input className="input" value={canvaName} onChange={(event) => setCanvaName(event.target.value)} placeholder="Canva" aria-label="Namn" />
            <input className="input" value={canvaUrl} onChange={(event) => setCanvaUrl(event.target.value)} placeholder={adv.canva.urlPlaceholder} aria-label={adv.canva.urlPlaceholder} />
            <button type="button" className="ui-btn ui-btn--sm" onClick={() => addCanvaImage(canvaUrl, canvaName)}>{adv.canva.add}</button>
          </div>
          <div className="adv-pop__actions">
            <a className="ui-btn ui-btn--ghost ui-btn--sm" href="https://www.canva.com/create/banners/" target="_blank" rel="noreferrer">{adv.canva.open} <Icon name="external" size="xs" /></a>
            <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => void copyBrief()}>{adv.canva.export}</button>
          </div>
        </div>
      ) : null}

      <div className="adv-nano">
        <form onSubmit={(event) => { event.preventDefault(); void runNano(); }}>
          <Icon name="sparkles" size="sm" />
          <input value={nanoPrompt} onChange={(event) => setNanoPrompt(event.target.value)} placeholder={adv.nano.placeholder} aria-label={adv.nano.title} />
          <button className="ui-btn ui-btn--ghost ui-btn--sm" type="submit" disabled={nanoBusy || nanoPrompt.trim().length < 3}>
            {nanoBusy ? adv.prompt.working : adv.nano.cta}
          </button>
        </form>
        <span className="adv-quota" title={adv.nano.hint}>{adv.nano.hint}</span>
      </div>

      <div className="adv-stage-canvas" ref={shell} style={{ zoom } as CSSProperties} onPointerDown={onCanvasPointerDown}>
        {(() => {
          const regions: { key: string; label: string; value: AdvancedCanvas }[] = chromeMode
            ? [{ key: "chrome", label: adv.chrome.globalTitle, value: canvas }]
            : [
                { key: "header", label: adv.chrome.header, value: headerCanvas },
                { key: "page", label: adv.canvas.pages, value: shownCanvas },
                { key: "footer", label: adv.chrome.footer, value: footerCanvas },
              ];
          return regions.map((entry) => {
            const value = shownFor(entry.value);
            // "page" är bara etiketten i scenen – själva ytan heter t.ex. "home".
            const regionTarget: AdvancedTarget = entry.key === "page" ? target : (entry.key as AdvancedTarget);
            return (
              <EditableRegion
                key={entry.key}
                config={config}
                canvas={value}
                region={entry.key}
                label={entry.label}
                selectedId={located && located.target === regionTarget ? located.node.id : null}
                selectedIds={entry.key === "page" ? selectedIds : []}
                guide={guide && guide.region === regionTarget ? guide : null}
                editingId={editing && value.nodes.some((node) => node.id === editing) ? editing : null}
                editingText={editingText}
                onEditingText={setEditingText}
                onCommitText={commitText}
                onCancelText={() => setEditing(null)}
                onSelect={onSelect}
                onNodePointerDown={(event, node) => onNodePointerDown(event, node, regionTarget, entry.value)}
                onNodeDoubleClick={(node) => {
                  if (node.type === "text" || node.type === "heading" || node.type === "logo") {
                    setEditing(node.id);
                    setEditingText(node.text ?? "");
                  }
                }}
                onResize={(event, node, dir) => beginDrag(event, node, "resize", dir, regionTarget, entry.value)}
              />
            );
          });
        })()}

        {drawing && drawing.length > 1 ? (
          <svg className="adv-draw-preview"            viewBox={`0 0 ${shownCanvas.width} ${shownCanvas.height}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d={drawing.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join(" ")}
              fill="none"
              stroke={penColor}
              strokeWidth={penWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}

        <div className="adv-page-end" onPointerDown={beginPageResize} title={adv.canvas.resizeHint}>
          <span className="adv-page-end__grip" />
          <small>{adv.canvas.resizeHint}</small>
        </div>
        {!chromeMode && hasCustomChrome ? (
          <div className="adv-chrome-overlay" aria-hidden="true">
            <AdvancedCanvasView
              config={config}
              canvas={{ ...chromeCanvas, background: "transparent", height: canvas.height }}
              vertical="width"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Högerpanel: egenskaper                                              */
/* ------------------------------------------------------------------ */

function HeaderInspector({ config, update, locale }: Common) {
  const adv = getAdvanced(locale);
  const header = config.header;
  const patch = (value: Partial<ThemeConfig["header"]>) => update((current) => ({ ...current, header: { ...current.header, ...value } }));
  return (
    <div className="adv-inspector">
      <div className="adv-inspector__head">
        <div><b>{adv.chrome.header}</b><small>{adv.canvas.properties}</small></div>
      </div>
      <p className="hint">{adv.chrome.headerHint}</p>
      <label className="adv-field"><span>{adv.chrome.logo}</span>
        <input className="input" value={header.logoText} onChange={(event) => patch({ logoText: event.target.value })} />
      </label>
      <label className="adv-field"><span>{adv.chrome.links}</span>
        <textarea
          className="textarea adv-textarea"
          value={header.links.join("\n")}
          onChange={(event) => patch({ links: event.target.value.split("\n").map((link) => link.trim()).filter(Boolean) })}
        />
      </label>
      <label className="adv-field"><span>{adv.chrome.announcement}</span>
        <input className="input" value={header.announcement} onChange={(event) => patch({ announcement: event.target.value })} />
      </label>
      <label className="adv-field"><span>{adv.chrome.actionsPosition}</span>
        <select
          className="select"
          value={header.actionsPosition ?? "right"}
          onChange={(event) => patch({ actionsPosition: event.target.value as ThemeConfig["header"]["actionsPosition"] })}
        >
          <option value="left">{adv.chrome.left}</option>
          <option value="center">{adv.chrome.center}</option>
          <option value="right">{adv.chrome.right}</option>
        </select>
      </label>
      <div className="toggle-row"><span>{adv.chrome.showSearch}</span>
        <button type="button" className={`toggle${header.showSearch ? " is-on" : ""}`} aria-pressed={header.showSearch} onClick={() => patch({ showSearch: !header.showSearch })}><i /></button>
      </div>
      <div className="toggle-row"><span>{adv.chrome.showCart}</span>
        <button type="button" className={`toggle${header.showCart ? " is-on" : ""}`} aria-pressed={header.showCart} onClick={() => patch({ showCart: !header.showCart })}><i /></button>
      </div>
      <div className="toggle-row"><span>{adv.chrome.sticky}</span>
        <button type="button" className={`toggle${header.sticky ? " is-on" : ""}`} aria-pressed={header.sticky} onClick={() => patch({ sticky: !header.sticky })}><i /></button>
      </div>
    </div>
  );
}

function FooterInspector({ config, update, locale }: Common) {
  const adv = getAdvanced(locale);
  const footer = config.footer;
  const patch = (value: Partial<ThemeConfig["footer"]>) => update((current) => ({ ...current, footer: { ...current.footer, ...value } }));
  const setColumn = (index: number, value: { title?: string; links?: string[] }) => {
    patch({ columns: footer.columns.map((column, position) => (position === index ? { ...column, ...value } : column)) });
  };
  return (
    <div className="adv-inspector">
      <div className="adv-inspector__head">
        <div><b>{adv.chrome.footer}</b><small>{adv.canvas.properties}</small></div>
      </div>
      <label className="adv-field"><span>{adv.chrome.footerText}</span>
        <textarea className="textarea adv-textarea" value={footer.text} onChange={(event) => patch({ text: event.target.value })} />
      </label>
      <label className="adv-field"><span>{adv.chrome.social}</span>
        <textarea
          className="textarea adv-textarea"
          value={footer.social.join("\n")}
          onChange={(event) => patch({ social: event.target.value.split("\n").map((link) => link.trim()).filter(Boolean) })}
        />
      </label>
      <div className="panel-title" style={{ marginTop: 16 }}>{adv.chrome.columns}</div>
      {footer.columns.map((column, index) => (
        <div key={`${column.title}-${index}`} className="adv-footer-column">
          <label className="adv-field"><span>{adv.chrome.columnTitle}</span>
            <input className="input" value={column.title} onChange={(event) => setColumn(index, { title: event.target.value })} />
          </label>
          <label className="adv-field"><span>{adv.chrome.columnLinks}</span>
            <textarea
              className="textarea adv-textarea"
              value={column.links.join("\n")}
              onChange={(event) => setColumn(index, { links: event.target.value.split("\n").map((link) => link.trim()).filter(Boolean) })}
            />
          </label>
          <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => patch({ columns: footer.columns.filter((_, position) => position !== index) })}>
            {adv.canvas.delete}
          </button>
        </div>
      ))}
      <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => patch({ columns: [...footer.columns, { title: "Ny kolumn", links: ["Ny länk"] }] })}>
        + {adv.chrome.columns}
      </button>
    </div>
  );
}

export function AdvancedInspector({
  config,
  update,
  locale,
  selectedId,
  onSelect,
  page,
  chromeMode,
}: Common) {
  const adv = getAdvanced(locale);
  if (selectedId === "__header") return <HeaderInspector config={config} update={update} locale={locale} selectedId={selectedId} onSelect={onSelect} page={page} chromeMode={chromeMode} />;
  if (selectedId === "__footer") return <FooterInspector config={config} update={update} locale={locale} selectedId={selectedId} onSelect={onSelect} page={page} chromeMode={chromeMode} />;
  const baseTarget = targetFor(page, chromeMode);
  // Markeringen kan ligga i sidhuvudet, sidan eller sidfoten. Panelen följer
  // noden vart den än ligger, så ett klick alltid redigerar rätt sak.
  const located = locateNode(config, baseTarget, selectedId);
  const target = located?.target ?? baseTarget;
  const canvas = located?.canvas ?? canvasOf(config, baseTarget);
  const node = located?.node ?? null;

  if (!node) {
    return (
      <div className="adv-inspector">
        <div className="panel-title">{adv.canvas.title}</div>
        <p className="hint">{adv.canvas.none}</p>
        <div className="adv-stat-row"><span>{adv.canvas.layers}</span><b>{canvas.nodes.length}</b></div>
        <div className="adv-stat-row"><span>{adv.canvas.size}</span><b>{canvas.width} × {canvas.height}</b></div>
        <label className="adv-field"><span>{adv.canvas.height}</span>
          <input
            className="input"
            type="number"
            min={MIN_CANVAS_HEIGHT}
            max={MAX_CANVAS_HEIGHT}
            step={100}
            value={canvas.height}
            onChange={(event) => update((current) => withCanvas(current, target, resizeCanvasHeight(canvas, numberValue(event.target.value, canvas.height))))}
          />
        </label>
        <div className="adv-actions">
          <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => update((current) => withCanvas(current, target, resizeCanvasHeight(canvas, canvas.height + 600)))}>+600 px</button>
          <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => update((current) => withCanvas(current, target, resizeCanvasHeight(canvas, canvas.height - 600)))}>−600 px</button>
        </div>
        <p className="hint">{adv.canvas.heightHint}</p>
        <div className="panel-title" style={{ marginTop: 20 }}>{adv.canvas.background}</div>
        <ColorField
          label={adv.canvas.background}
          config={config}
          value={canvas.background === "transparent" ? "" : canvas.background}
          allowEmpty
          onChange={(value) => update((current) => withCanvas(current, target, { ...canvasOf(current, target), background: value || "transparent" }))}
        />
        <div className="adv-token-preview">
          {[config.palette.primary, config.palette.accent, config.palette.surface, config.palette.background].map((color) => <i key={color} style={{ background: color }} />)}
        </div>
        {page !== "home" ? (
          <>
            <div className="toggle-row" style={{ marginTop: 14 }}>
              <span>{adv.canvas.replaceDefault}</span>
              <button
                type="button"
                className={`toggle${canvas.replaceDefault ? " is-on" : ""}`}
                aria-pressed={Boolean(canvas.replaceDefault)}
                onClick={() => update((current) => withCanvas(current, target, { ...canvasOf(current, target), replaceDefault: !canvasOf(current, target).replaceDefault }))}
              >
                <i />
              </button>
            </div>
            <p className="hint">{adv.canvas.replaceHint}</p>
          </>
        ) : null}
        <p className="hint">{adv.canvas.empty}</p>
      </div>
    );
  }

  const patch = (value: Partial<AdvancedNode>) => update((current) => patchNode(current, target, node.id, value));
  const colorLabel = (token: string | undefined) => token ?? "";
  const isText = node.type === "text" || node.type === "heading";
  const isButton = node.type === "button";
  const isSection = node.type === "section";
  const resizeNode = (axis: "w" | "h", value: number) => {
    const size = Math.max(4, value);
    if (axis === "h" && (node.type === "logo" || node.type === "nav")) {
      const factor = size / Math.max(1, node.h);
      patch({
        h: size,
        fontSize: Math.max(4, Math.min(2000, Math.round((node.fontSize ?? (node.type === "logo" ? 64 : 18)) * factor))),
      });
      return;
    }
    patch({ [axis]: size });
  };

  return (
    <div className="adv-inspector">
      <div className="adv-inspector__head">
        <div>
          <b>{node.type}</b>
          <small>{adv.canvas.properties}</small>
        </div>
        <button type="button" className="icon-btn" aria-label={adv.canvas.delete} title={adv.canvas.delete} onClick={() => {
          update((current) => removeNode(current, target, node.id));
          onSelect(null);
        }}>
          <Icon name="trash" size="sm" />
        </button>
      </div>

      {isText ? (
        <>
          <label className="adv-field"><span>{adv.fields.text}</span>
            <textarea className="textarea adv-textarea" value={node.text ?? ""} onChange={(event) => patch({ text: event.target.value })} />
          </label>
          <label className="adv-field"><span>{adv.fields.fontSize}</span>
            <input className="input" type="number" min={4} max={2000} value={node.fontSize ?? 28} onChange={(event) => patch({ fontSize: numberValue(event.target.value, 28) })} />
          </label>
          <label className="adv-field"><span>{adv.fields.fontWeight}</span>
            <select className="select" value={node.fontWeight ?? 500} onChange={(event) => patch({ fontWeight: Number(event.target.value) })}>
              {[300, 400, 500, 600, 700, 800].map((weight) => <option key={weight} value={weight}>{weight}</option>)}
            </select>
          </label>
          <label className="adv-field"><span>{adv.fields.align}</span>
            <select className="select" value={node.align ?? "left"} onChange={(event) => patch({ align: event.target.value as AdvancedNode["align"] })}>
              <option value="left">left</option><option value="center">center</option><option value="right">right</option>
            </select>
          </label>
          <TypographyExtra node={node} patch={patch} />
          <ColorField config={config} label={adv.fields.color} value={node.color} onChange={(value) => patch({ color: value })} />
        </>
      ) : null}

      {node.type === "logo" ? (
        <>
          <label className="adv-field"><span>{adv.fields.text}</span>
            <input className="input" value={node.text ?? ""} onChange={(event) => patch({ text: event.target.value })} placeholder={config.header.logoText || config.shop.name} />
          </label>
          <label className="adv-field"><span>{adv.fields.fontSize}</span>
            <input className="input" type="number" min={4} max={2000} value={node.fontSize ?? 64} onChange={(event) => patch({ fontSize: numberValue(event.target.value, 64) })} />
          </label>
          <label className="adv-field"><span>{adv.fields.fontWeight}</span>
            <select className="select" value={node.fontWeight ?? 500} onChange={(event) => patch({ fontWeight: Number(event.target.value) })}>
              {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((weight) => <option key={weight} value={weight}>{weight}</option>)}
            </select>
          </label>
          <label className="adv-field"><span>{adv.fields.align}</span>
            <select className="select" value={node.align ?? "left"} onChange={(event) => patch({ align: event.target.value as AdvancedNode["align"] })}>
              <option value="left">left</option><option value="center">center</option><option value="right">right</option>
            </select>
          </label>
          <TypographyExtra node={node} patch={patch} />
          <ColorField config={config} label={adv.fields.color} value={node.color} onChange={(value) => patch({ color: value })} />
        </>
      ) : null}

      {node.type === "nav" ? (
        <>
          <label className="adv-field"><span>{adv.fields.menu}</span>
            <input className="input" value={node.menu ?? "main-menu"} onChange={(event) => patch({ menu: event.target.value })} placeholder="main-menu" />
          </label>
          <p className="hint">{adv.fields.menuHint}</p>
          <label className="adv-field"><span>{adv.fields.fontSize}</span>
            <input className="input" type="number" min={4} max={2000} value={node.fontSize ?? 18} onChange={(event) => patch({ fontSize: numberValue(event.target.value, 18) })} />
          </label>
          <label className="adv-field"><span>{adv.fields.fontWeight}</span>
            <select className="select" value={node.fontWeight ?? 500} onChange={(event) => patch({ fontWeight: Number(event.target.value) })}>
              {[300, 400, 500, 600, 700, 800].map((weight) => <option key={weight} value={weight}>{weight}</option>)}
            </select>
          </label>
          <label className="adv-field"><span>{adv.fields.align}</span>
            <select className="select" value={node.align ?? "left"} onChange={(event) => patch({ align: event.target.value as AdvancedNode["align"] })}>
              <option value="left">left</option><option value="center">center</option><option value="right">right</option>
            </select>
          </label>
          <TypographyExtra node={node} patch={patch} />
          <ColorField config={config} label={adv.fields.color} value={node.color} onChange={(value) => patch({ color: value })} />
        </>
      ) : null}

      {node.type === "cart" || node.type === "search" ? (
        <>
          <label className="adv-field"><span>{adv.fields.fontSize}</span>
            <input className="input" type="number" min={4} max={2000} value={node.fontSize ?? 18} onChange={(event) => patch({ fontSize: numberValue(event.target.value, 18) })} />
          </label>
          <IconPicker node={node} patch={patch} />
          <label className="adv-field"><span>Ikonens linjetjocklek</span>
            <input className="input" type="number" min={0.25} max={8} step={0.25} value={node.iconStroke ?? 1.75} onChange={(event) => patch({ iconStroke: numberValue(event.target.value, node.iconStroke ?? 1.75) })} />
          </label>
          <ColorField config={config} label={adv.fields.color} value={node.color} onChange={(value) => patch({ color: value })} />
          {node.type === "cart" ? <ColorField config={config} label={adv.fields.cartCount} value={node.fill} onChange={(value) => patch({ fill: value })} /> : null}
          <p className="hint">{adv.fields.storefrontHint}</p>
        </>
      ) : null}

      {isButton ? (
        <>
          <label className="adv-field"><span>{adv.fields.cta}</span><input className="input" value={node.ctaLabel ?? ""} onChange={(event) => patch({ ctaLabel: event.target.value })} /></label>
          <label className="adv-field"><span>{adv.fields.href}</span><input className="input" value={node.href ?? ""} onChange={(event) => patch({ href: event.target.value })} /></label>
          <ColorField config={config} label={adv.fields.fill} value={node.fill} onChange={(value) => patch({ fill: value })} />
          <ColorField config={config} label={adv.fields.color} value={node.color} onChange={(value) => patch({ color: value })} />
          <label className="adv-field"><span>{adv.fields.fontSize}</span><input className="input" type="number" value={node.fontSize ?? 18} onChange={(event) => patch({ fontSize: numberValue(event.target.value, 18) })} /></label>
          <TypographyExtra node={node} patch={patch} />
        </>
      ) : null}

      {node.type === "image" ? (
        <>
          <label className="adv-field"><span>{adv.fields.src}</span><input className="input" value={node.src ?? ""} onChange={(event) => patch({ src: event.target.value })} placeholder="https://…" /></label>
          <label className="adv-field"><span>{adv.fields.alt}</span><input className="input" value={node.alt ?? ""} onChange={(event) => patch({ alt: event.target.value })} /></label>
          <label className="adv-field"><span>{adv.fields.fit}</span>
            <select className="select" value={node.fit ?? "cover"} onChange={(event) => patch({ fit: event.target.value as AdvancedNode["fit"] })}>
              <option value="cover">cover</option><option value="contain">contain</option>
            </select>
          </label>
        </>
      ) : null}

      {node.type === "product" ? (
        <label className="adv-field"><span>{adv.fields.product}</span>
          <select className="select" value={node.productIndex ?? 0} onChange={(event) => patch({ productIndex: Number(event.target.value) })}>
            {config.shop.products.map((product, index) => <option key={product.id} value={index}>{product.name} · {product.price}</option>)}
          </select>
        </label>
      ) : null}

      {node.type === "products" ? (
        <>
          <div className="panel-title">Produktrad</div>
          <div className="adv-grid-2">
            <label className="adv-field"><span>Kolumner</span>
              <input className="input" type="number" min={1} max={12} value={node.columns ?? 3} onChange={(event) => patch({ columns: numberValue(event.target.value, node.columns ?? 3) })} />
            </label>
            <label className="adv-field"><span>Antal</span>
              <input className="input" type="number" min={1} max={24} value={node.count ?? 3} onChange={(event) => patch({ count: numberValue(event.target.value, node.count ?? 3) })} />
            </label>
            <label className="adv-field"><span>Mellanrum</span>
              <input className="input" type="number" min={0} max={400} value={node.gap ?? 24} onChange={(event) => patch({ gap: numberValue(event.target.value, node.gap ?? 24) })} />
            </label>
            <label className="adv-field"><span>Startprodukt</span>
              <input className="input" type="number" min={0} max={Math.max(0, config.shop.products.length - 1)} value={node.productIndex ?? 0} onChange={(event) => patch({ productIndex: numberValue(event.target.value, node.productIndex ?? 0) })} />
            </label>
          </div>
          <p className="hint">Kolumner styr om produkterna ligger på samma rad eller staplas. Dra i hörnet för att ge raden mer plats.</p>
        </>
      ) : null}

      {isSection ? (
        <>
          <label className="adv-field"><span>{adv.fields.preset}</span>
            <select className="select" value={node.preset ?? "hero"} onChange={(event) => patch({ preset: event.target.value as AdvancedNode["preset"] })}>
              {(["hero", "campaign", "products", "features", "testimonial", "banner"] as const).map((preset) => <option key={preset} value={preset}>{adv.presets[preset]}</option>)}
            </select>
          </label>
          <label className="adv-field"><span>{adv.fields.eyebrow}</span><input className="input" value={node.eyebrow ?? ""} onChange={(event) => patch({ eyebrow: event.target.value })} /></label>
          <label className="adv-field"><span>{adv.fields.title}</span><input className="input" value={node.title ?? ""} onChange={(event) => patch({ title: event.target.value })} /></label>
          <label className="adv-field"><span>{adv.fields.text}</span><textarea className="textarea adv-textarea" value={node.text ?? ""} onChange={(event) => patch({ text: event.target.value })} /></label>
          <label className="adv-field"><span>{adv.fields.cta}</span><input className="input" value={node.ctaLabel ?? ""} onChange={(event) => patch({ ctaLabel: event.target.value })} /></label>
          <label className="adv-field"><span>{adv.fields.href}</span><input className="input" value={node.href ?? ""} onChange={(event) => patch({ href: event.target.value })} /></label>
          <label className="adv-field"><span>{adv.fields.fontSize}</span><input className="input" type="number" min={4} max={2000} value={node.fontSize ?? 48} onChange={(event) => patch({ fontSize: numberValue(event.target.value, 48) })} /></label>
          <TypographyExtra node={node} patch={patch} />
          <ColorField config={config} label={adv.fields.fill} value={node.fill} onChange={(value) => patch({ fill: value })} />
          <ColorField config={config} label={adv.fields.color} value={node.color} onChange={(value) => patch({ color: value })} />
        </>
      ) : null}

      {node.type === "shape" ? (
        <>
          <label className="adv-field"><span>{adv.fields.shape}</span>
            <select className="select" value={node.shape ?? "rect"} onChange={(event) => patch({ shape: event.target.value as AdvancedNode["shape"] })}>
              <option value="rect">rect</option><option value="ellipse">ellipse</option><option value="line">line</option>
            </select>
          </label>
          <ColorField config={config} label={adv.fields.fill} value={node.fill} onChange={(value) => patch({ fill: value })} />
          <ColorField config={config} label={adv.fields.stroke} value={node.stroke} onChange={(value) => patch({ stroke: value })} allowEmpty />
          <label className="adv-field"><span>{adv.fields.strokeWidth}</span><input className="input" type="number" value={node.strokeWidth ?? 2} onChange={(event) => patch({ strokeWidth: numberValue(event.target.value, 2) })} /></label>
        </>
      ) : null}

      {node.type === "drawing" ? (
        <>
          <ColorField config={config} label={adv.fields.stroke} value={node.stroke} onChange={(value) => patch({ stroke: value })} />
          <label className="adv-field"><span>{adv.fields.strokeWidth}</span><input className="input" type="number" value={node.strokeWidth ?? 4} onChange={(event) => patch({ strokeWidth: numberValue(event.target.value, 4) })} /></label>
        </>
      ) : null}

      {node.type === "connector" ? (
        <>
          <label className="adv-field"><span>Från</span>
            <select className="select" value={node.fromId ?? ""} onChange={(event) => patch({ fromId: event.target.value })}>
              <option value="">—</option>
              {canvas.nodes.filter((item) => item.type !== "connector").map((item) => <option key={item.id} value={item.id}>{item.type} · {item.id.slice(-4)}</option>)}
            </select>
          </label>
          <label className="adv-field"><span>Till</span>
            <select className="select" value={node.toId ?? ""} onChange={(event) => patch({ toId: event.target.value })}>
              <option value="">—</option>
              {canvas.nodes.filter((item) => item.type !== "connector").map((item) => <option key={item.id} value={item.id}>{item.type} · {item.id.slice(-4)}</option>)}
            </select>
          </label>
          <ColorField config={config} label={adv.fields.stroke} value={node.stroke} onChange={(value) => patch({ stroke: value })} />
          <label className="adv-field"><span>{adv.fields.strokeWidth}</span><input className="input" type="number" value={node.strokeWidth ?? 3} onChange={(event) => patch({ strokeWidth: numberValue(event.target.value, 3) })} /></label>
        </>
      ) : null}

      {node.type !== "connector" ? (
        <>
          <div className="panel-title" style={{ marginTop: 16 }}>{adv.fx.title}</div>
          <div className="adv-grid-2">
            <label className="adv-field"><span>{adv.fx.hover}</span>
              <select className="select" value={node.hover ?? "none"} onChange={(event) => patch({ hover: event.target.value as AdvancedNode["hover"] })}>
                {HOVER_EFFECTS.map((effect) => <option key={effect} value={effect}>{adv.fx.hoverOptions[effect]}</option>)}
              </select>
            </label>
            <label className="adv-field"><span>{adv.fx.reveal}</span>
              <select className="select" value={node.reveal ?? "none"} onChange={(event) => patch({ reveal: event.target.value as AdvancedNode["reveal"] })}>
                {REVEAL_EFFECTS.map((effect) => <option key={effect} value={effect}>{adv.fx.revealOptions[effect]}</option>)}
              </select>
            </label>
          </div>
          <p className="hint">{adv.fx.hint}</p>
        </>
      ) : null}

      <div className="panel-title" style={{ marginTop: 16 }}>{adv.canvas.position}</div>
      <div className="adv-grid-2">
        <label className="adv-field"><span>X</span><input className="input" type="number" value={Math.round(node.x)} onChange={(event) => patch({ x: numberValue(event.target.value, node.x) })} /></label>
        <label className="adv-field"><span>Y</span><input className="input" type="number" value={Math.round(node.y)} onChange={(event) => patch({ y: numberValue(event.target.value, node.y) })} /></label>
        <label className="adv-field"><span>W</span><input className="input" type="number" min={4} value={Math.round(node.w)} onChange={(event) => resizeNode("w", numberValue(event.target.value, node.w))} /></label>
        <label className="adv-field"><span>H</span><input className="input" type="number" min={4} value={Math.round(node.h)} onChange={(event) => resizeNode("h", numberValue(event.target.value, node.h))} /></label>
      </div>
      <label className="adv-field"><span>{adv.canvas.radius}</span>
        <div className="adv-pair">
          <input className="input" type="number" min={0} value={Math.round(node.radius)} onChange={(event) => patch({ radius: numberValue(event.target.value, node.radius) })} />
          <input className="adv-range" type="range" min={0} max={800} value={Math.min(800, node.radius)} onChange={(event) => patch({ radius: numberValue(event.target.value, node.radius) })} />
        </div>
      </label>
      <label className="adv-field"><span>{adv.canvas.rotation}</span>
        <div className="adv-pair">
          <input className="input" type="number" value={Math.round(node.rotation)} onChange={(event) => patch({ rotation: numberValue(event.target.value, node.rotation) })} />
          <input className="adv-range" type="range" min={-360} max={360} value={Math.max(-360, Math.min(360, node.rotation))} onChange={(event) => patch({ rotation: numberValue(event.target.value, node.rotation) })} />
        </div>
      </label>
      <label className="adv-field"><span>{adv.canvas.opacity}</span>
        <div className="adv-pair">
          <input className="input" type="number" min={0} max={1} step={0.01} value={node.opacity} onChange={(event) => patch({ opacity: numberValue(event.target.value, node.opacity) })} />
          <input className="adv-range" type="range" min={0} max={1} step={0.01} value={node.opacity} onChange={(event) => patch({ opacity: numberValue(event.target.value, node.opacity) })} />
        </div>
      </label>
      {isText || node.type === "logo" || node.type === "nav" || isSection ? (
        <label className="adv-field"><span>Line height</span>
          <input className="input" type="number" min={0.5} max={4} step={0.05} value={node.lineHeight ?? 1.2} onChange={(event) => patch({ lineHeight: numberValue(event.target.value, node.lineHeight ?? 1.2) })} />
        </label>
      ) : null}
      {isText || node.type === "logo" || node.type === "nav" ? (
        <label className="adv-field"><span>Letter spacing (em)</span>
          <input className="input" type="number" step={0.01} value={node.letterSpacing ?? 0} onChange={(event) => patch({ letterSpacing: numberValue(event.target.value, node.letterSpacing ?? 0) })} />
        </label>
      ) : null}
      <label className="adv-field"><span>{adv.canvas.layer}</span>
        <input className="input" type="number" min={0} max={9999} value={node.z} onChange={(event) => patch({ z: numberValue(event.target.value, node.z) })} />
      </label>

      <div className="adv-actions">
        <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => {
          const clone = duplicateForCanvas(node);
          update((current) => addNode(current, target, clone));
          onSelect(clone.id);
        }}>{adv.canvas.duplicate}</button>
        <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => patch({ z: nextZ(canvas.nodes) })}>{adv.canvas.front}</button>
        <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => patch({ z: Math.max(0, Math.min(...canvas.nodes.map((item) => item.z)) - 1) })}>{adv.canvas.back}</button>
      </div>
      <p className="hint">{colorLabel(node.fill) ? `fill: ${colorLabel(node.fill)}` : `color: ${colorFor(node.color, config, "text")}`}</p>
    </div>
  );
}
