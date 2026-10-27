"use client";

import { useState } from "react";
import type { Dict } from "@/lib/i18n";
import { FONTS, SANS_FONTS, SERIF_FONTS, type FontKey, type Section, type SectionType, type ThemeConfig } from "@/lib/theme/types";
import { applyMood, emptySection, MOODS, PRESET_ORDER } from "@/lib/theme/presets";
import { MOOD_LABELS, SECTION_LABELS } from "@/lib/theme/labels";
import { Icon, type IconName } from "@/components/Icon";
import type { Locale, MoodId } from "@/lib/theme/types";
import {
  ColorRow,
  Field,
  FontPreview,
  MoodCards,
  PairingPicker,
  RadiusWidget,
  Segmented,
  Slider,
  TextArea,
  TextInput,
  Toggle,
  designReset,
} from "./controls";

type Update = (recipe: (config: ThemeConfig) => ThemeConfig) => void;

const SECTION_ICONS: Record<SectionType, IconName> = {
  hero: "sparkles",
  productGrid: "grid",
  features: "blocks",
  imageText: "image",
  testimonials: "quote",
  marquee: "repeat",
  faq: "help",
  newsletter: "mail",
  ugc: "images",
  trust: "checkCircle",
  bundle: "percent",
  sizeGuide: "ruler",
  countdown: "zap",
  collection: "layers",
  comparison: "table",
  lookbook: "frame",
  completeTheLook: "cart",
  story: "blockquote",
};

const SIGNATURE_COLORS = ["#C2542D", "#17171A", "#245C43", "#6C4CF1", "#F26D9C", "#2E5BFF", "#B08C4F", "#0E8B86"];

function heroOf(config: ThemeConfig) {
  return config.sections.find((section) => section.type === "hero");
}

function patchHero(config: ThemeConfig, patch: Record<string, unknown>): ThemeConfig {
  return { ...config, sections: config.sections.map((section) => (section.type === "hero" ? ({ ...section, ...patch } as Section) : section)) };
}

export function EasyPanel({ config, update, locale, dict }: { config: ThemeConfig; update: Update; locale: Locale; dict: Dict }) {
  const hero = heroOf(config);
  return (
    <>
      <div style={{ marginBottom: 18 }}>
        <h3 style={{ fontSize: 21 }}>{dict.studio.easyTitle}</h3>
        <p className="hint" style={{ marginTop: 6 }}>{dict.studio.easySub}</p>
      </div>

      <div className="panel-section">
        <div className="panel-title">{dict.studio.mood}</div>
        <p className="hint" style={{ marginBottom: 8 }}>{dict.studio.moodSub}</p>
        <MoodCards locale={locale} onPick={(mood) => update((current) => applyMood(current, mood))} />
      </div>

      <div className="panel-section">
        <div className="panel-title">{dict.studio.shape}</div>
        <p className="hint" style={{ marginBottom: 10 }}>{dict.studio.shapeSub}</p>
        <RadiusWidget
          radius={config.shape.radius}
          hint={dict.studio.dragShape}
          onChange={(radius) => update((current) => ({ ...current, shape: { ...current.shape, radius, buttonRadius: current.shape.buttonRadius > 100 ? 999 : Math.min(32, radius + 4) } }))}
        />
        <Field label={dict.studio.buttonRadius}>
          <Segmented
            value={config.shape.buttonRadius >= 100 ? 999 : config.shape.buttonRadius <= 6 ? 2 : 12}
            options={[
              { value: 2, label: "Rak" },
              { value: 12, label: "Mjuk" },
              { value: 999, label: "Pill" },
            ]}
            onChange={(value) => update((current) => ({ ...current, shape: { ...current.shape, buttonRadius: value } }))}
          />
        </Field>
      </div>

      <div className="panel-section">
        <div className="panel-title">{dict.studio.type}</div>
        <p className="hint" style={{ marginBottom: 8 }}>{dict.studio.typeSub}</p>
        <PairingPicker
          heading={config.typography.heading}
          body={config.typography.body}
          onPick={(heading, body) => update((current) => ({ ...current, typography: { ...current.typography, heading, body } }))}
        />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, gap: 10 }}>
          <span className="hint">{dict.studio.size}</span>
          <div className="type-buttons">
            <button type="button" onClick={() => update((c) => ({ ...c, typography: { ...c.typography, baseSize: Math.max(13, c.typography.baseSize - 1) } }))}>A−</button>
            <span>{config.typography.baseSize}</span>
            <button type="button" onClick={() => update((c) => ({ ...c, typography: { ...c.typography, baseSize: Math.min(24, c.typography.baseSize + 1) } }))}>A+</button>
          </div>
        </div>
      </div>

      <div className="panel-section">
        <div className="panel-title">{dict.studio.color}</div>
        <p className="hint" style={{ marginBottom: 8 }}>{dict.studio.colorSub}</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {SIGNATURE_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={color}
              onClick={() => update((current) => ({ ...current, palette: { ...current.palette, primary: color } }))}
              style={{ width: 24, height: 24, borderRadius: 999, background: color, border: config.palette.primary === color ? "2px solid #131310" : "2px solid #fff", boxShadow: "0 0 0 1px var(--line)" }}
            />
          ))}
        </div>
        <ColorRow label={dict.studio.primary} value={config.palette.primary} onChange={(value) => update((c) => ({ ...c, palette: { ...c.palette, primary: value } }))} />
        <ColorRow label={dict.studio.accent} value={config.palette.accent} onChange={(value) => update((c) => ({ ...c, palette: { ...c.palette, accent: value } }))} />
      </div>

      <div className="panel-section">
        <div className="panel-title">{dict.studio.contentTitle}</div>
        <Field label={dict.studio.shopName}>
          <TextInput value={config.shop.name} onChange={(value) => update((c) => ({ ...c, shop: { ...c.shop, name: value }, header: { ...c.header, logoText: value } }))} />
        </Field>
        <Field label={dict.studio.tagline}>
          <TextInput value={config.shop.tagline} onChange={(value) => update((c) => ({ ...c, shop: { ...c.shop, tagline: value } }))} />
        </Field>
        {hero && hero.type === "hero" && (
          <>
            <Field label={dict.studio.heroTitle}>
              <TextArea value={hero.title} rows={2} onChange={(value) => update((c) => patchHero(c, { title: value }))} />
            </Field>
            <Field label={dict.studio.cta}>
              <TextInput value={hero.ctaLabel} onChange={(value) => update((c) => patchHero(c, { ctaLabel: value }))} />
            </Field>
          </>
        )}
      </div>
    </>
  );
}

