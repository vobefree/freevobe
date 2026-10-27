/**
 * HTML-tolkning för Brand DNA.
 *
 * Allt här är rena funktioner (ingen nätverksåtkomst) så att samma HTML alltid
 * ger samma analys. Nätverket sköts av crawl.ts och sammansättningen av dna.ts.
 */
import { normalizeHex } from "./kit";

export type JsonLdNode = Record<string, unknown>;

export type ColorHit = { hex: string; weight: number; name: string; button: number };
export type FontHit = { family: string; weight: number; context: "heading" | "body" | "other" };
export type RadiusHit = { value: number; weight: number; context: "button" | "card" | "image" | "global" };
export type ImageHit = { url: string; alt: string; width: number; height: number };
export type LogoHit = { url: string; alt: string; score: number };
export type IconHit = { rel: string; url: string; sizes: string };
export type SocialHit = { platform: string; url: string };
export type ExtractedProduct = {
  name: string;
  price: string;
  image: string;
  url: string;
  category: string;
  description: string;
};

export type PageFacts = {
  url: string;
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  siteName: string;
  themeColor: string;
  lang: string;
  headings: { level: number; text: string }[];
  paragraphs: string[];
  ctas: string[];
  navLabels: string[];
  announcement: string;
  colors: ColorHit[];
  fonts: FontHit[];
  baseSize: number | null;
  headingSize: number | null;
  lineHeight: number | null;
  headingWeight: number | null;
  radii: RadiusHit[];
  shadows: number[];
  sectionPadding: number[];
  gridGap: number[];
  buttonStyles: { solid: number; outline: number; soft: number };
  images: ImageHit[];
  logoCandidates: LogoHit[];
  logoSvg: string;
  icons: IconHit[];
  manifest: string;
  socials: SocialHit[];
  emails: string[];
  phones: string[];
  addresses: string[];
  jsonLd: JsonLdNode[];
  products: ExtractedProduct[];
  newsletter: { title: string; text: string; cta: string; placeholder: string } | null;
  hasShopify: boolean;
  hasFooter: boolean;
  copyright: string;
  text: string;
};

const GENERIC_FONTS = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-sans-serif",
  "ui-serif",
  "-apple-system",
  "blinkmacsystemfont",
  "inherit",
  "initial",
  "unset",
  "revert",
  "arial",
  "helvetica",
  "helvetica neue",
  "times",
  "times new roman",
  "georgia",
  "verdana",
  "tahoma",
  "trebuchet ms",
  "courier",
  "courier new",
  "segoe ui",
  "roboto",
  "noto sans",
  "noto serif",
  "sans",
  "serif",
]);

const SOCIAL_PATTERNS: { platform: string; test: RegExp }[] = [
  { platform: "instagram", test: /instagram\.com/i },
  { platform: "facebook", test: /facebook\.com/i },
  { platform: "tiktok", test: /tiktok\.com/i },
  { platform: "pinterest", test: /pinterest\.[a-z.]+/i },
  { platform: "youtube", test: /youtube\.com|youtu\.be/i },
  { platform: "x", test: /(^|\.)(x|twitter)\.com/i },
  { platform: "linkedin", test: /linkedin\.com/i },
  { platform: "threads", test: /threads\.net/i },
  { platform: "spotify", test: /open\.spotify\.com/i },
];

const CTA_WORDS =
  /(shop|handla|köp|køb|osta|acheter|kaufen|comprar|explore|utforska|upptäck|se alla|view all|see all|add to cart|lägg i varukorg|leg i handlekurv|lisää ostoskoriin|tilføj|subscribe|prenumerera|nyhetsbrev|sign up|book|boka|buchen|réserver|contact|kontakta|read more|läs mer|discover|découvrir|entdecken|descubrir|get started|kom igång)/i;

