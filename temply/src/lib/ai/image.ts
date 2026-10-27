import type { DnaImagery, Palette } from "@/lib/theme/types";
import { mix, luminance } from "@/lib/brand/kit";

export type ImageKind = "hero" | "banner" | "lifestyle" | "product";

export type GeneratedImage = { url: string; source: "ai" | "local"; kind: ImageKind };

const SIZES: Record<ImageKind, { width: number; height: number; api: string }> = {
  hero: { width: 1200, height: 1500, api: "1024x1536" },
  banner: { width: 1600, height: 720, api: "1536x1024" },
  lifestyle: { width: 1200, height: 900, api: "1536x1024" },
  product: { width: 1000, height: 1250, api: "1024x1536" },
};

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function seeded(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * Offline-fallback: genererar en deterministisk kampanjbild i varumärkets färger.
 * Samma prompt + palett ger samma bild, så förhandsvisningen är stabil.
 */
export function localArtwork(prompt: string, palette: Palette, kind: ImageKind): string {
  const size = SIZES[kind];
  const random = seeded(hash(`${prompt}|${palette.primary}|${palette.accent}|${kind}`));
  const w = size.width;
  const h = size.height;
  const dark = luminance(palette.primary) < 0.55;
  const base = dark ? mix(palette.primary, "#000000", 0.55) : mix(palette.accent, palette.background, 0.55);
  const colors = [palette.primary, palette.accent, mix(palette.primary, palette.accent, 0.5), mix(palette.background, palette.primary, 0.35)];
  const blobs: string[] = [];
  for (let i = 0; i < 5; i++) {
    const cx = Math.round(random() * w);
    const cy = Math.round(random() * h);
    const r = Math.round((0.18 + random() * 0.42) * Math.min(w, h));
    const fill = colors[i % colors.length];
    const opacity = (0.22 + random() * 0.4).toFixed(2);
    blobs.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" opacity="${opacity}"/>`);
  }
  const stripeY = Math.round(h * (0.55 + random() * 0.2));
  const grain = Array.from({ length: 120 }, () => {
    const x = Math.round(random() * w);
    const y = Math.round(random() * h);
    const r = (0.5 + random() * 1.6).toFixed(1);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${dark ? "#FFFFFF" : "#000000"}" opacity="0.08"/>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${base}"/>
      <stop offset="1" stop-color="${mix(base, palette.background, 0.45)}"/>
    </linearGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="${Math.round(Math.min(w, h) * 0.03)}"/></filter>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <g filter="url(#soft)">${blobs.join("")}</g>
  <rect x="0" y="${stripeY}" width="${w}" height="${Math.round(h * 0.06)}" fill="${palette.background}" opacity="0.16"/>
  <rect x="${Math.round(w * 0.08)}" y="${Math.round(h * 0.08)}" width="${Math.round(w * 0.84)}" height="${Math.round(h * 0.84)}" fill="none" stroke="${dark ? "#FFFFFF" : "#14140F"}" stroke-opacity="0.22" rx="${Math.round(Math.min(w, h) * 0.04)}"/>
  ${grain}
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const STYLE_PROMPTS: Record<DnaImagery["style"], string> = {
  photography: "editorial product and lifestyle photography, soft natural light",
  illustration: "flat vector illustration with clean shapes and a limited palette",
  "3d": "soft 3D render with matte materials and gentle studio light",
  mixed: "mixed photography and graphic shapes, editorial collage feel",
};

/**
 * Bilder skapas alltid lokalt. Googles bildmodeller (Nano Banana) kräver
 * betald fakturering och får därför aldrig anropas – gratiskravet gäller hela
 * systemet. Bildspråket i Brand DNA styr fortfarande motivet i prompten.
 */
export async function generateImage(input: { prompt: string; palette: Palette; kind: ImageKind; imagery?: DnaImagery | null }): Promise<GeneratedImage> {
  const style = input.imagery
    ? `${STYLE_PROMPTS[input.imagery.style]}${input.imagery.productPhotos && input.kind === "product" ? ", packshot on a plain background" : ""}${input.imagery.lifestyle ? ", natural lifestyle setting" : ""}${input.imagery.keywords.length ? `, motifs: ${input.imagery.keywords.slice(0, 5).join(", ")}` : ""}`
    : "editorial e-commerce photography, soft natural light";
  return { url: localArtwork(`${input.prompt}. ${style}`, input.palette, input.kind), source: "local", kind: input.kind };
}
