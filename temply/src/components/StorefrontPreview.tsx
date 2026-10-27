"use client";

import type { CSSProperties, ReactNode } from "react";
import { Fragment, useEffect, useState } from "react";
import { FONTS, type AdvancedCanvas, type Locale, type Section, type SectionWidth, type ThemeConfig } from "@/lib/theme/types";
import { toneGradient } from "@/lib/theme/presets";
import { gridVars, resolveMarket } from "@/lib/theme/layout";
import { canvaDesignFor, liveProviders } from "@/lib/integrations/catalog";
import { Icon, type IconName } from "@/components/Icon";
import { AdvancedCanvasView } from "@/components/studio/advanced/AdvancedCanvasView";

export type PreviewPage = "home" | "product" | "collection" | "search" | "about" | "contact" | "cart" | "404";

type Props = {
  config: ThemeConfig;
  editable?: boolean;
  selectedId?: string | null;
  page?: PreviewPage;
  locale?: Locale;
  labels?: Partial<Record<Section["type"], string>>;
  onChange?: (recipe: (config: ThemeConfig) => ThemeConfig) => void;
  onSelect?: (id: string | null) => void;
  onAction?: (action: "up" | "down" | "duplicate" | "delete", id: string) => void;
  /** Advanced-ytor per sida, så att de syns även i det temastyrda läget. */
  advancedCanvases?: Partial<Record<PreviewPage, AdvancedCanvas>>;
};

const WIDTH_STEPS: SectionWidth[] = ["narrow", "boxed", "wide", "full"];
const START_INSET: Record<SectionWidth, number> = { full: 0, wide: 8, boxed: 18, narrow: 30 };

function widthFromInset(insetPercent: number): SectionWidth {
  if (insetPercent < 5) return "full";
  if (insetPercent < 12) return "wide";
  if (insetPercent < 22) return "boxed";
  return "narrow";
}

function readableOn(hex: string): string {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  if (full.length !== 6) return "#ffffff";
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.64 ? "#14140f" : "#ffffff";
}

function Editable({
  value,
  onChange,
  editable,
  as = "span",
  className,
  style,
}: {
  value: string;
  onChange?: (value: string) => void;
  editable?: boolean;
  as?: "span" | "b" | "h1" | "h2" | "h3" | "p" | "div";
  className?: string;
  style?: CSSProperties;
}) {
  const Tag = as as "span";
  return (
    <Tag
      className={className}
      style={style}
      contentEditable={editable || undefined}
      suppressContentEditableWarning
      onClick={(event) => {
        if (editable) event.stopPropagation();
      }}
      onBlur={(event) => {
        const next = event.currentTarget.textContent?.trim() ?? "";
        if (next && next !== value) onChange?.(next);
      }}
      onKeyDown={(event) => {
        if (!editable) return;
        if (event.key === "Enter") {
          event.preventDefault();
          (event.currentTarget as HTMLElement).blur();
        }
      }}
    >
      {value}
    </Tag>
  );
}

/** Betygsstjärnor från ikonsystemet, så stilen följer butikens färger. */
function Stars({ count, className }: { count: number; className?: string }) {
  return (
    <span className={className} aria-hidden="true">
      {Array.from({ length: Math.max(0, Math.round(count)) }).map((_, index) => (
        <Icon key={index} name="star" size="xs" filled />
      ))}
    </span>
  );
}

const BADGE_ICONS: Record<string, IconName> = {
  leaf: "leaf",
  hand: "heart",
  truck: "truck",
  shield: "shield",
  star: "star",
};

function badgeIcon(name: string): IconName {
  return BADGE_ICONS[name] ?? "sparkles";
}

/** Layoutvarianten blir en klass så att både preview och export stylar samma sak. */
function variantClass(section: Section): string {
  const parts: string[] = [];
  if (section.variant) parts.push(`sf-variant--${section.variant}`);
  if (section.span && section.span !== "even") parts.push(`sf-span--${section.span}`);
  return parts.length ? ` ${parts.join(" ")}` : "";
}

/** Nedräkning som tickar i förhandsvisningen och i exporten. */
function Countdown({ endsAt }: { endsAt: string }) {
  // Startar tom och fylls först i klienten, så server- och klienttext matchar.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const end = Date.parse(endsAt);
  const left = now === null || Number.isNaN(end) ? 0 : Math.max(0, end - now);
  const pad = (value: number) => String(value).padStart(2, "0");
  const units: [number, string][] = [
    [Math.floor(left / 86_400_000), "d"],
    [Math.floor((left % 86_400_000) / 3_600_000), "h"],
    [Math.floor((left % 3_600_000) / 60_000), "m"],
    [Math.floor((left % 60_000) / 1000), "s"],
  ];
  return (
    <div className="countdown__timer" aria-live="polite">
      {units.map(([value, unit]) => (
        <span className="countdown__unit" key={unit}>
          <b>{pad(value)}</b>
          <i>{unit}</i>
        </span>
      ))}
    </div>
  );
}