const CTA_CLASS = /(^|[\s"'-])(btn|button|cta|cta-button|shop-button)([\s"'-]|$)/i;

/** Skip-länkar, cookie-knappar och liknande är inte varumärkets CTA:er. */
const CTA_NOISE = /^(skip to (content|main)|hoppa till (innehåll|huvudinnehåll)|spring til indhold|gå til indhold|siirry sisältöön|zum inhalt|aller au contenu|ir al contenido|close|stäng|accept|acceptera|godkänn|accepter|hyväksy|akzeptieren|accepter accepterar)$/i;

/** Generiska palett- och biblioteksvariabler säger inget om varumärket. */
const GENERIC_VAR =
  /^(tw|swiper|mdc|bootstrap|splide|keen|flickity|aos|radix|chakra|mui|ant|bs|token|slick|photoswipe|--)/i;
// Endast skalor (gray-100, blue-500) och rena grundfärger räknas som generiska:
// en variabel som heter --color-green är ofta varumärkets egen färg.
const GENERIC_PALETTE =
  /^((swiper|tw|mdc|bs)-?)?(color-)?((gray|grey|neutral|slate|zinc|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{1,3}|white|transparent)$/i;
const PROMO_TEXT = /(fri frakt|free shipping|free ground|versandkostenfrei|livraison offerte|env[ií]o gratis|ilmainen toimitus|fri fragt|rabatt|off your first|% off|kampanj|deal|sale ends)/i;

const HEADING_NOISE =
  /^(added to cart|add to cart|lägg i varukorg|varukorg|cart|kundvagn|search|sök|menu|meny|close|stäng|sign in|log in|logga in|sign up|free shipping|fri frakt|shipping|leverans|returns|returer|newsletter|nyhetsbrev|subscribe|prenumerera|cookies?|accept|accept all|loading|error|shop|home|startsida|back|tillbaka)$/i;
const HEADING_NOISE_PART = /added to cart|lägg i varukorg|free shipping|fri frakt|we use cookies|your cart|ditt köp|skip to|subscribe to our|refund policy|privacy policy|terms of service|powered by/i;

/**
 * Butiks-UI som dyker upp som <p>-block: storleksväljare, lagerstatus och
 * prenumerationsrutor. Sådant säger inget om varumärkets röst.
 */
const UI_LEAD =
  /^(also available|available (in|sizes)|other (colou?rs|sizes)|även (finns|tillgänglig|i)|finns även|size guide|storleksguide|storleksguide|select (a )?(size|colou?r|option)|välj (storlek|färg)|choose (a )?(size|colou?r)|add to (bag|cart|basket|wishlist)|lägg (i|till) (varukorg|önskelista)|quick view|snabbtitt|sale price|regular price|ordinarie pris|in stock|i lager|out of stock|slutsåld|pickup|hämta i butik|shipping (calculated|costs?)|beräknas i kassan|fri frakt över|free shipping (on|over)|subscribe to our|sign up for our|prenumerera på vår|we use cookies|den här webbplatsen använder)/i;

/** Kort etikett utan mening, t.ex. "Also available in: Women's Sizes". */
export function isUiSnippet(value: string): boolean {
  if (UI_LEAD.test(value)) return true;
  const opensLikeLabel = /[:：]$/.test(value);
  const sentence = /[.!?]["'”’)]?$/.test(value);
  if (opensLikeLabel && !sentence) return true;
  if (!sentence && value.length < 80 && /[:：]/.test(value)) return true;
  // Footermenyer som hamnat i samma stycke: "Shop + - Men + - Women …".
  if (/\+\s*-/.test(value) && (value.match(/\+/g) ?? []).length >= 2) return true;
  return false;
}

export function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&#x27;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&auml;/gi, "ä")
    .replace(/&ouml;/gi, "ö")
    .replace(/&aring;/gi, "å")
    .replace(/&eacute;/gi, "é")
    .replace(/&egrave;/gi, "è")
    .replace(/&uuml;/gi, "ü")
    .replace(/&oslash;/gi, "ø")
    .replace(/&aelig;/gi, "æ")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      try {
        return String.fromCodePoint(parseInt(hex, 16));
      } catch {
        return " ";
      }
    })
    .replace(/&#(\d+);/g, (_, dec: string) => {
      try {
        return String.fromCodePoint(Number(dec));
      } catch {
        return " ";
      }
    });
}

/**
 * Trasig markup (vanligt i butiksteman med inline-mallar) lämnar attributrester
 * som "class='py-6' data-x>' i texten. De säger inget om varumärket.
 */
const ATTR_LEFTOVER =
  /\b(?:class|id|style|role|href|src|srcset|alt|width|height|loading|rel|type|name|value|target|title|aria-[\w-]+|data-[\w-]+)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+)/gi;

export function cleanText(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, " ").replace(ATTR_LEFTOVER, " ")).replace(/\s+/g, " ").trim();
}

export function bodyText(html: string): string {
  const withoutHidden = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<template[\s\S]*?<\/template>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  return cleanText(withoutHidden);
}

export function absolutize(value: string, base: string): string {
  const raw = decodeEntities(value.trim());
  if (!raw || raw.startsWith("data:") || raw.startsWith("javascript:") || raw.startsWith("#")) return raw.startsWith("data:") ? raw : "";
  try {
    return new URL(raw, base).toString();
  } catch {
    return "";
  }
}

function attr(tag: string, name: string): string {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return decodeEntities(match?.[2] ?? match?.[3] ?? match?.[4] ?? "").trim();
}

function meta(html: string, key: string, value: string): string {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    if (attr(tag, key).toLowerCase() === value.toLowerCase()) return attr(tag, "content");
  }
  return "";
}

function firstSrcset(value: string): string {
  return value.split(",")[0]?.trim().split(/\s+/)[0] ?? "";
}

function px(value: string, base = 16): number | null {
  const clean = value.trim().toLowerCase();
  const match = clean.match(/^(-?\d+(?:\.\d+)?)(px|rem|em|pt|%)?$/);
  if (!match) return null;
  const number = Number(match[1]);
  if (!Number.isFinite(number)) return null;
  switch (match[2]) {
    case "rem":
      return number * 16;
    case "em":
      return number * base;
    case "pt":
      return (number * 96) / 72;
    case "%":
      return number >= 50 ? 999 : null;
    default:
      return number;
  }
}

