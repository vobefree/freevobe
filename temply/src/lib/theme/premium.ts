import type { Locale, Section, ThemeConfig } from "./types";
import { applyTokens } from "./tokens";
import { darken, lighten, luminance, mix } from "@/lib/brand/kit";

type Rule = { match: RegExp; apply: (config: ThemeConfig) => ThemeConfig };

/** Enkla, förutsägbara regler så att kommandot fungerar utan API-nyckel. */
const RULES: Rule[] = [
  { match: /m(ö|o)rkare|dark/i, apply: (config) => applyTokens(config, { shadowLevel: Math.min(100, config.tokens.shadowLevel + 12) }) },
  { match: /rundare|round/i, apply: (config) => applyTokens(config, { roundness: Math.min(100, config.tokens.roundness + 18) }) },
  { match: /rakare|mindre rund|sharp/i, apply: (config) => applyTokens(config, { roundness: Math.max(0, config.tokens.roundness - 18) }) },
  { match: /mer luft|luftigare|air/i, apply: (config) => applyTokens(config, { spaceScale: Math.min(1.4, config.tokens.spaceScale + 0.1) }) },
  { match: /t(ä|a)tightare|kompakt/i, apply: (config) => applyTokens(config, { spaceScale: Math.max(0.75, config.tokens.spaceScale - 0.1) }) },
  { match: /st(ö|o)rre text|bigger text/i, apply: (config) => applyTokens(config, { typeScale: Math.min(1.2, config.tokens.typeScale + 0.04) }) },
];

function polish(text: string, locale: Locale): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  if (trimmed.endsWith(".") || trimmed.endsWith("!") || trimmed.endsWith("?")) return trimmed;
  return `${trimmed}.`;
}

/**
 * "Gör denna sektion mer premium": mer luft, mjukare kontraster, lägre rundhet,
 * serif-rubriker och en något stramare ton i texten.
 */
export function premiumifySection(config: ThemeConfig, sectionId: string, instruction = "", locale: Locale = "sv"): ThemeConfig {
  let next = applyTokens(config, {
    spaceScale: Math.min(1.35, config.tokens.spaceScale + 0.06),
    shadowLevel: Math.max(0, config.tokens.shadowLevel - 6),
    roundness: Math.max(0, config.tokens.roundness - 6),
  });

  for (const rule of RULES) {
    if (rule.match.test(instruction)) next = rule.apply(next);
  }

  const dark = luminance(next.palette.background) < 0.5;
  next = {
    ...next,
    palette: {
      ...next.palette,
      primary: dark ? lighten(next.palette.primary, 0.08) : darken(next.palette.primary, 0.14),
      accent: mix(next.palette.accent, next.palette.background, 0.22),
      muted: mix(next.palette.muted, next.palette.text, 0.2),
      border: dark ? lighten(next.palette.border, 0.04) : darken(next.palette.border, 0.05),
    },
    typography: {
      ...next.typography,
      tracking: Math.max(-0.04, next.typography.tracking - 0.008),
      headingWeight: Math.min(700, Math.max(400, next.typography.headingWeight - 100)),
    },
    sections: next.sections.map((section) => {
      if (section.id !== sectionId) return section;
      const base: Section = { ...section, width: instruction.match(/bredare|full/i) ? "wide" : "boxed" };
      switch (base.type) {
        case "hero":
          return {
            ...base,
            title: polish(base.title, locale),
            subtitle: base.subtitle ? polish(base.subtitle, locale) : base.subtitle,
            layout: base.layout === "center" ? "overlay" : base.layout,
          };
        case "productGrid":
          return { ...base, columns: base.columns === 4 ? 3 : base.columns, subtitle: base.subtitle ? polish(base.subtitle, locale) : base.subtitle };
        case "features":
          return { ...base, items: base.items.map((item) => ({ ...item, text: polish(item.text, locale) })) };
        case "imageText":
          return { ...base, text: polish(base.text, locale) };
        case "ugc":
          return { ...base, items: base.items.slice(0, 6) };
        default:
          return base;
      }
    }),
  };

  // Sektionen flyttas upp direkt efter hero om den ligger långt ner, så att
  // förbättringen syns där den gör mest nytta.
  return next;
}
