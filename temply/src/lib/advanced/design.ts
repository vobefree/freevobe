import type {
  AdvancedCanvas,
  AdvancedNode,
  AdvancedPage,
  DesignTokens,
  FontKey,
  ThemeConfig,
  Typography,
} from "@/lib/theme/types";
import { applyTokens } from "@/lib/theme/tokens";
import { darken, luminance, mix } from "@/lib/brand/kit";
import {
  canvasForChrome,
  canvasForFooter,
  canvasForHeader,
  canvasForPage,
  colorFor,
  growCanvasToFit,
  withChromeCanvas,
  withFooterCanvas,
  withHeaderCanvas,
  withPageCanvas,
} from "./canvas";

/**
 * Designagenten för den fria canvasen.
 *
 * En instruktion som "gör sidan mer premium" är inte innehåll – den ska ändra
 * typografi, luft, radier och färgton. Den här modulen tolkar instruktionen och
 * räknar fram ett DesignPlan som klienten applicerar på canvasen. Den skriver
 * aldrig in användarens mening som text på ytan.
 *
 * Motorn är medvetet deterministisk: samma instruktion ger samma resultat, den
 * kräver ingen API-nyckel och den kan köras både i route-handlern och i
 * webbläsaren.
 */

export type DesignMood =
  | "premium"
  | "modern"
  | "minimal"
  | "warm"
  | "bold"
  | "playful"
  | "editorial"
  | "tech"
  | "airy"
  | "compact"
  | "dark";

export type DesignScope = "canvas" | "selection";

export type DesignPlan = {
  moods: DesignMood[];
  scope: DesignScope;
};

export type DesignTarget = AdvancedPage | "chrome" | "header" | "footer";

type HeadingStyle = {
  font?: FontKey;
  weight?: number;
  letterSpacing?: number;
  lineHeight?: number;
  scale?: number;
  transform?: "none" | "uppercase";
};

type BodyStyle = HeadingStyle;

type Recipe = {
  tokens?: Partial<DesignTokens>;
  typography?: Partial<Typography>;
  heading?: HeadingStyle;
  body?: BodyStyle;
  button?: { radius?: number; weight?: number; letterSpacing?: number; transform?: "none" | "uppercase" };
  section?: { radius?: number; scale?: number };
  image?: { radius?: number };
  /** Multiplicerar höjden och alla y-positioner – mer luft utan att röra layouten. */
  spacing?: number;
  dark?: boolean;
};

/* ------------------------------------------------------------------ */
/* Tolkning av prompten                                                */
/* ------------------------------------------------------------------ */

const MOOD_WORDS: Record<DesignMood, RegExp> = {
  premium:
    /\b(premium|lyx(ig|igare)?|exklusiv(are)?|påkostad(e)?|paokostad(e)?|elegant(are)?|sofistikerad(e)?|raffinerad(e)?|high[\s-]?end|luxury|luxe|classy|dyr(are)?)\b/i,
  modern: /\b(modern(are)?|samtida|contemporary|clean|fräsch(are)?|fraesch(are)?|fresh|nutida|up[\s-]?to[\s-]?date)\b/i,
  minimal: /\b(minimal(istisk)?|enkel|enkelt|avskalad(e)?|ren|rent|stilren|scandi(navian)?|skandinavisk)\b/i,
  warm: /\b(varm(are)?|warm(er)?|omtänksam|omtanksam|mjuk(are)?|cozy|mysig(are)?|jordnära|jordnara)\b/i,
  bold: /\b(djärv(are)?|djarv(are)?|bold(er)?|kraftfull(are)?|stark(are)?|tuff(are)?|striking|high[\s-]?impact)\b/i,
  playful: /\b(lekfull(are)?|playful|färgglad(a)?|fargglad(a)?|rolig(are)?|colorful|youthful|ungdomlig)\b/i,
  editorial: /\b(editorial|redaktionell|magasin|magazine|tidningskänsla|modemagasin)\b/i,
  tech: /\b(tekni(sk|skare)?|tech(y)?|futuristisk|futuristic|digital(are)?|saas|startup)\b/i,
  airy: /\b(luftig(are)?|luft|luftigt|mer plats|mer luft|andning|whitespace|white[\s-]?space|rymlig(are)?|airy|spacious|mindre trångt)\b/i,
  compact: /\b(kompakt(are)?|tät(are)?|tat(are)?|tight(are)?|mindre luft|condensed)\b/i,
  dark: /\b(mörk(are)?|mork(are)?|dark(er)?|natt|night|svart(are)?|black)\b/i,
};