export function parseColor(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (!value || value === "transparent" || value === "currentcolor" || value === "inherit") return null;
  if (value.startsWith("#")) {
    const hex = value.slice(1);
    if (hex.length === 8) return normalizeHex(hex.slice(0, 6));
    return normalizeHex(hex);
  }
  const rgb = value.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/);
  if (rgb) {
    const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
    return `#${[rgb[1], rgb[2], rgb[3]].map((part) => clamp(Number(part)).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
  }
  const oklch = value.match(/^oklch\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+)(?:deg)?\s*(?:\/[^)]*)?\)/);
  if (oklch) {
    const l = oklch[1].endsWith("%") ? Number(oklch[1].slice(0, -1)) / 100 : Number(oklch[1]);
    const c = oklch[2].endsWith("%") ? (Number(oklch[2].slice(0, -1)) / 100) * 0.4 : Number(oklch[2]);
    const h = Number(oklch[3]);
    return oklabToHex(l, c * Math.cos((h * Math.PI) / 180), c * Math.sin((h * Math.PI) / 180));
  }
  const oklab = value.match(/^oklab\(\s*([\d.]+%?)[\s,]+(-?[\d.]+%?)[\s,]+(-?[\d.]+%?)\s*(?:\/[^)]*)?\)/);
  if (oklab) {
    const l = oklab[1].endsWith("%") ? Number(oklab[1].slice(0, -1)) / 100 : Number(oklab[1]);
    const a = Number(oklab[2].replace("%", ""));
    const b = Number(oklab[3].replace("%", ""));
    return oklabToHex(l, a, b);
  }
  const hsl = value.match(/^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/);
  if (hsl) {
    const h = ((Number(hsl[1]) % 360) + 360) % 360;
    const s = Math.max(0, Math.min(100, Number(hsl[2]))) / 100;
    const l = Math.max(0, Math.min(100, Number(hsl[3]))) / 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    const [r, g, b] =
      h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return `#${[r, g, b]
      .map((channel) => Math.max(0, Math.min(255, Math.round((channel + m) * 255))).toString(16).padStart(2, "0"))
      .join("")}`.toUpperCase();
  }
  return null;
}

function oklabToHex(l: number, a: number, b: number): string {
  const lc = Math.pow(l + 0.3963377774 * a + 0.2158037573 * b, 3);
  const mc = Math.pow(l - 0.1055613458 * a - 0.0638541728 * b, 3);
  const sc = Math.pow(l - 0.0894841775 * a - 1.291485548 * b, 3);
  const linear = [
    4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc,
    -1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc,
    -0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc,
  ];
  const toSrgb = (channel: number) => {
    const clamped = Math.max(0, Math.min(1, channel));
    const gamma = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(gamma * 255)));
  };
  return `#${linear.map((channel) => toSrgb(channel).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function collectCss(html: string): string {
  const blocks = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1]);
  const inline = [...html.matchAll(/\bstyle\s*=\s*("([^"]*)"|'([^']*)')/gi)].map((match) => match[2] ?? match[3] ?? "");
  return [...blocks, ...inline].join("\n");
}

type Rule = { selector: string; decls: Record<string, string> };

function parseRules(css: string): Rule[] {
  const rules: Rule[] = [];
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1].trim();
    if (!selector || selector.startsWith("@")) continue;
    const decls: Record<string, string> = {};
    for (const part of match[2].split(";")) {
      const index = part.indexOf(":");
      if (index < 0) continue;
      const name = part.slice(0, index).trim().toLowerCase();
      const value = part.slice(index + 1).trim();
      if (name && value) decls[name] = value;
    }
    if (Object.keys(decls).length) rules.push({ selector, decls });
  }
  return rules;
}

function addColor(map: Map<string, ColorHit>, hex: string, weight: number, name = "", button = 0) {
  const current = map.get(hex);
  if (current) {
    current.weight += weight;
    current.button += button;
    if (!current.name && name) current.name = name;
  } else {
    map.set(hex, { hex, weight, name, button });
  }
}

function isSkippedVar(name: string): boolean {
  return GENERIC_VAR.test(name) || GENERIC_PALETTE.test(name) || /^font/.test(name);
}

function buttonish(selector: string): boolean {
  return /btn|button|cta|action|add-to-cart|buy-now|checkout|\bsubmit\b/i.test(selector);
}

/**
 * Samlar färger med vikt: CSS-variabler väger tyngst, färger som används på
 * knappar extra mycket – de säger mest om varumärkets primärfärg.
 */