export function DesignPanel({ config, update, dict, locale }: { config: ThemeConfig; update: Update; dict: Dict; locale: Locale }) {
  return (
    <>
      <div className="panel-title">{dict.studio.designTitle}</div>

      <div className="panel-section">
        <div className="panel-title">{dict.studio.presets}</div>
        <MoodCards locale={locale} onPick={(mood) => update((current) => applyMood(current, mood))} />
      </div>

      <div className="panel-section">
        <div className="panel-title">{dict.studio.palette}</div>
        <ColorRow label={dict.studio.primary} value={config.palette.primary} onChange={(value) => update((c) => ({ ...c, palette: { ...c.palette, primary: value } }))} />
        <ColorRow label={dict.studio.accent} value={config.palette.accent} onChange={(value) => update((c) => ({ ...c, palette: { ...c.palette, accent: value } }))} />
        <ColorRow label={dict.studio.background} value={config.palette.background} onChange={(value) => update((c) => ({ ...c, palette: { ...c.palette, background: value } }))} />
        <ColorRow label={dict.studio.surface} value={config.palette.surface} onChange={(value) => update((c) => ({ ...c, palette: { ...c.palette, surface: value } }))} />
        <ColorRow label={dict.studio.text} value={config.palette.text} onChange={(value) => update((c) => ({ ...c, palette: { ...c.palette, text: value } }))} />
        <ColorRow label={dict.studio.muted} value={config.palette.muted} onChange={(value) => update((c) => ({ ...c, palette: { ...c.palette, muted: value } }))} />
        <ColorRow label={dict.studio.border} value={config.palette.border} onChange={(value) => update((c) => ({ ...c, palette: { ...c.palette, border: value } }))} />
      </div>

      <div className="panel-section">
        <div className="panel-title">{dict.studio.fonts}</div>
        <Field label={dict.studio.headingFont}>
          <select className="select" value={config.typography.heading} onChange={(event) => update((c) => ({ ...c, typography: { ...c.typography, heading: event.target.value as FontKey } }))}>
            <optgroup label="Sans">
              {SANS_FONTS.map((key) => <option key={key} value={key}>{FONTS[key].label}</option>)}
            </optgroup>
            <optgroup label="Serif">
              {SERIF_FONTS.map((key) => <option key={key} value={key}>{FONTS[key].label}</option>)}
            </optgroup>
          </select>
        </Field>
        <Field label={dict.studio.bodyFont}>
          <select className="select" value={config.typography.body} onChange={(event) => update((c) => ({ ...c, typography: { ...c.typography, body: event.target.value as FontKey } }))}>
            {Object.entries(FONTS).map(([key, font]) => <option key={key} value={key}>{font.label}</option>)}
          </select>
        </Field>
        <div style={{ padding: "8px 0 2px" }}>
          <FontPreview font={config.typography.heading} text={config.shop.name || "Aa"} style={{ fontSize: 26, fontWeight: config.typography.headingWeight }} />
        </div>
        <Slider label={dict.studio.size} value={config.typography.baseSize} min={13} max={24} step={1} onChange={(value) => update((c) => ({ ...c, typography: { ...c.typography, baseSize: value } }))} />
        <Slider label={dict.studio.scale} value={config.typography.scale} min={1} max={1.6} step={0.01} unit="×" onChange={(value) => update((c) => ({ ...c, typography: { ...c.typography, scale: value } }))} />
        <Slider label={dict.studio.weight} value={config.typography.headingWeight} min={400} max={800} step={100} unit="" onChange={(value) => update((c) => ({ ...c, typography: { ...c.typography, headingWeight: value } }))} />
        <Slider label={dict.studio.tracking} value={config.typography.tracking} min={-0.06} max={0.08} step={0.005} unit="em" onChange={(value) => update((c) => ({ ...c, typography: { ...c.typography, tracking: value } }))} />
        <Toggle label={dict.studio.uppercase} checked={config.typography.uppercaseHeadings} onChange={(value) => update((c) => ({ ...c, typography: { ...c.typography, uppercaseHeadings: value } }))} />
      </div>

      <div className="panel-section">
        <div className="panel-title">{dict.studio.shape}</div>
        <RadiusWidget radius={config.shape.radius} hint={dict.studio.dragShape} onChange={(radius) => update((c) => ({ ...c, shape: { ...c.shape, radius } }))} />
        <Slider label={dict.studio.buttonRadius} value={Math.min(999, config.shape.buttonRadius)} min={0} max={999} step={1} onChange={(value) => update((c) => ({ ...c, shape: { ...c.shape, buttonRadius: value } }))} />
        <Slider label={dict.studio.borders} value={config.shape.borderWidth} min={0} max={4} step={1} onChange={(value) => update((c) => ({ ...c, shape: { ...c.shape, borderWidth: value } }))} />
        <Slider label={dict.studio.shadow} value={config.shape.shadow} min={0} max={40} step={2} onChange={(value) => update((c) => ({ ...c, shape: { ...c.shape, shadow: value } }))} />
      </div>

      <div className="panel-section">
        <div className="panel-title">{dict.studio.layout}</div>
        <Slider label={dict.studio.maxWidth} value={config.layout.maxWidth} min={960} max={1600} step={20} onChange={(value) => update((c) => ({ ...c, layout: { ...c.layout, maxWidth: value } }))} />
        <Slider label={dict.studio.spacing} value={config.layout.sectionSpacing} min={32} max={160} step={4} onChange={(value) => update((c) => ({ ...c, layout: { ...c.layout, sectionSpacing: value } }))} />
        <Slider label={dict.studio.gap} value={config.layout.gridGap} min={8} max={48} step={2} onChange={(value) => update((c) => ({ ...c, layout: { ...c.layout, gridGap: value } }))} />
        <Field label={dict.studio.density}>
          <Segmented
            value={config.layout.density}
            options={[
              { value: "compact", label: dict.studio.densityCompact },
              { value: "cozy", label: dict.studio.densityCozy },
              { value: "airy", label: dict.studio.densityAiry },
            ]}
            onChange={(value) => update((c) => ({ ...c, layout: { ...c.layout, density: value, sectionSpacing: value === "compact" ? 56 : value === "airy" ? 120 : 88 } }))}
          />
        </Field>
      </div>

      <div className="panel-section">
        <div className="panel-title">{dict.studio.motion}</div>
        <Toggle label={dict.studio.motion} checked={config.motion.enabled} onChange={(value) => update((c) => ({ ...c, motion: { ...c.motion, enabled: value } }))} />
        <Slider label={dict.studio.speed} value={config.motion.speed} min={200} max={1200} step={50} unit="ms" onChange={(value) => update((c) => ({ ...c, motion: { ...c.motion, speed: value } }))} />
      </div>

      <button className="ui-btn ui-btn--ghost ui-btn--block" type="button" onClick={() => update((current) => designReset(current))}>
        {dict.studio.resetDesign}
      </button>
    </>
  );
}