/** Ord som beskriver innehåll – då ska prompten skriva copy, inte bygga om stilen. */
const CONTENT_WORDS =
  /\b(hero|kampanj(er)?|campaign|rubrik(er)?|heading|headline|text(er)?|copy|slogan|knapp(ar)?|button|cta|banner|nyhetsbrev|newsletter|produkt(er)?|product(s)?|recension(er)?|review(s)?|testimonial|omdöme(n)?|omdome(n)?|erbjudande(n)?|offer|fri frakt|free shipping|black friday|rea|sale|jul|christmas|sommar|summer|kollektion(er)?|collection)\b/i;

/** Verb som skapar nytt innehåll. */
const CREATE_VERBS = /\b(skapa|skapar|bygg|bygger|gör en|gor en|gör ett|gor ett|skriv|skriver|add|create|write|make (a|an|me)|lägg till|lagg till)\b/i;

/** Verb som ändrar något som redan finns. */
const EDIT_VERBS = /\b(gör|gor|ser|se ut|ska se|vill att|byt|byta|ändra|andra|uppdatera|snygga till|fräscha upp|frascha upp|modernisera|styla|style|make|look|feel|känns|kanns|känsla|kansla)\b/i;

/** Designord som inte är en specifik stil men ändå en stilinstruktion. */
const GENERIC_DESIGN =
  /\b(design(en)?|stil(en)?|stilrent|snygg(are|t)?|snyggt|look(en)?|känsla(n)?|kansla(n)?|typografi(n)?|typsnitt(en)?|font(en)?|teckensnitt|färg(er|erna)?|farg(er|erna)?|kontrast(en)?|layout(en)?|proportioner|harmoni(sk)?)\b/i;

export type PromptIntent =
  | { kind: "design"; moods: DesignMood[] }
  | { kind: "copy" }
  | { kind: "unclear" };

/** Plockar ut alla stilar som nämns, i den ordning de står i prompten. */
export function designMoods(prompt: string): DesignMood[] {
  const text = prompt.normalize("NFC");
  // "Black Friday" är en kampanj, inte en mörk design.
  const withoutCampaign = text.replace(/black[\s-]?friday/gi, " ");
  const found = (Object.keys(MOOD_WORDS) as DesignMood[]).filter((mood) => MOOD_WORDS[mood].test(withoutCampaign));
  return found;
}

/**
 * Avgör om prompten är en stilinstruktion eller en innehållsbeställning.
 * Ordningen är viktig: en tydlig skapandefras ("skapa en hero…") vinner över
 * ett allmänt designord som "snygg", medan "gör sidan mer premium" alltid blir
 * en stiländring.
 */
export function readPromptIntent(prompt: string): PromptIntent {
  const text = prompt.trim();
  if (!text) return { kind: "unclear" };
  const moods = designMoods(text);
  const wantsNewContent = CREATE_VERBS.test(text) && CONTENT_WORDS.test(text);
  if (wantsNewContent && !/\b(mer|mindre|more|less)\b/i.test(text)) return { kind: "copy" };
  if (moods.length) return { kind: "design", moods };
  if (CONTENT_WORDS.test(text)) return { kind: "copy" };
  if (EDIT_VERBS.test(text) && GENERIC_DESIGN.test(text)) return { kind: "design", moods: ["premium"] };
  if (GENERIC_DESIGN.test(text)) return { kind: "design", moods: ["premium"] };
  if (EDIT_VERBS.test(text)) return { kind: "unclear" };
  return { kind: "copy" };
}

/**
 * Tre varianter runt en instruktion: den bokstavliga tolkningen och två
 * närliggande stilar. Användaren väljer innan något skrivs till projektet.
 */
const NEIGHBOURS: Record<DesignMood, DesignMood[]> = {
  premium: ["editorial", "dark"],
  modern: ["minimal", "tech"],
  minimal: ["modern", "editorial"],
  warm: ["playful", "premium"],
  bold: ["tech", "playful"],
  playful: ["warm", "bold"],
  editorial: ["premium", "minimal"],
  tech: ["modern", "bold"],
  airy: ["minimal", "premium"],
  compact: ["bold", "tech"],
  dark: ["premium", "tech"],
};

