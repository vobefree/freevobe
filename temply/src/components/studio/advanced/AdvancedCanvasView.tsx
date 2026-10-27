"use client";

import { useEffect } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { FONTS, type AdvancedCanvas, type AdvancedNode, type ThemeConfig } from "@/lib/theme/types";
import { connectorGeometry, colorFor, fxClasses, safeHref, safeSrc } from "@/lib/advanced/canvas";
import { svgElement } from "@/lib/advanced/icons";
import { toneGradient } from "@/lib/theme/presets";

type Props = {
  config: ThemeConfig;
  canvas: AdvancedCanvas;
  selectedId?: string | null;
  /** Flera markerade noder (t.ex. produkter som ska läggas på rad). */
  selectedIds?: string[];
  interactive?: boolean;
  /**
   * "canvas" följer ytans proportioner. "width" låter höjden fyllas av
   * föräldern och räknar även Y/höjd i cqw – samma sätt som det globala
   * sidhuvudet exporteras till Shopify.
   */
  vertical?: "canvas" | "width";
  onSelect?: (id: string | null) => void;
  onNodePointerDown?: (event: ReactPointerEvent<HTMLDivElement>, node: AdvancedNode) => void;
  onNodeDoubleClick?: (node: AdvancedNode) => void;
  className?: string;
};

function unit(px: number, canvas: AdvancedCanvas): string {
  return `${((px / canvas.width) * 100).toFixed(3)}cqw`;
}

function wrapperStyle(node: AdvancedNode, canvas: AdvancedCanvas, vertical: "canvas" | "width" = "canvas"): CSSProperties {
  return {
    left: vertical === "width" ? unit(node.x, canvas) : `${(node.x / canvas.width) * 100}%`,
    top: vertical === "width" ? unit(node.y, canvas) : `${(node.y / canvas.height) * 100}%`,
    width: vertical === "width" ? unit(node.w, canvas) : `${(node.w / canvas.width) * 100}%`,
    height: vertical === "width" ? unit(node.h, canvas) : `${(node.h / canvas.height) * 100}%`,
    zIndex: node.z,
    opacity: node.opacity,
    transform: node.rotation ? `rotate(${node.rotation}deg)` : undefined,
    pointerEvents: node.locked ? "none" : undefined,
    borderRadius: unit(node.radius, canvas),
  };
}

function textStyle(node: AdvancedNode, canvas: AdvancedCanvas, config: ThemeConfig, heading: boolean): CSSProperties {
  return {
    fontSize: unit(node.fontSize ?? (heading ? 54 : 22), canvas),
    fontWeight: node.fontWeight ?? (heading ? config.typography.headingWeight : 400),
    lineHeight: node.lineHeight ?? 1.2,
    letterSpacing: `${node.letterSpacing ?? 0}em`,
    textAlign: node.align ?? "left",
    color: colorFor(node.color, config, "text"),
    fontFamily:
      node.font && FONTS[node.font as keyof typeof FONTS]
        ? FONTS[node.font as keyof typeof FONTS].stack
        : node.fontFamily?.trim()
          ? `${node.fontFamily.trim()}, sans-serif`
          : heading
            ? "var(--adv-heading)"
            : "var(--adv-body)",
    fontStyle: node.italic ? "italic" : undefined,
    textTransform: node.textTransform && node.textTransform !== "none" ? node.textTransform : undefined,
  };
}

