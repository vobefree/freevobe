import type { BrandKit, BrandTone, Palette, StylePresetId, ThemeConfig } from "@/lib/theme/types";
import { STYLE_PRESETS, styleFromText } from "./styles";

export const DEFAULT_BRAND: BrandKit = {
  source: "manual",
  sourceLabel: "",
  styleId: "nordicMinimal",
  tone: "calm",
  logoUrl: "",
  logoMark: "",
  logoVariantMark: "",
  colors: ["#C2542D", "#1F4A3D", "#E9B44C"],
  updatedAt: "",
  dna: null,
};

const HEX = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g;

export function normalizeHex(value: string): string | null {
  const raw = value.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw.split("").map((c) => c + c).join("").toUpperCase()}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toUpperCase()}`;
  return null;
}

export function extractHexes(input: string, limit = 24): string[] {
  const found = input.match(HEX) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of found) {
    const hex = normalizeHex(raw);
    if (!hex || seen.has(hex)) continue;
    seen.add(hex);
    out.push(hex);
    if (out.length >= limit) break;
  }
  return out;
}

export function parsePaletteText(input: string): string[] {
  return input
    .split(/[\s,;|]+/)
    .map((part) => normalizeHex(part))
    .filter((hex): hex is string => Boolean(hex));
}

type Rgb = { r: number; g: number; b: number };

function toRgb(hex: string): Rgb {
  const full = hex.replace("#", "");
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function toHex({ r, g, b }: Rgb): string {
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
  return `#${[r, g, b].map((value) => clamp(value).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

