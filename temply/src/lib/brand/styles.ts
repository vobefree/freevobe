import type { BrandTone, DesignTokens, FontKey, Palette, Shape, StylePresetId, Typography } from "@/lib/theme/types";

export type StylePreset = {
  id: StylePresetId;
  tone: BrandTone;
  palette: Palette;
  typography: Typography;
  shape: Shape;
  tokens: DesignTokens;
  hero: "split" | "center" | "overlay";
  productStyle: "cards" | "minimal" | "rounded";
  density: "compact" | "cozy" | "airy";
  keywords: string[];
};

const tokens = (roundness: number, shadowLevel: number, buttonStyle: DesignTokens["buttonStyle"]): DesignTokens => ({
  roundness,
  shadowLevel,
  spaceScale: 1,
  typeScale: 1,
  buttonStyle,
  inputRadius: Math.round(roundness * 0.5),
  imageRadius: Math.round(roundness * 1.4),
  cardRadius: Math.round(roundness * 0.9),
});

export const STYLE_PRESETS: Record<StylePresetId, StylePreset> = {
  premiumSkincare: {
    id: "premiumSkincare",
    tone: "premium",
    palette: {
      background: "#F6F1EA",
      surface: "#FFFDF9",
      text: "#1D1A16",
      muted: "#7C7266",
      primary: "#1F4A3D",
      accent: "#D8C3A0",
      border: "#E6DCCD",
    },
    typography: { heading: "fraunces", body: "dm", baseSize: 16, scale: 1.26, headingWeight: 400, tracking: 0.01, uppercaseHeadings: false },
    shape: { radius: 4, buttonRadius: 999, borderWidth: 1, shadow: 8 },
    tokens: tokens(18, 30, "solid"),
    hero: "split",
    productStyle: "minimal",
    density: "airy",
    keywords: ["skincare", "serum", "hudvård", "kräm", "beauty", "spa", "clean beauty", "elixir"],
  },
  gaming: {
    id: "gaming",
    tone: "technical",
    palette: {
      background: "#0B0B12",
      surface: "#14141F",
      text: "#F1F1FF",
      muted: "#9A9AB8",
      primary: "#7C4DFF",
      accent: "#00E5A0",
      border: "#25253A",
    },
    typography: { heading: "space", body: "inter", baseSize: 16, scale: 1.38, headingWeight: 700, tracking: -0.02, uppercaseHeadings: true },
    shape: { radius: 10, buttonRadius: 6, borderWidth: 1, shadow: 26 },
    tokens: tokens(30, 70, "outline"),
    hero: "center",
    productStyle: "cards",
    density: "compact",
    keywords: ["gaming", "spel", "headset", "rgb", "setup", "keyboard", "esport", "teknik"],
  },
  kidsClothes: {
    id: "kidsClothes",
    tone: "playful",
    palette: {
      background: "#FFF8EF",
      surface: "#FFFFFF",
      text: "#2A2140",
      muted: "#7A6F92",
      primary: "#FF6B4A",
      accent: "#62C9F5",
      border: "#F3E7DB",
    },
    typography: { heading: "sora", body: "manrope", baseSize: 17, scale: 1.3, headingWeight: 700, tracking: -0.01, uppercaseHeadings: false },
    shape: { radius: 22, buttonRadius: 999, borderWidth: 2, shadow: 16 },
    tokens: tokens(72, 45, "soft"),
    hero: "center",
    productStyle: "rounded",
    density: "cozy",
    keywords: ["barn", "barnkläder", "kids", "leksak", "baby", "familj", "mjuk", "färgglad"],
  },
  nordicMinimal: {
    id: "nordicMinimal",
    tone: "calm",
    palette: {
      background: "#F4F4F1",
      surface: "#FFFFFF",
      text: "#151512",
      muted: "#6E6E66",
      primary: "#151512",
      accent: "#C8D6C0",
      border: "#E3E3DC",
    },
    typography: { heading: "manrope", body: "inter", baseSize: 16, scale: 1.22, headingWeight: 600, tracking: -0.02, uppercaseHeadings: false },
    shape: { radius: 6, buttonRadius: 6, borderWidth: 1, shadow: 0 },
    tokens: tokens(14, 8, "solid"),
    hero: "split",
    productStyle: "minimal",
    density: "cozy",
    keywords: ["nordisk", "minimal", "skandinavisk", "mjölk", "inredning", "design", "tidlös"],
  },
  luxury: {
    id: "luxury",
    tone: "premium",
    palette: {
      background: "#0C0C0C",
      surface: "#161615",
      text: "#F5EFE4",
      muted: "#A79C88",
      primary: "#D6BE8C",
      accent: "#9C7C43",
      border: "#2A2926",
    },
    typography: { heading: "playfair", body: "archivo", baseSize: 16, scale: 1.44, headingWeight: 500, tracking: 0.03, uppercaseHeadings: true },
    shape: { radius: 0, buttonRadius: 0, borderWidth: 1, shadow: 0 },
    tokens: tokens(0, 12, "outline"),
    hero: "overlay",
    productStyle: "minimal",
    density: "airy",
    keywords: ["lyx", "exklusiv", "smycken", "jewelry", "klockor", "maison", "premium"],
  },
  streetwear: {
    id: "streetwear",
    tone: "bold",
    palette: {
      background: "#F2F2EE",
      surface: "#FFFFFF",
      text: "#101010",
      muted: "#66665F",
      primary: "#101010",
      accent: "#FF3B1F",
      border: "#DCDCD4",
    },
    typography: { heading: "archivo", body: "inter", baseSize: 16, scale: 1.42, headingWeight: 800, tracking: -0.03, uppercaseHeadings: true },
    shape: { radius: 2, buttonRadius: 2, borderWidth: 2, shadow: 1 },
    tokens: tokens(6, 6, "solid"),
    hero: "overlay",
    productStyle: "cards",
    density: "compact",
    keywords: ["street", "streetwear", "hype", "drop", "skate", "caps", "hoodie", "urban"],
  },
};

export const STYLE_KEYWORDS: { id: StylePresetId; words: string[] }[] = Object.values(STYLE_PRESETS).map((preset) => ({
  id: preset.id,
  words: preset.keywords,
}));

/** Gissar stil utifrån fri text (prompt, butiksbeskrivning, webbplatsrubrik). */
export function styleFromText(text: string): StylePresetId | null {
  const lower = ` ${text.toLowerCase()} `;
  let best: { id: StylePresetId; score: number } | null = null;
  for (const entry of STYLE_KEYWORDS) {
    const score = entry.words.reduce((sum, word) => (lower.includes(word) ? sum + word.length : sum), 0);
    if (score > 0 && (!best || score > best.score)) best = { id: entry.id, score };
  }
  return best?.id ?? null;
}

export function styleHeadingFont(id: StylePresetId): FontKey {
  return STYLE_PRESETS[id].typography.heading;
}