export function designVariants(moods: DesignMood[]): DesignMood[][] {
  const base: DesignMood[] = moods.length ? moods : ["premium"];
  const options: DesignMood[][] = [base];
  for (const neighbour of NEIGHBOURS[base[0]] ?? []) {
    if (base.includes(neighbour)) continue;
    // Grannen läggs sist: mörkt läge ska aldrig skriva över en ljus stil.
    const next = [...base, neighbour];
    if (!options.some((option) => option.join("|") === next.join("|"))) options.push(next);
  }
  // Fyller alltid upp till tre kort, även om prompten skulle nämna många stilar.
  const fallbacks: DesignMood[] = ["modern", "bold", "warm", "minimal", "editorial", "tech", "playful", "airy", "compact", "premium", "dark"];
  for (const fallback of fallbacks) {
    if (options.length >= 3) break;
    if (!base.includes(fallback)) options.push([...base, fallback]);
  }
  return options.slice(0, 3);
}

/** En markering styr om stilen läggs på elementet eller hela ytan. */
export function designScope(prompt: string, hasSelection: boolean): DesignScope {
  // "sidan"/"temat" betyder hela ytan även om ett element råkade vara markerat.
  if (/\b(hela|whole|entire|allt|all|everything|sidan|sajten|sajt|temat|page|site|theme)\b/i.test(prompt)) return "canvas";
  if (/\b(den (här|har)|denna|det (här|har)|this|that|elementet|sektionen)\b/i.test(prompt) && hasSelection) return "selection";
  return hasSelection ? "selection" : "canvas";
}

/* ------------------------------------------------------------------ */
/* Recept                                                              */
/* ------------------------------------------------------------------ */