export function SectionsPanel({
  config,
  update,
  dict,
  locale,
  selectedId,
  onSelect,
}: {
  config: ThemeConfig;
  update: Update;
  dict: Dict;
  locale: Locale;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const reorder = (from: string, to: string) =>
    update((current) => {
      const list = [...current.sections];
      const fromIndex = list.findIndex((item) => item.id === from);
      const toIndex = list.findIndex((item) => item.id === to);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return current;
      const [moved] = list.splice(fromIndex, 1);
      list.splice(toIndex, 0, moved);
      return { ...current, sections: list };
    });

  return (
    <>
      <div className="panel-title">{dict.studio.addSection}</div>
      <div className="section-palette">
        {(Object.keys(SECTION_LABELS[locale]) as SectionType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => {
              const section = emptySection(type);
              update((current) => ({ ...current, sections: [...current.sections, section] }));
              onSelect(section.id);
            }}
          >
            <b>
              <Icon name={SECTION_ICONS[type]} size="md" />
            </b>
            <span>{SECTION_LABELS[locale][type]}</span>
            <small>
              <Icon name="plus" size="sm" />
            </small>
          </button>
        ))}
      </div>

      <div className="panel-section" style={{ marginTop: 18 }}>
        <div className="panel-title">
          <span>{dict.studio.layers}</span>
          <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>{dict.studio.dragHint}</span>
        </div>
        <div style={{ display: "grid", gap: 3 }}>
          {config.sections.map((section) => (
            <div
              key={section.id}
              className={`layer${selectedId === section.id ? " is-active" : ""}${overId === section.id ? " is-dragover" : ""}`}
              draggable
              onDragStart={() => setDragId(section.id)}
              onDragOver={(event) => {
                event.preventDefault();
                setOverId(section.id);
              }}
              onDragLeave={() => setOverId(null)}
              onDrop={() => {
                if (dragId) reorder(dragId, section.id);
                setDragId(null);
                setOverId(null);
              }}
              onClick={() => onSelect(section.id)}
            >
              <span className="layer__grip" aria-hidden="true">
                <Icon name="drag" size="sm" />
              </span>
              <span className="layer__name">{SECTION_LABELS[locale][section.type]}</span>
              <button
                type="button"
                className="layer__eye"
                aria-label={section.visible ? dict.studio.visible : dict.studio.hidden}
                onClick={(event) => {
                  event.stopPropagation();
                  update((current) => ({ ...current, sections: current.sections.map((item) => (item.id === section.id ? { ...item, visible: !item.visible } : item)) }));
                }}
              >
                <Icon name={section.visible ? "eye" : "eyeOff"} size="sm" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function ContentPanel({ config, update, dict }: { config: ThemeConfig; update: Update; dict: Dict }) {
  const hero = heroOf(config);
  return (
    <>
      <div className="panel-title">{dict.studio.contentTitle}</div>
      <div className="panel-section">
        <div className="panel-title">{dict.studio.shopDetails}</div>
        <Field label={dict.studio.shopName}>
          <TextInput value={config.shop.name} onChange={(value) => update((c) => ({ ...c, shop: { ...c.shop, name: value }, header: { ...c.header, logoText: value } }))} />
        </Field>
        <Field label={dict.studio.tagline}>
          <TextInput value={config.shop.tagline} onChange={(value) => update((c) => ({ ...c, shop: { ...c.shop, tagline: value } }))} />
        </Field>
        <Field label={dict.studio.announcement}>
          <TextInput value={config.header.announcement} onChange={(value) => update((c) => ({ ...c, header: { ...c.header, announcement: value } }))} />
        </Field>
        <Field label={dict.studio.currency}>
          <TextInput value={config.shop.currency} onChange={(value) => update((c) => ({ ...c, shop: { ...c.shop, currency: value } }))} />
        </Field>
        <div className="field-row">
          <Field label={dict.studio.rating}>
            <TextInput value={config.shop.rating} onChange={(value) => update((c) => ({ ...c, shop: { ...c.shop, rating: value } }))} />
          </Field>
          <Field label={dict.studio.customers}>
            <TextInput value={config.shop.customers} onChange={(value) => update((c) => ({ ...c, shop: { ...c.shop, customers: value } }))} />
          </Field>
        </div>
        <Field label={dict.studio.footerText}>
          <TextArea value={config.footer.text} rows={2} onChange={(value) => update((c) => ({ ...c, footer: { ...c.footer, text: value } }))} />
        </Field>
      </div>

      <div className="panel-section">
        <div className="panel-title">{dict.studio.headerTitle}</div>
        <Field label={dict.studio.headerLinksHint}>
          <TextArea
            value={config.header.links.join("\n")}
            rows={4}
            onChange={(value) =>
              update((c) => ({ ...c, header: { ...c.header, links: value.split("\n").map((link) => link.trim()).filter(Boolean) } }))
            }
          />
        </Field>
        <Toggle label={dict.studio.searchIcon} checked={config.header.showSearch} onChange={(value) => update((c) => ({ ...c, header: { ...c.header, showSearch: value } }))} />
        <Toggle label={dict.studio.cartIcon} checked={config.header.showCart} onChange={(value) => update((c) => ({ ...c, header: { ...c.header, showCart: value } }))} />
        <Toggle label={dict.studio.stickyHeader} checked={config.header.sticky} onChange={(value) => update((c) => ({ ...c, header: { ...c.header, sticky: value } }))} />
        <Field label={dict.studio.layout}>
          <Segmented
            value={config.header.style}
            options={[
              { value: "minimal", label: dict.studio.split },
              { value: "boxed", label: dict.studio.overlay },
            ]}
            onChange={(value) => update((c) => ({ ...c, header: { ...c.header, style: value } }))}
          />
        </Field>
      </div>

      <div className="panel-section">
        <div className="panel-title">{dict.studio.footerTitle}</div>
        <Field label={dict.studio.socialLinks}>
          <TextArea
            value={config.footer.social.join("\n")}
            rows={3}
            onChange={(value) =>
              update((c) => ({ ...c, footer: { ...c.footer, social: value.split("\n").map((link) => link.trim()).filter(Boolean) } }))
            }
          />
        </Field>
        <p className="hint" style={{ marginBottom: 8 }}>{dict.studio.footerColumnsHint}</p>
        {config.footer.columns.map((column, index) => (
          <div key={index} className="panel-section">
            <TextInput
              value={column.title}
              onChange={(value) =>
                update((c) => ({
                  ...c,
                  footer: { ...c.footer, columns: c.footer.columns.map((item, i) => (i === index ? { ...item, title: value } : item)) },
                }))
              }
            />
            <TextArea
              value={column.links.join("\n")}
              rows={3}
              onChange={(value) =>
                update((c) => ({
                  ...c,
                  footer: {
                    ...c.footer,
                    columns: c.footer.columns.map((item, i) => (i === index ? { ...item, links: value.split("\n").map((link) => link.trim()).filter(Boolean) } : item)),
                  },
                }))
              }
            />
          </div>
        ))}
      </div>

      <div className="panel-section">
        <div className="panel-title">{dict.studio.seoTitleLabel}</div>
        <Field label={dict.studio.seoTitleLabel}>
          <TextInput value={config.seo.title} onChange={(value) => update((c) => ({ ...c, seo: { ...c.seo, title: value } }))} />
        </Field>
        <Field label={dict.studio.seoDescription}>
          <TextArea value={config.seo.description} rows={3} onChange={(value) => update((c) => ({ ...c, seo: { ...c.seo, description: value } }))} />
        </Field>
      </div>

      {hero && hero.type === "hero" && (
        <div className="panel-section">
          <div className="panel-title">{dict.studio.heroTitle}</div>
          <Field label={dict.studio.headline}>
            <TextArea value={hero.title} rows={2} onChange={(value) => update((c) => patchHero(c, { title: value }))} />
          </Field>
          <Field label={dict.studio.heroSub}>
            <TextArea value={hero.subtitle} rows={3} onChange={(value) => update((c) => patchHero(c, { subtitle: value }))} />
          </Field>
          <Field label={dict.studio.cta}>
            <TextInput value={hero.ctaLabel} onChange={(value) => update((c) => patchHero(c, { ctaLabel: value }))} />
          </Field>
          <Field label={dict.studio.secondaryCta}>
            <TextInput value={hero.secondaryLabel} onChange={(value) => update((c) => patchHero(c, { secondaryLabel: value }))} />
          </Field>
        </div>
      )}

      <div className="panel-section">
        <div className="panel-title">{dict.studio.products}</div>
        <p className="hint" style={{ marginBottom: 10 }}>{dict.studio.productsHint}</p>
        {config.shop.products.map((product, index) => {
          const patchProduct = (patch: Partial<typeof product>) =>
            update((c) => ({
              ...c,
              shop: { ...c.shop, products: c.shop.products.map((item, i) => (i === index ? { ...item, ...patch } : item)) },
            }));
          return (
          <div key={product.id} className="panel-section">
            <div className="field-row" style={{ marginBottom: 8 }}>
              <TextInput value={product.name} onChange={(value) => patchProduct({ name: value })} placeholder={dict.studio.productName} />
              <TextInput value={product.price} onChange={(value) => patchProduct({ price: value })} placeholder={dict.studio.productPrice} />
            </div>
            <div className="field-row" style={{ marginBottom: 8 }}>
              <TextInput value={product.tag ?? ""} onChange={(value) => patchProduct({ tag: value })} placeholder={dict.studio.productTag} />
              <TextInput value={product.compareAt ?? ""} onChange={(value) => patchProduct({ compareAt: value })} placeholder={dict.studio.compareAt} />
            </div>
            <Field label={dict.studio.productImage}>
              <TextInput value={product.image ?? ""} onChange={(value) => patchProduct({ image: value })} placeholder="https://…" />
            </Field>
            <Field label={dict.studio.productDescription}>
              <TextArea value={product.description ?? ""} rows={2} onChange={(value) => patchProduct({ description: value })} />
            </Field>
          </div>
          );
        })}
      </div>
    </>
  );
}

export function AiPanel({
  dict,
  examples,
  projectId,
  onApply,
}: {
  dict: Dict;
  examples: string[];
  projectId: string;
  onApply: (config: ThemeConfig) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<"ai" | "local" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async (value?: string) => {
    const text = (value ?? prompt).trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, projectId }),
      });
      const json = (await res.json()) as { config?: ThemeConfig; source?: "ai" | "local"; error?: string };
      if (!res.ok || !json.config) {
        setError(json.error === "locked" ? dict.studio.trialExpired : dict.common.error);
        return;
      }
      onApply(json.config);
      setSource(json.source ?? "local");
    } catch {
      setError(dict.common.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="panel-title">{dict.studio.ai}</div>
      <div className="ai-box">
        <h3 style={{ fontSize: 17 }}>{dict.studio.aiTitle}</h3>
        <p className="hint" style={{ margin: "6px 0 10px" }}>{dict.studio.aiSub}</p>
        <TextArea value={prompt} rows={4} onChange={setPrompt} />
        <button className="ui-btn ui-btn--accent ui-btn--block" type="button" style={{ marginTop: 10 }} disabled={busy || !prompt.trim()} onClick={() => generate()}>
          {busy ? dict.studio.aiWorking : dict.studio.aiGenerate}
        </button>
        {error && <div className="banner banner--warn" style={{ marginTop: 10 }}>{error}</div>}
        {source && <p className="hint" style={{ marginTop: 8 }}>{dict.studio.aiHint}</p>}
      </div>
      <div className="panel-section" style={{ marginTop: 14 }}>
        <div className="panel-title">{dict.studio.aiExamples}</div>
        {examples.map((example) => (
          <button key={example} className="ai-example" type="button" onClick={() => { setPrompt(example); generate(example); }}>
            “{example}”
          </button>
        ))}
      </div>
      <p className="hint">{dict.studio.aiHint}</p>
    </>
  );
}

export function moodsForLocale(locale: Locale): { id: MoodId; label: string }[] {
  return PRESET_ORDER.map((id) => ({ id, label: MOOD_LABELS[locale][id] }));
}

export function moodSwatches(id: MoodId) {
  return [MOODS[id].palette.background, MOODS[id].palette.primary, MOODS[id].palette.accent];
}
