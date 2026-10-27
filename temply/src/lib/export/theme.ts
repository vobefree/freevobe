import { FONTS, type ThemeConfig, type Section } from "@/lib/theme/types";
import { THEME_CSS } from "./css";
import { campaignSection, integrationSchemaSettings, integrationSettingsData, integrationSnippets } from "./integrations";
import { canvaDesignFor, isIntegrationLive } from "@/lib/integrations/catalog";
import { EXPORT_ICON_NAMES, EXPORT_ICON_PATHS, exportIconName } from "./icons";
import { createZip } from "./zip";
import { advancedChromeSection, advancedFooterSection, advancedHeaderSection, advancedSection } from "./advanced";
import { canvasForChrome, canvasForFooter, canvasForHeader, canvasForPage, canvasHasContent } from "@/lib/advanced/canvas";
import { syncThemeToAdvanced } from "@/lib/advanced/sync";
import { CREDIT_SECTION, creditSection } from "./credit";
import {
  faqSection,
  featuresSection,
  footerSection,
  headerSection,
  heroSection,
  imageTextSection,
  main404Section,
  mainCartSection,
  mainCollectionSection,
  mainListCollectionsSection,
  mainPageSection,
  mainProductSection,
  mainSearchSection,
  marqueeSection,
  newsletterSection,
  productGridSection,
  testimonialsSection,
} from "./sections";
import {
  aboutSection,
  appEmbedSnippet,
  bundleSection,
  contactSection,
  exitIntentSnippet,
  freeShippingBarSnippet,
  marketsSnippet,
  recentlyViewedSnippet,
  reviewsSnippet,
  sizeGuideSection,
  sizeGuideSnippet,
  stickyAtcSnippet,
  trustSection,
  ugcSection,
} from "./sections2";
import {
  collectionSection,
  comparisonSection,
  completeTheLookSection,
  countdownSection,
  lookbookSection,
  marketSwitcherSnippet,
  megaSnippet,
  storySection,
} from "./sections3";

const SECTION_FILES: Record<Section["type"], { file: string; build: (config: ThemeConfig) => string }> = {
  hero: { file: "hero", build: heroSection },
  productGrid: { file: "product-grid", build: productGridSection },
  features: { file: "features", build: featuresSection },
  imageText: { file: "image-text", build: imageTextSection },
  testimonials: { file: "testimonials", build: testimonialsSection },
  marquee: { file: "marquee", build: marqueeSection },
  faq: { file: "faq", build: faqSection },
  newsletter: { file: "newsletter", build: newsletterSection },
  ugc: { file: "ugc", build: ugcSection },
  trust: { file: "trust", build: trustSection },
  bundle: { file: "bundle", build: bundleSection },
  sizeGuide: { file: "size-guide", build: sizeGuideSection },
  countdown: { file: "countdown", build: (config) => countdownSection(config) },
  collection: { file: "category-grid", build: (config) => collectionSection(config) },
  comparison: { file: "comparison", build: (config) => comparisonSection(config) },
  lookbook: { file: "lookbook", build: (config) => lookbookSection(config) },
  completeTheLook: { file: "complete-the-look", build: (config) => completeTheLookSection(config) },
  story: { file: "story", build: (config) => storySection(config) },
};