/** Flera produkter i rad/grid – kolumner och mellanrum är helt fria. */
function ProductGrid({ node, config, canvas }: { node: AdvancedNode; config: ThemeConfig; canvas: AdvancedCanvas }) {
  const columns = Math.max(1, Math.min(12, Math.round(node.columns ?? 3)));
  const count = Math.max(1, Math.min(24, Math.round(node.count ?? 3)));
  const start = Math.max(0, Math.round(node.productIndex ?? 0));
  const products = Array.from({ length: count }, (_, offset) => config.shop.products[(start + offset) % Math.max(1, config.shop.products.length)]).filter(Boolean);
  return (
    <div
      className="adv-render-product-grid"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: unit(node.gap ?? 24, canvas) }}
    >
      {products.map((product, index) => (
        <div
          key={`${product.id}-${index}`}
          className="adv-render-product-grid__card"
          style={{ borderRadius: unit(node.radius, canvas), borderColor: "var(--adv-border)", background: "var(--adv-surface)" }}
        >
          <span className="adv-render-product__media" style={{ background: toneGradient(product.tone) }}>
            {product.image ? <img src={safeSrc(product.image)} alt={product.name} /> : product.tag ? <span>{product.tag}</span> : null}
          </span>
          <b>{product.name}</b>
          <span>{product.price}</span>
        </div>
      ))}
    </div>
  );
}

function fillFor(node: AdvancedNode, config: ThemeConfig, fallback: "primary" | "accent" | "surface"): string {
  return colorFor(node.fill, config, fallback);
}

function StoreIcon({ node, fallback }: { node: AdvancedNode; fallback: IconName }) {
  if (node.iconImage) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="adv-render-icon" src={node.iconImage} alt="" />;
  }
  if (node.iconSvg) {
    return <span className="adv-render-icon" dangerouslySetInnerHTML={{ __html: svgElement(node.iconSvg) }} />;
  }
  return <Icon name={(node.icon ?? fallback) as IconName} size="md" strokeWidth={node.iconStroke} />;
}

function ProductCard({ node, config, canvas }: { node: AdvancedNode; config: ThemeConfig; canvas: AdvancedCanvas }) {
  const product = config.shop.products[Math.max(0, Math.min(config.shop.products.length - 1, Math.round(node.productIndex ?? 0)))] ?? config.shop.products[0];
  return (
    <div className="adv-render-product">
      <div className="adv-render-product__media" style={{ background: product ? toneGradient(product.tone) : "var(--adv-primary)" }}>
        {product?.image ? <img src={safeSrc(product.image)} alt={product.name} /> : product?.tag ? <span>{product.tag}</span> : null}
      </div>
      <b>{product?.name || "Produkt"}</b>
      <span>{product?.price || ""}</span>
    </div>
  );
}