const MOODS: Record<DesignMood, Recipe> = {
  premium: {
    tokens: { roundness: 8, shadowLevel: 14, spaceScale: 1.16, typeScale: 1.02, buttonStyle: "outline" },
    typography: { heading: "playfair", body: "archivo", headingWeight: 500, tracking: 0.005, uppercaseHeadings: false },
    heading: { font: "playfair", weight: 500, letterSpacing: 0.005, lineHeight: 1.1, scale: 0.98 },
    body: { font: "archivo", scale: 0.97, lineHeight: 1.7, letterSpacing: 0.002 },
    button: { radius: 2, weight: 600, letterSpacing: 0.14, transform: "uppercase" },
    section: { radius: 2, scale: 0.98 },
    image: { radius: 3 },
    spacing: 1.06,
  },
  modern: {
    tokens: { roundness: 46, shadowLevel: 34, spaceScale: 1.08, typeScale: 1.02, buttonStyle: "solid" },
    typography: { heading: "manrope", body: "inter", headingWeight: 600, tracking: -0.012, uppercaseHeadings: false },
    heading: { font: "manrope", weight: 600, letterSpacing: -0.012, lineHeight: 1.12, scale: 1.04 },
    body: { font: "inter", scale: 1, lineHeight: 1.6 },
    button: { radius: 999, weight: 600, letterSpacing: 0.01, transform: "none" },
    section: { radius: 20, scale: 1 },
    image: { radius: 22 },
    spacing: 1.02,
  },
  minimal: {
    tokens: { roundness: 4, shadowLevel: 0, spaceScale: 1.22, typeScale: 0.98, buttonStyle: "outline" },
    typography: { heading: "inter", body: "inter", headingWeight: 500, tracking: -0.02, uppercaseHeadings: false },
    heading: { font: "inter", weight: 500, letterSpacing: -0.02, lineHeight: 1.15, scale: 0.96 },
    body: { font: "inter", scale: 0.95, lineHeight: 1.75 },
    button: { radius: 0, weight: 600, letterSpacing: 0.1, transform: "uppercase" },
    section: { radius: 0, scale: 0.96 },
    image: { radius: 0 },
    spacing: 1.08,
  },
  warm: {
    tokens: { roundness: 52, shadowLevel: 40, spaceScale: 1.12, typeScale: 1.02, buttonStyle: "solid" },
    typography: { heading: "fraunces", body: "dm", headingWeight: 500, tracking: 0, uppercaseHeadings: false },
    heading: { font: "fraunces", weight: 500, letterSpacing: 0, lineHeight: 1.16, scale: 1.02 },
    body: { font: "dm", scale: 1, lineHeight: 1.65 },
    button: { radius: 18, weight: 600, letterSpacing: 0.01, transform: "none" },
    section: { radius: 22, scale: 1 },
    image: { radius: 26 },
    spacing: 1.04,
  },
  bold: {
    tokens: { roundness: 10, shadowLevel: 0, spaceScale: 0.98, typeScale: 1.1, buttonStyle: "solid" },
    typography: { heading: "archivo", body: "inter", headingWeight: 800, tracking: -0.03, uppercaseHeadings: true },
    heading: { font: "archivo", weight: 800, letterSpacing: -0.03, lineHeight: 0.98, scale: 1.14, transform: "uppercase" },
    body: { font: "inter", scale: 1.02, lineHeight: 1.5 },
    button: { radius: 2, weight: 800, letterSpacing: 0.08, transform: "uppercase" },
    section: { radius: 2, scale: 1.02 },
    image: { radius: 2 },
    spacing: 0.98,
  },
  playful: {
    tokens: { roundness: 74, shadowLevel: 62, spaceScale: 1.06, typeScale: 1.04, buttonStyle: "solid" },
    typography: { heading: "sora", body: "manrope", headingWeight: 700, tracking: -0.01, uppercaseHeadings: false },
    heading: { font: "sora", weight: 700, letterSpacing: -0.01, lineHeight: 1.2, scale: 1.06 },
    body: { font: "manrope", scale: 1, lineHeight: 1.55 },
    button: { radius: 999, weight: 700, letterSpacing: 0.02, transform: "none" },
    section: { radius: 30, scale: 1 },
    image: { radius: 34 },
    spacing: 1.03,
  },
  editorial: {
    tokens: { roundness: 2, shadowLevel: 6, spaceScale: 1.24, typeScale: 1.06, buttonStyle: "outline" },
    typography: { heading: "instrument", body: "dm", headingWeight: 400, tracking: 0, uppercaseHeadings: false },
    heading: { font: "instrument", weight: 400, letterSpacing: 0, lineHeight: 1.04, scale: 1.08 },
    body: { font: "dm", scale: 1, lineHeight: 1.72 },
    button: { radius: 0, weight: 500, letterSpacing: 0.06, transform: "uppercase" },
    section: { radius: 0, scale: 1 },
    image: { radius: 0 },
    spacing: 1.1,
  },
  tech: {
    tokens: { roundness: 20, shadowLevel: 30, spaceScale: 1.02, typeScale: 0.98, buttonStyle: "soft" },
    typography: { heading: "space", body: "inter", headingWeight: 600, tracking: 0.02, uppercaseHeadings: true },
    heading: { font: "space", weight: 600, letterSpacing: 0.02, lineHeight: 1.15, scale: 0.98, transform: "uppercase" },
    body: { font: "inter", scale: 0.97, lineHeight: 1.6 },
    button: { radius: 8, weight: 600, letterSpacing: 0.12, transform: "uppercase" },
    section: { radius: 10, scale: 1 },
    image: { radius: 10 },
    spacing: 1.02,
  },
  airy: {
    tokens: { spaceScale: 1.26, shadowLevel: 24 },
    heading: { lineHeight: 1.22 },
    body: { lineHeight: 1.8 },
    spacing: 1.1,
  },
  compact: {
    tokens: { spaceScale: 0.84 },
    heading: { lineHeight: 1 },
    body: { lineHeight: 1.4 },
    spacing: 0.9,
  },
  dark: {
    tokens: { shadowLevel: 46, roundness: 12 },
    typography: { uppercaseHeadings: false },
    heading: { lineHeight: 1.12 },
    body: { lineHeight: 1.65 },
    spacing: 1.02,
    dark: true,
  },
};

function merge(a: Recipe, b: Recipe): Recipe {
  return {
    ...a,
    ...b,
    tokens: { ...a.tokens, ...b.tokens },
    typography: { ...a.typography, ...b.typography },
    heading: { ...a.heading, ...b.heading },
    body: { ...a.body, ...b.body },
    button: { ...a.button, ...b.button },
    section: { ...a.section, ...b.section },
    image: { ...a.image, ...b.image },
    dark: a.dark || b.dark,
  };
}