function esc(value: string): string {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function readableOn(hex: string): string {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  if (full.length !== 6) return "#FFFFFF";
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#14140F" : "#FFFFFF";
}

function layoutCss(): string {
  return `{%- if settings.use_shopify_fonts and settings.heading_shopify_font != blank -%}
  {%- assign heading_family = settings.heading_shopify_font.family -%}
  {%- assign heading_fallback = settings.heading_shopify_font.fallback_families | default: 'sans-serif' -%}
{%- endif -%}
{%- if settings.use_shopify_fonts and settings.body_shopify_font != blank -%}
  {%- assign body_family = settings.body_shopify_font.family -%}
  {%- assign body_fallback = settings.body_shopify_font.fallback_families | default: 'sans-serif' -%}
{%- endif -%}
:root{
  --bg: {{ settings.color_background }};
  --surface: {{ settings.color_surface }};
  --text: {{ settings.color_text }};
  --muted: {{ settings.color_muted }};
  --primary: {{ settings.color_primary }};
  --on-primary: {{ settings.color_on_primary }};
  --accent: {{ settings.color_accent }};
  --border: {{ settings.color_border }};
  --radius: {{ settings.radius }}px;
  --btn-radius: {{ settings.button_radius }}px;
  --border-width: {{ settings.border_width }}px;
  --shadow: {{ settings.shadow }}px;
  --max: {{ settings.page_width }};
  --grid-gap: {{ settings.grid_gap }};
  --section-space: {{ settings.section_spacing }};
  --base: {{ settings.base_size }}px;
  --scale: {{ settings.heading_scale }};
  --heading-weight: {{ settings.heading_weight }};
  --tracking: {{ settings.heading_tracking }}em;
  --font-heading: {% if heading_family %}'{{ heading_family }}', {{ heading_fallback }}{% else %}{{ heading_stack }}{% endif %};
  --font-body: {% if body_family %}'{{ body_family }}', {{ body_fallback }}{% else %}{{ body_stack }}{% endif %};
  --card-radius: {{ settings.card_radius }}px;
  --image-radius: {{ settings.image_radius }}px;
  --input-radius: {{ settings.input_radius }}px;
}
.adv-page-shell{position:relative}`;
}

function fontCases(): string {
  const heading = Object.entries(FONTS)
    .map(([key, font]) => `  {%- when '${key}' -%}{%- assign heading_stack = "${font.stack}" -%}{%- assign heading_google = '${font.google}' -%}`)
    .join("\n");
  const body = Object.entries(FONTS)
    .map(([key, font]) => `  {%- when '${key}' -%}{%- assign body_stack = "${font.stack}" -%}{%- assign body_google = '${font.google}' -%}`)
    .join("\n");
  return `{%- case settings.heading_font -%}\n${heading}\n  {%- else -%}{%- assign heading_stack = "${FONTS.manrope.stack}" -%}{%- assign heading_google = '${FONTS.manrope.google}' -%}\n{%- endcase -%}\n{%- case settings.body_font -%}\n${body}\n  {%- else -%}{%- assign body_stack = "${FONTS.inter.stack}" -%}{%- assign body_google = '${FONTS.inter.google}' -%}\n{%- endcase -%}`;
}

/** Typsnitt som bara används i Advanced måste laddas i butiken också. */
function advancedFontQueries(config: ThemeConfig): string[] {
  const canvases = [
    config.builder?.canvas,
    ...Object.values(config.builder?.canvases ?? {}),
    config.builder?.chrome,
    config.builder?.header,
    config.builder?.footer,
  ].filter(Boolean);
  const queries = new Set<string>();
  for (const canvas of canvases) {
    for (const node of canvas?.nodes ?? []) {
      if (node.font && FONTS[node.font as keyof typeof FONTS]) queries.add(`family=${FONTS[node.font as keyof typeof FONTS].google}`);
      const custom = node.fontFamily?.trim();
      if (custom && /^[a-zA-Z0-9 -]{1,60}$/.test(custom)) queries.add(`family=${encodeURIComponent(custom).replace(/%20/g, "+")}`);
    }
  }
  return [...queries];
}

function themeLayout(config: ThemeConfig, credit: boolean): string {
  // Ett eget globalt lager ersätter den vanliga headern. Då hamnar logotyp,
  // meny, sök och varukorg exakt där de drogs på canvasen.
  const advanced = config.builder?.mode === "advanced";
  const customChrome = canvasHasContent(canvasForChrome(config));
  // I Advanced ersätts header och footer av de fria ytorna, så det som syns i
  // editorn är exakt det som hamnar i butiken – även en helt ombyggd footer.
  const customHeader = advanced && canvasHasContent(canvasForHeader(config));
  const customFooter = advanced && canvasHasContent(canvasForFooter(config));
  return `<!doctype html>
<html lang="{{ request.locale.iso_code }}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="{{ settings.color_background }}">
    <link rel="canonical" href="{{ canonical_url }}">
    {%- if settings.favicon != blank -%}
      <link rel="icon" type="image/png" href="{{ settings.favicon | image_url: width: 64 }}">
    {%- endif -%}
    <title>{{ page_title }}{% if current_page != 1 %} &ndash; {{ shop.name }}{% endif %}</title>
    {%- if page_description -%}<meta name="description" content="{{ page_description | escape }}">{%- elsif settings.default_meta_description != blank -%}<meta name="description" content="{{ settings.default_meta_description | escape }}">{%- endif -%}
    {%- if template.name == 'index' and settings.default_title != blank -%}<meta property="og:title" content="{{ settings.default_title | escape }}">{%- endif -%}
    ${fontCases()}
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family={{ heading_google }}&family={{ body_google }}&display=swap" rel="stylesheet">
    ${advancedFontQueries(config).length ? `<link href="https://fonts.googleapis.com/css2?${advancedFontQueries(config).join("&")}&display=swap" rel="stylesheet">` : ""}
    <style>${layoutCss()}</style>
    {%- if settings.integration_analytics_enabled -%}{% render 'integration-analytics' %}{%- endif -%}
    {%- assign canva_og = ${JSON.stringify(canvaDesignFor(config, "og")?.url ?? "")} -%}
    {%- if canva_og != blank -%}<meta property="og:image" content="{{ canva_og }}">{%- endif -%}
    {{ 'theme.css' | asset_url | stylesheet_tag }}
    {{ content_for_header }}
  </head>
  <body
    class="template-{{ template.name }}{% if settings.uppercase_headings %} uppercase-headings{% endif %}"
    data-animate="{{ settings.animations }}"
    data-ab="{{ settings.ab_test }}"
    data-ab-headline="{{ settings.ab_headline | escape }}"
    data-ab-cta="{{ settings.ab_cta | escape }}"
    data-reviews-app="{{ settings.reviews_app }}">
    <a class="skip-link" href="#MainContent">{{ 'accessibility.skip_to_content' | t }}</a>
    {%- if settings.free_shipping_bar -%}{% render 'free-shipping-bar' %}{%- endif -%}
    ${customChrome ? `<div class="adv-page-shell">` : customHeader ? "{% section 'advanced-header' %}" : "{% section 'header' %}"}
    <main id="MainContent" role="main">
      {{ content_for_layout }}
    </main>
    ${customChrome ? `{% section 'advanced-chrome' %}</div>` : ""}
    ${customFooter ? "{% section 'advanced-footer' %}" : "{% section 'footer' %}"}
    ${credit ? `{% section '${CREDIT_SECTION}' %}` : ""}
    {% render 'exit-intent' %}
    {%- if settings.app_blocks -%}{% render 'app-embed' %}{%- endif -%}
    {%- if settings.integration_chat_enabled -%}{% render 'integration-chat' %}{%- endif -%}
    {%- if settings.integration_consent_enabled -%}{% render 'integration-consent' %}{%- endif -%}
    <script src="{{ 'theme.js' | asset_url }}" defer></script>
  </body>
</html>
`;
}

function settingsSchema(config: ThemeConfig): string {
  const fontOptions = Object.entries(FONTS).map(([value, font]) => ({ value, label: font.label }));
  return JSON.stringify(
    [
      {
        name: "theme_info",
        theme_name: config.name || "ThemeFold theme",
        theme_version: "1.0.0",
        theme_author: "ThemeFold",
        theme_documentation_url: "https://temply.studio",
        theme_support_url: "https://temply.studio",
      },
      {
        name: "Colors",
        settings: [
          { type: "color", id: "color_background", label: "Background", default: config.palette.background },
          { type: "color", id: "color_surface", label: "Surface", default: config.palette.surface },
          { type: "color", id: "color_text", label: "Text", default: config.palette.text },
          { type: "color", id: "color_muted", label: "Muted text", default: config.palette.muted },
          { type: "color", id: "color_primary", label: "Primary", default: config.palette.primary },
          { type: "color", id: "color_on_primary", label: "Text on primary", default: readableOn(config.palette.primary) },
          { type: "color", id: "color_accent", label: "Accent", default: config.palette.accent },
          { type: "color", id: "color_border", label: "Border", default: config.palette.border },
        ],
      },
      {
        name: "Typography",
        settings: [
          { type: "select", id: "heading_font", label: "Heading font", default: config.typography.heading, options: fontOptions },
          { type: "select", id: "body_font", label: "Body font", default: config.typography.body, options: fontOptions },
          { type: "range", id: "base_size", label: "Base font size", min: 14, max: 22, step: 1, unit: "px", default: Math.round(config.typography.baseSize) },
          { type: "range", id: "heading_scale", label: "Heading scale", min: 1, max: 1.6, step: 0.01, default: config.typography.scale },
          { type: "select", id: "heading_weight", label: "Heading weight", default: String(config.typography.headingWeight), options: ["400", "500", "600", "700", "800"].map((v) => ({ value: v, label: v })) },
          { type: "range", id: "heading_tracking", label: "Letter spacing", min: -0.06, max: 0.08, step: 0.005, unit: "em", default: config.typography.tracking },
          { type: "checkbox", id: "uppercase_headings", label: "Uppercase headings", default: config.typography.uppercaseHeadings },
        ],
      },
      {
        name: "Shape",
        settings: [
          { type: "range", id: "radius", label: "Corner radius", min: 0, max: 40, step: 1, unit: "px", default: Math.min(40, config.shape.radius) },
          { type: "range", id: "button_radius", label: "Button radius", min: 0, max: 50, step: 1, unit: "px", default: Math.min(50, config.shape.buttonRadius) },
          { type: "range", id: "border_width", label: "Border width", min: 0, max: 4, step: 1, unit: "px", default: config.shape.borderWidth },
          { type: "range", id: "shadow", label: "Shadow", min: 0, max: 40, step: 2, default: config.shape.shadow },
        ],
      },
      {
        name: "Layout",
        settings: [
          { type: "range", id: "page_width", label: "Page width", min: 960, max: 1600, step: 20, unit: "px", default: config.layout.maxWidth },
          { type: "range", id: "section_spacing", label: "Section spacing", min: 32, max: 160, step: 4, unit: "px", default: config.layout.sectionSpacing },
          { type: "range", id: "grid_gap", label: "Grid gap", min: 8, max: 48, step: 2, unit: "px", default: config.layout.gridGap },
          { type: "checkbox", id: "animations", label: "Animations", default: config.motion.enabled },
        ],
      },
      {
        name: "Branding",
        settings: [
          { type: "image_picker", id: "favicon", label: "Favicon" },
          { type: "text", id: "default_title", label: "Standardtitel (SEO)", default: config.seo.title },
          { type: "textarea", id: "default_meta_description", label: "Standardbeskrivning (SEO)", default: config.seo.description },
        ],
      },
      {
        name: "Shopify-teman",
        settings: [
          { type: "checkbox", id: "use_shopify_fonts", label: "Använd Shopifys typsnitt", default: false },
          { type: "font_picker", id: "heading_shopify_font", label: "Shopify-rubriktypsnitt", default: "assistant_n4" },
          { type: "font_picker", id: "body_shopify_font", label: "Shopify-brödtypsnitt", default: "assistant_n4" },
          { type: "range", id: "card_radius", label: "Kortradie", min: 0, max: 48, step: 1, unit: "px", default: config.tokens.cardRadius },
          { type: "range", id: "image_radius", label: "Bildradie", min: 0, max: 64, step: 1, unit: "px", default: config.tokens.imageRadius },
          { type: "range", id: "input_radius", label: "Inputradie", min: 0, max: 32, step: 1, unit: "px", default: config.tokens.inputRadius },
        ],
      },
      {
        name: "Konvertering",
        settings: [
          { type: "checkbox", id: "sticky_atc", label: "Sticky add-to-cart", default: config.conversion.stickyAtc },
          { type: "checkbox", id: "dynamic_checkout", label: "Köp nu / dynamic checkout", default: config.conversion.dynamicCheckout },
          { type: "checkbox", id: "free_shipping_bar", label: "Fri frakt-bar", default: config.conversion.freeShippingBar },
          { type: "range", id: "free_shipping_threshold", label: "Fri frakt över", min: 0, max: 3000, step: 50, default: config.conversion.freeShippingThreshold },
          { type: "checkbox", id: "trust_badges", label: "Trygghetsmärken", default: config.conversion.trustBadges },
          { type: "textarea", id: "trust_text", label: "Trygghetstext", default: "Fri frakt · 30 dagars retur · Säker betalning" },
          { type: "checkbox", id: "recently_viewed", label: "Nyligen visade", default: config.conversion.recentlyViewed },
          { type: "checkbox", id: "complete_the_look", label: "Complete the look", default: config.conversion.completeTheLook },
          { type: "checkbox", id: "size_guide", label: "Storleksguide", default: config.conversion.sizeGuide },
          { type: "checkbox", id: "product_video", label: "Produktvideo", default: config.media.productVideo.length > 0 },
          { type: "checkbox", id: "exit_intent", label: "Exit intent-popup", default: config.conversion.exitIntent },
          { type: "checkbox", id: "gdpr_consent", label: "GDPR-samtycke i popup", default: config.conversion.gdprConsent },
          { type: "text", id: "gdpr_text", label: "GDPR-text", default: "Jag godkänner att ThemeFold-butiken sparar min e-post för nyhetsbrev." },
          { type: "text", id: "popup_title", label: "Popup-rubrik", default: "Innan du går" },
          { type: "text", id: "popup_text", label: "Popup-text", default: "Få 10 % på ditt första köp." },
          { type: "text", id: "popup_cta", label: "Popup-knapp", default: "Skicka" },
          { type: "select", id: "ab_test", label: "A/B-test", default: config.conversion.abTest, options: ["off", "hero", "cta", "layout", "colors"].map((value) => ({ value, label: value })) },
          { type: "text", id: "ab_headline", label: "Variant B-rubrik", default: config.conversion.abHeadline },
          { type: "text", id: "ab_cta", label: "Variant B-CTA", default: config.conversion.abCta },
        ],
      },
      {
        name: "Appar & integrationer",
        settings: [
          { type: "checkbox", id: "klaviyo", label: "Klaviyo", default: config.integrations.klaviyo },
          { type: "text", id: "klaviyo_company_id", label: "Klaviyo company id", default: config.integrations.klaviyoCompanyId },
          { type: "select", id: "reviews_app", label: "Recensioner", default: config.integrations.reviews, options: ["none", "shopify", "judgeme", "loox"].map((value) => ({ value, label: value })) },
          { type: "text", id: "reviews_id", label: "Recensions-app-id", default: config.integrations.reviewsShopId },
          { type: "checkbox", id: "app_blocks", label: "App blocks & app embeds", default: config.integrations.appBlocks },
          { type: "checkbox", id: "search_filters", label: "Search & Discovery-filter", default: config.integrations.searchDiscovery },
          { type: "checkbox", id: "show_markets", label: "Shopify Markets (språk & valuta)", default: config.integrations.markets },
          ...integrationSchemaSettings(config),
        ],
      },
    ],
    null,
    2,
  );
}

function settingsData(config: ThemeConfig): string {
  const current = {
    color_background: config.palette.background,
    color_surface: config.palette.surface,
    color_text: config.palette.text,
    color_muted: config.palette.muted,
    color_primary: config.palette.primary,
    color_on_primary: readableOn(config.palette.primary),
    color_accent: config.palette.accent,
    color_border: config.palette.border,
    heading_font: config.typography.heading,
    body_font: config.typography.body,
    base_size: Math.round(config.typography.baseSize),
    heading_scale: config.typography.scale,
    heading_weight: String(config.typography.headingWeight),
    heading_tracking: config.typography.tracking,
    uppercase_headings: config.typography.uppercaseHeadings,
    radius: Math.min(40, config.shape.radius),
    button_radius: Math.min(50, config.shape.buttonRadius),
    border_width: config.shape.borderWidth,
    shadow: config.shape.shadow,
    page_width: config.layout.maxWidth,
    section_spacing: config.layout.sectionSpacing,
    grid_gap: config.layout.gridGap,
    animations: config.motion.enabled,
    default_title: config.seo.title,
    default_meta_description: config.seo.description,
    use_shopify_fonts: false,
    heading_shopify_font: "assistant_n4",
    body_shopify_font: "assistant_n4",
    card_radius: config.tokens.cardRadius,
    image_radius: config.tokens.imageRadius,
    input_radius: config.tokens.inputRadius,
    sticky_atc: config.conversion.stickyAtc,
    dynamic_checkout: config.conversion.dynamicCheckout,
    free_shipping_bar: config.conversion.freeShippingBar,
    free_shipping_threshold: config.conversion.freeShippingThreshold,
    trust_badges: config.conversion.trustBadges,
    trust_text: "Fri frakt · 30 dagars retur · Säker betalning",
    recently_viewed: config.conversion.recentlyViewed,
    complete_the_look: config.conversion.completeTheLook,
    size_guide: config.conversion.sizeGuide,
    product_video: config.media.productVideo.length > 0,
    exit_intent: config.conversion.exitIntent,
    gdpr_consent: config.conversion.gdprConsent,
    gdpr_text: "Jag godkänner att butiken sparar min e-post för nyhetsbrev.",
    popup_title: "Innan du går",
    popup_text: "Få 10 % på ditt första köp.",
    popup_cta: "Skicka",
    ab_test: config.conversion.abTest,
    ab_headline: config.conversion.abHeadline,
    ab_cta: config.conversion.abCta,
    klaviyo: config.integrations.klaviyo,
    klaviyo_company_id: config.integrations.klaviyoCompanyId,
    reviews_app: config.integrations.reviews,
    reviews_id: config.integrations.reviewsShopId,
    app_blocks: config.integrations.appBlocks,
    search_filters: config.integrations.searchDiscovery,
    show_markets: config.integrations.markets,
    ...integrationSettingsData(config),
  };
  return JSON.stringify({ current, presets: { Default: current } }, null, 2);
}

type BlockEntry = { type: string; settings: Record<string, unknown> };

/**
 * Layoutmotorns inställningar följer med varje gridsektion, så att en ändrad
 * kolumnsiffra i studion också blir en ändrad kolumnsiffra i Shopify.
 */
function gridSettings(section: Section): Record<string, unknown> {
  return {
    columns: section.columns ?? 4,
    ratio: section.ratio ?? "portrait",
    gap: Math.round((section.gap ?? 1) * 100),
    span: section.span ?? "even",
  };
}

function sectionTemplate(section: Section): { settings: Record<string, unknown>; blocks?: Record<string, BlockEntry>; block_order?: string[] } {
  switch (section.type) {
    case "hero":
      return {
        settings: {
          eyebrow: section.eyebrow,
          title: section.title,
          subtitle: section.subtitle,
          cta_label: section.ctaLabel,
          cta_url: "/collections/all",
          secondary_label: section.secondaryLabel,
          secondary_url: "/pages/about",
          layout: section.layout,
          align: section.align,
          show_image: section.showImage,
          placeholder_caption: section.title,
        },
      };
    case "productGrid":
      return {
        settings: {
          title: section.title,
          subtitle: section.subtitle,
          style: section.style,
          columns: section.columns,
          limit: Math.max(section.columns, configLimit(section.columns)),
          show_price: section.showPrice,
          show_rating: section.showRating,
          align: "left",
          cta_label: section.collectionLabel ? "Visa alla" : "",
          variant: section.variant ?? "grid",
          ...gridSettings(section),
        },
      };
    case "features": {
      const blocks: Record<string, BlockEntry> = {};
      const order: string[] = [];
      section.items.forEach((item, index) => {
        const id = `feature_${index + 1}`;
        order.push(id);
        blocks[id] = { type: "feature", settings: { icon: exportIconName(item.icon), title: item.title, text: item.text } };
      });
      return { settings: { title: section.title, subtitle: section.subtitle, align: "center" }, blocks, block_order: order };
    }
    case "imageText":
      return { settings: { title: section.title, text: `<p>${esc(section.text)}</p>`, cta_label: section.ctaLabel, cta_url: "/pages/about", image_side: section.imageSide } };
    case "testimonials": {
      const blocks: Record<string, BlockEntry> = {};
      const order: string[] = [];
      section.items.forEach((item, index) => {
        const id = `quote_${index + 1}`;
        order.push(id);
        blocks[id] = { type: "testimonial", settings: { quote: item.quote, author: item.author, role: item.role, rating: item.rating } };
      });
      return { settings: { title: section.title }, blocks, block_order: order };
    }
    case "marquee":
      return { settings: { text: section.text, speed: section.speed, style: section.style } };
    case "faq": {
      const blocks: Record<string, BlockEntry> = {};
      const order: string[] = [];
      section.items.forEach((item, index) => {
        const id = `question_${index + 1}`;
        order.push(id);
        blocks[id] = { type: "question", settings: { question: item.q, answer: `<p>${esc(item.a)}</p>` } };
      });
      return { settings: { title: section.title }, blocks, block_order: order };
    }
    case "newsletter":
      return { settings: { title: section.title, text: section.text, cta_label: section.ctaLabel } };
    case "ugc": {
      const blocks: Record<string, BlockEntry> = {};
      const order: string[] = [];
      section.items.forEach((item, index) => {
        const id = `photo_${index + 1}`;
        order.push(id);
        blocks[id] = { type: "photo", settings: { caption: item.caption, author: `${item.author} ${item.handle}` } };
      });
      return { settings: { title: section.title, subtitle: section.subtitle, handle: "" }, blocks, block_order: order };
    }
    case "trust": {
      const blocks: Record<string, BlockEntry> = {};
      const order: string[] = [];
      section.badges.forEach((badge, index) => {
        const id = `badge_${index + 1}`;
        order.push(id);
        blocks[id] = { type: "badge", settings: { icon: exportIconName(badge.icon), title: badge.title, text: badge.text } };
      });
      return { settings: { title: section.title, shipping: section.shipping, returns: section.returns }, blocks, block_order: order };
    }
    case "bundle": {
      const blocks: Record<string, BlockEntry> = {};
      const order: string[] = [];
      section.tiers.forEach((tier, index) => {
        const id = `tier_${index + 1}`;
        order.push(id);
        blocks[id] = { type: "tier", settings: { quantity: tier.quantity, discount: tier.discount, label: tier.label } };
      });
      return { settings: { title: section.title, subtitle: section.subtitle, note: "" }, blocks, block_order: order };
    }
    case "sizeGuide": {
      const blocks: Record<string, BlockEntry> = {};
      const order: string[] = [];
      section.rows.forEach((row, index) => {
        const id = `row_${index + 1}`;
        order.push(id);
        blocks[id] = { type: "row", settings: { size: row.size, chest: row.chest, length: row.length, sleeve: row.sleeve } };
      });
      return { settings: { title: section.title, note: section.note }, blocks, block_order: order };
    }
    case "countdown":
      return {
        settings: {
          eyebrow: section.eyebrow,
          title: section.title,
          text: section.text,
          ends_at: section.endsAt,
          cta_label: section.ctaLabel,
          style: section.style,
        },
      };
    case "collection": {
      const blocks: Record<string, BlockEntry> = {};
      const order: string[] = [];
      section.tiles.forEach((tile, index) => {
        const id = `tile_${index + 1}`;
        order.push(id);
        blocks[id] = { type: "tile", settings: { title: tile.title, count: tile.count } };
      });
      return { settings: { title: section.title, subtitle: section.subtitle, layout: section.layout }, blocks, block_order: order };
    }
    case "comparison": {
      const blocks: Record<string, BlockEntry> = {};
      const order: string[] = [];
      section.plans.forEach((plan, index) => {
        const id = `plan_${index + 1}`;
        order.push(id);
        blocks[id] = { type: "plan", settings: { title: plan.title, price: plan.price, highlight: plan.highlight } };
      });
      section.rows.forEach((row, index) => {
        const id = `row_${index + 1}`;
        order.push(id);
        blocks[id] = {
          type: "row",
          settings: { label: row.label, value_1: row.values[0] ?? "", value_2: row.values[1] ?? "", value_3: row.values[2] ?? "", value_4: row.values[3] ?? "" },
        };
      });
      return { settings: { title: section.title, subtitle: section.subtitle, note: section.note, variant: section.variant ?? "table", ...gridSettings(section) }, blocks, block_order: order };
    }
    case "lookbook": {
      const blocks: Record<string, BlockEntry> = {};
      const order: string[] = [];
      section.items.forEach((item, index) => {
        const id = `photo_${index + 1}`;
        order.push(id);
        blocks[id] = { type: "photo", settings: { caption: item.caption, tag: item.tag } };
      });
      return { settings: { title: section.title, subtitle: section.subtitle, ...gridSettings(section) }, blocks, block_order: order };
    }
    case "completeTheLook": {
      const blocks: Record<string, BlockEntry> = {};
      const order: string[] = [];
      section.items.forEach((item, index) => {
        const id = `item_${index + 1}`;
        order.push(id);
        blocks[id] = { type: "item", settings: { name: item.name, price: item.price } };
      });
      return {
        settings: { title: section.title, subtitle: section.subtitle, hero_title: section.hero, total: section.total, cta_label: section.ctaLabel, variant: section.variant ?? "bundle", ...gridSettings(section) },
        blocks,
        block_order: order,
      };
    }
    case "story": {
      const blocks: Record<string, BlockEntry> = {};
      const order: string[] = [];
      section.steps.forEach((step, index) => {
        const id = `step_${index + 1}`;
        order.push(id);
        blocks[id] = { type: "step", settings: { title: step.title, text: step.text } };
      });
      return { settings: { title: section.title, text: `<p>${esc(section.text)}</p>`, image_side: section.imageSide, ...gridSettings(section) }, blocks, block_order: order };
    }
  }
}

function configLimit(columns: number): number {
  return columns === 4 ? 8 : columns === 2 ? 6 : 9;
}

function indexTemplate(config: ThemeConfig): string {
  const sections: Record<string, unknown> = {};
  const order: string[] = [];
  config.sections
    .filter((section) => section.visible)
    .forEach((section, index) => {
      const file = SECTION_FILES[section.type];
      // Okända typer (t.ex. från en framtida version) hoppas över i stället för
      // att krascha hela exporten.
      if (!file) {
        console.warn(`export: okänd sektionstyp "${section.type}" hoppas över`);
        return;
      }
      const key = `${file.file}-${index + 1}`;
      const data = sectionTemplate(section);
      sections[key] = { type: file.file, settings: data.settings, ...(data.blocks ? { blocks: data.blocks, block_order: data.block_order } : {}) };
      order.push(key);
      if (section.type === "hero" && isIntegrationLive(config.integrations.blocks?.campaign)) {
        const campaignKey = "campaign-band-1";
        sections[campaignKey] = { type: "campaign-band", settings: {} };
        order.push(campaignKey);
      }
    });
  return JSON.stringify({ sections, order }, null, 2);
}

function simpleTemplate(type: string, schema = true): string {
  return JSON.stringify({ sections: { main: { type, ...(schema ? {} : {}) } }, order: ["main"] }, null, 2);
}

/** En Advanced-yta ovanför den funktionella mallen, t.ex. produktformuläret. */
function stackTemplate(advancedType: string, mainType: string): string {
  return JSON.stringify(
    { sections: { advanced: { type: advancedType }, main: { type: mainType } }, order: ["advanced", "main"] },
    null,
    2,
  );
}

function productCardSnippet(): string {
  return `{%- comment -%} Product card used across grids {%- endcomment -%}
<a class="card" href="{{ product.url }}" aria-label="{{ product.title | escape }}">
  <div class="card__media">
    {%- if product.featured_image -%}
      {{ product.featured_image | image_url: width: 800 | image_tag: loading: 'lazy', class: 'card__image', alt: product.title | escape }}
    {%- else -%}
      <div class="card__placeholder"></div>
    {%- endif -%}
    {%- if product.available == false -%}
      <span class="card__badge">Slutsåld</span>
    {%- elsif badge != blank -%}
      <span class="card__badge">{{ badge | escape }}</span>
    {%- endif -%}
  </div>
  <div class="card__info">
    <h3 class="card__title">{{ product.title | escape }}</h3>
    {%- if show_price -%}
      <p class="card__price">
        {{ product.price | money }}
        {%- if product.compare_at_price > product.price -%}<s>{{ product.compare_at_price | money }}</s>{%- endif -%}
      </p>
    {%- endif -%}
    {%- if show_rating and product.metafields.reviews.rating.value != blank -%}
      <p class="card__rating">{% render 'icon', name: 'star', size: 14 %} {{ product.metafields.reviews.rating.value }}</p>
    {%- endif -%}
  </div>
</a>
`;
}

/**
 * Ikon-snippet för temat. Samma Lucide-former som i ThemeFolds gränssnitt, så
 * linjetjocklek och rundade hörn följer med ut i butiken.
 */
function iconSnippet(): string {
  const branches = EXPORT_ICON_NAMES.map((name) => `  {%- when '${name}' -%}\n    ${EXPORT_ICON_PATHS[name]}`).join("\n");
  return `{%- assign icon_size = size | default: 18 -%}
{%- assign icon_stroke = stroke | default: 1.75 -%}
<svg xmlns="http://www.w3.org/2000/svg" width="{{ icon_size }}" height="{{ icon_size }}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="{{ icon_stroke }}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
{%- case name -%}
${branches}
  {%- else -%}
    ${EXPORT_ICON_PATHS.star}
{%- endcase -%}
</svg>`;
}

function themeJs(): string {
  return `document.documentElement.classList.add('js');
(function () {
  var body = document.body;

  // A/B-test: varje besökare får en stabil variant via localStorage.
  var ab = body.getAttribute('data-ab');
  if (ab && ab !== 'off') {
    var variant = null;
    try { variant = window.localStorage.getItem('temply-ab'); } catch (error) {}
    if (!variant) {
      variant = Math.random() < 0.5 ? 'a' : 'b';
      try { window.localStorage.setItem('temply-ab', variant); } catch (error) {}
    }
    body.setAttribute('data-ab-variant', variant);
    if (variant === 'b') {
      var headline = body.getAttribute('data-ab-headline');
      var cta = body.getAttribute('data-ab-cta');
      if (ab === 'hero' && headline) {
        var title = document.querySelector('[data-hero-title]');
        if (title) title.textContent = headline;
      }
      if ((ab === 'cta' || ab === 'hero') && cta) {
        var button = document.querySelector('[data-hero-cta]');
        if (button) button.textContent = cta;
      }
      if (ab === 'layout') body.classList.add('ab-layout-b');
      if (ab === 'colors') body.classList.add('ab-colors-b');
    }
  }

  // Nedräkning: tickar lokalt mot kampanjens sluttid.
  document.querySelectorAll('[data-countdown]').forEach(function (timer) {
    var end = new Date(timer.getAttribute('data-countdown')).getTime();
    if (!end) return;
    var units = {
      days: timer.querySelector('[data-unit="days"]'),
      hours: timer.querySelector('[data-unit="hours"]'),
      minutes: timer.querySelector('[data-unit="minutes"]'),
      seconds: timer.querySelector('[data-unit="seconds"]')
    };
    var pad = function (value) { return String(value).padStart(2, '0'); };
    var tick = function () {
      var left = Math.max(0, end - Date.now());
      if (units.days) units.days.textContent = pad(Math.floor(left / 86400000));
      if (units.hours) units.hours.textContent = pad(Math.floor((left % 86400000) / 3600000));
      if (units.minutes) units.minutes.textContent = pad(Math.floor((left % 3600000) / 60000));
      if (units.seconds) units.seconds.textContent = pad(Math.floor((left % 60000) / 1000));
      if (left <= 0 && timer._interval) { clearInterval(timer._interval); timer._interval = null; }
    };
    tick();
    timer._interval = setInterval(tick, 1000);
  });

  // Fri frakt-bar uppdateras mot kundkorgen.
  document.querySelectorAll('[data-shipbar]').forEach(function (bar) {
    var threshold = parseInt(bar.getAttribute('data-threshold'), 10);
    if (!threshold) return;
    fetch('/cart.js', { headers: { Accept: 'application/json' } })
      .then(function (response) { return response.json(); })
      .then(function (cart) {
        var progress = Math.min(100, Math.round((cart.total_price / threshold) * 100));
        var fill = bar.querySelector('[data-shipbar-progress]');
        if (fill) fill.style.width = progress + '%';
        var label = bar.querySelector('[data-shipbar-text]');
        if (label) {
          var rest = threshold - cart.total_price;
          label.textContent = rest <= 0 ? label.getAttribute('data-done') || label.textContent.replace(/om.*/, 'uppnådd') : label.textContent;
        }
      })
      .catch(function () {});
  });

  // Sticky add-to-cart visas när köpknappen scrollat ur bild.
  var sticky = document.querySelector('[data-sticky-atc]');
  if (sticky) {
    var trigger = document.querySelector('.product__form button[type="submit"]');
    var onScroll = function () {
      if (!trigger) { sticky.hidden = false; return; }
      var rect = trigger.getBoundingClientRect();
      sticky.hidden = rect.bottom > 0 && rect.top < window.innerHeight;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Exit intent-popup med GDPR-samtycke.
  var popup = document.querySelector('[data-exit-popup]');
  if (popup) {
    var seen = false;
    try { seen = window.localStorage.getItem('temply-exit-intent') === '1'; } catch (error) {}
    var open = function () {
      if (seen) return;
      popup.hidden = false;
      seen = true;
      try { window.localStorage.setItem('temply-exit-intent', '1'); } catch (error) {}
    };
    document.addEventListener('mouseout', function (event) {
      if (event.clientY <= 0 && !event.relatedTarget) open();
    });
    var close = popup.querySelector('[data-popup-close]');
    if (close) close.addEventListener('click', function () { popup.hidden = true; });
  }

  // Nyligen visade produkter sparas lokalt och renderas utan extra anrop.
  var recentBox = document.querySelector('[data-recently-viewed]');
  var productData = document.querySelector('[data-product-id]');
  var storageKey = 'temply-recently-viewed';
  var readRecent = function () {
    try { return JSON.parse(window.localStorage.getItem(storageKey) || '[]'); } catch (error) { return []; }
  };
  if (productData) {
    var item = {
      title: productData.getAttribute('data-product-title'),
      url: productData.getAttribute('data-product-url'),
      price: productData.getAttribute('data-product-price'),
      handle: productData.getAttribute('data-product-handle')
    };
    var list = readRecent().filter(function (entry) { return entry.handle !== item.handle; });
    list.unshift(item);
    try { window.localStorage.setItem(storageKey, JSON.stringify(list.slice(0, 8))); } catch (error) {}
  }
  if (recentBox) {
    var currentHandle = productData ? productData.getAttribute('data-product-handle') : null;
    var entries = readRecent().filter(function (entry) { return entry.handle !== currentHandle; }).slice(0, 4);
    var target = recentBox.querySelector('[data-recently-viewed-list]');
    if (entries.length && target) {
      target.innerHTML = entries.map(function (entry) {
        return '<a class="card" href="' + entry.url + '"><div class="card__info"><h3 class="card__title">' + entry.title + '</h3><p class="card__price">' + entry.price + '</p></div></a>';
      }).join('');
      recentBox.hidden = false;
    }
  }
})();
(function () {
  var items = document.querySelectorAll('.reveal');
  var animate = document.body.getAttribute('data-animate') !== 'false';
  if (!animate || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    items.forEach(function (el) { el.classList.add('is-visible'); });
    return;
  }
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
  items.forEach(function (el) { observer.observe(el); });
})();
`;
}

const LOCALES: Record<string, unknown> = {
  "en.default": { general: { search: "Search", cart: "Cart" }, accessibility: { skip_to_content: "Skip to content" } },
  sv: { general: { search: "Sök", cart: "Varukorg" }, accessibility: { skip_to_content: "Hoppa till innehåll" } },
  nb: { general: { search: "Søk", cart: "Handlekurv" }, accessibility: { skip_to_content: "Hopp til innhold" } },
  fi: { general: { search: "Haku", cart: "Ostoskori" }, accessibility: { skip_to_content: "Siirry sisältöön" } },
  da: { general: { search: "Søg", cart: "Kurv" }, accessibility: { skip_to_content: "Gå til indhold" } },
  fr: { general: { search: "Rechercher", cart: "Panier" }, accessibility: { skip_to_content: "Aller au contenu" } },
  de: { general: { search: "Suchen", cart: "Warenkorb" }, accessibility: { skip_to_content: "Zum Inhalt springen" } },
  es: { general: { search: "Buscar", cart: "Carrito" }, accessibility: { skip_to_content: "Ir al contenido" } },
};

export type ThemeExportOptions = {
  /** Låst ThemeFold-credit. Slås på för provperioden, aldrig för betalande. */
  credit?: boolean;
};

export function buildThemeFiles(config: ThemeConfig, options: ThemeExportOptions = {}): Record<string, string> {
  const files: Record<string, string> = {
    "layout/theme.liquid": themeLayout(config, Boolean(options.credit)),
    "assets/theme.css": THEME_CSS,
    "assets/theme.js": themeJs(),
    "config/settings_schema.json": settingsSchema(config),
    "config/settings_data.json": settingsData(config),
    "sections/header.liquid": headerSection(config),
    "sections/footer.liquid": footerSection(config),
    "sections/main-product.liquid": mainProductSection(),
    "sections/main-collection.liquid": mainCollectionSection(),
    "sections/main-cart.liquid": mainCartSection(),
    "sections/main-page.liquid": mainPageSection(),
    "sections/main-404.liquid": main404Section(),
    "sections/main-search.liquid": mainSearchSection(),
    "sections/main-list-collections.liquid": mainListCollectionsSection(),
    "snippets/product-card.liquid": productCardSnippet(),
    "snippets/icon.liquid": iconSnippet(),
    "snippets/sticky-atc.liquid": stickyAtcSnippet(),
    "snippets/recently-viewed.liquid": recentlyViewedSnippet(),
    "snippets/reviews.liquid": reviewsSnippet(),
    "snippets/size-guide.liquid": sizeGuideSnippet(),
    "snippets/free-shipping-bar.liquid": freeShippingBarSnippet(),
    "snippets/exit-intent.liquid": exitIntentSnippet(),
    "snippets/app-embed.liquid": appEmbedSnippet(),
    "snippets/markets.liquid": marketsSnippet(),
    "snippets/mega-menu.liquid": megaSnippet(config),
    "snippets/market-switcher.liquid": marketSwitcherSnippet(),
    "sections/main-about.liquid": aboutSection(),
    "sections/main-contact.liquid": contactSection(),
    "templates/page.about.json": simpleTemplate("main-about"),
    "templates/page.contact.json": simpleTemplate("main-contact"),
    "templates/index.json": indexTemplate(config),
    "templates/product.json": simpleTemplate("main-product"),
    "templates/collection.json": simpleTemplate("main-collection"),
    "templates/cart.json": simpleTemplate("main-cart"),
    "templates/page.json": simpleTemplate("main-page"),
    "templates/404.json": simpleTemplate("main-404"),
    "templates/search.json": simpleTemplate("main-search"),
    "templates/list-collections.json": simpleTemplate("main-list-collections"),
  };

  // Advanced är ett val, men fritt placerade element på startsidan får aldrig
  // tappas när användaren växlar till temastyrt. Sektionsnoder synkas först så
  // att rubriker och knappar är samma innehåll som i temastyra läget.
  const homeBefore = canvasForPage(config, "home");
  const homeFreeform = homeBefore.nodes.some((node) => node.type !== "connector" && !node.sectionId);
  if (homeFreeform) config = syncThemeToAdvanced(config);
  const chromeCanvas = canvasForChrome(config);
  if (canvasHasContent(chromeCanvas)) {
    files["sections/advanced-chrome.liquid"] = advancedChromeSection(chromeCanvas, config);
  }
  if (config.builder?.mode === "advanced") {
    const headerCanvas = canvasForHeader(config);
    const footerCanvas = canvasForFooter(config);
    if (canvasHasContent(headerCanvas)) files["sections/advanced-header.liquid"] = advancedHeaderSection(headerCanvas, config);
    if (canvasHasContent(footerCanvas)) files["sections/advanced-footer.liquid"] = advancedFooterSection(footerCanvas, config);
  }

  const homeCanvas = canvasForPage(config, "home");
  const advanced = homeCanvas.nodes.length > 0 && (config.builder?.mode === "advanced" || homeFreeform) && canvasHasContent(homeCanvas);
  if (advanced) {
    files["sections/advanced-canvas.liquid"] = advancedSection(homeCanvas, config);
    files["templates/index.json"] = simpleTemplate("advanced-canvas");
  }

  // Advanced-ytor för undersidor läggs ovanför den funktionella mallen, så
  // produktformulär, kontaktformulär och varukorg fortsätter att fungera.
  const advancedPages: { page: "product" | "collection" | "search" | "about" | "contact" | "cart" | "404"; file: string; template: string; main: string; label: string }[] = [
    { page: "product", file: "advanced-product", template: "templates/product.json", main: "main-product", label: "Advanced product" },
    { page: "collection", file: "advanced-collection", template: "templates/collection.json", main: "main-collection", label: "Advanced collection" },
    { page: "search", file: "advanced-search", template: "templates/search.json", main: "main-search", label: "Advanced search" },
    { page: "about", file: "advanced-about", template: "templates/page.about.json", main: "main-about", label: "Advanced about" },
    { page: "contact", file: "advanced-contact", template: "templates/page.contact.json", main: "main-contact", label: "Advanced contact" },
    { page: "cart", file: "advanced-cart", template: "templates/cart.json", main: "main-cart", label: "Advanced cart" },
    { page: "404", file: "advanced-404", template: "templates/404.json", main: "main-404", label: "Advanced 404" },
  ];
  for (const entry of advancedPages) {
    const canvas = canvasForPage(config, entry.page);
    if (!canvasHasContent(canvas)) continue;
    files[`sections/${entry.file}.liquid`] = advancedSection(canvas, config, entry.label);
    files[entry.template] = canvas.replaceDefault
      ? simpleTemplate(entry.file)
      : stackTemplate(entry.file, entry.main);
  }

  for (const entry of Object.values(SECTION_FILES)) {
    files[`sections/${entry.file}.liquid`] = entry.build(config);
  }

  Object.assign(files, integrationSnippets());
  if (isIntegrationLive(config.integrations.blocks?.campaign)) {
    files["sections/campaign-band.liquid"] = campaignSection(config);
  }

  for (const [locale, values] of Object.entries(LOCALES)) {
    files[`locales/${locale}.json`] = JSON.stringify(values, null, 2);
  }

  // Statisk sektion i layouten: den syns i editorn men kan inte raderas där.
  // Filen läggs aldrig i templates/JSON, så den går inte att ta bort som block.
  if (options.credit) {
    files[`sections/${CREDIT_SECTION}.liquid`] = creditSection();
  }

  return files;
}

export function buildThemeZip(config: ThemeConfig, options: ThemeExportOptions = {}): Buffer {
  return createZip(buildThemeFiles(config, options));
}