function SectionPreview({ node, config, canvas }: { node: AdvancedNode; config: ThemeConfig; canvas: AdvancedCanvas }) {
  const preset = node.preset ?? "hero";
  const textColor = colorFor(node.color, config, "text");
  const titleSize = unit(node.fontSize ?? 48, canvas);
  const bodySize = unit(Math.max(13, Math.round((node.fontSize ?? 48) * 0.36)), canvas);
  const ctaStyle: CSSProperties = {
    background: preset === "campaign" ? config.palette.text : config.palette.primary,
    color: preset === "campaign" ? config.palette.background : colorFor("onPrimary", config),
    borderRadius: unit(config.shape.buttonRadius, canvas),
    fontSize: unit(17, canvas),
  };
  const cta = node.ctaLabel ? <span className="adv-render-btn" style={ctaStyle}>{node.ctaLabel}</span> : null;
  const sectionStyle: CSSProperties = {
    background: fillFor(node, config, preset === "campaign" ? "accent" : "surface"),
    color: textColor,
    borderRadius: unit(node.radius, canvas),
    padding: unit(34, canvas),
    fontFamily: node.font && FONTS[node.font as keyof typeof FONTS]
      ? FONTS[node.font as keyof typeof FONTS].stack
      : node.fontFamily?.trim()
        ? `${node.fontFamily.trim()}, sans-serif`
        : undefined,
    fontStyle: node.italic ? "italic" : undefined,
    textTransform: node.textTransform && node.textTransform !== "none" ? node.textTransform : undefined,
  };
  const head = (
    <span className="adv-render-section__head">
      {node.badge ? (
        <span className="adv-render-badge" style={{ background: config.palette.text, color: config.palette.background, fontSize: unit(12, canvas) }}>{node.badge}</span>
      ) : node.eyebrow ? (
        <span className="adv-render-eyebrow" style={{ fontSize: unit(13, canvas) }}>{node.eyebrow}</span>
      ) : null}
      <b style={{ fontSize: titleSize, color: textColor }}>{node.title || config.shop.name}</b>
      {node.text ? <span style={{ fontSize: bodySize, color: textColor, opacity: 0.8 }}>{node.text}</span> : null}
    </span>
  );

  if (preset === "products") {
    return (
      <div className="adv-render-section adv-render-section--products" style={sectionStyle}>
        <div className="adv-render-section__row">{head}{cta}</div>
        <div className="adv-render-mini-grid">
          {config.shop.products.slice(0, 3).map((product) => (
            <div className="adv-render-mini-card" key={product.id}>
              <span style={{ background: toneGradient(product.tone) }}>{product.image ? <img src={safeSrc(product.image)} alt={product.name} /> : product.name}</span>
              <b>{product.name}</b>
              <i>{product.price}</i>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (preset === "features") {
    const items = (config.sections.find((section) => section.type === "features") as { items?: { title: string; text: string }[] } | undefined)?.items ?? [];
    return (
      <div className="adv-render-section adv-render-section--features" style={sectionStyle}>
        {head}
        <div className="adv-render-feature-grid">
          {items.slice(0, 3).map((item) => (
            <span key={item.title}><b>{item.title}</b><i>{item.text}</i></span>
          ))}
        </div>
        {cta}
      </div>
    );
  }

  if (preset === "testimonial") {
    const item = (config.sections.find((section) => section.type === "testimonials") as { items?: { quote: string; author: string; role: string }[] } | undefined)?.items?.[0];
    return (
      <div className="adv-render-section adv-render-section--testimonial" style={sectionStyle}>
        {node.eyebrow ? <span className="adv-render-eyebrow" style={{ fontSize: unit(13, canvas) }}>{node.eyebrow}</span> : null}
        <b style={{ fontSize: titleSize, color: textColor }}>“{item?.quote || node.text || "Bästa köpet på länge."}”</b>
        <span style={{ fontSize: bodySize, color: textColor, opacity: 0.75 }}>{node.title || item?.author || config.shop.name}{item?.role ? ` · ${item.role}` : ""}</span>
      </div>
    );
  }

  if (preset === "banner") {
    return (
      <div className="adv-render-section adv-render-section--banner" style={sectionStyle}>
        {head}
        {cta}
      </div>
    );
  }

  return (
    <div className={`adv-render-section adv-render-section--${preset}`} style={sectionStyle}>
      {head}
      {cta}
    </div>
  );
}

export function AdvancedCanvasView({
  config,
  canvas,
  selectedId,
  selectedIds,
  interactive,
  onSelect,
  onNodePointerDown,
  onNodeDoubleClick,
  className,
  vertical = "canvas",
}: Props) {
  const style = {
    "--adv-bg": config.palette.background,
    "--adv-surface": config.palette.surface,
    "--adv-text": config.palette.text,
    "--adv-muted": config.palette.muted,
    "--adv-primary": config.palette.primary,
    "--adv-on-primary": colorFor("onPrimary", config),
    "--adv-accent": config.palette.accent,
    "--adv-border": config.palette.border,
    "--adv-heading": FONTS[config.typography.heading]?.stack ?? FONTS.manrope.stack,
    "--adv-body": FONTS[config.typography.body]?.stack ?? FONTS.inter.stack,
    "--adv-card-radius": unit(config.tokens.cardRadius, canvas),
    ...(vertical === "width"
      ? { height: "100%", minHeight: 0 }
      : { aspectRatio: `${canvas.width} / ${canvas.height}` }),
  } as unknown as CSSProperties;

  // Se till att valda Google Fonts faktiskt laddas i förhandsvisningen, även
  // när de inte är temats huvudtypsnitt.
  useEffect(() => {
    const families = new Set<string>();
    canvas.nodes.forEach((node) => {
      if (node.font && FONTS[node.font as keyof typeof FONTS]) families.add(`family=${FONTS[node.font as keyof typeof FONTS].google}`);
      const custom = node.fontFamily?.trim();
      if (custom && /^[a-zA-Z0-9 -]{1,60}$/.test(custom)) families.add(`family=${encodeURIComponent(custom).replace(/%20/g, "+")}`);
    });
    families.forEach((query) => {
      const id = `adv-font-${query.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
      if (document.getElementById(id)) return;
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?${query}&display=swap`;
      document.head.appendChild(link);
    });
  }, [canvas.nodes]);

  const connectors = canvas.nodes.filter((node) => node.type === "connector" && !node.hidden);
  const nodes = [...canvas.nodes].filter((node) => node.type !== "connector" && !node.hidden).sort((a, b) => a.z - b.z);

  return (
    <div
      className={`adv-canvas${interactive ? " adv-canvas--interactive" : ""}${className ? ` ${className}` : ""}`}
      style={{ ...style, background: canvas.background === "transparent" ? "transparent" : colorFor(canvas.background, config, "background") }}
      onPointerDown={(event) => {
        if (!interactive) return;
        if (event.target === event.currentTarget) onSelect?.(null);
      }}
    >
      {connectors.length > 0 && (
        <svg className="adv-connectors" viewBox={`0 0 ${canvas.width} ${canvas.height}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <marker id="adv-preview-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 z" fill={config.palette.primary} />
            </marker>
          </defs>
          {connectors.map((connector) => {
            const geometry = connectorGeometry(connector, canvas.nodes);
            if (!geometry) return null;
            return (
              <line
                key={connector.id}
                x1={geometry.x1}
                y1={geometry.y1}
                x2={geometry.x2}
                y2={geometry.y2}
                stroke={colorFor(connector.stroke, config, "primary")}
                strokeWidth={Math.max(1, connector.strokeWidth ?? 3)}
                strokeLinecap="round"
                markerEnd="url(#adv-preview-arrow)"
                opacity={connector.opacity}
              />
            );
          })}
        </svg>
      )}

      {nodes.map((node) => {
        const selected = selectedId === node.id || Boolean(selectedIds?.includes(node.id));
        return (
          <div
            key={node.id}
            className={`adv-node adv-node--${node.type}${selected ? " is-selected" : ""}${node.locked ? " is-locked" : ""}${interactive ? "" : fxClasses(node)}`}
            style={wrapperStyle(node, canvas, vertical)}
            onPointerDown={(event) => {
              if (!interactive) return;
              event.stopPropagation();
              // Shift/Cmd/Ctrl markerar flera noder; då behåller vi den primära
              // markeringen så att panelen inte hoppar mellan noderna.
              if (!(event.shiftKey || event.metaKey || event.ctrlKey)) onSelect?.(node.id);
              onNodePointerDown?.(event, node);
            }}
            onDoubleClick={(event) => {
              if (!interactive) return;
              event.stopPropagation();
              onNodeDoubleClick?.(node);
            }}
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-label={node.type}
          >
            {node.type === "logo" ? (
              <span
                className="adv-render-logo"
                style={{
                  ...textStyle(node, canvas, config, true),
                  justifyContent: node.align === "right" ? "flex-end" : node.align === "center" ? "center" : "flex-start",
                }}
              >
                {node.text || config.header.logoText || config.shop.name}
              </span>
            ) : null}

            {node.type === "nav" ? (
              <nav
                className="adv-render-nav"
                style={{
                  fontSize: unit(node.fontSize ?? 16, canvas),
                  color: colorFor(node.color, config, "text"),
                  justifyContent: node.align === "right" ? "flex-end" : node.align === "center" ? "center" : "flex-start",
                  fontWeight: node.fontWeight ?? 500,
                  fontFamily: node.font && FONTS[node.font as keyof typeof FONTS] ? FONTS[node.font as keyof typeof FONTS].stack : node.fontFamily?.trim() ? `${node.fontFamily.trim()}, sans-serif` : undefined,
                  fontStyle: node.italic ? "italic" : undefined,
                  textTransform: node.textTransform && node.textTransform !== "none" ? node.textTransform : undefined,
                }}
              >
                {config.header.links.map((link) => <span key={link}>{link}</span>)}
              </nav>
            ) : null}

            {node.type === "cart" ? (
              <span
                className="adv-render-cart"
                style={{
                  color: colorFor(node.color, config, "text"),
                  fontSize: unit(Math.max(node.fontSize ?? 18, node.h * 0.28), canvas),
                }}
                title="Cart"
              >
                <StoreIcon node={node} fallback="cart" />
                <span className="adv-render-cart__count" style={{ background: fillFor(node, config, "primary"), color: colorFor("onPrimary", config, "background") }}>2</span>
              </span>
            ) : null}

            {node.type === "search" ? (
              <span
                className="adv-render-cart"
                style={{ color: colorFor(node.color, config, "text"), fontSize: unit(node.fontSize ?? 18, canvas) }}
                title="Search"
              >
                <StoreIcon node={node} fallback="search" />
              </span>
            ) : null}

            {node.type === "text" || node.type === "heading" ? (
              <div className={`adv-render-text${node.type === "heading" ? " adv-render-text--heading" : ""}`} style={textStyle(node, canvas, config, node.type === "heading")}>
                {node.text}
              </div>
            ) : null}

            {node.type === "button" ? (
              <span
                className="adv-render-button"
                style={{
                  background: fillFor(node, config, "primary"),
                  color: colorFor(node.color, config, "onPrimary"),
                  borderRadius: unit(node.radius, canvas),
                  fontSize: unit(node.fontSize ?? 18, canvas),
                  fontWeight: node.fontWeight ?? 600,
                  justifyContent: node.align === "left" ? "flex-start" : node.align === "right" ? "flex-end" : "center",
                }}
                title={safeHref(node.href)}
              >
                {node.ctaLabel || "Handla nu"}
              </span>
            ) : null}

            {node.type === "image" ? (
              safeSrc(node.src) ? (
                <img
                  className="adv-render-image"
                  src={safeSrc(node.src)}
                  alt={node.alt || config.shop.name}
                  style={{ objectFit: node.fit === "contain" ? "contain" : "cover", borderRadius: unit(node.radius, canvas) }}
                />
              ) : (
                <div className="adv-render-image adv-render-image--placeholder" style={{ borderRadius: unit(node.radius, canvas) }}>
                  {node.alt || config.shop.name}
                </div>
              )
            ) : null}

            {node.type === "product" ? <ProductCard node={node} config={config} canvas={canvas} /> : null}

            {node.type === "products" ? <ProductGrid node={node} config={config} canvas={canvas} /> : null}

            {node.type === "section" ? <SectionPreview node={node} config={config} canvas={canvas} /> : null}

            {node.type === "shape" ? (
              <div
                className={`adv-render-shape adv-render-shape--${node.shape ?? "rect"}`}
                style={{
                  background: node.shape === "line" ? "transparent" : fillFor(node, config, "accent"),
                  borderRadius: node.shape === "ellipse" ? "50%" : unit(node.radius, canvas),
                  border: node.stroke ? `${unit(node.strokeWidth ?? 2, canvas)} solid ${colorFor(node.stroke, config, "primary")}` : undefined,
                  borderTop: node.shape === "line" ? `${unit(Math.max(1, node.strokeWidth ?? 3), canvas)} solid ${colorFor(node.stroke ?? node.fill, config, "primary")}` : undefined,
                }}
              />
            ) : null}

            {node.type === "drawing" ? (
              <svg className="adv-render-drawing" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <path
                  d={(node.points ?? []).map((point, index) => `${index === 0 ? "M" : "L"}${(point.x * 100).toFixed(2)} ${(point.y * 100).toFixed(2)}`).join(" ")}
                  fill="none"
                  stroke={colorFor(node.stroke, config, "primary")}
                  strokeWidth={Math.max(0.4, ((node.strokeWidth ?? 4) / canvas.width) * 100)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
