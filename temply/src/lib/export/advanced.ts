import { FONTS, type AdvancedCanvas, type AdvancedNode, type ThemeConfig } from "@/lib/theme/types";
import { colorFor, connectorGeometry, fxClasses, safeHref, safeSrc } from "@/lib/advanced/canvas";
import { svgElement } from "@/lib/advanced/icons";

/**
 * Advanced-canvasen exporteras som en riktig Liquid-sektion. Positioner och
 * mått ligger i designkoordinater och räknas om till cqw, så canvasen skalar
 * proportionellt i Shopify utan att gå sönder på mobil.
 */

type Vertical = "canvas" | "width";

function esc(value: string | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function attr(value: string | undefined): string {
  return esc(value).replace(/'/g, "&#39;");
}

/** Välkända butiksvägar blir riktiga Shopify-routes i stället för hårdkodade sökvägar. */
function liquidHref(value: string | undefined): string {
  switch (safeHref(value)) {
    case "/":
      return "{{ routes.root_url }}";
    case "/cart":
      return "{{ routes.cart_url }}";
    case "/search":
      return "{{ routes.search_url }}";
    case "/collections/all":
      return "{{ routes.all_products_collection_url }}";
    case "/account":
      return "{{ routes.account_url }}";
    default:
      return attr(safeHref(value));
  }
}

function cqw(px: number, canvas: AdvancedCanvas): string {
  return `${((px / canvas.width) * 100).toFixed(4)}cqw`;
}

function color(token: string | undefined, config: ThemeConfig, fallback: Parameters<typeof colorFor>[2]): string {
  return colorFor(token, config, fallback);
}

function styleFor(node: AdvancedNode, canvas: AdvancedCanvas, vertical: Vertical = "canvas"): string {
  return [
    `left:${((node.x / canvas.width) * 100).toFixed(4)}%`,
    vertical === "width"
      ? `top:${cqw(node.y, canvas)}`
      : `top:${((node.y / canvas.height) * 100).toFixed(4)}%`,
    `width:${((node.w / canvas.width) * 100).toFixed(4)}%`,
    vertical === "width"
      ? `height:${cqw(node.h, canvas)}`
      : `height:${((node.h / canvas.height) * 100).toFixed(4)}%`,
    `z-index:${node.z}`,
    `opacity:${node.opacity}`,
    node.rotation ? `transform:rotate(${node.rotation}deg)` : "",
  ]
    .filter(Boolean)
    .join(";");
}

function fontCss(node: AdvancedNode, heading = false): string {
  const family = node.font && FONTS[node.font as keyof typeof FONTS]
    ? FONTS[node.font as keyof typeof FONTS].stack
    : node.fontFamily?.trim()
      ? `${node.fontFamily.trim().replace(/[";{}]/g, "")}, sans-serif`
      : heading
        ? "var(--font-heading)"
        : "var(--font-body)";
  return [
    `font-family:${family}`,
    node.italic ? "font-style:italic" : "",
    node.textTransform && node.textTransform !== "none" ? `text-transform:${node.textTransform}` : "",
  ].filter(Boolean).join(";");
}

function textStyle(node: AdvancedNode, canvas: AdvancedCanvas, config: ThemeConfig, heading = false): string {
  const size = node.fontSize ?? (heading ? 54 : 22);
  return [
    fontCss(node, heading),
    `font-size:${cqw(size, canvas)}`,
    `font-weight:${node.fontWeight ?? (heading ? config.typography.headingWeight : 400)}`,
    `line-height:${node.lineHeight ?? 1.2}`,
    `letter-spacing:${node.letterSpacing ?? 0}em`,
    `text-align:${node.align ?? "left"}`,
    `color:${color(node.color, config, heading ? "text" : "text")}`,
    `border-radius:${cqw(node.radius, canvas)}`,
  ].join(";");
}

function padding(canvas: AdvancedCanvas, value: number): string {
  return cqw(value, canvas);
}

function alignment(node: AdvancedNode): string {
  return node.align === "right" ? "flex-end" : node.align === "center" ? "center" : "flex-start";
}

function renderText(node: AdvancedNode, canvas: AdvancedCanvas, config: ThemeConfig, vertical: Vertical): string {
  const heading = node.type === "heading";
  const content = esc(node.text).replace(/\n/g, "<br>");
  return `<div class="adv-node adv-text${heading ? " adv-text--heading" : ""}" style="${styleFor(node, canvas, vertical)};${textStyle(node, canvas, config, heading)}">${content}</div>`;
}

function renderButton(node: AdvancedNode, canvas: AdvancedCanvas, config: ThemeConfig, vertical: Vertical): string {
  const size = node.fontSize ?? 18;
  return `<a class="adv-node adv-button" href="${liquidHref(node.href)}" style="${styleFor(node, canvas, vertical)};background:${color(node.fill, config, "primary")};color:${color(node.color, config, "onPrimary")};border-radius:${cqw(node.radius, canvas)};${fontCss(node)};font-size:${cqw(size, canvas)};font-weight:${node.fontWeight ?? 600}">${esc(node.ctaLabel || "Handla nu")}</a>`;
}

function renderImage(node: AdvancedNode, canvas: AdvancedCanvas, config: ThemeConfig, vertical: Vertical): string {
  const src = safeSrc(node.src);
  const radius = cqw(node.radius, canvas);
  const fit = node.fit === "contain" ? "contain" : "cover";
  const inner = src
    ? `<img src="${attr(src)}" alt="${attr(node.alt || config.shop.name)}" loading="lazy" style="width:100%;height:100%;object-fit:${fit};display:block">`
    : `<span class="adv-placeholder">${esc(node.alt || config.shop.name)}</span>`;
  return `<div class="adv-node adv-image" style="${styleFor(node, canvas, vertical)};border-radius:${radius};overflow:hidden;background:linear-gradient(140deg,${config.palette.accent},${config.palette.primary})">${inner}</div>`;
}

function renderShape(node: AdvancedNode, canvas: AdvancedCanvas, config: ThemeConfig, vertical: Vertical): string {
  const fill = color(node.fill, config, "accent");
  const radius = node.shape === "ellipse" ? "50%" : cqw(node.radius, canvas);
  if (node.shape === "line") {
    return `<div class="adv-node" style="${styleFor(node, canvas, vertical)};background:${fill};height:${cqw(Math.max(1, node.strokeWidth ?? 3), canvas)};border-radius:999px"></div>`;
  }
  const border = node.stroke ? `border:${cqw(node.strokeWidth ?? 2, canvas)} solid ${color(node.stroke, config, "primary")};` : "";
  return `<div class="adv-node" style="${styleFor(node, canvas, vertical)};background:${fill};${border}border-radius:${radius}"></div>`;
}

function renderDrawing(node: AdvancedNode, canvas: AdvancedCanvas, config: ThemeConfig, vertical: Vertical): string {
  const points = node.points ?? [];
  const d = points.length > 1
    ? points.map((point, index) => `${index === 0 ? "M" : "L"}${(point.x * 100).toFixed(2)} ${(point.y * 100).toFixed(2)}`).join(" ")
    : "";
  const stroke = color(node.stroke, config, "primary");
  return `<div class="adv-node adv-drawing" style="${styleFor(node, canvas, vertical)};color:${stroke}">
  <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <path d="${d}" fill="none" stroke="currentColor" stroke-width="${Math.max(0.4, ((node.strokeWidth ?? 4) / canvas.width) * 100).toFixed(3)}" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
</div>`;
}

function renderProduct(node: AdvancedNode, canvas: AdvancedCanvas, config: ThemeConfig, vertical: Vertical): string {
  const index = Math.max(0, Math.min(11, Math.round(node.productIndex ?? 0)));
  const fallback = config.shop.products[index] ?? config.shop.products[0] ?? { name: "Produkt", price: "" };
  return `<div class="adv-node adv-product" style="${styleFor(node, canvas, vertical)};background:${config.palette.surface};border:${cqw(1, canvas)} solid ${config.palette.border};border-radius:${cqw(node.radius, canvas)}">
  {%- assign adv_products = collections.all.products -%}
  {%- assign adv_product = adv_products[${index}] -%}
  {%- if adv_product -%}
    <a href="{{ adv_product.url }}" class="adv-product__link">
      <span class="adv-product__media">{%- if adv_product.featured_image -%}{{ adv_product.featured_image | image_url: width: 700 | image_tag: loading: 'lazy', alt: adv_product.title }}{%- endif -%}</span>
      <span class="adv-product__name">{{ adv_product.title | escape }}</span>
      <span class="adv-product__price">{{ adv_product.price | money }}</span>
    </a>
  {%- else -%}
    <div class="adv-product__link">
      <span class="adv-product__media">${esc(fallback.tag || "")}</span>
      <span class="adv-product__name">${esc(fallback.name)}</span>
      <span class="adv-product__price">${esc(fallback.price)}</span>
    </div>
  {%- endif -%}
</div>`;
}

function renderProducts(node: AdvancedNode, canvas: AdvancedCanvas, config: ThemeConfig, vertical: Vertical): string {
  const columns = Math.max(1, Math.min(12, Math.round(node.columns ?? 3)));
  const count = Math.max(1, Math.min(24, Math.round(node.count ?? 3)));
  const start = Math.max(0, Math.round(node.productIndex ?? 0));
  const gap = cqw(node.gap ?? 24, canvas);
  const fallback = Array.from({ length: count }, (_, offset) => config.shop.products[(start + offset) % Math.max(1, config.shop.products.length)]).filter(Boolean);
  const fallbackCards = fallback.map((product) => `<div class="adv-product-grid__card"><span class="adv-product-grid__media adv-placeholder">${esc(product.name)}</span><b>${esc(product.name)}</b><span>${esc(product.price)}</span></div>`).join("");
  return `<div class="adv-node adv-product-grid" style="${styleFor(node, canvas, vertical)};--adv-cols:${columns};--adv-gap:${gap};--adv-card-radius:${cqw(node.radius, canvas)}">
  <div class="adv-product-grid__inner">
    {%- assign adv_products = collections.all.products -%}
    {%- if adv_products.size > 0 -%}
      {%- for product in adv_products limit: ${count} offset: ${start} -%}
        <a class="adv-product-grid__card" href="{{ product.url }}">
          <span class="adv-product-grid__media">{%- if product.featured_image -%}{{ product.featured_image | image_url: width: 700 | image_tag: loading: 'lazy', alt: product.title }}{%- endif -%}</span>
          <b>{{ product.title | escape }}</b><span>{{ product.price | money }}</span>
        </a>
      {%- endfor -%}
    {%- else -%}
      ${fallbackCards}
    {%- endif -%}
  </div>
</div>`;
}

function sectionCta(node: AdvancedNode, canvas: AdvancedCanvas, config: ThemeConfig): string {
  if (!node.ctaLabel) return "";
  const bg = node.preset === "campaign" ? config.palette.text : config.palette.primary;
  const fg = node.preset === "campaign" ? config.palette.background : colorFor("onPrimary", config);
  return `<a class="adv-btn" href="${liquidHref(node.href)}" style="background:${bg};color:${fg};border-radius:${cqw(config.shape.buttonRadius, canvas)};font-size:${cqw(17, canvas)}">${esc(node.ctaLabel)}</a>`;
}

function renderSection(node: AdvancedNode, canvas: AdvancedCanvas, config: ThemeConfig, vertical: Vertical): string {
  const preset = node.preset ?? "hero";
  const fill = color(node.fill, config, preset === "campaign" ? "accent" : "surface");
  const textColor = color(node.color, config, "text");
  const radius = cqw(node.radius, canvas);
  const titleSize = node.fontSize ?? 48;
  const bodySize = Math.max(13, Math.round(titleSize * 0.36));
  const base = `style="${styleFor(node, canvas, vertical)};background:${fill};color:${textColor};border-radius:${radius};padding:${padding(canvas, 34)};overflow:hidden;${fontCss(node, true)}"`;

  if (preset === "products") {
    return `<section class="adv-node adv-section adv-section--products" ${base}>
  <div class="adv-section__head"><div>${node.eyebrow ? `<span class="adv-eyebrow" style="font-size:${cqw(13, canvas)}">${esc(node.eyebrow)}</span>` : ""}<h2 style="font-size:${cqw(titleSize, canvas)};color:${textColor}">${esc(node.title || "Utvalt")}</h2></div>${sectionCta(node, canvas, config)}</div>
  <div class="adv-mini-grid">
    {%- assign adv_products = collections.all.products -%}
    {%- if adv_products.size > 0 -%}
      {%- for product in adv_products limit: 3 -%}
        <a class="adv-mini-card" href="{{ product.url }}">
          <span class="adv-mini-card__media">{%- if product.featured_image -%}{{ product.featured_image | image_url: width: 420 | image_tag: loading: 'lazy', alt: product.title }}{%- endif -%}</span>
          <b>{{ product.title | escape }}</b><span>{{ product.price | money }}</span>
        </a>
      {%- endfor -%}
    {%- else -%}
      ${config.shop.products.slice(0, 3).map((product) => `<div class="adv-mini-card"><span class="adv-mini-card__media adv-placeholder">${esc(product.name)}</span><b>${esc(product.name)}</b><span>${esc(product.price)}</span></div>`).join("")}
    {%- endif -%}
  </div>
</section>`;
  }

  if (preset === "features") {
    const items = (config.sections.find((section) => section.type === "features") as { items?: { title: string; text: string }[] } | undefined)?.items ?? [];
    const rows = items.slice(0, 3).map((item) => `<div class="adv-feature"><b>${esc(item.title)}</b><span>${esc(item.text)}</span></div>`).join("");
    return `<section class="adv-node adv-section adv-section--features" ${base}>
  ${node.eyebrow ? `<span class="adv-eyebrow" style="font-size:${cqw(13, canvas)}">${esc(node.eyebrow)}</span>` : ""}
  <h2 style="font-size:${cqw(titleSize, canvas)};color:${textColor}">${esc(node.title || "Varför oss")}</h2>
  <p style="font-size:${cqw(bodySize, canvas)}">${esc(node.text)}</p>
  <div class="adv-feature-grid">${rows}</div>
  ${sectionCta(node, canvas, config)}
</section>`;
  }

  if (preset === "testimonial") {
    const item = (config.sections.find((section) => section.type === "testimonials") as { items?: { quote: string; author: string; role: string }[] } | undefined)?.items?.[0];
    return `<section class="adv-node adv-section adv-section--testimonial" ${base}>
  ${node.eyebrow ? `<span class="adv-eyebrow" style="font-size:${cqw(13, canvas)}">${esc(node.eyebrow)}</span>` : ""}
  <blockquote style="font-size:${cqw(titleSize, canvas)}">“${esc(item?.quote || node.text || "Bästa köpet på länge.")}”</blockquote>
  <p style="font-size:${cqw(bodySize, canvas)}">${esc(node.title || item?.author || config.shop.name)}${item?.role ? ` · ${esc(item.role)}` : ""}</p>
</section>`;
  }

  if (preset === "banner") {
    return `<section class="adv-node adv-section adv-section--banner" ${base}>
  <div><h2 style="font-size:${cqw(titleSize, canvas)};color:${textColor}">${esc(node.title)}</h2><p style="font-size:${cqw(bodySize, canvas)};color:${textColor};opacity:.78">${esc(node.text)}</p></div>
  ${sectionCta(node, canvas, config)}
</section>`;
  }

  const campaign = preset === "campaign";
  return `<section class="adv-node adv-section adv-section--${campaign ? "campaign" : "hero"}" ${base}>
  ${node.badge ? `<span class="adv-badge" style="font-size:${cqw(12, canvas)}">${esc(node.badge)}</span>` : node.eyebrow ? `<span class="adv-eyebrow" style="font-size:${cqw(13, canvas)}">${esc(node.eyebrow)}</span>` : ""}
  <h2 style="font-size:${cqw(titleSize, canvas)};color:${textColor}">${esc(node.title || config.shop.name)}</h2>
  ${node.text ? `<p style="font-size:${cqw(bodySize, canvas)};color:${textColor};opacity:.8">${esc(node.text)}</p>` : ""}
  ${sectionCta(node, canvas, config)}
</section>`;
}

/* ------------------------------------------------------------------ */
/* Butiksdelar med riktiga Shopify-taggar                              */
/* ------------------------------------------------------------------ */

function renderLogo(node: AdvancedNode, canvas: AdvancedCanvas, config: ThemeConfig, vertical: Vertical): string {
  const label = esc(node.text || config.header.logoText || config.shop.name);
  return `<a class="adv-node adv-store adv-logo" href="{{ routes.root_url }}" style="${styleFor(node, canvas, vertical)};${textStyle(node, canvas, config, true)};justify-content:${alignment(node)};text-decoration:none">${label}</a>`;
}

function renderNav(node: AdvancedNode, canvas: AdvancedCanvas, config: ThemeConfig, vertical: Vertical): string {
  const menu = (node.menu || "main-menu").replace(/[^a-zA-Z0-9_-]/g, "") || "main-menu";
  return `<nav class="adv-node adv-store adv-nav" aria-label="Main menu" style="${styleFor(node, canvas, vertical)};${fontCss(node)};font-size:${cqw(node.fontSize ?? 18, canvas)};font-weight:${node.fontWeight ?? 500};letter-spacing:${node.letterSpacing ?? 0}em;color:${color(node.color, config, "text")};justify-content:${alignment(node)};text-align:${node.align ?? "left"}">
  {%- assign adv_menu = linklists['${menu}'] -%}
  {%- if adv_menu == blank -%}{%- assign adv_menu = linklists[section.settings.menu] -%}{%- endif -%}
  {%- if adv_menu == blank -%}{%- assign adv_menu = linklists.main-menu -%}{%- endif -%}
  {%- for link in adv_menu.links -%}<a href="{{ link.url }}">{{ link.title | escape }}</a>{%- endfor -%}
</nav>`;
}

function iconName(value: string | undefined, fallback: string): string {
  return value && /^[a-zA-Z0-9_-]{1,40}$/.test(value) ? value : fallback;
}

/** Egna ikoner lagras som sanerad SVG eller data-URL och skrivs inline i Liquid. */
function storeIcon(node: AdvancedNode, fallback: string, stroke: number): string {
  if (node.iconImage) {
    return `<img class="adv-custom-icon" src="${node.iconImage.replace(/"/g, "&quot;")}" alt="" width="24" height="24" loading="lazy">`;
  }
  if (node.iconSvg) return svgElement(node.iconSvg);
  return `{%- assign adv_icon = '${iconName(node.icon, fallback)}' -%}\n  {%- render 'icon', name: adv_icon, stroke: ${Math.max(0.25, stroke)} -%}`;
}

function renderCart(node: AdvancedNode, canvas: AdvancedCanvas, config: ThemeConfig, vertical: Vertical): string {
  return `<a class="adv-node adv-store adv-cart" href="{{ routes.cart_url }}" aria-label="{{ 'general.cart' | t | default: 'Cart' }}" style="${styleFor(node, canvas, vertical)};color:${color(node.color, config, "text")};font-size:${cqw(Math.max(node.fontSize ?? 18, node.h * 0.28), canvas)};--adv-cart-badge:${color(node.fill, config, "primary")};--adv-cart-badge-text:${colorFor("onPrimary", config)}">
  ${storeIcon(node, "cart", node.iconStroke ?? 1.75)}
  <span class="adv-cart__count">{{ cart.item_count }}</span>
</a>`;
}

function renderSearch(node: AdvancedNode, canvas: AdvancedCanvas, config: ThemeConfig, vertical: Vertical): string {
  return `<a class="adv-node adv-store adv-search" href="{{ routes.search_url }}" aria-label="{{ 'general.search' | t | default: 'Search' }}" style="${styleFor(node, canvas, vertical)};color:${color(node.color, config, "text")};font-size:${cqw(node.fontSize ?? 18, canvas)}">
  ${storeIcon(node, "search", node.iconStroke ?? 1.75)}
</a>`;
}

function renderNode(node: AdvancedNode, canvas: AdvancedCanvas, config: ThemeConfig, vertical: Vertical = "canvas"): string {
  const html = renderNodeBody(node, canvas, config, vertical);
  const fx = fxClasses(node).trim();
  // Effektklasserna läggs på nodens rot, så hover och entré animeras exakt
  // som i editorn utan att varje renderfunktion behöver känna till dem.
  return fx ? html.replace('class="adv-node ', `class="${fx} adv-node `) : html;
}

function renderNodeBody(node: AdvancedNode, canvas: AdvancedCanvas, config: ThemeConfig, vertical: Vertical): string {
  switch (node.type) {
    case "text":
    case "heading":
      return renderText(node, canvas, config, vertical);
    case "button":
      return renderButton(node, canvas, config, vertical);
    case "image":
      return renderImage(node, canvas, config, vertical);
    case "product":
      return renderProduct(node, canvas, config, vertical);
    case "products":
      return renderProducts(node, canvas, config, vertical);
    case "section":
      return renderSection(node, canvas, config, vertical);
    case "shape":
      return renderShape(node, canvas, config, vertical);
    case "drawing":
      return renderDrawing(node, canvas, config, vertical);
    case "logo":
      return renderLogo(node, canvas, config, vertical);
    case "nav":
      return renderNav(node, canvas, config, vertical);
    case "cart":
      return renderCart(node, canvas, config, vertical);
    case "search":
      return renderSearch(node, canvas, config, vertical);
    case "connector":
      return "";
  }
}

function connectorLayer(canvas: AdvancedCanvas, config: ThemeConfig): string {
  const connectors = canvas.nodes.filter((node) => node.type === "connector");
  if (connectors.length === 0) return "";
  const lines = connectors
    .map((node) => {
      const geometry = connectorGeometry(node, canvas.nodes);
      if (!geometry) return "";
      return `<line x1="${geometry.x1.toFixed(1)}" y1="${geometry.y1.toFixed(1)}" x2="${geometry.x2.toFixed(1)}" y2="${geometry.y2.toFixed(1)}" stroke="${color(node.stroke, config, "primary")}" stroke-width="${Math.max(1, node.strokeWidth ?? 3)}" stroke-linecap="round" marker-end="url(#adv-arrow)" opacity="${node.opacity}"/>`;
    })
    .join("");
  return `<svg class="adv-connectors" viewBox="0 0 ${canvas.width} ${canvas.height}" preserveAspectRatio="none" aria-hidden="true">
  <defs><marker id="adv-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="${config.palette.primary}"/></marker></defs>
  ${lines}
</svg>`;
}

function baseCss(config: ThemeConfig): string {
  return `.adv-page{position:relative;width:100%;overflow:hidden}
.adv-canvas{position:relative;width:100%;margin-inline:auto;container-type:inline-size;overflow:hidden}
.adv-node{position:absolute;box-sizing:border-box;margin:0}
.adv-store{text-decoration:none;color:inherit}
.adv-logo{display:flex;align-items:center;white-space:nowrap;overflow:visible}
.adv-nav{display:flex;align-items:center;gap:1.4em;flex-wrap:wrap;overflow:visible}
.adv-nav a{color:inherit;text-decoration:none}
.adv-cart,.adv-search{display:flex;align-items:center;justify-content:center;position:relative}
.adv-cart svg,.adv-search svg,.adv-cart img,.adv-search img,.adv-custom-icon{width:100%;height:100%;display:block;object-fit:contain}
.adv-cart__count{position:absolute;top:0;right:0;display:inline-flex;min-width:1.25em;height:1.25em;align-items:center;justify-content:center;border-radius:999px;padding:0 .25em;background:var(--adv-cart-badge,${config.palette.primary});color:var(--adv-cart-badge-text,${colorFor("onPrimary", config)});font-size:.55em;font-weight:700;line-height:1;transform:translate(20%,-10%)}
.adv-text{display:flex;align-items:flex-start;white-space:pre-wrap;overflow:hidden;text-wrap:pretty}
.adv-text--heading{letter-spacing:-.02em}
.adv-button{display:inline-flex;align-items:center;justify-content:center;text-align:center;text-decoration:none;line-height:1;padding:.4em .8em;transition:transform .2s ease,opacity .2s ease}
.adv-button:hover{opacity:.9;transform:translateY(-1px)}
.adv-node{transition:translate .24s ease,scale .24s ease,rotate .24s ease,box-shadow .24s ease,opacity .24s ease,filter .24s ease}
.adv-fx-hover--lift:hover{translate:0 -.6%;box-shadow:0 18px 40px -24px rgba(19,19,16,.45)}
.adv-fx-hover--grow:hover{scale:1.035}
.adv-fx-hover--glow:hover{box-shadow:0 0 0 2px ${config.palette.primary},0 22px 48px -26px rgba(19,19,16,.5)}
.adv-fx-hover--dim:hover{filter:opacity(.72)}
.adv-fx-hover--underline:hover{text-decoration:underline;text-underline-offset:.18em}
.adv-fx-hover--tilt:hover{rotate:-2deg}
@keyframes adv-fx-fade-up{from{opacity:0;translate:0 18px}to{opacity:1;translate:0 0}}
@keyframes adv-fx-zoom{from{opacity:0;scale:.94}to{opacity:1;scale:1}}
@keyframes adv-fx-slide-left{from{opacity:0;translate:-32px 0}to{opacity:1;translate:0 0}}
@keyframes adv-fx-slide-right{from{opacity:0;translate:32px 0}to{opacity:1;translate:0 0}}
.adv-fx-reveal--fade-up{animation:adv-fx-fade-up .55s cubic-bezier(.22,.61,.36,1) backwards}
.adv-fx-reveal--zoom{animation:adv-fx-zoom .5s cubic-bezier(.22,.61,.36,1) backwards}
.adv-fx-reveal--slide-left{animation:adv-fx-slide-left .55s cubic-bezier(.22,.61,.36,1) backwards}
.adv-fx-reveal--slide-right{animation:adv-fx-slide-right .55s cubic-bezier(.22,.61,.36,1) backwards}
.adv-image img{display:block}
.adv-placeholder{display:flex;align-items:center;justify-content:center;width:100%;height:100%;min-height:100%;padding:1em;text-align:center;color:rgba(255,255,255,.86);font-family:var(--font-heading);font-size:1.1em;line-height:1.15}
.adv-drawing,.adv-drawing svg{width:100%;height:100%;display:block;overflow:visible}
.adv-connectors{position:absolute;inset:0;width:100%;height:100%;z-index:1;pointer-events:none;overflow:visible}
.adv-product{display:flex;overflow:hidden}
.adv-product-grid{display:flex;overflow:hidden}
.adv-product-grid__inner{display:grid;grid-template-columns:repeat(var(--adv-cols,3),minmax(0,1fr));gap:var(--adv-gap,1.2em);width:100%}
.adv-product-grid__card{display:flex;flex-direction:column;overflow:hidden;background:var(--surface);border:1px solid var(--border);border-radius:var(--adv-card-radius);min-width:0;min-height:0;text-decoration:none;color:inherit}
.adv-product-grid__media{display:flex;flex:1;min-height:0;align-items:center;justify-content:center;overflow:hidden;background:linear-gradient(140deg,${config.palette.accent},${config.palette.primary})}
.adv-product-grid__media img{width:100%;height:100%;object-fit:cover}
.adv-product-grid__card b{padding:.5em .65em 0;font-family:var(--font-heading);font-weight:600;line-height:1.2}
.adv-product-grid__card>span:last-child{padding:.1em .65em .6em;color:var(--muted);font-size:.92em}
.adv-product__link{display:flex;flex-direction:column;width:100%;height:100%;text-decoration:none;color:inherit}
.adv-product__media{display:flex;flex:1;min-height:0;align-items:center;justify-content:center;overflow:hidden;background:linear-gradient(140deg,${config.palette.accent},${config.palette.primary})}
.adv-product__media img{width:100%;height:100%;object-fit:cover}
.adv-product__name{padding:.55em .7em 0;font-family:var(--font-heading);font-weight:600;line-height:1.2}
.adv-product__price{padding:.1em .7em .7em;color:var(--muted);font-size:.92em}
.adv-section{display:flex;flex-direction:column;justify-content:center;gap:.35em}
.adv-section h2,.adv-section p,.adv-section blockquote{margin:0}
.adv-section p{line-height:1.4}
.adv-eyebrow{display:block;text-transform:uppercase;letter-spacing:.14em;font-weight:600;opacity:.72;margin-bottom:.5em}
.adv-badge{display:inline-flex;align-self:flex-start;background:${config.palette.text};color:${config.palette.background};border-radius:999px;padding:.35em .8em;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:.55em}
.adv-btn{display:inline-flex;align-items:center;justify-content:center;align-self:flex-start;padding:.8em 1.2em;text-decoration:none;font-weight:600;line-height:1;margin-top:.6em}
.adv-section--banner{flex-direction:row;align-items:center;justify-content:space-between;gap:1em}
.adv-section--banner .adv-btn{margin-top:0;flex-shrink:0}
.adv-section--campaign{text-align:left}
.adv-section--products .adv-section__head{display:flex;align-items:flex-end;justify-content:space-between;gap:1em;margin-bottom:.5em}
.adv-section--products .adv-btn{margin-top:0}
.adv-mini-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.7em;min-height:0}
.adv-mini-card{display:flex;flex-direction:column;gap:.2em;background:color-mix(in srgb,var(--surface) 72%,transparent);border-radius:calc(var(--radius)*.7);overflow:hidden;text-decoration:none;color:inherit;min-height:0}
.adv-mini-card__media{display:block;min-height:0;flex:1;overflow:hidden;background:linear-gradient(140deg,${config.palette.accent},${config.palette.primary})}
.adv-mini-card__media img{width:100%;height:100%;object-fit:cover}
.adv-mini-card b,.adv-mini-card span{padding-inline:.5em;font-size:.86em;line-height:1.2}
.adv-mini-card b{padding-top:.45em}
.adv-mini-card span{padding-bottom:.5em;color:var(--muted)}
.adv-feature-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.7em}
.adv-feature{display:flex;flex-direction:column;gap:.15em}
.adv-feature b{font-family:var(--font-heading);font-size:.95em}
.adv-feature span{font-size:.82em;line-height:1.3;opacity:.76}
.adv-section--testimonial blockquote{font-family:var(--font-heading);line-height:1.14;letter-spacing:-.02em}
@media (max-width: 749px){
  .adv-mini-grid,.adv-feature-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
  .adv-section--banner{flex-direction:column;align-items:flex-start}
}
@media (prefers-reduced-motion: reduce){.adv-button{transition:none}.adv-node{transition:none;animation:none}}`;
}

function schema(name: string, config: ThemeConfig) {
  return {
    name,
    tag: "section",
    class: "section-advanced",
    settings: [
      { type: "color", id: "background_color", label: "Background", default: config.palette.background },
      { type: "range", id: "max_width", label: "Max width", min: 720, max: 1920, step: 20, unit: "px", default: config.layout.maxWidth },
      { type: "link_list", id: "menu", label: "Menu", default: "main-menu" },
    ],
    presets: [{ name }],
  };
}

export function advancedSection(canvas: AdvancedCanvas, config: ThemeConfig, name = "Advanced canvas"): string {
  const nodes = [...canvas.nodes].filter((node) => node.type !== "connector").sort((a, b) => a.z - b.z || a.y - b.y);
  const html = nodes.map((node) => renderNode(node, canvas, config)).join("\n");
  const background = canvas.background === "transparent" ? "transparent" : colorFor(canvas.background, config, "background");
  return `{%- comment -%} ThemeFold Advanced canvas – generated from the free canvas. Editable in the theme editor. {%- endcomment -%}
<div class="adv-page" style="background:{{ section.settings.background_color | default: '${attr(background)}' }}">
  <div class="adv-canvas" style="max-width:{{ section.settings.max_width }}px;aspect-ratio:${canvas.width}/${canvas.height}">
    ${connectorLayer(canvas, config)}
    ${html}
  </div>
</div>

<style>
${baseCss(config)}
</style>

{% schema %}
${JSON.stringify(schema(name, config), null, 2)}
{% endschema %}
`;
}

/**
 * Ett fritt sidhuvud eller en fri sidfot. Ytan har samma proportioner som i
 * editorn, så allt hamnar på exakt samma plats i Shopify. Alla element – inte
 * bara logotyp och meny – får plats, och färger skrivs ut som de valdes.
 */
export function advancedRegionSection(
  canvas: AdvancedCanvas,
  config: ThemeConfig,
  name: string,
  className: string,
): string {
  const nodes = [...canvas.nodes].filter((node) => node.type !== "connector").sort((a, b) => a.z - b.z || a.y - b.y);
  const html = nodes.map((node) => renderNode(node, canvas, config, "width")).join("\n");
  const background = canvas.background === "transparent" ? "transparent" : colorFor(canvas.background, config, "background");
  return `{%- comment -%} ThemeFold ${name} – free placement, generated from Advanced. {%- endcomment -%}
<section class="adv-fixed ${className}" style="background:${attr(background)}">
  <div class="adv-fixed__inner" style="max-width:{{ section.settings.max_width }}px;aspect-ratio:${canvas.width}/${canvas.height}">
    ${connectorLayer(canvas, config)}
    ${html}
  </div>
</section>

<style>
${baseCss(config)}
.adv-fixed{position:relative;width:100%;z-index:20}
.adv-fixed__inner{position:relative;width:100%;margin-inline:auto;container-type:inline-size;overflow:hidden}
</style>

{% schema %}
${JSON.stringify(
  {
    name,
    tag: "section",
    class: `section-${className}`,
    settings: [
      { type: "range", id: "max_width", label: "Max width", min: 720, max: 1920, step: 20, unit: "px", default: config.layout.maxWidth },
      { type: "link_list", id: "menu", label: "Menu", default: "main-menu" },
    ],
  },
  null,
  2,
)}
{% endschema %}
`;
}

export function advancedHeaderSection(canvas: AdvancedCanvas, config: ThemeConfig): string {
  return advancedRegionSection(canvas, config, "Advanced header", "adv-header");
}

export function advancedFooterSection(canvas: AdvancedCanvas, config: ThemeConfig): string {
  return advancedRegionSection(canvas, config, "Advanced footer", "adv-footer");
}

/**
 * Globalt lager för logotyp, meny, sök och varukorg. Lagret ligger ovanpå
 * sidans innehåll men påverkar inte flödet. Positionerna räknas i cqw, så en
 * varukorg som dragits till mitten av canvasen hamnar mitt i sidan även när
 * olika sidor har olika höjd.
 */
export function advancedChromeSection(canvas: AdvancedCanvas, config: ThemeConfig, name = "Header & cart"): string {
  const nodes = [...canvas.nodes].filter((node) => node.type !== "connector").sort((a, b) => a.z - b.z || a.y - b.y);
  const html = nodes.map((node) => renderNode(node, canvas, config, "width")).join("\n");
  return `{%- comment -%} ThemeFold Advanced chrome – logo, menu, search and cart placed freely. {%- endcomment -%}
<div class="adv-global-chrome" style="max-width:{{ section.settings.max_width }}px">
  ${connectorLayer(canvas, config)}
  ${html}
</div>

<style>
${baseCss(config)}
.adv-global-chrome{position:absolute;top:0;bottom:0;left:50%;transform:translateX(-50%);width:100%;z-index:60;pointer-events:none;container-type:inline-size;overflow:visible}
.adv-global-chrome .adv-store,.adv-global-chrome .adv-button{pointer-events:auto}
</style>

{% schema %}
${JSON.stringify(
  {
    name,
    tag: "section",
    class: "section-advanced-chrome",
    settings: [
      { type: "range", id: "max_width", label: "Max width", min: 720, max: 1920, step: 20, unit: "px", default: config.layout.maxWidth },
      { type: "link_list", id: "menu", label: "Menu", default: "main-menu" },
    ],
  },
  null,
  2,
)}
{% endschema %}
`;
}