/* ------------------------------------------------------------------ */
/* Applicering                                                         */
/* ------------------------------------------------------------------ */

function round(value: number): number {
  return Math.max(0, Math.round(value * 10) / 10);
}

function hexLuminance(color: string | undefined): number | null {
  if (!color) return null;
  const raw = color.trim();
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return null;
  const full = raw.length === 4 ? `#${raw.slice(1).split("").map((char) => char + char).join("")}` : raw;
  return luminance(full);
}

function isPageTarget(target: DesignTarget): boolean {
  return target !== "chrome" && target !== "header" && target !== "footer";
}

export function designCanvas(config: ThemeConfig, target: DesignTarget): AdvancedCanvas {
  if (target === "chrome") return canvasForChrome(config);
  if (target === "header") return canvasForHeader(config);
  if (target === "footer") return canvasForFooter(config);
  return canvasForPage(config, target);
}

function writeDesignCanvas(config: ThemeConfig, target: DesignTarget, canvas: AdvancedCanvas): ThemeConfig {
  if (target === "chrome") return withChromeCanvas(config, canvas);
  if (target === "header") return withHeaderCanvas(config, canvas);
  if (target === "footer") return withFooterCanvas(config, canvas);
  return withPageCanvas(config, target, canvas);
}

type DarkPalette = { background: string; card: string; ink: string };

function darkPalette(config: ThemeConfig): DarkPalette {
  const ink = config.palette.text;
  const light = config.palette.background;
  const background = hexLuminance(ink) !== null ? darken(ink, 0.12) : "#14140F";
  const card = hexLuminance(ink) !== null ? mix(background, "#FFFFFF", 0.08) : "#1F1E1A";
  return { background, card, ink: (hexLuminance(light) ?? 1) > 0.55 ? light : "#F6F3EC" };
}

type Factors = { heading: number; body: number; section: number };

function restyleNode(
  node: AdvancedNode,
  recipe: Recipe,
  config: ThemeConfig,
  palette: DarkPalette | null,
  factor: Factors,
): AdvancedNode {
  const patch: Partial<AdvancedNode> = {};
  const h = recipe.heading ?? {};
  const b = recipe.body ?? {};
  const btn = recipe.button ?? {};
  const sec = recipe.section ?? {};
  const img = recipe.image ?? {};

  switch (node.type) {
    case "heading":
      if (h.font) patch.font = h.font;
      if (h.weight) patch.fontWeight = h.weight;
      if (h.letterSpacing !== undefined) patch.letterSpacing = h.letterSpacing;
      if (h.lineHeight !== undefined) patch.lineHeight = h.lineHeight;
      if (h.transform) patch.textTransform = h.transform;
      if (factor.heading !== 1) patch.fontSize = round((node.fontSize ?? 62) * factor.heading);
      break;
    case "text":
      if (b.font) patch.font = b.font;
      if (b.lineHeight !== undefined) patch.lineHeight = b.lineHeight;
      if (b.letterSpacing !== undefined) patch.letterSpacing = b.letterSpacing;
      if (factor.body !== 1) patch.fontSize = round((node.fontSize ?? 24) * factor.body);
      break;
    case "button":
      if (btn.radius !== undefined) patch.radius = btn.radius;
      if (btn.weight) patch.fontWeight = btn.weight;
      if (btn.letterSpacing !== undefined) patch.letterSpacing = btn.letterSpacing;
      if (btn.transform) patch.textTransform = btn.transform;
      if (h.font) patch.font = h.font;
      break;
    case "section":
      if (sec.radius !== undefined) patch.radius = sec.radius;
      if (factor.section !== 1) patch.fontSize = round((node.fontSize ?? 48) * factor.section);
      if (h.font) patch.font = h.font;
      break;
    case "products":
      if (sec.radius !== undefined) patch.radius = sec.radius;
      if (recipe.tokens?.spaceScale) patch.gap = round((node.gap ?? 24) * recipe.tokens.spaceScale);
      break;
    case "product":
    case "image":
    case "shape":
      if (img.radius !== undefined) patch.radius = img.radius;
      break;
    case "logo":
    case "nav":
    case "cart":
    case "search":
      if (h.font) patch.font = h.font;
      if (node.type === "nav" && h.transform) patch.textTransform = h.transform;
      break;
    default:
      break;
  }

  if (palette) {
    // Mörk yta: allt som var mörkt måste bli ljust, annars försvinner texten.
    const resolved = colorFor(node.color, config);
    const lum = hexLuminance(resolved);
    if (!node.color || (lum !== null && lum < 0.5)) patch.color = palette.ink;
    if (node.type === "section") {
      const fill = colorFor(node.fill, config, "surface");
      const fillLum = hexLuminance(fill);
      if (!node.fill || (fillLum !== null && fillLum > 0.55)) patch.fill = palette.card;
    }
    const strokeLum = hexLuminance(colorFor(node.stroke, config, "text"));
    if (node.stroke && strokeLum !== null && strokeLum < 0.5) patch.stroke = palette.ink;
  }

  return { ...node, ...patch };
}