export function collectColors(html: string): ColorHit[] {
  const map = new Map<string, ColorHit>();
  const css = collectCss(html);
  const vars = new Map<string, string>();

  for (const match of css.matchAll(/--([a-z0-9_-]+)\s*:\s*([^;{}]+)/gi)) {
    const name = match[1].toLowerCase();
    if (isSkippedVar(name)) continue;
    const hex = parseColor(match[2].trim().split(/\s+/)[0] ?? "");
    if (hex) vars.set(name, hex);
  }

  const rules = parseRules(css);
  const buttonVars = new Map<string, number>();
  const buttonHexes = new Map<string, number>();
  for (const rule of rules) {
    if (!buttonish(rule.selector)) continue;
    const values = [rule.decls["background-color"], rule.decls["background"], rule.decls["color"], rule.decls["border-color"], rule.decls["border"]].filter(Boolean) as string[];
    for (const value of values) {
      for (const match of value.matchAll(/var\(\s*--([a-z0-9_-]+)/gi)) {
        const name = match[1].toLowerCase();
        buttonVars.set(name, (buttonVars.get(name) ?? 0) + 1);
      }
      for (const match of value.matchAll(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|oklch?\([^)]*\)|oklab\([^)]*\)/gi)) {
        const hex = parseColor(match[0]);
        if (hex) buttonHexes.set(hex, (buttonHexes.get(hex) ?? 0) + 1);
      }
    }
  }

  const cleanCss = css.replace(
    /--(?:swiper|tw|mdc|bs|radix|chakra|mui|ant|splide|keen|flickity|aos)[a-z0-9_-]*\s*:[^;{}]+|--(?:color-)?(?:gray|grey|neutral|slate|zinc|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{1,3}\s*:[^;{}]+|--(?:color-)?(?:white|transparent)\s*:[^;{}]+/gi,
    "",
  );

  for (const [name, hex] of vars) {
    const uses = (cleanCss.match(new RegExp(`var\\(\\s*--${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g")) ?? []).length;
    addColor(map, hex, 6 + Math.min(14, uses), name, buttonVars.get(name) ?? 0);
  }

  const colorRegex = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|oklch?\([^)]*\)|oklab\([^)]*\)/gi;
  for (const match of cleanCss.matchAll(colorRegex)) {
    const hex = parseColor(match[0]);
    if (hex) addColor(map, hex, 1, "", buttonHexes.get(hex) ?? 0);
  }

  for (const [hex, hits] of buttonHexes) addColor(map, hex, 2 + hits, "", hits);

  const themeColor = meta(html, "name", "theme-color").split(",")[0];
  const themeHex = themeColor ? parseColor(themeColor) : null;
  if (themeHex) addColor(map, themeHex, 8, "theme-color");

  return [...map.values()].sort((a, b) => b.weight + b.button * 4 - (a.weight + a.button * 4)).slice(0, 40);
}

function addFont(map: Map<string, FontHit>, family: string, weight: number, context: FontHit["context"]) {
  const clean = family.trim().replace(/^['"]|['"]$/g, "").replace(/\s+/g, " ");
  if (!clean || clean.includes("var(") || clean.length > 48) return;
  const key = clean.toLowerCase();
  if (GENERIC_FONTS.has(key) || /^(sans|serif|mono)-/.test(key)) return;
  const current = map.get(key);
  if (current) {
    current.weight += weight;
    if (current.context === "other" && context !== "other") current.context = context;
  } else {
    map.set(key, { family: clean, weight, context });
  }
}

export function collectFonts(html: string): FontHit[] {
  const map = new Map<string, FontHit>();
  const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of linkTags) {
    const href = attr(tag, "href");
    if (!/fonts\.googleapis\.com|fonts\.google\.com/i.test(href + tag)) continue;
    for (const family of href.matchAll(/[?&]family=([^&"']+)/g)) {
      const first = decodeURIComponent(family[1]).split(":")[0].replace(/\+/g, " ");
      if (first) addFont(map, first, 8, "other");
    }
  }

  const css = collectCss(html);
  const vars = new Map<string, string>();
  for (const match of css.matchAll(/--([a-z0-9_-]+)\s*:\s*([^;{}]+)/gi)) vars.set(match[1].toLowerCase(), match[2].trim());
  const resolve = (value: string) => {
    let out = value;
    for (let pass = 0; pass < 2; pass += 1) {
      out = out.replace(/var\(\s*--([a-z0-9_-]+)\s*(?:,\s*([^)]*))?\)/gi, (_, name: string, fallback?: string) => vars.get(name.toLowerCase()) ?? fallback ?? "");
    }
    return out;
  };

  // Typsnitt som sätts via variabler (t.ex. --font-manrope, --font-heading).
  for (const [name, value] of vars) {
    if (!/^font|font-|fontfamily/.test(name)) continue;
    const first = resolve(value).split(",")[0] ?? "";
    const context: FontHit["context"] = /head|display|title|serif/.test(name) ? "heading" : /body|text|base|sans/.test(name) ? "body" : "other";
    addFont(map, first, 7, context);
  }

  for (const rule of parseRules(css)) {
    const family = rule.decls["font-family"];
    if (!family) continue;
    const first = resolve(family).split(",")[0] ?? "";
    const selector = rule.selector.toLowerCase();
    const context: FontHit["context"] = /(^|[\s,>])(h1|h2|h3|heading|title|display|hero)/.test(selector)
      ? "heading"
      : /(^|[\s,>])(body|html|:root|p|base|text|copy)/.test(selector)
        ? "body"
        : "other";
    addFont(map, first, 1, context);
  }

  // Typsnitt som sätts direkt i style-attribut.
  for (const match of css.matchAll(/font-family\s*:\s*([^;"'}]+)/gi)) {
    addFont(map, resolve(match[1]).split(",")[0] ?? "", 1, "other");
  }

  return [...map.values()].sort((a, b) => b.weight - a.weight).slice(0, 14);
}

export function collectTypographyMetrics(html: string): {
  baseSize: number | null;
  headingSize: number | null;
  lineHeight: number | null;
  headingWeight: number | null;
} {
  const rules = parseRules(collectCss(html));
  let baseSize: number | null = null;
  let lineHeight: number | null = null;
  let headingSize: number | null = null;
  let headingWeight: number | null = null;
  const allSizes: number[] = [];

  for (const rule of rules) {
    const selector = rule.selector.toLowerCase();
    const isBody = /(^|[\s,>])(body|html|:root)([\s,{]|$)/.test(selector) || selector === "body";
    const isHeading = /(^|[\s,>])(h1|\.hero|\.heading-1)([\s,{]|$)/.test(selector);
    const size = rule.decls["font-size"] ? px(rule.decls["font-size"]) : null;
    if (size) {
      allSizes.push(size);
      if (isBody && !baseSize && size >= 12 && size <= 24) baseSize = Math.round(size);
      if (isHeading && !headingSize && size >= 24) headingSize = Math.round(size);
    }
    if (isBody && !lineHeight && rule.decls["line-height"]) {
      const raw = rule.decls["line-height"].trim();
      if (/^\d*\.?\d+$/.test(raw)) lineHeight = Number(raw);
      else {
        const linePx = px(raw, size ?? 16);
        if (linePx && size) lineHeight = Number((linePx / size).toFixed(2));
      }
    }
    if (isHeading && !headingWeight && rule.decls["font-weight"]) {
      const weight = Number(rule.decls["font-weight"]);
      if (weight >= 100 && weight <= 900) headingWeight = weight;
    }
  }

  if (!baseSize && allSizes.length) {
    const counts = new Map<number, number>();
    for (const size of allSizes) counts.set(size, (counts.get(size) ?? 0) + 1);
    baseSize = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  return {
    baseSize: baseSize ? Math.max(14, Math.min(20, baseSize)) : null,
    headingSize: headingSize ? Math.max(28, Math.min(84, headingSize)) : null,
    lineHeight: lineHeight ? Math.max(1.2, Math.min(1.9, lineHeight)) : null,
    headingWeight,
  };
}

function radiusContext(selector: string): RadiusHit["context"] {
  const lower = selector.toLowerCase();
  if (/btn|button|cta|add-to-cart/.test(lower)) return "button";
  if (/card|tile|product|collection-item|grid-item/.test(lower)) return "card";
  if (/img|image|media|photo|thumbnail|thumb/.test(lower)) return "image";
  return "global";
}

export function collectDesign(html: string): {
  radii: RadiusHit[];
  shadows: number[];
  sectionPadding: number[];
  gridGap: number[];
  buttonStyles: { solid: number; outline: number; soft: number };
} {
  const radii: RadiusHit[] = [];
  const shadows: number[] = [];
  const sectionPadding: number[] = [];
  const gridGap: number[] = [];
  const buttonStyles = { solid: 0, outline: 0, soft: 0 };
  const rules = parseRules(collectCss(html));

  for (const rule of rules) {
    const context = radiusContext(rule.selector);
    const radius = rule.decls["border-radius"];
    if (radius) {
      const first = radius.split(/[\s/]/)[0];
      const value = px(first);
      if (value !== null && value >= 0) radii.push({ value: Math.min(999, Math.round(value)), weight: context === "button" ? 2 : 1, context });
    }
    const shadow = rule.decls["box-shadow"] || rule.decls["-webkit-box-shadow"];
    if (shadow && shadow !== "none") {
      const numbers = [...shadow.matchAll(/(-?\d+(?:\.\d+)?)(px|rem)/g)].map((match) => px(match[0]) ?? 0);
      const blur = numbers[2] ?? numbers[1] ?? 0;
      if (blur > 0) shadows.push(blur);
    }
    for (const name of ["padding", "padding-block", "padding-top", "padding-bottom"]) {
      const value = rule.decls[name];
      if (!value) continue;
      for (const part of value.split(/\s+/)) {
        const size = px(part);
        if (size && size >= 24 && size <= 200) sectionPadding.push(size);
      }
    }
    if (rule.decls["gap"]) {
      for (const part of rule.decls["gap"].split(/\s+/)) {
        const size = px(part);
        if (size && size >= 4 && size <= 80) gridGap.push(size);
      }
    }
    if (context === "button") {
      const background = parseColor((rule.decls["background-color"] || rule.decls["background"] || "").split(/\s+/)[0] ?? "");
      const hasBorder = Boolean(rule.decls["border"] || rule.decls["border-width"]);
      const transparent = /transparent/i.test(rule.decls["background"] ?? rule.decls["background-color"] ?? "");
      const translucent = /rgba\([^)]*,\s*0?\.\d+\)/i.test(rule.decls["background"] ?? rule.decls["background-color"] ?? "");
      if (transparent) buttonStyles.outline += 1;
      else if (translucent) buttonStyles.soft += 1;
      else if (background) buttonStyles.solid += 1;
      else if (hasBorder) buttonStyles.outline += 1;
    }
  }

  return { radii: radii.slice(0, 80), shadows, sectionPadding, gridGap, buttonStyles };
}

export function collectImages(html: string, base: string): ImageHit[] {
  const images: ImageHit[] = [];
  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    const src =
      attr(tag, "src") ||
      attr(tag, "data-src") ||
      attr(tag, "data-original") ||
      attr(tag, "data-lazy-src") ||
      firstSrcset(attr(tag, "srcset") || attr(tag, "data-srcset"));
    const url = absolutize(src, base);
    if (!url || url.startsWith("data:")) continue;
    if (/pixel|tracking|1x1|spacer|blank\.(gif|png)/i.test(url)) continue;
    const width = Number(attr(tag, "width")) || 0;
    const height = Number(attr(tag, "height")) || 0;
    if ((width && width <= 2) || (height && height <= 2)) continue;
    images.push({ url, alt: attr(tag, "alt").slice(0, 160), width, height });
    if (images.length >= 60) break;
  }
  const ogImage = meta(html, "property", "og:image") || meta(html, "name", "og:image");
  const ogUrl = absolutize(ogImage, base);
  if (ogUrl && !images.some((image) => image.url === ogUrl)) images.unshift({ url: ogUrl, alt: "og:image", width: 1200, height: 630 });
  return images;
}

function scoreLogo(tag: string, inHeader: boolean, url: string, alt: string): number {
  const haystack = `${url} ${alt} ${tag}`.toLowerCase();
  let score = 0;
  if (/logo|wordmark|brandmark|brand-mark/.test(haystack)) score += 60;
  if (inHeader) score += 25;
  if (/\.svg(\?|$)/i.test(url)) score += 12;
  const width = Number(attr(tag, "width")) || 0;
  const height = Number(attr(tag, "height")) || 0;
  if (width >= 60 && width <= 420) score += 8;
  if (height && height <= 22) score -= 12;
  if (width && width > 700) score -= 25;
  return score;
}

export function collectLogo(html: string, base: string): { candidates: LogoHit[]; svg: string } {
  const headerMatch = html.match(/<header\b[\s\S]*?<\/header>/i);
  const header = headerMatch?.[0] ?? "";
  const candidates: LogoHit[] = [];

  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    const inHeader = header.includes(tag);
    const src = attr(tag, "src") || attr(tag, "data-src") || firstSrcset(attr(tag, "srcset"));
    const url = absolutize(src, base);
    if (!url || url.startsWith("data:")) continue;
    const alt = attr(tag, "alt");
    const score = scoreLogo(tag, inHeader, url, alt);
    if (score >= 40) candidates.push({ url, alt: alt.slice(0, 120), score });
  }

  candidates.sort((a, b) => b.score - a.score);

  const svgSource = header || html.match(/<a\b[^>]*(?:class|id)\s*=\s*["'][^"']*logo[^"']*["'][^>]*>[\s\S]{0,4000}?<\/a>/i)?.[0] || "";
  const svgMatch = svgSource.match(/<svg\b[\s\S]*?<\/svg>/i);
  let svg = "";
  if (svgMatch && svgMatch[0].length < 30_000) {
    svg = svgMatch[0].replace(/<svg\b/i, (tag) => (/\bxmlns=/.test(tag) ? tag : `<svg xmlns="http://www.w3.org/2000/svg"`));
    candidates.unshift({ url: "", alt: "inline logo", score: 70 });
  }

  return { candidates: candidates.slice(0, 5), svg };
}

export function collectIcons(html: string, base: string): { icons: IconHit[]; manifest: string } {
  const icons: IconHit[] = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = attr(tag, "rel").toLowerCase();
    if (!/icon|apple-touch-icon|mask-icon|manifest/.test(rel)) continue;
    if (rel === "manifest") continue;
    const url = absolutize(attr(tag, "href"), base);
    if (!url) continue;
    icons.push({ rel, url, sizes: attr(tag, "sizes") });
  }
  const manifest = absolutize(attr(html.match(/<link\b[^>]*rel=["'][^"']*manifest[^"']*["'][^>]*>/i)?.[0] ?? "", "href"), base);
  return { icons: icons.slice(0, 12), manifest };
}

export function collectSocials(html: string): SocialHit[] {
  const found = new Map<string, string>();
  for (const tag of html.match(/<a\b[^>]*>/gi) ?? []) {
    const href = attr(tag, "href");
    if (!/^https?:/i.test(href)) continue;
    for (const social of SOCIAL_PATTERNS) {
      if (!social.test.test(href) || found.has(social.platform)) continue;
      if (/share|intent|sharer|/i.test(href) && !/instagram\.com/i.test(href)) continue;
      found.set(social.platform, href.split("?")[0]);
    }
  }
  return [...found.entries()].map(([platform, url]) => ({ platform, url }));
}

export function collectContact(html: string, jsonLd: JsonLdNode[]): { emails: string[]; phones: string[]; addresses: string[] } {
  const text = bodyText(html);
  const emails = new Set<string>();
  const phones = new Set<string>();
  const addresses = new Set<string>();

  for (const match of (html + " " + text).matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)) {
    const email = match[0].toLowerCase();
    if (/\.(png|jpg|jpeg|webp|svg|gif)$/i.test(email)) continue;
    if (/example|sentry|wixpress|shopify\.com|domain\.com/.test(email)) continue;
    emails.add(email);
  }
  for (const match of html.matchAll(/href\s*=\s*["']tel:([^"']+)["']/gi)) {
    const phone = decodeEntities(match[1]).replace(/\s+/g, " ").trim();
    if (phone.length >= 5) phones.add(phone);
  }
  for (const match of html.matchAll(/<address\b[^>]*>([\s\S]*?)<\/address>/gi)) {
    const value = cleanText(match[1]);
    if (value.length >= 6) addresses.add(value.slice(0, 180));
  }
  for (const node of jsonLd) {
    const address = node.address as Record<string, unknown> | undefined;
    if (address && typeof address === "object") {
      const parts = [address.streetAddress, address.postalCode, address.addressLocality, address.addressCountry]
        .map((part) => (typeof part === "string" ? part : ""))
        .filter(Boolean);
      if (parts.length) addresses.add(parts.join(", ").slice(0, 180));
    }
    if (typeof node.email === "string" && !emails.has(node.email.toLowerCase())) emails.add(node.email.toLowerCase());
    if (typeof node.telephone === "string" && node.telephone.length >= 5) phones.add(node.telephone);
  }

  return { emails: [...emails].slice(0, 4), phones: [...phones].slice(0, 3), addresses: [...addresses].slice(0, 2) };
}

export function collectJsonLd(html: string): JsonLdNode[] {
  const nodes: JsonLdNode[] = [];
  for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const raw = match[1].trim().replace(/^<!--|-->$/g, "");
    if (!raw) continue;
    try {
      collectJsonLdValue(JSON.parse(raw), nodes, 0);
    } catch {
      /* trasig JSON-LD ignoreras */
    }
  }
  return nodes;
}

function collectJsonLdValue(value: unknown, out: JsonLdNode[], depth: number) {
  if (depth > 6 || !value) return;
  if (Array.isArray(value)) {
    for (const item of value) collectJsonLdValue(item, out, depth + 1);
    return;
  }
  if (typeof value !== "object") return;
  const node = value as JsonLdNode;
  out.push(node);
  if (node["@graph"]) collectJsonLdValue(node["@graph"], out, depth + 1);
  if (node.itemListElement) collectJsonLdValue(node.itemListElement, out, depth + 1);
  if (node.item) collectJsonLdValue(node.item, out, depth + 1);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
}

function firstImage(value: unknown, base: string): string {
  const first = asArray(value)[0];
  const raw = typeof first === "string" ? first : first && typeof first === "object" ? text((first as JsonLdNode).url) : "";
  return absolutize(raw, base);
}

function formatPrice(value: unknown, currency: unknown): string {
  const amount = typeof value === "number" ? value : Number(text(value));
  if (!Number.isFinite(amount) || amount <= 0) return "";
  const code = text(currency).toUpperCase();
  const formatted = Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace(".", ",");
  return code ? `${formatted} ${code}` : formatted;
}

export function collectProducts(jsonLd: JsonLdNode[], html: string, base: string): ExtractedProduct[] {
  const products: ExtractedProduct[] = [];
  const seen = new Set<string>();

  const push = (product: ExtractedProduct) => {
    const name = product.name.slice(0, 90).trim();
    if (name.length < 2) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    products.push({ ...product, name });
  };

  for (const node of jsonLd) {
    const type = asArray(node["@type"]).map(String).join(" ").toLowerCase();
    if (!type.includes("product")) continue;
    const offers = asArray(node.offers)[0] as JsonLdNode | undefined;
    push({
      name: text(node.name) || text(node.title),
      price: offers ? formatPrice(offers.price ?? offers.lowPrice ?? offers.highPrice, offers.priceCurrency) : "",
      image: firstImage(node.image, base),
      url: absolutize(text(node.url) || text(node["@id"]), base),
      category: text(node.category),
      description: text(node.description).slice(0, 240),
    });
  }

  if (!products.length) {
    const productLinks: { name: string; url: string }[] = [];
    for (const tag of html.match(/<a\b[^>]*>([\s\S]*?)<\/a>/gi) ?? []) {
      const href = absolutize(attr(tag, "href"), base);
      if (!href || !/\/(products?|produkter|produkt|shop|collections)\/[^/?#]+/i.test(href)) continue;
      const label = cleanText(tag);
      if (label.length < 3 || label.length > 70) continue;
      if (/^(shop|alla|all|se alla|view all|nyheter|new|sale|rea)$/i.test(label)) continue;
      productLinks.push({ name: label, url: href });
      if (productLinks.length >= 12) break;
    }
    for (const link of productLinks) {
      push({ name: link.name, price: "", image: "", url: link.url, category: "", description: "" });
    }
  }

  return products.slice(0, 16);
}

export function collectTextBlocks(html: string): {
  headings: { level: number; text: string }[];
  paragraphs: string[];
  ctas: string[];
  navLabels: string[];
  announcement: string;
  copyright: string;
} {
  const headings: { level: number; text: string }[] = [];
  for (const level of [1, 2, 3]) {
    for (const match of html.matchAll(new RegExp(`<h${level}\\b[^>]*>([\\s\\S]*?)<\\/h${level}>`, "gi"))) {
      const value = cleanText(match[1]);
      if (value.length < 2 || value.length > 120) continue;
      // Rubriker som bara är butiks-UI (varukorg, cookies, fraktbanderoll) säger inget om varumärket.
      if (HEADING_NOISE.test(value) || HEADING_NOISE_PART.test(value)) continue;
      if (!headings.some((heading) => heading.text === value)) headings.push({ level, text: value });
      if (headings.length >= 36) break;
    }
  }

  const paragraphs: string[] = [];
  for (const match of html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const value = cleanText(match[1]);
    if (value.length < 30 || value.length > 260) continue;
    if (/cookie|javascript|integritetspolicy|privacy policy|we use cookies|använder cookies/i.test(value)) continue;
    if (isUiSnippet(value)) continue;
    if (!paragraphs.includes(value)) paragraphs.push(value);
    if (paragraphs.length >= 18) break;
  }

  const ctas: string[] = [];
  for (const match of html.matchAll(/<(a|button)\b([^>]*)>([\s\S]*?)<\/\1>/gi)) {
    const label = cleanText(match[3]);
    if (!label || label.length > 34) continue;
    if (CTA_NOISE.test(label)) continue;
    const attrs = match[2];
    if (!CTA_WORDS.test(label) && !CTA_CLASS.test(attrs)) continue;
    if (!ctas.includes(label)) ctas.push(label);
    if (ctas.length >= 20) break;
  }

  const navLabels: string[] = [];
  for (const nav of html.match(/<nav\b[\s\S]*?<\/nav>/gi) ?? []) {
    for (const match of nav.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)) {
      const label = cleanText(match[1]);
      if (label.length >= 2 && label.length <= 28 && !navLabels.includes(label)) navLabels.push(label);
      if (navLabels.length >= 24) break;
    }
  }

  let announcement = "";
  const announcementBlock =
    html.match(
      /<([a-z0-9]+)\b[^>]*(?:class|id|aria-label)\s*=\s*["'][^"']*(?:announcement|topbar|top-bar|utility-bar|promo-bar|marquee|ticker|shipping-bar)[^"']*["'][^>]*>([\s\S]{0,500}?)<\/\1>/i,
    )?.[2] ?? "";
  if (announcementBlock) {
    const value = cleanText(announcementBlock);
    if (value.length >= 6 && value.length <= 140) announcement = value;
  }
  if (!announcement) {
    const header = html.match(/<header\b[\s\S]*?<\/header>/i)?.[0] ?? "";
    for (const match of header.matchAll(/<(p|span|div)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
      const value = cleanText(match[2]);
      if (value.length >= 12 && value.length <= 100 && /(fri frakt|free shipping|leverans|delivery|retur|returns|köp|shop|rabatt|off)/i.test(value)) {
        announcement = value;
        break;
      }
    }
  }

  if (announcement) {
    const words = announcement.split(/\s+/).filter((word) => word.length > 2);
    const navWords = new Set(navLabels.flatMap((label) => label.toLowerCase().split(/\s+/)));
    const allNav = words.length > 0 && words.every((word) => navWords.has(word.toLowerCase()));
    // En rad med bara Versala Ord Är En Meny, inte ett kampanjband.
    const menuLike = words.length >= 3 && words.filter((word) => /^[A-ZÅÄÖ0-9]/.test(word)).length / words.length > 0.7;
    if (allNav || menuLike) announcement = "";
  }

  const pageText = bodyText(html);
  const copyright = pageText.match(/(?:©|copyright)[^|·]{0,90}/i)?.[0]?.trim() ?? "";

  return { headings, paragraphs, ctas, navLabels, announcement, copyright };
}

export function collectNewsletter(html: string): PageFacts["newsletter"] {
  for (const match of html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/gi)) {
    const inner = match[1];
    if (!/type\s*=\s*["']email["']/i.test(inner) && !/name\s*=\s*["']email["']/i.test(inner)) continue;
    const placeholder = attr(inner.match(/<input\b[^>]*>/i)?.[0] ?? "", "placeholder");
    const heading =
      cleanText(inner.match(/<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/i)?.[1] ?? "") ||
      cleanText(inner.match(/<label\b[^>]*>([\s\S]*?)<\/label>/i)?.[1] ?? "");
    const paragraph = cleanText(inner.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "");
    const cta = cleanText(inner.match(/<button\b[^>]*>([\s\S]*?)<\/button>/i)?.[1] ?? "");
    return {
      title: heading.slice(0, 90),
      text: paragraph.slice(0, 160),
      cta: cta.slice(0, 32),
      placeholder: placeholder.slice(0, 60),
    };
  }
  return null;
}

/** Länkar till stilmallar på samma domän, så att extern CSS kan läsas in. */
export function collectStylesheets(html: string, base: string): string[] {
  const baseHost = (() => {
    try {
      return new URL(base).hostname.replace(/^www\./i, "");
    } catch {
      return "";
    }
  })();
  const urls: string[] = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    if (!/stylesheet/i.test(attr(tag, "rel"))) continue;
    const url = absolutize(attr(tag, "href"), base);
    if (!url || url.startsWith("data:")) continue;
    // Tredjeparts-widgets (Shop Pay, Klarna, samtycke) har egna färger.
    if (/shopifycloud|portable-wallets|checkout|shop-pay|klarna|paypal|klaviyo|judge|loox|recaptcha|consent|cookiebot|googleapis|gstatic|jsdelivr|unpkg|typekit/i.test(url)) continue;
    try {
      const parsed = new URL(url);
      if (baseHost && parsed.hostname.replace(/^www\./i, "") !== baseHost) continue;
      urls.push(url);
    } catch {
      /* ogiltig länk ignoreras */
    }
    if (urls.length >= 4) break;
  }
  return urls;
}

/** Tolkar en HTML-sida och plockar ut allt Brand DNA behöver. */
export function analyzePage(html: string, url: string, extraCss = ""): PageFacts {
  const base = url;
  // Externa stilmallar läggs in som en extra <style> så att färger, typsnitt och
  // radier hittas även när sajten lägger all CSS i separata filer.
  if (extraCss) html = `${html}\n<style>${extraCss}</style>`;
  const jsonLd = collectJsonLd(html);
  const texts = collectTextBlocks(html);
  const design = collectDesign(html);
  const metrics = collectTypographyMetrics(html);
  const logo = collectLogo(html, base);
  const icons = collectIcons(html, base);
  const contact = collectContact(html, jsonLd);

  return {
    url,
    title: cleanText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").slice(0, 160),
    description: (meta(html, "name", "description") || meta(html, "property", "og:description")).slice(0, 300),
    ogTitle: meta(html, "property", "og:title").slice(0, 160),
    ogDescription: meta(html, "property", "og:description").slice(0, 300),
    siteName: (meta(html, "property", "og:site_name") || meta(html, "name", "application-name")).slice(0, 80),
    themeColor: meta(html, "name", "theme-color").slice(0, 40),
    lang: attr(html.match(/<html\b[^>]*>/i)?.[0] ?? "", "lang").slice(0, 12),
    headings: texts.headings,
    paragraphs: texts.paragraphs,
    ctas: texts.ctas,
    navLabels: texts.navLabels,
    announcement: texts.announcement,
    colors: collectColors(html),
    fonts: collectFonts(html),
    baseSize: metrics.baseSize,
    headingSize: metrics.headingSize,
    lineHeight: metrics.lineHeight,
    headingWeight: metrics.headingWeight,
    radii: design.radii,
    shadows: design.shadows,
    sectionPadding: design.sectionPadding,
    gridGap: design.gridGap,
    buttonStyles: design.buttonStyles,
    images: collectImages(html, base),
    logoCandidates: logo.candidates,
    logoSvg: logo.svg,
    icons: icons.icons,
    manifest: icons.manifest,
    socials: collectSocials(html),
    emails: contact.emails,
    phones: contact.phones,
    addresses: contact.addresses,
    jsonLd,
    products: collectProducts(jsonLd, html, base),
    newsletter: collectNewsletter(html),
    hasShopify: /cdn\.shopify\.com|shopify\.theme|myshopify\.com/i.test(html),
    hasFooter: /<footer\b/i.test(html) || /* © i sidfoten */ /©\s*\d{4}|copyright/i.test(html),
    copyright: texts.copyright,
    text: bodyText(html).slice(0, 20_000),
  };
}