function SectionShell({
  section,
  label,
  editable,
  selected,
  onSelect,
  onAction,
  onWidth,
  onSpace,
  children,
}: {
  section: Section;
  label: string;
  editable?: boolean;
  selected: boolean;
  onSelect?: (id: string | null) => void;
  onAction?: (action: "up" | "down" | "duplicate" | "delete", id: string) => void;
  onWidth?: (width: SectionWidth) => void;
  onSpace?: (space: number) => void;
  children: ReactNode;
}) {
  const width: SectionWidth = section.width ?? "boxed";

  const dragEdge = (side: "left" | "right") => (event: React.PointerEvent<HTMLDivElement>) => {
    if (!editable || !onWidth) return;
    event.stopPropagation();
    event.preventDefault();
    const frame = (event.currentTarget.parentElement as HTMLElement)?.getBoundingClientRect();
    if (!frame) return;
    const startX = event.clientX;
    const startWidth = width;
    const onMove = (move: PointerEvent) => {
      const delta = ((side === "right" ? startX - move.clientX : move.clientX - startX) / frame.width) * 100;
      const inset = Math.max(0, Math.min(45, START_INSET[startWidth] + delta));
      onWidth(widthFromInset(inset));
    };
    const stop = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stop);
  };

  const dragSpace = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!editable || !onSpace) return;
    event.stopPropagation();
    event.preventDefault();
    const startY = event.clientY;
    const startSpace = section.space ?? 1;
    const onMove = (move: PointerEvent) => {
      const next = Math.max(0.4, Math.min(2, startSpace + (move.clientY - startY) / 220));
      onSpace(Math.round(next * 20) / 20);
    };
    const stop = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stop);
  };

  return (
    <div
      className={`sf-sec sf-sec--${width}${selected ? " is-selected" : ""}`}
      data-section={section.id}
      style={{ "--sf-sec-space": section.space ?? 1 } as CSSProperties}
      onClick={(event) => {
        if (!editable) return;
        event.stopPropagation();
        onSelect?.(section.id);
      }}
    >
      {editable && <span className="sf-sec__tag">{label}</span>}
      {editable && (
        <div className="sf-toolbar" onClick={(event) => event.stopPropagation()}>
          <button type="button" title="Upp" aria-label="Upp" onClick={() => onAction?.("up", section.id)}>
            <Icon name="arrowUp" size="sm" />
          </button>
          <button type="button" title="Ner" aria-label="Ner" onClick={() => onAction?.("down", section.id)}>
            <Icon name="arrowDown" size="sm" />
          </button>
          <button type="button" title="Duplicera" aria-label="Duplicera" onClick={() => onAction?.("duplicate", section.id)}>
            <Icon name="copy" size="sm" />
          </button>
          <button type="button" title="Radera" aria-label="Radera" onClick={() => onAction?.("delete", section.id)}>
            <Icon name="trash" size="sm" />
          </button>
        </div>
      )}
      {editable && selected && (
        <>
          <div className="sf-edge sf-edge--left" role="separator" aria-label="Bredd" onPointerDown={dragEdge("left")} />
          <div className="sf-edge sf-edge--right" role="separator" aria-label="Bredd" onPointerDown={dragEdge("right")} />
          <div className="sf-space-handle" role="separator" aria-label="Luft" onPointerDown={dragSpace}>
            <Icon name="moveVertical" size="xs" />
          </div>
        </>
      )}
      <div className={`sf-width sf-width--${width}`}>{children}</div>
    </div>
  );
}

const DEFAULT_LABELS: Record<Section["type"], string> = {
  hero: "Hero",
  productGrid: "Products",
  features: "Features",
  imageText: "Story",
  testimonials: "Reviews",
  marquee: "Marquee",
  faq: "FAQ",
  newsletter: "Newsletter",
  ugc: "UGC",
  trust: "Trust",
  bundle: "Bundle",
  sizeGuide: "Size guide",
  countdown: "Countdown",
  collection: "Categories",
  comparison: "Comparison",
  lookbook: "Lookbook",
  completeTheLook: "Complete the look",
  story: "Storytelling",
};

const SIZE_HEADERS: Record<string, string[]> = {
  sv: ["Storlek", "Byst", "Längd", "Ärm"],
  nb: ["Størrelse", "Bryst", "Lengde", "Erme"],
  fi: ["Koko", "Rinta", "Pituus", "Hiha"],
  da: ["Størrelse", "Bryst", "Længde", "Ærme"],
  en: ["Size", "Chest", "Length", "Sleeve"],
  fr: ["Taille", "Poitrine", "Longueur", "Manche"],
  de: ["Größe", "Brust", "Länge", "Ärmel"],
  es: ["Talla", "Pecho", "Largo", "Manga"],
};