/**
 * Applicerar en designplan på en yta. Ren funktion: samma config + plan ger
 * samma resultat, vilket gör "mer premium" idempotent.
 */
export function applyDesignPlan(
  config: ThemeConfig,
  target: DesignTarget,
  plan: DesignPlan,
  selectionId?: string | null,
): ThemeConfig {
  const moods = plan.moods.filter((mood) => Object.prototype.hasOwnProperty.call(MOODS, mood));
  if (!moods.length) return config;
  const recipe = moods.reduce<Recipe>((acc, mood) => merge(acc, MOODS[mood]), {});
  const canvas = designCanvas(config, target);
  const selection = plan.scope === "selection" ? canvas.nodes.find((node) => node.id === selectionId) ?? null : null;
  // Hittas markeringen inte på den här ytan lämnas allt orört – en stil på ett
  // element får aldrig plötsligt måla om hela sidan.
  if (plan.scope === "selection" && !selection) return config;
  const styleAll = plan.scope === "canvas";
  const palette = recipe.dark ? darkPalette(config) : null;

  // Typsnittsstorlek räknas om från förra greppet, precis som luften. Annars
  // krymper en rubrik varje gång man skriver "mer premium".
  const previousScales = canvas.design?.scales ?? { heading: 1, body: 1, section: 1 };
  const nextScales = {
    heading: recipe.heading?.scale ?? 1,
    body: recipe.body?.scale ?? 1,
    section: recipe.section?.scale ?? 1,
  };
  const factor: Factors = styleAll
    ? {
        heading: (nextScales.heading || 1) / (previousScales.heading || 1),
        body: (nextScales.body || 1) / (previousScales.body || 1),
        section: (nextScales.section || 1) / (previousScales.section || 1),
      }
    : { heading: 1, body: 1, section: 1 };

  const nodes = canvas.nodes.map((node) => {
    if (!styleAll && node.id !== selection?.id) return node;
    // Låsta element är låsta för alla – även för designagenten.
    if (styleAll && node.locked) return node;
    return restyleNode(node, recipe, config, palette, factor);
  });

  // Luften räknas om från föregående grepp i stället för att multipliceras på
  // nytt: samma instruktion två gånger ska ge samma yta.
  const spacing = styleAll && isPageTarget(target) && recipe.spacing ? recipe.spacing : 1;
  const previous = canvas.design?.spacing && canvas.design.spacing > 0 ? canvas.design.spacing : 1;
  const relative = spacing === 1 ? 1 : spacing / previous;
  const placed = relative === 1 ? nodes : nodes.map((node) => ({ ...node, y: round(node.y * relative) }));
  const next = growCanvasToFit({
    ...canvas,
    background: palette ? palette.background : canvas.background,
    height: Math.round(canvas.height * relative),
    ...(styleAll && isPageTarget(target) ? { design: { moods, spacing, scales: nextScales } } : {}),
    nodes: placed,
  });

  // Ett enskilt element ska inte byta hela temats typsnitt och tokens.
  let output = config;
  if (styleAll) {
    if (recipe.tokens && Object.keys(recipe.tokens).length) output = applyTokens(output, recipe.tokens);
    if (recipe.typography && Object.keys(recipe.typography).length) {
      output = { ...output, typography: { ...output.typography, ...recipe.typography } };
    }
  }
  return writeDesignCanvas(output, target, next);
}

