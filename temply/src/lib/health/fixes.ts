import { emptySection } from "@/lib/theme/presets";
import type { Section, ThemeConfig } from "@/lib/theme/types";

/**
 * Deterministiska snabbfixar för de health-issues som går att lösa i temat.
 * AI:n föreslår; fixarna ser till att förslagen faktiskt landar i konfigurationen.
 */

function hasSection(config: ThemeConfig, type: Section["type"]): boolean {
  return config.sections.some((section) => section.type === type);
}

function addSection(config: ThemeConfig, type: Section["type"], before?: Section["type"]): ThemeConfig {
  if (hasSection(config, type)) return config;
  const section = emptySection(type);
  const index = before ? config.sections.findIndex((item) => item.type === before) : -1;
  const sections = [...config.sections];
  sections.splice(index >= 0 ? index : sections.length, 0, section);
  return { ...config, sections };
}

/** Mörkar en färg tills kontrasten mot bakgrunden når målet. */
function darkenUntil(hex: string, background: string, target: number): string {
  const parse = (value: string) => {
    const clean = value.replace("#", "");
    const full = clean.length === 3 ? clean.split("").map((char) => char + char).join("") : clean;
    if (!/^[0-9a-f]{6}$/i.test(full)) return null;
    return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
  };
  const toHex = (rgb: number[]) => `#${rgb.map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, "0")).join("")}`;
  const lum = (rgb: number[]) => {
    const [r, g, b] = rgb.map((channel) => {
      const value = channel / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a: number[], b: number[]) => {
    const [light, dark] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (light + 0.05) / (dark + 0.05);
  };

  const bg = parse(background);
  let color = parse(hex);
  if (!bg || !color) return hex;
  if (ratio(color, bg) >= target) return hex;
  for (let step = 0; step < 40; step += 1) {
    color = color.map((channel) => channel * 0.9);
    if (ratio(color, bg) >= target) return toHex(color);
  }
  return "#1b1b1b";
}

function seoTitle(config: ThemeConfig): string {
  const base = `${config.shop.name} – ${config.shop.tagline}`.replace(/\s+/g, " ").trim();
  const suffix = " | Fri frakt & snabb leverans";
  return (base.length >= 30 ? base : `${base}${suffix}`).slice(0, 60).trim();
}

function seoDescription(config: ThemeConfig): string {
  const product = config.shop.products[0]?.name ?? "utvalt sortiment";
  const text = `${config.shop.name} säljer ${product.toLowerCase()} och mer. Handplockat sortiment, trygg betalning och leverans inom 1–3 dagar. Fri frakt över ${config.conversion.freeShippingThreshold} kr.`;
  return text.length > 155 ? `${text.slice(0, 152).trim()}…` : text;
}

export function applyHealthFixes(config: ThemeConfig, issueIds: string[]): { config: ThemeConfig; applied: string[] } {
  let next = config;
  const applied: string[] = [];
  const ids = new Set(issueIds);

  if (ids.has("seo.title-missing") || ids.has("seo.title-short") || ids.has("seo.title-long")) {
    next = { ...next, seo: { ...next.seo, title: seoTitle(next) } };
    applied.push("seo.title");
  }
  if (ids.has("seo.description-missing") || ids.has("seo.description-short") || ids.has("seo.description-long")) {
    next = { ...next, seo: { ...next.seo, description: seoDescription(next) } };
    applied.push("seo.description");
  }
  if (ids.has("seo.no-h1")) {
    next = { ...next, sections: next.sections.map((section) => (section.type === "hero" ? { ...section, visible: true } : section)) };
    applied.push("seo.hero");
  }
  if (ids.has("seo.alt-text")) {
    // Alt-texter sätts i exporten från sektionens innehåll; här säkras att
    // produkter och hero har beskrivande innehåll att falla tillbaka på.
    next = {
      ...next,
      shop: {
        ...next.shop,
        products: next.shop.products.map((product) => ({
          ...product,
          description: product.description ?? `${product.name} från ${next.shop.name}.`,
        })),
      },
    };
    applied.push("seo.alt");
  }
  if (ids.has("mobile.small-text")) {
    next = { ...next, typography: { ...next.typography, baseSize: 16 } };
    applied.push("mobile.base-size");
  }
  if (ids.has("a11y.contrast-text")) {
    next = { ...next, palette: { ...next.palette, text: darkenUntil(next.palette.text, next.palette.background, 4.6) } };
    applied.push("a11y.text-contrast");
  }
  if (ids.has("a11y.contrast-muted")) {
    next = { ...next, palette: { ...next.palette, muted: darkenUntil(next.palette.muted, next.palette.background, 4.6) } };
    applied.push("a11y.muted-contrast");
  }
  if (ids.has("links.duplicates")) {
    const seen = new Set<string>();
    const links = next.header.links.filter((label) => {
      const key = label.trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    next = { ...next, header: { ...next.header, links } };
    applied.push("links.dedupe");
  }
  if (ids.has("links.footer-empty")) {
    next = {
      ...next,
      footer: {
        ...next.footer,
        columns: next.footer.columns.map((column, index) =>
          column.links.length > 0
            ? column
            : {
                ...column,
                links: index === 0 ? ["Kundservice", "Frakt & leverans", "Retur"] : ["Om oss", "Villkor", "Kontakt"],
              },
        ),
      },
    };
    applied.push("links.footer");
  }
  if (ids.has("conversion.reviews")) {
    next = addSection(next, "testimonials", "newsletter");
    if (!hasSection(next, "testimonials")) {
      next = { ...next, integrations: { ...next.integrations, reviews: next.integrations.reviews === "none" ? "shopify" : next.integrations.reviews } };
    }
    applied.push("conversion.reviews");
  }
  if (ids.has("conversion.trust")) {
    next = { ...next, conversion: { ...next.conversion, trustBadges: true } };
    next = addSection(next, "trust", "newsletter");
    applied.push("conversion.trust");
  }
  if (ids.has("conversion.newsletter")) {
    next = addSection(next, "newsletter");
    applied.push("conversion.newsletter");
  }
  if (ids.has("conversion.sticky-atc")) {
    next = { ...next, conversion: { ...next.conversion, stickyAtc: true } };
    applied.push("conversion.sticky");
  }
  if (ids.has("conversion.free-shipping")) {
    next = { ...next, conversion: { ...next.conversion, freeShippingBar: true } };
    applied.push("conversion.free-shipping");
  }
  if (ids.has("conversion.search")) {
    next = { ...next, header: { ...next.header, showSearch: true } };
    applied.push("conversion.search");
  }
  if (ids.has("conversion.urgency")) {
    next = addSection(next, "countdown", "productGrid");
    applied.push("conversion.urgency");
  }

  return { config: next, applied };
}