export default function StorefrontPreview({
  config,
  editable = false,
  selectedId = null,
  page = "home",
  locale = "sv",
  labels,
  onChange,
  onSelect,
  onAction,
  advancedCanvases,
}: Props) {
  const { palette, typography, shape, layout, shop } = config;
  const sectionLabel = (type: Section["type"]) => labels?.[type] ?? DEFAULT_LABELS[type];
  // Aktiv marknad styr kampanjband, frakttext, valuta och hero-text.
  const market = config.markets?.enabled ? resolveMarket(config, locale) : null;
  const announcement = market?.campaign || config.header.announcement;
  const heroTitle = (defaultTitle: string) => market?.heroTitle || defaultTitle;
  const heroSubtitle = (defaultSubtitle: string) => market?.heroSubtitle || defaultSubtitle;

  const style = {
    "--sf-bg": palette.background,
    "--sf-surface": palette.surface,
    "--sf-text": palette.text,
    "--sf-muted": palette.muted,
    "--sf-primary": palette.primary,
    "--sf-accent": palette.accent,
    "--sf-border": palette.border,
    "--sf-on-primary": readableOn(palette.primary),
    "--sf-heading": FONTS[typography.heading]?.stack ?? FONTS.manrope.stack,
    "--sf-body": FONTS[typography.body]?.stack ?? FONTS.inter.stack,
    "--sf-base": typography.baseSize,
    "--sf-scale": typography.scale,
    "--sf-heading-weight": typography.headingWeight,
    "--sf-tracking": `${typography.tracking}em`,
    "--sf-radius": `${shape.radius}px`,
    "--sf-btn-radius": `${shape.buttonRadius}px`,
    "--sf-border-width": `${shape.borderWidth}px`,
    "--sf-max": layout.maxWidth,
    "--sf-space": layout.sectionSpacing,
    "--sf-gap": layout.gridGap,
    "--sf-card-radius": `${config.tokens.cardRadius}px`,
    "--sf-image-radius": `${config.tokens.imageRadius}px`,
    "--sf-input-radius": `${config.tokens.inputRadius}px`,
    "--sf-shadow": `${config.shape.shadow}px`,
    "--sf-btn-style": config.tokens.buttonStyle,
  } as CSSProperties;

  const updateSection = (id: string, patch: Record<string, unknown>) => {
    onChange?.((current) => ({
      ...current,
      sections: current.sections.map((item) => (item.id === id ? ({ ...item, ...patch } as Section) : item)),
    }));
  };

  const setText = (section: Section, key: string) => (value: string) => updateSection(section.id, { [key]: value });

  const setShop = (patch: Partial<ThemeConfig["shop"]>) => onChange?.((current) => ({ ...current, shop: { ...current.shop, ...patch } }));

  const renderSection = (section: Section) => {
    const label = sectionLabel(section.type);
    const common = {
      section,
      label,
      editable,
      selected: selectedId === section.id,
      onSelect,
      onAction,
      onWidth: (width: SectionWidth) => updateSection(section.id, { width }),
      onSpace: (space: number) => updateSection(section.id, { space }),
    };

    switch (section.type) {
      case "hero":
        return (
          <SectionShell key={section.id} {...common}>
            <section className={`hero hero--${section.layout}${section.align === "center" ? " hero--center" : ""}`}>
              <div className="container">
                <div className="hero__inner">
                  <div className="hero__copy">
                    {section.eyebrow && <Editable as="p" className="eyebrow" editable={editable} value={section.eyebrow} onChange={setText(section, "eyebrow")} />}
                    <Editable as="h1" className="hero__title" editable={editable} value={heroTitle(section.title)} onChange={setText(section, "title")} />
                    {section.subtitle && <Editable as="p" className="hero__sub" editable={editable} value={heroSubtitle(section.subtitle)} onChange={setText(section, "subtitle")} />}
                    <div className="hero__actions">
                      <span className="btn">{section.ctaLabel}</span>
                      {section.secondaryLabel && <span className="btn btn--secondary">{section.secondaryLabel}</span>}
                    </div>
                  </div>
                  {section.showImage && (
                    <div className="hero__media">
                      {config.media.heroVideo ? (
                        <video className="hero__image" src={config.media.heroVideo} autoPlay muted loop playsInline />
                      ) : section.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          className="hero__image"
                          src={section.image}
                          alt=""
                          style={{ objectPosition: `${config.media.focal.x}% ${config.media.focal.y}%` }}
                        />
                      ) : (
                        <div className="hero__placeholder">
                          <span>{section.title}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>
          </SectionShell>
        );

      case "productGrid":
        return (
          <SectionShell key={section.id} {...common}>
            <section className="section">
              <div className="container">
                <div className="section-head">
                  <Editable as="h2" editable={editable} value={section.title} onChange={setText(section, "title")} />
                  {section.subtitle && <Editable as="p" editable={editable} value={section.subtitle} onChange={setText(section, "subtitle")} />}
                </div>
                <div className={`product-grid product-grid--${section.style}${variantClass(section)}`} style={gridVars(section) as CSSProperties}>
                  {shop.products.slice(0, 8).map((product, index) => (
                    <div className="card" key={product.id}>
                      <div className="card__media" style={{ background: toneGradient(product.tone) }}>
                        {product.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img className="card__image" src={product.image} alt={product.name} />
                        ) : (
                          <div className="card__placeholder" />
                        )}
                        {product.tag && <span className="card__badge">{product.tag}</span>}
                      </div>
                      <div className="card__info">
                        <Editable
                          as="h3"
                          className="card__title"
                          editable={editable}
                          value={product.name}
                          onChange={(value) => setShop({ products: shop.products.map((item, i) => (i === index ? { ...item, name: value } : item)) })}
                        />
                        <p className="card__price">
                          <Editable
                            as="span"
                            editable={editable}
                            value={product.price}
                            onChange={(value) => setShop({ products: shop.products.map((item, i) => (i === index ? { ...item, price: value } : item)) })}
                          />
                          {product.compareAt && <s>{product.compareAt}</s>}
                        </p>
                        {product.description && (
                          <Editable
                            as="p"
                            className="card__desc"
                            editable={editable}
                            value={product.description}
                            onChange={(value) => setShop({ products: shop.products.map((item, i) => (i === index ? { ...item, description: value } : item)) })}
                          />
                        )}
                        {section.showRating && (
                          <p className="card__rating">
                            <Stars count={5} /> <span style={{ opacity: 0.7 }}>{shop.rating}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </SectionShell>
        );

      case "features":
        return (
          <SectionShell key={section.id} {...common}>
            <section className="section">
              <div className="container">
                <div className="section-head">
                  <Editable as="h2" editable={editable} value={section.title} onChange={setText(section, "title")} />
                  {section.subtitle && <Editable as="p" editable={editable} value={section.subtitle} onChange={setText(section, "subtitle")} />}
                </div>
                <div className="features" style={{ "--sf-features": Math.max(1, section.items.length) } as CSSProperties}>
                  {section.items.map((item, index) => (
                    <div className="feature" key={item.id}>
                      <span className="feature__icon" aria-hidden="true">
                        <Icon name={badgeIcon(item.icon)} size="lg" />
                      </span>
                      <Editable
                        as="h3"
                        editable={editable}
                        value={item.title}
                        onChange={(value) => updateSection(section.id, { items: section.items.map((it, i) => (i === index ? { ...it, title: value } : it)) })}
                      />
                      <Editable
                        as="p"
                        editable={editable}
                        value={item.text}
                        onChange={(value) => updateSection(section.id, { items: section.items.map((it, i) => (i === index ? { ...it, text: value } : it)) })}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </SectionShell>
        );

      case "imageText":
        return (
          <SectionShell key={section.id} {...common}>
            <section className="section">
              <div className="container">
                <div className={`image-text${section.imageSide === "right" ? " image-text--right" : ""}`}>
                  <div className="image-text__media" />
                  <div className="image-text__body">
                    <Editable as="h2" editable={editable} value={section.title} onChange={setText(section, "title")} />
                    <Editable as="p" editable={editable} value={section.text} onChange={setText(section, "text")} />
                    {section.ctaLabel && <span className="btn btn--secondary">{section.ctaLabel}</span>}
                  </div>
                </div>
              </div>
            </section>
          </SectionShell>
        );

      case "testimonials":
        return (
          <SectionShell key={section.id} {...common}>
            <section className="section">
              <div className="container">
                <div className="section-head section-head--center">
                  <Editable as="h2" editable={editable} value={section.title} onChange={setText(section, "title")} />
                </div>
                <div className="testimonials">
                  {section.items.map((item) => (
                    <blockquote className="testimonial" key={item.id}>
                      <Stars count={item.rating} className="testimonial__stars" />
                      <p className="testimonial__quote">“{item.quote}”</p>
                      <p className="testimonial__author">
                        <strong>{item.author}</strong> · {item.role}
                      </p>
                    </blockquote>
                  ))}
                </div>
              </div>
            </section>
          </SectionShell>
        );

      case "marquee":
        return (
          <SectionShell key={section.id} {...common}>
            <div className={`marquee marquee--${section.style}`} style={{ "--sf-marquee-speed": `${section.speed}s` } as CSSProperties}>
              <div className="marquee__track">
                <span>{section.text}</span>
                <span aria-hidden="true">{section.text}</span>
              </div>
            </div>
          </SectionShell>
        );

      case "faq":
        return (
          <SectionShell key={section.id} {...common}>
            <section className="section">
              <div className="container">
                <div className="section-head section-head--center">
                  <Editable as="h2" editable={editable} value={section.title} onChange={setText(section, "title")} />
                </div>
                <div className="faq">
                  {section.items.map((item) => (
                    <details className="faq__item" key={item.id}>
                      <summary>{item.q}</summary>
                      <div className="faq__answer">{item.a}</div>
                    </details>
                  ))}
                </div>
              </div>
            </section>
          </SectionShell>
        );

      case "ugc":
        return (
          <SectionShell key={section.id} {...common}>
            <section className="section">
              <div className="container">
                <div className="section-head section-head--center">
                  <Editable as="h2" editable={editable} value={section.title} onChange={setText(section, "title")} />
                  {section.subtitle && <Editable as="p" editable={editable} value={section.subtitle} onChange={setText(section, "subtitle")} />}
                </div>
                <div className="ugc-grid">
                  {section.items.map((item, index) => (
                    <figure className="ugc" key={item.id}>
                      <div
                        className="ugc__media"
                        style={item.image ? { backgroundImage: `url(${item.image})` } : { background: toneGradient(item.tone) }}
                      />
                      <figcaption>
                        <Editable
                          as="p"
                          editable={editable}
                          value={item.caption}
                          onChange={(value) => updateSection(section.id, { items: section.items.map((it, i) => (i === index ? { ...it, caption: value } : it)) })}
                        />
                        <span>
                          {item.author} · {item.handle}
                        </span>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            </section>
          </SectionShell>
        );

      case "trust":
        return (
          <SectionShell key={section.id} {...common}>
            <section className="section section--trust">
              <div className="container">
                <h2 className="visually-hidden">{section.title}</h2>
                <div className="trust-grid">
                  {section.badges.map((badge) => (
                    <div className="trust" key={badge.id}>
                      <span className="trust__icon" aria-hidden="true">
                        <Icon name={badgeIcon(badge.icon)} size="md" />
                      </span>
                      <b>{badge.title}</b>
                      <small>{badge.text}</small>
                    </div>
                  ))}
                </div>
                <p className="trust__meta">
                  {section.shipping} · {section.returns}
                </p>
              </div>
            </section>
          </SectionShell>
        );

      case "bundle":
        return (
          <SectionShell key={section.id} {...common}>
            <section className="section">
              <div className="container">
                <div className="section-head section-head--center">
                  <Editable as="h2" editable={editable} value={section.title} onChange={setText(section, "title")} />
                  <Editable as="p" editable={editable} value={section.subtitle} onChange={setText(section, "subtitle")} />
                </div>
                <div className="bundle-grid">
                  {section.tiers.map((tier) => (
                    <div className="bundle-tier" key={tier.id}>
                      <b>
                        {tier.quantity}×
                      </b>
                      <span>{tier.label}</span>
                      <strong>−{tier.discount}%</strong>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </SectionShell>
        );

      case "sizeGuide":
        return (
          <SectionShell key={section.id} {...common}>
            <section className="section">
              <div className="container">
                <div className="section-head section-head--center">
                  <Editable as="h2" editable={editable} value={section.title} onChange={setText(section, "title")} />
                  <Editable as="p" editable={editable} value={section.note} onChange={setText(section, "note")} />
                </div>
                <div className="size-table">
                  <table>
                    <thead>
                      <tr>
                        {SIZE_HEADERS[locale].map((header) => (
                          <th key={header}>{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {section.rows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.size}</td>
                          <td>{row.chest}</td>
                          <td>{row.length}</td>
                          <td>{row.sleeve}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </SectionShell>
        );

      case "countdown":
        return (
          <SectionShell key={section.id} {...common}>
            <section className={`section countdown countdown--${section.style}${variantClass(section)}`}>
              <div className="container countdown__inner">
                <div className="countdown__copy">
                  {section.eyebrow && <Editable as="p" className="eyebrow" editable={editable} value={section.eyebrow} onChange={setText(section, "eyebrow")} />}
                  <Editable as="h2" editable={editable} value={section.title} onChange={setText(section, "title")} />
                  {section.text && <Editable as="p" editable={editable} value={section.text} onChange={setText(section, "text")} />}
                </div>
                <Countdown endsAt={section.endsAt} />
                <span className="btn">{section.ctaLabel}</span>
              </div>
            </section>
          </SectionShell>
        );

      case "collection":
        return (
          <SectionShell key={section.id} {...common}>
            <section className="section">
              <div className="container">
                <div className="section-head">
                  <Editable as="h2" editable={editable} value={section.title} onChange={setText(section, "title")} />
                  {section.subtitle && <Editable as="p" editable={editable} value={section.subtitle} onChange={setText(section, "subtitle")} />}
                </div>
                <div className={`collection-grid collection-grid--${section.layout}${variantClass(section)}`} style={gridVars(section) as CSSProperties}>
                  {section.tiles.map((tile, index) => (
                    <article className="collection-tile" key={tile.id}>
                      <div className="collection-tile__media" style={{ background: tile.image ? undefined : toneGradient(tile.tone) }}>
                        {tile.image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={tile.image} alt="" />
                        )}
                      </div>
                      <Editable
                        as="h3"
                        editable={editable}
                        value={tile.title}
                        onChange={(value) => updateSection(section.id, { tiles: section.tiles.map((item, i) => (i === index ? { ...item, title: value } : item)) })}
                      />
                      <Editable
                        as="span"
                        className="collection-tile__count"
                        editable={editable}
                        value={tile.count}
                        onChange={(value) => updateSection(section.id, { tiles: section.tiles.map((item, i) => (i === index ? { ...item, count: value } : item)) })}
                      />
                    </article>
                  ))}
                </div>
              </div>
            </section>
          </SectionShell>
        );

      case "comparison":
        return (
          <SectionShell key={section.id} {...common}>
            <section className="section">
              <div className="container">
                <div className="section-head section-head--center">
                  <Editable as="h2" editable={editable} value={section.title} onChange={setText(section, "title")} />
                  {section.subtitle && <Editable as="p" editable={editable} value={section.subtitle} onChange={setText(section, "subtitle")} />}
                </div>
                <div className={`compare compare--${section.variant ?? "table"}`} style={gridVars(section) as CSSProperties}>
                  <div className="compare__row compare__row--head">
                    <span />
                    {section.plans.map((plan) => (
                      <span className={`compare__plan${plan.highlight ? " is-highlight" : ""}`} key={plan.id}>
                        <b>{plan.title}</b>
                        <i>{plan.price}</i>
                      </span>
                    ))}
                  </div>
                  {section.rows.map((row) => (
                    <div className="compare__row" key={row.id}>
                      <span className="compare__label">{row.label}</span>
                      {section.plans.map((plan, index) => (
                        <span key={`${row.id}-${plan.id}`}>{row.values[index] ?? "—"}</span>
                      ))}
                    </div>
                  ))}
                </div>
                {section.note && <p className="hint" style={{ marginTop: 10 }}>{section.note}</p>}
              </div>
            </section>
          </SectionShell>
        );

      case "lookbook":
        return (
          <SectionShell key={section.id} {...common}>
            <section className="section">
              <div className="container">
                <div className="section-head">
                  <Editable as="h2" editable={editable} value={section.title} onChange={setText(section, "title")} />
                  {section.subtitle && <Editable as="p" editable={editable} value={section.subtitle} onChange={setText(section, "subtitle")} />}
                </div>
                <div className={`lookbook${variantClass(section)}`} style={gridVars(section) as CSSProperties}>
                  {section.items.map((item, index) => (
                    <figure className="lookbook__item" key={item.id}>
                      <div className="lookbook__media" style={{ background: item.image ? undefined : toneGradient(item.tone) }}>
                        {item.image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.image} alt="" />
                        )}
                        {item.tag && <span className="lookbook__tag">{item.tag}</span>}
                      </div>
                      <figcaption>
                        <Editable
                          as="span"
                          editable={editable}
                          value={item.caption}
                          onChange={(value) => updateSection(section.id, { items: section.items.map((entry, i) => (i === index ? { ...entry, caption: value } : entry)) })}
                        />
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            </section>
          </SectionShell>
        );

      case "completeTheLook":
        return (
          <SectionShell key={section.id} {...common}>
            <section className="section">
              <div className="container">
                <div className="section-head">
                  <Editable as="h2" editable={editable} value={section.title} onChange={setText(section, "title")} />
                  {section.subtitle && <Editable as="p" editable={editable} value={section.subtitle} onChange={setText(section, "subtitle")} />}
                </div>
                <div className={`ctl${variantClass(section)}`} style={gridVars(section) as CSSProperties}>
                  <div className="ctl__hero" style={{ background: toneGradient(section.heroTone) }}>
                    <span>{section.hero}</span>
                  </div>
                  <div className="ctl__items">
                    {section.items.map((item, index) => (
                      <div className="ctl__item" key={item.id}>
                        <span className="ctl__thumb" style={{ background: toneGradient(item.tone) }} />
                        <Editable
                          as="span"
                          editable={editable}
                          value={item.name}
                          onChange={(value) => updateSection(section.id, { items: section.items.map((entry, i) => (i === index ? { ...entry, name: value } : entry)) })}
                        />
                        <Editable
                          as="b"
                          editable={editable}
                          value={item.price}
                          onChange={(value) => updateSection(section.id, { items: section.items.map((entry, i) => (i === index ? { ...entry, price: value } : entry)) })}
                        />
                      </div>
                    ))}
                    <div className="ctl__total">
                      <Editable as="b" editable={editable} value={section.total} onChange={setText(section, "total")} />
                      <span className="btn">{section.ctaLabel}</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </SectionShell>
        );

      case "story":
        return (
          <SectionShell key={section.id} {...common}>
            <section className={`section story story--${section.imageSide}${variantClass(section)}`}>
              <div className="container story__inner">
                <div className="story__media" style={{ background: section.image ? undefined : toneGradient(2) }}>
                  {section.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={section.image} alt="" />
                  )}
                </div>
                <div className="story__copy">
                  <Editable as="h2" editable={editable} value={section.title} onChange={setText(section, "title")} />
                  <Editable as="p" editable={editable} value={section.text} onChange={setText(section, "text")} />
                  <div className="story__steps" style={gridVars(section) as CSSProperties}>
                    {section.steps.map((step, index) => (
                      <div className="story__step" key={step.id}>
                        <Editable
                          as="h3"
                          editable={editable}
                          value={step.title}
                          onChange={(value) => updateSection(section.id, { steps: section.steps.map((entry, i) => (i === index ? { ...entry, title: value } : entry)) })}
                        />
                        <Editable
                          as="p"
                          editable={editable}
                          value={step.text}
                          onChange={(value) => updateSection(section.id, { steps: section.steps.map((entry, i) => (i === index ? { ...entry, text: value } : entry)) })}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </SectionShell>
        );

      case "newsletter":
        return (
          <SectionShell key={section.id} {...common}>
            <section className="section">
              <div className="container">
                <div className={`newsletter${variantClass(section)}`}>
                  <Editable as="h2" editable={editable} value={section.title} onChange={setText(section, "title")} />
                  <Editable as="p" editable={editable} value={section.text} onChange={setText(section, "text")} />
                  <div className="newsletter__form">
                    <input placeholder="din@epost.se" aria-label="Email" readOnly={!editable} />
                    <span className="btn">{section.ctaLabel}</span>
                  </div>
                </div>
              </div>
            </section>
          </SectionShell>
        );
    }
  };

  const dragGap = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!editable) return;
    event.preventDefault();
    event.stopPropagation();
    const startY = event.clientY;
    const startSpace = layout.sectionSpacing;
    const onMove = (move: PointerEvent) => {
      const next = Math.max(32, Math.min(180, Math.round(startSpace + (move.clientY - startY) / 4) * 1));
      onChange?.((current) => ({ ...current, layout: { ...current.layout, sectionSpacing: next } }));
    };
    const stop = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stop);
  };

  const money = (value: string) => value;
  const firstProduct = shop.products[0];

  /** Sidförhandsvisning: produkt, om oss, kontakt och kundkorg som de exporteras. */
  const reviewProviders = liveProviders(config, "reviews");
  const paymentProviders = liveProviders(config, "payments");
  const newsletterProviders = liveProviders(config, "newsletter");
  const chatProviders = liveProviders(config, "chat");
  const consentProviders = liveProviders(config, "consent");
  const loyaltyProviders = liveProviders(config, "loyalty");
  const ugcProviders = liveProviders(config, "ugc");
  const campaignProviders = liveProviders(config, "campaign");
  const canvaCampaign = canvaDesignFor(config, "campaign");
  const canvaProduct = canvaDesignFor(config, "product");

  const providerLabel = (list: { name: string }[]) => list.map((provider) => provider.name).join(" · ");

  const paymentRow = () =>
    paymentProviders.length > 0 ? (
      <div className="sf-pay" aria-label="Betalningsmetoder">
        {paymentProviders.map((provider) => (
          <span key={provider.id} className={`sf-pay__badge sf-pay__badge--${provider.id}`}>
            {provider.name}
          </span>
        ))}
      </div>
    ) : null;

  const reviewBlock = () =>
    reviewProviders.length > 0 ? (
      <div className="container">
      <div className="sf-app sf-reviews">
        <div className="sf-reviews__head">
          <div className="sf-reviews__score">
            <b>{config.shop.rating.split(" ")[0]}</b>
            <span>
              <Stars count={5} />
              <small>128 omdömen</small>
            </span>
          </div>
          <span className="sf-powered">{providerLabel(reviewProviders)}</span>
        </div>
        <div className="sf-reviews__list">
          {[
            ["Elin S.", "Exakt som på bilden. Känns genomtänkt hela vägen.", 5],
            ["Johan K.", "Snabb leverans och fantastiskt paketerat. Kommer igen.", 5],
            ["Amanda L.", "Älskar materialet. Används varje dag hemma hos oss.", 4],
          ].map(([author, text, stars]) => (
            <figure className="sf-review" key={String(author)}>
              <Stars count={Number(stars)} />
              <blockquote>{text}</blockquote>
              <figcaption>
                <b>{author}</b> <span className="sf-verified">Verifierat köp</span>
              </figcaption>
            </figure>
          ))}
        </div>
        <button className="btn btn--secondary btn--sm" type="button">
          Skriv ett omdöme
        </button>
      </div>
      </div>
    ) : null;

  const ugcBlock = (variant: "home" | "product") =>
    ugcProviders.length > 0 ? (
      <div className="container">
      <div className={`sf-app sf-ugc sf-ugc--${variant}`}>
        <div className="sf-ugc__head">
          <div>
            <b>{variant === "home" ? "Från vårt community" : "Kundbilder"}</b>
            <small>@{(config.shop.name || "temply").toLowerCase().replace(/[^a-z0-9]+/g, "")}</small>
          </div>
          <span className="sf-powered">{providerLabel(ugcProviders)}</span>
        </div>
        <div className="sf-ugc__grid">
          {shop.products.slice(0, 4).map((product, index) => (
            <figure key={product.id} style={{ background: toneGradient(product.tone) }}>
              <span>{index % 2 === 0 ? "❤" : "★"}</span>
              <figcaption>{product.name}</figcaption>
            </figure>
          ))}
        </div>
      </div>
      </div>
    ) : null;

  const campaignBlock = () =>
    campaignProviders.length > 0 ? (
      <section className={`sf-campaign${canvaCampaign ? " sf-campaign--image" : ""}`} style={canvaCampaign ? { backgroundImage: `url(${canvaCampaign.url})` } : undefined}>
        <div className="container sf-campaign__inner">
          <span className="sf-campaign__eyebrow">Kampanj · {providerLabel(campaignProviders)}</span>
          <h2>Ny kollektion ute nu</h2>
          <p>Fri frakt över {config.conversion.freeShippingThreshold} kr. Så länge lagret räcker.</p>
          <div className="sf-campaign__actions">
            <span className="btn">Se kampanjen</span>
            <span className="sf-campaign__note">Redigeras i Shopify</span>
          </div>
        </div>
      </section>
    ) : null;

  const advancedForPage = page !== "home" ? advancedCanvases?.[page] : undefined;
  const advancedPageNodes = advancedForPage?.nodes.filter((node) => node.type !== "connector") ?? [];
  const replacePage = Boolean(advancedForPage?.replaceDefault && advancedPageNodes.length > 0);
  const homeFreeform = advancedCanvases?.home;
  const homeFreeformNodes = homeFreeform?.nodes.filter((node) => node.type !== "connector" && !node.sectionId) ?? [];

  const renderPage = () => {
    if (page === "product") {
      return (
        <section className="section page-product">
          <div className="container product-layout">
            <div className="product-gallery">
              <div className="product-gallery__main" style={{ background: toneGradient(firstProduct?.tone ?? 1) }}>
                {canvaProduct && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={canvaProduct.url} alt={canvaProduct.name} />
                )}
              </div>
              <div className="product-gallery__thumbs">
                {[1, 2, 3, 4].map((tone) => (
                  <span key={tone} style={{ background: toneGradient(tone) }} />
                ))}
              </div>
              {config.media.productVideo && <video className="product-video" src={config.media.productVideo} controls playsInline />}
            </div>
            <div className="product-info">
              <p className="eyebrow">{config.header.announcement}</p>
              <h1>{firstProduct?.name ?? shop.name}</h1>
              <p className="product-price">
                <strong>{money(firstProduct?.price ?? "")}</strong>
                {firstProduct?.compareAt && <s>{firstProduct.compareAt}</s>}
                {config.shop.rating && (
                  <span className="card__rating">
                    <Stars count={5} /> {config.shop.rating}
                  </span>
                )}
              </p>
              <p>{firstProduct?.description ?? shop.tagline}</p>
              <div className="variant-picker">
                {["XS", "S", "M", "L"].map((size) => (
                  <button key={size} type="button" className="variant-pill">
                    {size}
                  </button>
                ))}
              </div>
              <div className="qty-row">
                <span className="qty">
                  <Icon name="minus" size="sm" /> 1 <Icon name="plus" size="sm" />
                </span>
                <button className="btn btn--full" type="button">
                  Lägg i varukorg
                </button>
              </div>
              {config.conversion.dynamicCheckout && <button className="btn btn--secondary btn--full dynamic-checkout" type="button">Köp nu · Shop Pay · Klarna</button>}
              {config.conversion.completeTheLook && (
                <div className="metafield-block">
                  <b>Complete the look</b>
                  <div className="look-row">
                    {shop.products.slice(1, 4).map((product) => (
                      <span key={product.id}>
                        <i style={{ background: toneGradient(product.tone) }} />
                        {product.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {config.conversion.sizeGuide && (
                <div className="metafield-block">
                  <b>Storleksguide</b>
                  <p>Metafield <code>product.metafields.custom.size_guide</code> används automatiskt när fältet finns i Shopify.</p>
                </div>
              )}
              <div className="metafield-block">
                <b>Material & hållbarhet</b>
                <p>
                  Metafields: <code>custom.ingredients</code>, <code>custom.material</code>, <code>custom.sustainability</code>
                </p>
              </div>
              {config.conversion.trustBadges && <div className="trust-inline">Fri frakt · 30 dagars retur · Säker betalning</div>}
              {paymentRow()}
              {reviewBlock()}
            </div>
          </div>
          {config.conversion.recentlyViewed && (
            <div className="container recently-viewed">
              <h2>Nyligen visade</h2>
              <div className="product-grid" style={{ "--sf-columns": 4 } as CSSProperties}>
                {shop.products.slice(2, 6).map((product) => (
                  <div className="card" key={product.id}>
                    <div className="card__media" style={{ background: toneGradient(product.tone) }} />
                    <div className="card__info">
                      <h3 className="card__title">{product.name}</h3>
                      <p className="card__price">{product.price}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {ugcBlock("product")}
        </section>
      );
    }

    if (page === "collection") {
      return (
        <section className="section page-collection">
          <div className="container">
            <div className="section-head">
              <h1>Alla produkter</h1>
              <p>Hela kollektionen · {shop.products.length} produkter</p>
            </div>
            <div className="collection-toolbar">
              <span className="pill">Filtrera</span>
              <span className="pill">Sortera: Utvalda</span>
            </div>
            <div className="product-grid product-grid--grid" style={{ "--sf-columns": 4 } as CSSProperties}>
              {shop.products.map((product) => (
                <div className="card" key={product.id}>
                  <div className="card__media" style={{ background: toneGradient(product.tone) }}>
                    {product.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="card__image" src={product.image} alt={product.name} />
                    ) : (
                      <div className="card__placeholder" />
                    )}
                    {product.tag && <span className="card__badge">{product.tag}</span>}
                  </div>
                  <div className="card__info">
                    <h3 className="card__title">{product.name}</h3>
                    <p className="card__price">{product.price}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    }

    if (page === "search") {
      return (
        <section className="section page-search">
          <div className="container">
            <div className="section-head">
              <h1>Sök i butiken</h1>
              <p>Hitta rätt bland kollektioner, produkter och guider.</p>
            </div>
            <div className="search-bar">
              <input placeholder="Sök produkt, kollektion eller guide" aria-label="Sök" readOnly={!editable} />
              <button className="btn" type="button">Sök</button>
            </div>
            <h2 className="search-popular">Populära sökningar</h2>
            <div className="search-chips">
              {["Nyheter", "Bästsäljare", "Keramik", "Presenttips"].map((term) => (
                <span className="pill" key={term}>{term}</span>
              ))}
            </div>
            <div className="product-grid product-grid--grid" style={{ "--sf-columns": 4 } as CSSProperties}>
              {shop.products.slice(0, 4).map((product) => (
                <div className="card" key={product.id}>
                  <div className="card__media" style={{ background: toneGradient(product.tone) }} />
                  <div className="card__info">
                    <h3 className="card__title">{product.name}</h3>
                    <p className="card__price">{product.price}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    }

    if (page === "404") {
      return (
        <section className="section page-404">
          <div className="container page-404__inner">
            <span className="eyebrow">404</span>
            <h1>Sidan kunde inte hittas</h1>
            <p>Länken kan vara gammal, eller så har sidan flyttats. Prova startsidan eller sök i butiken.</p>
            <div className="page-404__actions">
              <span className="btn">Till startsidan</span>
              <span className="btn btn--secondary">Sök</span>
            </div>
          </div>
        </section>
      );
    }

    if (page === "about") {
      return (
        <section className="section page-about">
          <div className="container">
            <h1>{shop.name}</h1>
            <p className="lead">{shop.tagline}</p>
            <div className="about-grid">
              <div className="about-media" style={{ background: toneGradient(3) }} />
              <div>
                <h2>Vår historia</h2>
                <p>
                  {config.footer.text} Text från <code>templates/page.about.json</code> kan redigeras direkt i Shopify Admin.
                </p>
                <h3>Det här står vi för</h3>
                <ul>
                  <li>Material valda för att hålla länge</li>
                  <li>Tillverkat i små serier</li>
                  <li>Frakt som kompenseras klimatmässigt</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      );
    }

    if (page === "contact") {
      return (
        <section className="section page-contact">
          <div className="container contact-grid">
            <div>
              <h1>Kontakta oss</h1>
              <p>Vi svarar normalt inom några timmar på vardagar.</p>
              <form className="contact-form" onSubmit={(event) => event.preventDefault()}>
                <input placeholder="Namn" aria-label="Namn" readOnly={!editable} />
                <input placeholder="E-post" aria-label="E-post" readOnly={!editable} />
                <textarea placeholder="Meddelande" rows={4} aria-label="Meddelande" readOnly={!editable} />
                <button className="btn" type="button">
                  Skicka
                </button>
              </form>
            </div>
            <aside className="contact-aside">
              <p><b>E-post</b> hej@{shop.name.toLowerCase().replace(/[^a-z0-9]+/g, "")}.se</p>
              <p><b>Telefon</b> Vardagar 09–17</p>
              <p><b>Adress</b> Verkstadsgatan 1, Sverige</p>
              <div className="map-placeholder" />
            </aside>
          </div>
        </section>
      );
    }

    if (page === "cart") {
      const lines = shop.products.slice(0, 3);
      return (
        <section className="section page-cart">
          <div className="container cart-grid">
            <div>
              <h1>Din varukorg</h1>
              {lines.map((product) => (
                <div className="cart-line" key={product.id}>
                  <span style={{ background: toneGradient(product.tone) }} />
                  <div>
                    <b>{product.name}</b>
                    <small>1 × {product.price}</small>
                  </div>
                  <strong>{product.price}</strong>
                </div>
              ))}
              {config.conversion.freeShippingBar && <div className="shipbar shipbar--inline">Fri frakt uppnådd – 799 kr av {config.conversion.freeShippingThreshold} kr</div>}
            </div>
            <aside className="cart-summary">
              <h2>Summa</h2>
              <p className="cart-total">1 097 kr</p>
              <button className="btn btn--full" type="button">Till kassan</button>
              <div className="trust-inline">Säker betalning med Shopify Checkout</div>
              {paymentRow()}
            </aside>
          </div>
        </section>
      );
    }

    return null;
  };

  return (
    <div
      className={`sf${editable ? " sf-edit" : ""}${typography.uppercaseHeadings ? " uppercase" : ""}`}
      style={style}
      data-btn-style={config.tokens.buttonStyle}
      onClick={() => editable && onSelect?.(null)}
    >
      {editable && (config.markets?.markets?.length ?? 0) > 1 && (
        <div className="market-bar">
          <span className="market-bar__label">{market?.market?.label ?? ""}</span>
          {config.markets.markets.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`market-bar__chip${entry.id === config.markets.activeId ? " is-active" : ""}`}
              onClick={() => onChange?.((current) => ({ ...current, markets: { ...current.markets, activeId: entry.id } }))}
            >
              {entry.label} · {entry.currency}
            </button>
          ))}
        </div>
      )}
      {announcement && <div className="announcement">{announcement}</div>}
      {config.conversion.freeShippingBar && page !== "cart" && (
        <div className="shipbar">
          <div className="container shipbar__inner">
            <span>{market?.shipping || `Fri frakt över ${config.conversion.freeShippingThreshold} kr`}</span>
            <span className="shipbar__track">
              <i style={{ width: "62%" }} />
            </span>
          </div>
        </div>
      )}
      <header className={`site-header${config.header.sticky ? " site-header--sticky" : ""}`}>
        <div className={`container header__inner header__inner--${config.header.actionsPosition ?? "right"}`}>
          <Editable
            className="header__logo"
            editable={editable}
            value={config.header.logoText || shop.name}
            onChange={(value) => onChange?.((current) => ({ ...current, header: { ...current.header, logoText: value }, shop: { ...current.shop, name: value } }))}
          />
          <nav className="header__nav">
            {config.header.links.map((link) => (
              <a key={link} href="#" onClick={(event) => event.preventDefault()}>
                {link}
              </a>
            ))}
          </nav>
          <div className={`header__actions header__actions--${config.header.actionsPosition ?? "right"}`}>
            {config.header.showSearch && (
              <a className="header__action" href="#" onClick={(event) => event.preventDefault()} aria-label="Search">
                <Icon name="search" size="md" />
              </a>
            )}
            {config.header.showCart && (
              <a className="header__action" href="#" onClick={(event) => event.preventDefault()} aria-label="Cart">
                <Icon name="cart" size="md" />
                <span className="header__cart-count">2</span>
              </a>
            )}
          </div>
        </div>
      </header>

      {config.header.mega?.enabled && (
        <div className="mega" style={{ "--sf-mega-columns": config.header.mega.columns } as CSSProperties}>
          <div className="container mega__inner">
            {config.header.mega.groups.map((group) => (
              <div className={`mega__group${group.highlight ? " is-highlight" : ""}`} key={group.id}>
                <b>{group.label}</b>
                <ul>
                  {group.children.map((child) => (
                    <li key={child}>{child}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      <main style={{ position: "relative" }}>
        {page === "home" && homeFreeformNodes.length > 0 && homeFreeform && (
          <div className="sf-advanced-overlay">
            <AdvancedCanvasView
              config={config}
              canvas={{ ...homeFreeform, background: "transparent", nodes: homeFreeformNodes }}
            />
          </div>
        )}
        {page === "home"
          ? config.sections
              .filter((section) => section.visible)
              .map((section, index) => (
                <Fragment key={section.id}>
                  {editable && index > 0 && (
                    <div className="sf-gap" role="separator" aria-label="Mellanrum" onPointerDown={dragGap}>
                      <Icon name="moveVertical" size="xs" /> {Math.round(layout.sectionSpacing * (section.space ?? 1))}px
                    </div>
                  )}
                  {renderSection(section)}
                  {section.type === "hero" && campaignBlock()}
                  {section.type === "productGrid" && ugcBlock("home")}
                </Fragment>
              ))
          : (
              <>
                {advancedForPage && advancedPageNodes.length > 0 && (
                  <div className="sf-advanced-page">
                    <AdvancedCanvasView config={config} canvas={advancedForPage} />
                  </div>
                )}
                {!replacePage && renderPage()}
              </>
            )}
      </main>

      {config.conversion.stickyAtc && page === "product" && (
        <div className="sticky-atc">
          <div className="sticky-atc__info">
            <b>{firstProduct?.name ?? shop.name}</b>
            <small>{firstProduct?.price}</small>
          </div>
          <button className="btn" type="button">
            Lägg i varukorg
          </button>
        </div>
      )}

      {config.conversion.exitIntent && editable && (
        <div className="exit-chip">Exit intent & e-postinsamling{config.conversion.gdprConsent ? " · GDPR-samtycke krävs" : ""}</div>
      )}

      {chatProviders.length > 0 && (
        <div className="sf-chat">
          <span className="sf-chat__label">Chatt · {providerLabel(chatProviders)}</span>
          <button className="sf-chat__bubble" type="button" aria-label="Öppna chatt">
            <Icon name="quote" size="md" />
            <i />
          </button>
        </div>
      )}

      {consentProviders.length > 0 && (
        <div className="sf-consent" role="region" aria-label="Samtycke">
          <div>
            <b>Vi använder cookies</b>
            <p>Nödvändiga cookies håller butiken igång. Övriga används för analys och marknadsföring.</p>
            <small>Samtycke via {providerLabel(consentProviders)}</small>
          </div>
          <div className="sf-consent__actions">
            <button className="btn btn--secondary btn--sm" type="button">Avvisa</button>
            <button className="btn btn--sm" type="button">Acceptera</button>
          </div>
        </div>
      )}

      <footer className="site-footer">
        <div className="container footer__grid">
          <div>
            <p className="footer__brand">{shop.name}</p>
            <Editable
              as="p"
              className="footer__about"
              editable={editable}
              value={config.footer.text}
              onChange={(value) => onChange?.((current) => ({ ...current, footer: { ...current.footer, text: value } }))}
            />
          </div>
          {config.footer.columns.map((column) => (
            <div className="footer__col" key={column.title}>
              <h4>{column.title}</h4>
              {column.links.map((link) => (
                <a key={link} href="#" onClick={(event) => event.preventDefault()}>
                  {link}
                </a>
              ))}
            </div>
          ))}
        </div>
        {newsletterProviders.length > 0 && (
          <div className="container sf-news">
            <div className="sf-news__copy">
              <b>Nyhetsbrev</b>
              <p>Nya släpp och 10 % på ditt första köp.</p>
            </div>
            <div className="sf-news__form">
              <input placeholder="din@epost.se" aria-label="E-post" readOnly />
              <span className="btn">Prenumerera</span>
            </div>
            <span className="sf-powered">{providerLabel(newsletterProviders)}</span>
          </div>
        )}
        {loyaltyProviders.length > 0 && (
          <div className="container sf-loyalty">
            <span className="sf-loyalty__icon">★</span>
            <div>
              <b>Medlemsklubb</b>
              <p>1 poäng per krona · födelsedagsgåva · tidig access</p>
            </div>
            <span className="btn btn--secondary btn--sm">Bli medlem</span>
          </div>
        )}
        <div className="container footer__bottom">
          <span>© {new Date().getFullYear()} {shop.name} · Powered by Shopify</span>
          <span>{config.footer.social.join(" · ")}</span>
        </div>
        {paymentProviders.length > 0 && <div className="container footer__pay">{paymentRow()}</div>}
      </footer>
    </div>
  );
}