export function luminance(hex: string): number {
  const { r, g, b } = toRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function saturation(hex: string): number {
  const { r, g, b } = toRgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

export function mix(a: string, b: string, amount: number): string {
  const left = toRgb(a);
  const right = toRgb(b);
  return toHex({
    r: left.r + (right.r - left.r) * amount,
    g: left.g + (right.g - left.g) * amount,
    b: left.b + (right.b - left.b) * amount,
  });
}

export function lighten(hex: string, amount: number): string {
  return mix(hex, "#FFFFFF", amount);
}

export function darken(hex: string, amount: number): string {
  return mix(hex, "#000000", amount);
}

/** Plockar ut en användbar palett ur valfria färger (logotyp, webbplats, klistrad lista). */
export function paletteFromColors(colors: string[], base?: Partial<Palette>): Palette {
  const list = colors.map((color) => normalizeHex(color)).filter((hex): hex is string => Boolean(hex));
  // Ljusast möjliga yta blir bakgrund – en mättad accent ska inte bli hela sidan.
  const light = list.filter((hex) => luminance(hex) > 0.72).sort((a, b) => luminance(b) - luminance(a));
  const dark = list.filter((hex) => luminance(hex) < 0.3);
  const usable = list.filter((hex) => luminance(hex) > 0.08 && luminance(hex) < 0.86);
  const chromatic = usable.filter((hex) => saturation(hex) > 0.14);
  const vivid = [...(chromatic.length ? chromatic : usable)].sort(
    (a, b) => saturation(b) * 0.7 + (1 - Math.abs(luminance(b) - 0.4)) * 0.3 - (saturation(a) * 0.7 + (1 - Math.abs(luminance(a) - 0.4)) * 0.3),
  );
  // En butik utan färg (bara gråskala) får sin mörkaste ton som primärfärg,
  // aldrig en nästan vit – då blir knapparna oläsbara.
  const primary = vivid[0] ?? dark[0] ?? usable[0] ?? "#1F4A3D";
  const accentSource = vivid.find((hex) => hex !== primary) ?? (chromatic.length ? chromatic[0] : dark.find((hex) => hex !== primary)) ?? mix(primary, "#E9B44C", 0.55);
  const background = light[0] ?? (dark.length >= 2 ? dark[0] : "#F7F4EF");
  const isDark = luminance(background) < 0.5;
  return {
    background,
    surface: isDark ? lighten(background, 0.06) : "#FFFFFF",
    text: isDark ? "#F6F3EC" : dark[0] ?? "#191813",
    muted: isDark ? mix(background, "#FFFFFF", 0.55) : mix(dark[0] ?? "#191813", background, 0.48),
    primary,
    accent: accentSource,
    border: isDark ? lighten(background, 0.12) : darken(background, 0.08),
    ...base,
  };
}

export function toneFromPalette(palette: Palette): BrandTone {
  const l = luminance(palette.background);
  const s = saturation(palette.primary);
  if (l < 0.28) return s > 0.6 ? "bold" : "premium";
  if (s > 0.66) return "playful";
  if (s < 0.34) return "calm";
  return l > 0.86 ? "warm" : "calm";
}

export type BrandAnalysis = {
  palette: Palette;
  tone: BrandTone;
  styleId: StylePresetId;
  title: string;
  ogImage: string;
  fonts: string[];
  colors: string[];
};

/** Tolkar rå HTML från en webbplats (färger, typsnitt, rubrik, og:bild). */
export function analyzeHtml(html: string, sourceLabel: string): BrandAnalysis {
  const colors = extractHexes(html, 40);
  const hexWithoutWhites = colors.filter((hex) => !["#FFFFFF", "#000000"].includes(hex));
  const palette = paletteFromColors(hexWithoutWhites.length ? hexWithoutWhites : colors);
  const title = (html.match(/<title[^>]*>([^<]{3,120})<\/title>/i)?.[1] ?? "").trim();
  const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? "";
  const fonts = [...new Set([...html.matchAll(/font-family:\s*([^;"'}]+)/gi)].map((match) => match[1].trim().replace(/["']/g, "")))].slice(0, 6);
  const styleId = styleFromText(`${title} ${sourceLabel} ${fonts.join(" ")}`) ?? "nordicMinimal";
  return { palette, tone: toneFromPalette(palette), styleId, title, ogImage, fonts, colors };
}

/** Applicerar varumärket på temat: palett, typsnitt, form, tokens och logotyp. */
export function applyBrand(
  config: ThemeConfig,
  input: { palette?: Palette; styleId?: StylePresetId; tone?: BrandTone; logoUrl?: string; logoMark?: string; source?: BrandKit["source"]; sourceLabel?: string; colors?: string[] },
): ThemeConfig {
  const styleId = input.styleId ?? config.brand.styleId;
  const preset = STYLE_PRESETS[styleId] ?? STYLE_PRESETS.nordicMinimal;
  const palette = input.palette ?? preset.palette;
  const tone = input.tone ?? preset.tone;
  const brand: BrandKit = {
    source: input.source ?? config.brand.source,
    sourceLabel: input.sourceLabel ?? config.brand.sourceLabel,
    styleId,
    tone,
    logoUrl: input.logoUrl ?? config.brand.logoUrl,
    logoMark: input.logoMark ?? config.brand.logoMark ?? "",
    logoVariantMark: config.brand.logoVariantMark ?? "",
    colors: input.colors ?? config.brand.colors,
    updatedAt: new Date().toISOString(),
    dna: config.brand.dna ?? null,
  };
  const keepTypography = !input.styleId;
  return {
    ...config,
    brand,
    palette,
    typography: keepTypography ? config.typography : { ...preset.typography },
    shape: keepTypography ? config.shape : { ...preset.shape },
    tokens: keepTypography ? config.tokens : { ...preset.tokens },
    layout: { ...config.layout, density: preset.density, sectionSpacing: preset.density === "airy" ? 120 : preset.density === "compact" ? 56 : 88 },
    media: { ...config.media, logo: input.logoUrl ?? config.media.logo },
    header: { ...config.header, logoText: input.logoMark ?? config.header.logoText },
    sections: config.sections.map((section) => {
      if (section.type === "hero" && !keepTypography) return { ...section, layout: preset.hero, align: preset.hero === "center" ? "center" : "left" };
      if (section.type === "productGrid" && !keepTypography) return { ...section, style: preset.productStyle };
      return section;
    }),
  };
}

/** Genererar favicon, logotypvariant och OG-bild som SVG från varumärket. */
export function brandAssets(config: ThemeConfig, localeLabel = "ThemeFold"): { favicon: string; logo: string; og: string } {
  const { palette, brand, shop } = config;
  const mark = (brand.logoMark || shop.name || "T").trim().charAt(0).toUpperCase();
  const name = (brand.logoMark || shop.name || localeLabel).slice(0, 28);
  const onPrimary = luminance(palette.primary) > 0.62 ? "#14140F" : "#FFFFFF";
  const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${palette.primary}"/><text x="32" y="43" font-family="Manrope, Inter, sans-serif" font-size="34" font-weight="700" text-anchor="middle" fill="${onPrimary}">${escapeXml(mark)}</text></svg>`;
  const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 120"><rect width="480" height="120" fill="${palette.background}"/><rect x="24" y="30" width="60" height="60" rx="${Math.round(config.tokens.roundness * 0.16)}" fill="${palette.primary}"/><text x="54" y="72" font-family="Manrope, Inter, sans-serif" font-size="30" font-weight="700" text-anchor="middle" fill="${onPrimary}">${escapeXml(mark)}</text><text x="104" y="72" font-family="Manrope, Inter, sans-serif" font-size="30" font-weight="600" fill="${palette.text}">${escapeXml(name)}</text></svg>`;
  const og = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette.accent}"/><stop offset="1" stop-color="${palette.primary}"/></linearGradient></defs><rect width="1200" height="630" fill="${palette.background}"/><rect x="60" y="60" width="1080" height="510" rx="${Math.round(config.tokens.roundness * 0.4)}" fill="url(#g)" opacity="0.92"/><text x="120" y="330" font-family="Manrope, Inter, sans-serif" font-size="64" font-weight="700" fill="#FFFFFF">${escapeXml(name)}</text><text x="120" y="400" font-family="Inter, sans-serif" font-size="30" fill="#FFFFFF" opacity="0.9">${escapeXml((config.shop.tagline || "").slice(0, 70))}</text></svg>`;
  return { favicon, logo, og };
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
