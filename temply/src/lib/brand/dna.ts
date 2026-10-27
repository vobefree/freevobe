import type {
  BrandDna,
  BrandIndustry,
  BrandKit,
  BrandTone,
  BrandVoice,
  DnaCopy,
  DnaDesign,
  DnaImagery,
  DnaPage,
  DnaPalette,
  DnaProduct,
  DnaSource,
  FontKey,
  Locale,
  Section,
  StylePresetId,
  ThemeConfig,
} from "@/lib/theme/types";
import { FONTS } from "@/lib/theme/types";
import { STYLE_PRESETS, styleFromText } from "./styles";
import { luminance, mix, saturation } from "./kit";
import { isUiSnippet, type PageFacts } from "./extract";
import type { CrawledSite } from "./crawl";

/* ------------------------------------------------------------------ */
/* Små hjälpare                                                        */
/* ------------------------------------------------------------------ */

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const unique = <T,>(list: T[]): T[] => [...new Set(list)];

function median(values: number[], fallback: number): number {
  if (!values.length) return fallback;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function mode(values: number[], fallback: number): number {
  if (!values.length) return fallback;
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function share<T>(list: T[], test: (value: T) => boolean): number {
  return list.length ? list.filter(test).length / list.length : 0;
}

function colorDistance(a: string, b: string): number {
  const parse = (hex: string) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
}

function readable(foreground: string, background: string): boolean {
  return Math.abs(luminance(foreground) - luminance(background)) > 0.32;
}

class Markers {
  missing = new Set<string>();
  suggested = new Set<string>();

  take(path: string, found: boolean) {
    if (found) return;
    this.missing.add(path);
    this.suggested.add(path);
  }

  list() {
    return { missing: [...this.missing], suggested: [...this.suggested] };
  }
}

/* ------------------------------------------------------------------ */
/* Färger                                                              */
/* ------------------------------------------------------------------ */

type RoleSources = Partial<Record<keyof Omit<DnaPalette, "swatches">, DnaSource>>;

function mergeColors(facts: PageFacts[]) {
  const map = new Map<string, ColorCandidate>();
  for (const factsEntry of facts) {
    for (const color of factsEntry.colors) {
      const current = map.get(color.hex);
      if (current) {
        current.weight += color.weight;
        current.button += color.button;
        if (!current.name && color.name) current.name = color.name;
      } else {
        map.set(color.hex, { ...color });
      }
    }
  }
  return [...map.values()].sort((a, b) => b.weight + b.button * 4 - (a.weight + a.button * 4));
}

type ColorCandidate = { hex: string; weight: number; name: string; button: number };

/** Poäng för "huvudfärg": mättnad, hur vanlig den är och om knapparna använder den. */
function brandScore(color: ColorCandidate): number {
  return saturation(color.hex) * 40 + Math.min(35, color.weight * 1.5) + Math.min(45, color.button * 12);
}

function named(colors: ColorCandidate[], test: RegExp): ColorCandidate | undefined {
  return colors.find((color) => color.name && test.test(color.name));
}

function pickPalette(colors: ColorCandidate[], fallbackStyle: StylePresetId, markers: Markers): { palette: DnaPalette; sources: RoleSources } {
  const preset = STYLE_PRESETS[fallbackStyle].palette;
  const light = colors.filter((color) => luminance(color.hex) >= 0.9);
  const dark = colors.filter((color) => luminance(color.hex) <= 0.12);
  const brand = colors.filter((color) => {
    const l = luminance(color.hex);
    return l > 0.08 && l < 0.88;
  });
  const vivid = [...(brand.length ? brand : colors)].sort((a, b) => brandScore(b) - brandScore(a));

  const namedBackground = named(colors, /(^|[-_])(bg|background|surface|paper|base|canvas)([-_]|$)/)?.hex;
  const namedText = named(colors, /(^|[-_])(text|foreground|ink|copy|body-color)([-_]|$)/)?.hex;
  const namedPrimary = named(colors, /(^|[-_])(primary|brand|main|theme-color)([-_]|$)/)?.hex;
  const namedSecondary = named(colors, /(^|[-_])(secondary|brand-2|brand-secondary)([-_]|$)/)?.hex;
  const namedAccent = named(colors, /(^|[-_])(accent|highlight|lime|yellow)([-_]|$)/)?.hex;
  const namedButton = named(colors, /(^|[-_])(button|btn|cta|action)([-_]|$)/)?.hex;

  let background = namedBackground ?? "";
  if (!background) {
    if (light.length) background = light[0].hex;
    else if (dark.length) background = dark[0].hex;
  }
  if (!background) background = preset.background;
  const darkTheme = luminance(background) < 0.35;

  let text = namedText ?? "";
  if (!text) {
    const candidates = colors
      .filter((color) => (darkTheme ? luminance(color.hex) > 0.75 : luminance(color.hex) < 0.38))
      .sort((a, b) => b.weight - a.weight);
    text = candidates[0]?.hex ?? (darkTheme ? "#F6F3EC" : "#191813");
  }
  if (!readable(text, background)) text = luminance(background) > 0.5 ? "#191813" : "#F6F3EC";

  let primary = namedPrimary ?? vivid.find((color) => readable(color.hex, background))?.hex ?? vivid[0]?.hex ?? preset.primary;
  if (!readable(primary, background)) primary = luminance(background) > 0.5 ? "#1F4A3D" : mix(primary, "#FFFFFF", 0.45);

  const accentCandidate =
    namedAccent ??
    vivid.find((color) => color.hex !== primary && colorDistance(color.hex, primary) > 110 && readable(color.hex, background))?.hex ??
    vivid.find((color) => color.hex !== primary && colorDistance(color.hex, primary) > 60)?.hex;
  // En accent ska synas mot bakgrunden – en nästan vit accent är ingen accent.
  const accent = accentCandidate && readable(accentCandidate, background) ? accentCandidate : mix(primary, "#E9B44C", 0.55);

  const secondaryCandidate = namedSecondary ?? vivid.find((color) => color.hex !== primary && color.hex !== accent && colorDistance(color.hex, primary) > 70)?.hex;
  const secondary = secondaryCandidate ?? mix(primary, accent, 0.5);

  const button = namedButton ?? primary;

  const swatches = unique(
    [primary, accent, secondary, background, text, ...vivid.map((color) => color.hex)]
      .filter((hex) => hex && hex !== "#FFFFFF" && hex !== "#000000")
      .slice(0, 8),
  );

  if (!namedBackground) markers.take("palette.background", Boolean(light.length || dark.length));
  markers.take("palette.text", Boolean(namedText) || colors.length > 0);
  markers.take("palette.primary", Boolean(namedPrimary) || Boolean(vivid.length));
  markers.take("palette.accent", Boolean(namedAccent) || Boolean(accentCandidate));
  markers.take("palette.secondary", Boolean(namedSecondary) || Boolean(secondaryCandidate));
  markers.take("palette.button", Boolean(namedButton) || Boolean(namedPrimary) || colors.some((color) => color.button > 0) || Boolean(vivid.length));

  return {
    palette: { primary, secondary, accent, background, text, button, swatches: swatches.length ? swatches : presetSwatches(preset) },
    sources: {
      primary: namedPrimary ? "site" : vivid.length ? "site" : "suggested",
      accent: accentCandidate ? "site" : "suggested",
      secondary: secondaryCandidate ? "site" : "suggested",
      background: namedBackground || light.length || dark.length ? "site" : "suggested",
      text: namedText || colors.length ? "site" : "suggested",
      button: namedButton ? "site" : "suggested",
    },
  };
}

function presetSwatches(palette: { primary: string; accent: string; background: string; text: string }): string[] {
  return [palette.primary, palette.accent, palette.background, palette.text];
}

/* ------------------------------------------------------------------ */
/* Typografi                                                           */
/* ------------------------------------------------------------------ */

const FONT_ALIASES: { key: FontKey; test: RegExp }[] = [
  { key: "inter", test: /(^|\s)inter(\s|$|tight)/ },
  { key: "dm", test: /dm sans|dmsans/ },
  { key: "manrope", test: /manrope/ },
  { key: "space", test: /space grotesk|spacegrotesk/ },
  { key: "sora", test: /sora/ },
  { key: "archivo", test: /archivo/ },
  { key: "playfair", test: /playfair/ },
  { key: "fraunces", test: /fraunces/ },
  { key: "instrument", test: /instrument/ },
  { key: "libre", test: /libre baskerville|libre/ },
];

export function mapFont(family: string): FontKey | null {
  const lower = family.toLowerCase();
  for (const alias of FONT_ALIASES) {
    if (alias.test.test(lower)) return alias.key;
  }
  if (/serif|garamond|didot|baskerville|georgia|times|bodoni|caslon/.test(lower)) return "playfair";
  if (/mono|code/.test(lower)) return "space";
  if (/grotesk|grotesque|neue|helvetica|arial|sans/.test(lower)) return "manrope";
  return null;
}

function pickTypography(facts: PageFacts[], presetStyle: StylePresetId, markers: Markers, notes: string[]) {
  const preset = STYLE_PRESETS[presetStyle].typography;
  const map = new Map<string, { family: string; weight: number; heading: number; body: number }>();
  for (const page of facts) {
    for (const font of page.fonts) {
      const key = font.family.toLowerCase();
      const current = map.get(key) ?? { family: font.family, weight: 0, heading: 0, body: 0 };
      current.weight += font.weight;
      if (font.context === "heading") current.heading += font.weight;
      if (font.context === "body") current.body += font.weight;
      map.set(key, current);
    }
  }
  const fonts = [...map.values()].sort((a, b) => b.weight - a.weight);
  const headingSource = [...fonts].sort((a, b) => b.heading - a.heading)[0];
  const bodySource = [...fonts].sort((a, b) => b.body - a.body)[0] ?? fonts[0];
  const headingFamily = headingSource?.heading ? headingSource.family : fonts[0]?.family ?? "";
  const bodyFamily = bodySource?.body ? bodySource.family : fonts[1]?.family ?? fonts[0]?.family ?? "";

  const heading = headingFamily ? mapFont(headingFamily) : null;
  const body = bodyFamily ? mapFont(bodyFamily) : null;
  if (headingFamily && !heading) notes.push(`font_unmapped:${headingFamily}`);
  if (bodyFamily && !body) notes.push(`font_unmapped:${bodyFamily}`);

  const baseSizes = facts.map((page) => page.baseSize).filter((size): size is number => Boolean(size));
  const headingSizes = facts.map((page) => page.headingSize).filter((size): size is number => Boolean(size));
  const lineHeights = facts.map((page) => page.lineHeight).filter((value): value is number => Boolean(value));
  const weights = facts.map((page) => page.headingWeight).filter((value): value is number => Boolean(value));

  const allHeadings = facts.flatMap((page) => page.headings);
  const uppercaseShare = share(allHeadings.filter((heading) => heading.level <= 2 && heading.text.length > 4), (heading) => heading.text === heading.text.toUpperCase());

  const baseSize = median(baseSizes, preset.baseSize);
  const headingSize = Math.round(median(headingSizes, Math.round(baseSize * 2.8)));
  const defaultLineHeight = Number((1.35 + preset.scale * 0.16).toFixed(2));
  const lineHeight = Number((median(lineHeights.map((value) => Math.round(value * 100)), Math.round(defaultLineHeight * 100)) / 100).toFixed(2));

  markers.take("typography.heading", Boolean(heading));
  markers.take("typography.body", Boolean(body));
  markers.take("typography.baseSize", baseSizes.length > 0);

  return {
    typography: {
      headingFamily: headingFamily || FONTS[preset.heading].label,
      bodyFamily: bodyFamily || FONTS[preset.body].label,
      heading: heading ?? preset.heading,
      body: body ?? preset.body,
      baseSize: clamp(baseSize, 14, 19),
      headingSize: clamp(headingSize, 28, 76),
      lineHeight: clamp(lineHeight, 1.3, 1.85),
      headingWeight: weights.length ? clamp(mode(weights, preset.headingWeight), 300, 900) : preset.headingWeight,
      bodyWeight: 400,
      tracking: uppercaseShare > 0.5 ? 0.04 : preset.tracking,
      uppercaseHeadings: uppercaseShare > 0.5,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Design                                                              */
/* ------------------------------------------------------------------ */

function pickDesign(facts: PageFacts[], presetStyle: StylePresetId, markers: Markers): DnaDesign {
  const preset = STYLE_PRESETS[presetStyle];
  const radii = facts.flatMap((page) => page.radii);
  const globalRadii = radii.filter((radius) => radius.context === "global");
  const buttonRadii = radii.filter((radius) => radius.context === "button");
  const cardRadii = radii.filter((radius) => radius.context === "card");
  const imageRadii = radii.filter((radius) => radius.context === "image");

  const radius = radii.length ? clamp(mode([...globalRadii, ...radii].map((hit) => hit.value), preset.shape.radius), 0, 40) : preset.shape.radius;
  const buttonRadius = buttonRadii.length ? clamp(mode(buttonRadii.map((hit) => hit.value), preset.shape.buttonRadius), 0, 999) : clamp(radius, 0, 999);
  const cardRadius = cardRadii.length ? clamp(mode(cardRadii.map((hit) => hit.value), preset.tokens.cardRadius), 0, 48) : Math.round(radius * 1.2);
  const imageRadius = imageRadii.length ? clamp(mode(imageRadii.map((hit) => hit.value), preset.tokens.imageRadius), 0, 999) : cardRadius;

  const shadows = facts.flatMap((page) => page.shadows);
  const blur = median(shadows, 0);
  const shadow = shadows.length ? Math.round(clamp(blur, 0, 60)) : preset.shape.shadow;

  const paddings = facts.flatMap((page) => page.sectionPadding);
  const gaps = facts.flatMap((page) => page.gridGap);
  const sectionSpacing = paddings.length ? clamp(Math.round(median(paddings, 88) / 8) * 8, 48, 136) : preset.density === "airy" ? 112 : preset.density === "compact" ? 64 : 88;
  const gridGap = gaps.length ? clamp(Math.round(median(gaps, 24) / 4) * 4, 8, 48) : 24;

  const styles = facts.reduce(
    (sum, page) => ({
      solid: sum.solid + page.buttonStyles.solid,
      outline: sum.outline + page.buttonStyles.outline,
      soft: sum.soft + page.buttonStyles.soft,
    }),
    { solid: 0, outline: 0, soft: 0 },
  );
  const buttonStyle: DnaDesign["buttonStyle"] =
    styles.solid + styles.outline + styles.soft === 0
      ? preset.tokens.buttonStyle
      : styles.solid >= styles.outline && styles.solid >= styles.soft
        ? "solid"
        : styles.outline >= styles.soft
          ? "outline"
          : "soft";

  const density: DnaDesign["density"] = sectionSpacing >= 104 ? "airy" : sectionSpacing <= 68 ? "compact" : "cozy";

  markers.take("design.radius", radii.length > 0);
  markers.take("design.buttonRadius", buttonRadii.length > 0);
  markers.take("design.cardRadius", cardRadii.length > 0 || radii.length > 0);
  markers.take("design.sectionSpacing", paddings.length > 0);
  markers.take("design.shadow", shadows.length > 0);

  return {
    style: presetStyle,
    radius,
    buttonRadius,
    cardRadius,
    imageRadius,
    sectionSpacing,
    gridGap,
    shadow,
    buttonStyle,
    density,
  };
}

/* ------------------------------------------------------------------ */
/* Bildstil, ton, bransch                                              */
/* ------------------------------------------------------------------ */

const IMAGE_WORDS = {
  product: /(product|produkt|packshot|pack-shot|studio|white background|front|bottle|flaska|jar|burk|detail|närbild)/gi,
  lifestyle: /(lifestyle|livsstil|model|modell|wearing|bär|person|people|människa|home|hemma|interior|inredning|outdoor|ute|on-model)/gi,
  illustration: /(illustration|vector|illu|drawing|teckning|graphic|grafisk|pattern|mönster|icon|ikon)/gi,
  threeD: /(3d|render|cgi|sculpt|sculpture)/gi,
};

function pickImagery(facts: PageFacts[], markers: Markers): DnaImagery {
  const images = facts.flatMap((page) => page.images);
  const corpus = images.map((image) => `${image.alt} ${image.url}`).join(" ");
  const count = (pattern: RegExp) => (corpus.match(pattern) ?? []).length;
  const productPhotos = count(IMAGE_WORDS.product) >= 2;
  const lifestyle = count(IMAGE_WORDS.lifestyle) >= 2;
  const illustrations = count(IMAGE_WORDS.illustration) + count(IMAGE_WORDS.threeD);
  const svgShare = share(images, (image) => /\.svg(\?|$)/i.test(image.url));
  let style: DnaImagery["style"] = "photography";
  if (!images.length) style = "mixed";
  else if (illustrations > images.length * 0.35 || svgShare > 0.5) style = count(IMAGE_WORDS.threeD) > 2 ? "3d" : "illustration";
  else if (illustrations > 0 && images.length > 6) style = "mixed";

  const IMAGE_STOPWORDS =
    /^(image|images|photo|photos|product|products|bild|bilder|produkt|produkter|upload|uploads|file|files|cdn|shopify|asset|assets|full|large|small|medium|thumb|thumbnail|main|primary|default|hero|banner|aspect|width|height|addedproduct|productname|title|item|items|variant|variants|color|colour|grey|gray|black|white|logo|site|website|homepage|dasher|section|block|wrapper|container)$/;
  const counts = new Map<string, number>();
  for (const image of images) {
    const seen = new Set<string>();
    for (const token of image.alt.toLowerCase().split(/[^a-zåäöéüß]+/)) {
      if (token.length < 4 || !/^[a-zåäöéüß]+$/.test(token) || IMAGE_STOPWORDS.test(token) || seen.has(token)) continue;
      seen.add(token);
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const repeated = ranked.filter(([, count]) => count >= 2);
  const keywords = (repeated.length ? repeated : ranked).slice(0, 8).map(([word]) => word);

  markers.take("imagery.style", images.length > 0);
  return { style, productPhotos, lifestyle, keywords };
}

const VOICE_WORDS: Record<BrandVoice, RegExp[]> = {
  formal: [
    /erbjuder/gi, /vänligen/gi, /kontakta oss/gi, /expert/gi, /professionell/gi, /kvalitet/gi, /sedan (18|19|20)\d\d/gi, /officiell/gi, /branschledande/gi, /we offer/gi, /please/gi, /since (18|19|20)\d\d/gi, /quality/gi, /established/gi,
  ],
  friendly: [
    /vi älskar/gi, /tillsammans/gi, /välkommen/gi, /hos oss/gi, /vi finns här/gi, /hej/gi, /we love/gi, /together/gi, /welcome/gi, /we're here/gi, /our community/gi, /for you/gi, /till dig/gi,
  ],
  luxury: [
    /exklusiv/gi, /lyx/gi, /handgjord/gi, /hantverk/gi, /unik/gi, /ateljé/gi, /maison/gi, /bespoke/gi, /crafted/gi, /handcrafted/gi, /limited edition/gi, /premium/gi, /elegance/gi, /fine jewelry/gi, /sedan 18/gi,
  ],
  youthful: [
    /\bdrop\b/gi, /street/gi, /sneaker/gi, /collab/gi, /\bgym\b/gi, /energy/gi, /fresh/gi, /hype/gi, /\bvibe\b/gi, /crew/gi, /next gen/gi, /gen z/gi, /\bnyheter\b/gi,
  ],
  minimal: [
    /tidlös/gi, /\benkel\b/gi, /\bren\b/gi, /funktion/gi, /minimal/gi, /less is more/gi, /essentials/gi, /basics/gi, /clean/gi, /simplicity/gi, /understated/gi, /form follows/gi,
  ],
  playful: [
    /lekfull/gi, /\bkul\b/gi, /\bglad\b/gi, /\bfärg/gi, /\bwow\b/gi, /skoj/gi, /busig/gi, /\bfun\b/gi, /playful/gi, /colorful/gi, /\bjoy\b/gi, /\bhappy\b/gi, /treat yourself/gi, /present tips/gi,
  ],
};

const INDUSTRY_WORDS: Record<BrandIndustry, RegExp[]> = {
  fashion: [/kläder/gi, /\bmode\b/gi, /fashion/gi, /apparel/gi, /clothing/gi, /tröja/gi, /klänning/gi, /dress/gi, /jacket/gi, /sneaker/gi, /\bskor\b/gi, /shoes/gi, /byxor/gi, /shirt/gi, /\bjeans\b/gi],
  jewelry: [/smycken/gi, /jewelry/gi, /jewellery/gi, /\bring\b/gi, /necklace/gi, /halsband/gi, /örhängen/gi, /earrings/gi, /guld/gi, /silver/gi, /klocka/gi, /watch/gi],
  beauty: [/hudvård/gi, /skincare/gi, /serum/gi, /kräm/gi, /\bbeauty\b/gi, /kosmetika/gi, /makeup/gi, /parfym/gi, /fragrance/gi, /läppar/gi],
  home: [/inredning/gi, /furniture/gi, /möbler/gi, /\bhem\b/gi, /\bhome\b/gi, /interior/gi, /kudde/gi, /soffa/gi, /lampa/gi, /keramik/gi, /porslin/gi, /\bvas\b/gi, /textil/gi],
  food: [/\bkaffe\b/gi, /coffee/gi, /\bte\b/gi, /choklad/gi, /chocolate/gi, /olivolja/gi, /\bfood\b/gi, /bageri/gi, /bakery/gi, /\bvin\b/gi, /dryck/gi, /snacks/gi, /honung/gi],
  kids: [/\bbarn/gi, /\bkids?\b/gi, /baby/gi, /leksak/gi, /\btoy/gi, /barnkläder/gi, /pram/gi, /vagn/gi],
  electronics: [/elektronik/gi, /gaming/gi, /hörlurar/gi, /headphones/gi, /speaker/gi, /teknik/gi, /\btech\b/gi, /laptop/gi, /telefon/gi, /gadget/gi, /\bljud\b/gi],
  sport: [/\bsport/gi, /träning/gi, /fitness/gi, /\bgym\b/gi, /löpning/gi, /running/gi, /yoga/gi, /cykel/gi, /outdoor/gi, /friluftsliv/gi],
  pets: [/\bhund/gi, /\bdog/gi, /\bkatt/gi, /\bcat/gi, /\bpet/gi, /\bdjur/gi, /koppel/gi, /\bleash/gi],
  art: [/\bkonst/gi, /\bart\b/gi, /\bprint/gi, /poster/gi, /affisch/gi, /galleri/gi, /illustration/gi, /fotografi/gi, /måleri/gi],
  flowers: [/blommor/gi, /flowers/gi, /bukett/gi, /bouquet/gi, /florist/gi, /planta/gi, /plant/gi, /trädgård/gi],
  services: [/byrå/gi, /agency/gi, /studio/gi, /konsult/gi, /consulting/gi, /tjänst/gi, /service/gi, /boka/gi, /booking/gi, /klinik/gi, /behandling/gi],
  other: [],
};

const INDUSTRY_STYLE: Record<BrandIndustry, StylePresetId> = {
  fashion: "luxury",
  jewelry: "luxury",
  beauty: "premiumSkincare",
  home: "nordicMinimal",
  food: "premiumSkincare",
  kids: "kidsClothes",
  electronics: "gaming",
  sport: "streetwear",
  pets: "premiumSkincare",
  art: "nordicMinimal",
  flowers: "premiumSkincare",
  services: "nordicMinimal",
  other: "nordicMinimal",
};

const INDUSTRY_SEGMENT: Record<BrandIndustry, string> = {
  fashion: "Style-conscious shoppers who invest in wardrobe staples and seasonal drops.",
  jewelry: "Gift buyers and self-purchasers looking for fine, lasting pieces.",
  beauty: "Skincare and beauty shoppers who read ingredients and value results.",
  home: "Design-minded people furnishing a calm, lasting home.",
  food: "Curious food and drink lovers who care about origin and craft.",
  kids: "Parents and gift-givers shopping for durable, playful children's products.",
  electronics: "Tech-savvy buyers comparing performance, design and value.",
  sport: "Active people who want functional gear that also looks good.",
  pets: "Devoted pet owners looking for safe, well-designed everyday products.",
  art: "Collectors and interior enthusiasts buying prints and original work.",
  flowers: "Gift-givers and home decorators looking for seasonal flowers and plants.",
  services: "Clients looking for a trusted expert with a clear, premium process.",
  other: "Online shoppers looking for a curated, trustworthy selection.",
};

const VOICE_TONE: Record<BrandVoice, BrandTone> = {
  formal: "premium",
  friendly: "warm",
  luxury: "premium",
  youthful: "bold",
  minimal: "calm",
  playful: "playful",
};

const VOICE_FALLBACK: Record<BrandIndustry, BrandVoice> = {
  fashion: "minimal",
  jewelry: "luxury",
  beauty: "minimal",
  home: "minimal",
  food: "friendly",
  kids: "playful",
  electronics: "youthful",
  sport: "youthful",
  pets: "friendly",
  art: "minimal",
  flowers: "friendly",
  services: "formal",
  other: "minimal",
};

function detectLanguage(facts: PageFacts[]): string {
  const declared = facts.map((page) => page.lang.split("-")[0].toLowerCase()).find((lang) => /^[a-z]{2}$/.test(lang));
  if (declared === "no") return "nb";
  if (declared) return declared;
  const text = facts.map((page) => page.text.slice(0, 4000)).join(" ").toLowerCase();
  const languages: { code: string; words: RegExp }[] = [
    { code: "sv", words: /\b(och|att|är|för|med|inte|som|det|vi)\b/g },
    { code: "nb", words: /\b(og|ikke|er|for|med|som|det|vi)\b/g },
    { code: "da", words: /\b(og|ikke|er|for|med|som|det|vi)\b/g },
    { code: "fi", words: /\b(ja|on|ei|että|kanssa|myös|me)\b/g },
    { code: "en", words: /\b(the|and|is|for|with|you|our|we)\b/g },
    { code: "fr", words: /\b(le|et|est|pour|avec|vous|nous|des)\b/g },
    { code: "de", words: /\b(der|und|ist|für|mit|wir|sie|das)\b/g },
    { code: "es", words: /\b(el|y|es|para|con|nosotros|los|las)\b/g },
  ];
  let best = { code: "en", score: 0 };
  for (const language of languages) {
    const score = (text.match(language.words) ?? []).length;
    if (score > best.score) best = { code: language.code, score };
  }
  return best.code;
}

function detectVoice(facts: PageFacts[], industry: BrandIndustry, markers: Markers) {
  const text = facts.map((page) => page.text).join(" ").slice(0, 60_000);
  const lower = text.toLowerCase();
  const words = Math.max(120, lower.split(/\s+/).length);
  const scores = {} as Record<BrandVoice, number>;
  const keywords = new Set<string>();

  for (const voice of Object.keys(VOICE_WORDS) as BrandVoice[]) {
    let hits = 0;
    for (const pattern of VOICE_WORDS[voice]) {
      const matches = lower.match(pattern) ?? [];
      hits += matches.length;
      const first = matches[0];
      if (first) keywords.add(first.toLowerCase());
    }
    scores[voice] = Math.min(100, Math.round((hits / words) * 1000 * 9));
  }

  const exclamations = (text.match(/!/g) ?? []).length;
  scores.playful = Math.min(100, scores.playful + Math.min(30, Math.round((exclamations / words) * 1000 * 6)));
  scores.youthful = Math.min(100, scores.youthful + Math.min(20, Math.round((exclamations / words) * 1000 * 3)));
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text)) scores.playful = Math.min(100, scores.playful + 18);
  scores.minimal = Math.min(100, scores.minimal + Math.max(0, Math.round(30 - words / 120)));
  if (/\b(welcome|välkommen|velkommen|tervetuloa|bienvenue|willkommen|bienvenido)\b/i.test(lower)) scores.friendly = Math.min(100, scores.friendly + 20);

  let primary = (Object.keys(scores) as BrandVoice[]).sort((a, b) => scores[b] - scores[a])[0];
  const found = Object.values(scores).some((score) => score > 0);
  if (!found) primary = VOICE_FALLBACK[industry];
  markers.take("voice.primary", found);

  const formality: "formal" | "neutral" | "casual" =
    primary === "formal" || primary === "luxury" ? "formal" : primary === "friendly" || primary === "youthful" || primary === "playful" ? "casual" : "neutral";

  return {
    primary,
    tone: VOICE_TONE[primary],
    language: detectLanguage(facts),
    formality,
    keywords: [...keywords].slice(0, 8),
    scores,
  };
}

function detectIndustry(facts: PageFacts[], products: DnaProduct[]): BrandIndustry {
  const text = `${facts.map((page) => page.text).join(" ")} ${products.map((product) => `${product.name} ${product.category}`).join(" ")}`.toLowerCase();
  let best: { industry: BrandIndustry; score: number } = { industry: "other", score: 0 };
  for (const industry of Object.keys(INDUSTRY_WORDS) as BrandIndustry[]) {
    let score = 0;
    for (const pattern of INDUSTRY_WORDS[industry]) {
      score += (text.match(pattern) ?? []).length;
    }
    if (score > best.score) best = { industry, score };
  }
  return best.score >= 3 ? best.industry : "other";
}

/* ------------------------------------------------------------------ */
/* Copy                                                                */
/* ------------------------------------------------------------------ */

const COPY_SUGGESTIONS: Record<Locale, Omit<DnaCopy, "slogan">> = {
  sv: {
    heroTitle: "Välkommen till {brand}",
    heroSubtitle: "Upptäck vår kollektion – gjord med omsorg om detaljerna.",
    heroCta: "Utforska kollektionen",
    heroSecondary: "Läs vår historia",
    announcement: "Fri frakt över 799 kr · Snabb leverans",
    collectionTitle: "Utvalt just nu",
    collectionText: "Säsongens favoriter, handplockade för dig.",
    productIntro: "{product} – en favorit hos våra kunder.",
    newsletterTitle: "Bli först att veta",
    newsletterText: "Nyheter, inspiration och erbjudanden direkt i inkorgen.",
    newsletterCta: "Prenumerera",
    seoTitle: "{brand} | Tidlös design för vardagen",
    seoDescription: "Handla hos {brand}. Utvalt sortiment, trygg betalning och snabb leverans.",
  },
  nb: {
    heroTitle: "Velkommen til {brand}",
    heroSubtitle: "Oppdag kolleksjonen vår – laget med omtanke om detaljene.",
    heroCta: "Utforsk kolleksjonen",
    heroSecondary: "Les historien vår",
    announcement: "Fri frakt over 799 kr · Rask levering",
    collectionTitle: "Utvalgt akkurat nå",
    collectionText: "Sesongens favoritter, håndplukket for deg.",
    productIntro: "{product} – en favoritt blant kundene våre.",
    newsletterTitle: "Bli den første som vet",
    newsletterText: "Nyheter, inspirasjon og tilbud rett i innboksen.",
    newsletterCta: "Abonner",
    seoTitle: "{brand} | Tidløs design for hverdagen",
    seoDescription: "Handle hos {brand}. Utvalgt sortiment, trygg betaling og rask levering.",
  },
  fi: {
    heroTitle: "Tervetuloa {brand}",
    heroSubtitle: "Tutustu mallistoomme – tehty huolella yksityiskohtia myöten.",
    heroCta: "Tutustu mallistoon",
    heroSecondary: "Lue tarinamme",
    announcement: "Ilmainen toimitus yli 79 € · Nopea toimitus",
    collectionTitle: "Valittu juuri nyt",
    collectionText: "Kauden suosikit, valittu sinulle.",
    productIntro: "{product} – asiakkaidemme suosikki.",
    newsletterTitle: "Saat tiedon ensimmäisenä",
    newsletterText: "Uutuudet, inspiraatio ja tarjoukset suoraan sähköpostiisi.",
    newsletterCta: "Tilaa",
    seoTitle: "{brand} | Ajaton muotoilu arkeen",
    seoDescription: "Osta {brand}. Valikoitu valikoima, turvallinen maksu ja nopea toimitus.",
  },
  da: {
    heroTitle: "Velkommen til {brand}",
    heroSubtitle: "Oplev vores kollektion – lavet med omhu for detaljerne.",
    heroCta: "Udforsk kollektionen",
    heroSecondary: "Læs vores historie",
    announcement: "Fri fragt over 799 kr · Hurtig levering",
    collectionTitle: "Udvalgt lige nu",
    collectionText: "Sæsonens favoritter, håndplukket til dig.",
    productIntro: "{product} – en favorit blandt vores kunder.",
    newsletterTitle: "Vær den første til at vide det",
    newsletterText: "Nyheder, inspiration og tilbud direkte i indbakken.",
    newsletterCta: "Tilmeld",
    seoTitle: "{brand} | Tidløst design til hverdagen",
    seoDescription: "Shop hos {brand}. Udvalgt sortiment, sikker betaling og hurtig levering.",
  },
  en: {
    heroTitle: "Welcome to {brand}",
    heroSubtitle: "Discover our collection – made with care for the details.",
    heroCta: "Explore the collection",
    heroSecondary: "Read our story",
    announcement: "Free shipping over €79 · Fast delivery",
    collectionTitle: "Chosen for you",
    collectionText: "Seasonal favourites, hand-picked for you.",
    productIntro: "{product} – a favourite among our customers.",
    newsletterTitle: "Be the first to know",
    newsletterText: "New drops, inspiration and offers straight to your inbox.",
    newsletterCta: "Subscribe",
    seoTitle: "{brand} | Timeless design for every day",
    seoDescription: "Shop at {brand}. A curated range, secure payment and fast delivery.",
  },
  fr: {
    heroTitle: "Bienvenue chez {brand}",
    heroSubtitle: "Découvrez notre collection – pensée dans le détail.",
    heroCta: "Découvrir la collection",
    heroSecondary: "Notre histoire",
    announcement: "Livraison offerte dès 79 € · Livraison rapide",
    collectionTitle: "Sélection du moment",
    collectionText: "Les favoris de la saison, choisis pour vous.",
    productIntro: "{product} – un favori de nos clients.",
    newsletterTitle: "Soyez le premier informé",
    newsletterText: "Nouveautés, inspiration et offres directement dans votre boîte mail.",
    newsletterCta: "S'abonner",
    seoTitle: "{brand} | Un design intemporel au quotidien",
    seoDescription: "Achetez chez {brand}. Sélection soignée, paiement sécurisé et livraison rapide.",
  },
  de: {
    heroTitle: "Willkommen bei {brand}",
    heroSubtitle: "Entdecke unsere Kollektion – mit Liebe zum Detail gemacht.",
    heroCta: "Kollektion entdecken",
    heroSecondary: "Unsere Geschichte",
    announcement: "Versandkostenfrei ab 79 € · Schnelle Lieferung",
    collectionTitle: "Aktuell ausgewählt",
    collectionText: "Die Favoriten der Saison, für dich handverlesen.",
    productIntro: "{product} – ein Favorit unserer Kundinnen und Kunden.",
    newsletterTitle: "Erfahre es zuerst",
    newsletterText: "Neuheiten, Inspiration und Angebote direkt in dein Postfach.",
    newsletterCta: "Abonnieren",
    seoTitle: "{brand} | Zeitloses Design für jeden Tag",
    seoDescription: "Bei {brand} einkaufen. Ausgewähltes Sortiment, sichere Zahlung und schnelle Lieferung.",
  },
  es: {
    heroTitle: "Bienvenido a {brand}",
    heroSubtitle: "Descubre nuestra colección, cuidada hasta el último detalle.",
    heroCta: "Explorar la colección",
    heroSecondary: "Nuestra historia",
    announcement: "Envío gratis desde 79 € · Entrega rápida",
    collectionTitle: "Elegido para ti",
    collectionText: "Los favoritos de la temporada, seleccionados para ti.",
    productIntro: "{product} – un favorito entre nuestros clientes.",
    newsletterTitle: "Entérate primero",
    newsletterText: "Novedades, inspiración y ofertas directamente en tu correo.",
    newsletterCta: "Suscribirme",
    seoTitle: "{brand} | Diseño atemporal para cada día",
    seoDescription: "Compra en {brand}. Selección cuidada, pago seguro y entrega rápida.",
  },
};

const PRODUCT_IDEAS: Record<"sv" | "en", Record<BrandIndustry, string[]>> = {
  sv: {
    fashion: ["Bomullsjacka", "Stickad tröja", "Linneskjorta", "Byxor i ull"],
    jewelry: ["Silverhalsband", "Örhängen No. 2", "Signetring", "Armband i mässing"],
    beauty: ["Ansiktsserum", "Dagkräm", "Rengöringsolja", "Läppbalsam"],
    home: ["Vas i stengods", "Linnepåslakan", "Ljusstake", "Skål i keramik"],
    food: ["Kaffebönor", "Mörk choklad", "Olivolja", "Örtte"],
    kids: ["Bomullströja", "Mjukisleksak", "Barnbyxa", "Regnjacka"],
    electronics: ["Trådlösa hörlurar", "Bärbar högtalare", "Laddningsstation", "Mekaniskt tangentbord"],
    sport: ["Träningsshorts", "Vattenflaska", "Yogamatta", "Sport-bh"],
    pets: ["Hundhalsband", "Kattbädd", "Leksak", "Matskål"],
    art: ["Konstprint A3", "Affisch No. 1", "Risram", "Notbok"],
    flowers: ["Bukett Säsong", "Torkade blommor", "Vas", "Presentkort"],
    services: ["Konsultation", "Studiosession", "Workshop", "Gåvokort"],
    other: ["Produkt No. 1", "Favorit", "Nyhet", "Presentkort"],
  },
  en: {
    fashion: ["Cotton jacket", "Knitted sweater", "Linen shirt", "Wool trousers"],
    jewelry: ["Silver necklace", "Earrings No. 2", "Signet ring", "Brass bracelet"],
    beauty: ["Face serum", "Day cream", "Cleansing oil", "Lip balm"],
    home: ["Stoneware vase", "Linen duvet cover", "Candlestick", "Ceramic bowl"],
    food: ["Coffee beans", "Dark chocolate", "Olive oil", "Herbal tea"],
    kids: ["Cotton sweater", "Soft toy", "Kids trousers", "Rain jacket"],
    electronics: ["Wireless headphones", "Portable speaker", "Charging dock", "Mechanical keyboard"],
    sport: ["Training shorts", "Water bottle", "Yoga mat", "Sports bra"],
    pets: ["Dog collar", "Cat bed", "Toy", "Food bowl"],
    art: ["Art print A3", "Poster No. 1", "Oak frame", "Notebook"],
    flowers: ["Seasonal bouquet", "Dried flowers", "Vase", "Gift card"],
    services: ["Consultation", "Studio session", "Workshop", "Gift card"],
    other: ["Product No. 1", "Favourite", "New arrival", "Gift card"],
  },
};

/* ------------------------------------------------------------------ */
/* Bygget                                                              */
/* ------------------------------------------------------------------ */

function cleanBrandName(value: string): string {
  return value
    .split(/\s+[|–—·:]\s+/)[0]
    .replace(/\s*[-–—]\s*(official|officiell|home|startsida|shop|butik).*$/i, "")
    .replace(/\b(official site|officiell webbplats|home page|startsida)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function brandFromFacts(site: CrawledSite): string {
  const nodes = site.facts.flatMap((page) => page.jsonLd);
  for (const node of nodes) {
    const type = String(node["@type"] ?? "").toLowerCase();
    if ((type.includes("organization") || type.includes("website") || type.includes("store")) && typeof node.name === "string") {
      const value = cleanBrandName(node.name);
      if (value.length >= 2) return value;
    }
  }
  const home = site.home;
  if (home.siteName) return cleanBrandName(home.siteName);
  const logoAlt = home.logoCandidates.find((candidate) => candidate.alt)?.alt ?? "";
  if (logoAlt && !/logo|logotyp|brand|hem/i.test(logoAlt)) return cleanBrandName(logoAlt);
  if (home.ogTitle) {
    const value = cleanBrandName(home.ogTitle);
    if (value.length >= 2) return value;
  }
  if (home.title) {
    const value = cleanBrandName(home.title);
    if (value.length >= 2) return value;
  }
  const host = site.host.replace(/^www\./i, "");
  return host.split(".")[0].replace(/[-_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

const PROMO =
  /(fri frakt|free shipping|free ground|versandkostenfrei|livraison offerte|env[ií]o gratis|ilmainen toimitus|fri fragt|% off|rabatt|kampanj|sale ends|newsletter|prenumerera|sign up|orders? (may|can) take|increased demand|due to demand|kan ta upp till)/i;

function looksLikeSentence(value: string): boolean {
  if (isUiSnippet(value)) return false;
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length < 3) return false;
  // Produktnamn skrivs i Versaler I Varje Ord – en slogan är en mening.
  const capitalized = words.filter((word) => /^[A-ZÅÄÖ]/.test(word)).length / words.length;
  return capitalized <= 0.6;
}

function guessSlogan(facts: PageFacts[]): string {
  const candidates = facts.flatMap((page) => page.paragraphs.filter((paragraph) => paragraph.length >= 18 && paragraph.length <= 100));
  const short = candidates.find((paragraph) => !PROMO.test(paragraph) && looksLikeSentence(paragraph));
  if (short) return short;
  const description = facts
    .map((page) => page.description)
    .find((value) => value.length >= 20)
    ?.split(/(?<=[.!?])\s+/)[0];
  return description && description.length <= 120 && looksLikeSentence(description) ? description : "";
}

function buildCopy(site: CrawledSite, brandName: string, slogan: string, locale: Locale, markers: Markers): DnaCopy {
  const home = site.home;
  const collection = site.pages.find((page) => page.role === "collection")?.facts;
  const product = site.pages.find((page) => page.role === "product")?.facts;
  const suggestion = COPY_SUGGESTIONS[locale] ?? COPY_SUGGESTIONS.sv;
  const fill = (template: string, productName = "") =>
    template.replace(/\{brand\}/g, brandName || "…").replace(/\{product\}/g, productName || "Produkten");
  const h1 = home.headings.find((heading) => heading.level === 1)?.text ?? "";
  const heroTitle = h1.length >= 4 && h1.length <= 90 ? h1 : fill(suggestion.heroTitle);
  const heroParagraph =
    home.paragraphs.find((paragraph) => paragraph.length >= 30 && paragraph.length <= 190 && !PROMO.test(paragraph) && looksLikeSentence(paragraph)) ??
    home.paragraphs.find((paragraph) => paragraph.length >= 30 && paragraph.length <= 190 && !PROMO.test(paragraph));
  const heroSubtitle = heroParagraph ?? (home.description.length >= 20 ? home.description.slice(0, 190) : fill(suggestion.heroSubtitle));
  const newsletter = home.newsletter ?? site.pages.find((page) => page.facts.newsletter)?.facts.newsletter ?? null;
  const collectionHeading =
    collection?.headings.find((heading) => heading.level <= 2)?.text ??
    home.headings.find((heading) => heading.level === 2 && heading.text.length >= 3)?.text ??
    home.navLabels.find((label) => /shop|produkter|products|kollektion|collection|sortiment/i.test(label)) ??
    "";
  const collectionParagraph =
    collection?.paragraphs.find((paragraph) => paragraph.length >= 30 && looksLikeSentence(paragraph) && paragraph !== slogan) ??
    home.paragraphs.find(
      (paragraph) =>
        paragraph.length >= 30 &&
        looksLikeSentence(paragraph) &&
        !PROMO.test(paragraph) &&
        paragraph !== heroParagraph &&
        paragraph !== slogan &&
        paragraph !== heroSubtitle,
    ) ??
    "";

  const copy: DnaCopy = {
    slogan,
    heroTitle,
    heroSubtitle,
    heroCta: home.ctas.find((cta) => cta.length <= 26) ?? fill(suggestion.heroCta),
    heroSecondary: home.ctas.filter((cta) => cta.length <= 26)[1] ?? fill(suggestion.heroSecondary),
    announcement: home.announcement || fill(suggestion.announcement),
    collectionTitle: collectionHeading.length >= 3 ? collectionHeading : fill(suggestion.collectionTitle),
    collectionText: collectionParagraph.length >= 20 ? collectionParagraph.slice(0, 190) : fill(suggestion.collectionText),
    productIntro:
      (product?.paragraphs.find((paragraph) => paragraph.length >= 30 && looksLikeSentence(paragraph) && !PROMO.test(paragraph)) ?? "").slice(0, 220) ||
      (site.shopifyProducts[0]?.description ?? "").replace(/<[^>]*>/g, " ").trim().slice(0, 220) ||
      fill(suggestion.productIntro, product?.headings[0]?.text ?? home.headings.find((heading) => heading.level === 1)?.text ?? ""),
    newsletterTitle: newsletter?.title || fill(suggestion.newsletterTitle),
    newsletterText: newsletter?.text || fill(suggestion.newsletterText),
    newsletterCta: newsletter?.cta || fill(suggestion.newsletterCta),
    seoTitle: (home.title || fill(suggestion.seoTitle)).slice(0, 60),
    seoDescription: (home.description || fill(suggestion.seoDescription)).slice(0, 155),
  };

  const found: Record<string, boolean> = {
    "copy.slogan": Boolean(slogan),
    "copy.heroTitle": heroTitle === h1,
    "copy.heroSubtitle": Boolean(heroParagraph ?? (home.description.length >= 20)),
    "copy.heroCta": Boolean(home.ctas.length),
    "copy.heroSecondary": home.ctas.length > 1,
    "copy.announcement": Boolean(home.announcement),
    "copy.collectionTitle": Boolean(collectionHeading),
    "copy.collectionText": Boolean(collectionParagraph),
    "copy.productIntro": Boolean(product?.paragraphs.some((paragraph) => paragraph.length >= 30 && looksLikeSentence(paragraph) && !PROMO.test(paragraph))),
    "copy.newsletterTitle": Boolean(newsletter?.title),
    "copy.newsletterText": Boolean(newsletter?.text),
    "copy.newsletterCta": Boolean(newsletter?.cta),
    "copy.seoTitle": Boolean(home.title),
    "copy.seoDescription": Boolean(home.description),
  };
  for (const [path, value] of Object.entries(found)) markers.take(path, value);

  return copy;
}

function buildProducts(site: CrawledSite, industry: BrandIndustry, locale: Locale, language: string, markers: Markers): DnaProduct[] {
  const seen = new Set<string>();
  const products: DnaProduct[] = [];
  const add = (product: ExtractedProductLike, source: DnaSource) => {
    const name = product.name.trim().slice(0, 90);
    if (name.length < 2) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    products.push({
      id: `dna-${products.length + 1}`,
      name,
      price: product.price,
      category: product.category,
      image: product.image,
      url: product.url,
      source,
    });
  };

  for (const product of site.shopifyProducts) add(product, "site");
  for (const page of site.facts) for (const product of page.products) add(product, "site");

  if (!products.length) {
    const lang = /^(sv|nb|da)$/.test(language) || locale === "sv" || locale === "nb" || locale === "da" ? "sv" : "en";
    const currency = lang === "sv" ? "kr" : "€";
    const prices = lang === "sv" ? [249, 389, 179, 459] : [29, 45, 19, 59];
    PRODUCT_IDEAS[lang][industry].forEach((name, index) => {
      add({ name, price: `${prices[index]} ${currency}`, category: "", image: "", url: "", description: "" }, "suggested");
    });
    markers.take("products", false);
  }

  return products.slice(0, 12);
}

type ExtractedProductLike = { name: string; price: string; image: string; url: string; category: string; description: string };

function buildPages(site: CrawledSite): DnaPage[] {
  const pages: DnaPage[] = [
    { key: "home", url: site.home.url, found: true, title: site.home.title },
    { key: "footer", url: site.home.url, found: site.home.hasFooter, title: site.home.copyright },
  ];
  for (const role of ["about", "product", "collection", "contact"] as const) {
    const page = site.pages.find((entry) => entry.role === role);
    pages.push({ key: role, url: page?.facts.url ?? "", found: Boolean(page), title: page?.facts.title ?? "" });
  }
  return pages;
}

function assetFromUrl(url: string, source: DnaSource): { url: string; source: DnaSource } {
  return { url: url ?? "", source };
}

export function buildDna(site: CrawledSite, locale: Locale = "sv"): BrandDna {
  const markers = new Markers();
  const notes: string[] = [];
  const brandName = brandFromFacts(site);
  const allProducts = site.shopifyProducts.length ? site.shopifyProducts : site.facts.flatMap((page) => page.products);
  const industry = detectIndustry(
    site.facts,
    allProducts.map((product) => ({
      id: "",
      name: product.name,
      price: product.price,
      category: product.category,
      image: product.image,
      url: product.url,
      source: "site" as DnaSource,
    })),
  );
  const voice = detectVoice(site.facts, industry, markers);
  const styleFromKeywords = styleFromText(`${site.facts.map((page) => `${page.title} ${page.headings.map((heading) => heading.text).join(" ")}`).join(" ")} ${allProducts.map((product) => product.name).join(" ")}`);
  const styleId = styleFromKeywords ?? (voice.primary === "playful" ? "kidsClothes" : voice.primary === "luxury" ? "luxury" : voice.primary === "youthful" ? "streetwear" : INDUSTRY_STYLE[industry]);

  const colors = mergeColors(site.facts);
  const { palette } = pickPalette(colors, styleId, markers);
  const { typography } = pickTypography(site.facts, styleId, markers, notes);
  const design = pickDesign(site.facts, styleId, markers);
  const imagery = pickImagery(site.facts, markers);
  const products = buildProducts(site, industry, locale, voice.language, markers);
  const slogan = guessSlogan(site.facts);
  const copy = buildCopy(site, brandName, slogan, locale, markers);

  const logo = site.home.logoSvg
    ? assetFromUrl(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(site.home.logoSvg)}`, "site")
    : assetFromUrl(site.home.logoCandidates.find((candidate) => candidate.url)?.url ?? "", "site");
  const icon =
    site.home.icons.find((entry) => /apple-touch/i.test(entry.rel)) ??
    site.home.icons.find((entry) => /icon/i.test(entry.rel) && /192|180|512/.test(entry.sizes)) ??
    site.home.icons.find((entry) => /icon|shortcut/i.test(entry.rel));
  const favicon = site.home.icons.find((entry) => /(^|\s)(shortcut icon|icon)(\s|$)/i.test(entry.rel)) ?? icon;
  const manifestIcon = site.manifestIcons.find((entry) => /192|512|180/.test(entry.sizes)) ?? site.manifestIcons[0];
  const ogImage = site.home.images.find((image) => image.alt === "og:image")?.url ?? "";

  markers.take("logo", Boolean(logo.url));
  markers.take("favicon", Boolean(favicon?.url));
  markers.take("appIcon", Boolean(icon?.url || manifestIcon?.url));
  markers.take("socialImage", Boolean(ogImage));
  markers.take("socials", site.home.socials.length > 0);
  markers.take("contact.email", Boolean(site.home.emails.length));
  markers.take("contact.phone", Boolean(site.home.phones.length));
  markers.take("contact.address", Boolean(site.home.addresses.length));
  markers.take("policies.returns", Boolean(site.policies.returns));
  markers.take("policies.shipping", Boolean(site.policies.shipping));

  const socials = site.facts.flatMap((page) => page.socials);
  const socialMap = new Map<string, string>();
  for (const social of socials) if (!socialMap.has(social.platform)) socialMap.set(social.platform, social.url);

  const emails = unique(site.facts.flatMap((page) => page.emails));
  const phones = unique(site.facts.flatMap((page) => page.phones));
  const addresses = unique(site.facts.flatMap((page) => page.addresses));
  const headings = unique(site.facts.flatMap((page) => page.headings.map((heading) => heading.text))).slice(0, 16);
  const phrases = unique(
    site.facts.flatMap((page) => [...page.ctas, ...page.navLabels, ...page.paragraphs.map((paragraph) => paragraph.split(/[.!?]/)[0])]),
  )
    .filter((phrase) => phrase.length >= 8 && phrase.length <= 90)
    .slice(0, 16);

  const headlines = site.facts.flatMap((page) => page.headings.filter((heading) => heading.level === 1).map((heading) => heading.text));
  if (!headlines.length) markers.take("headings", false);

  const markersList = markers.list();

  return {
    version: 1,
    url: site.url,
    domain: site.host.replace(/^www\./i, ""),
    fetchedAt: new Date().toISOString(),
    pagesCrawled: site.facts.length,
    brandName,
    currency: site.currency,
    slogan,
    logo,
    favicon: assetFromUrl(favicon?.url ?? "", "site"),
    appIcon: assetFromUrl(icon?.url || manifestIcon?.url || "", "site"),
    socialImage: assetFromUrl(ogImage, ogImage ? "site" : "suggested"),
    palette,
    typography,
    design,
    imagery,
    voice,
    audience: {
      industry,
      segment: INDUSTRY_SEGMENT[industry],
      keywords: unique([
        ...industryKeywords(industry),
        ...site.facts.flatMap((page) => page.navLabels.filter((label) => /^[\p{L} ]{3,18}$/u.test(label)).slice(0, 3)),
      ]).slice(0, 8),
    },
    products,
    copy,
    headings,
    phrases,
    pages: buildPages(site),
    socials: [...socialMap.entries()].map(([platform, url]) => ({ platform, url })),
    contact: { email: emails[0] ?? "", phone: phones[0] ?? "", address: addresses[0] ?? "" },
    policies: { returns: site.policies.returns, shipping: site.policies.shipping },
    missing: markersList.missing,
    suggested: markersList.suggested,
    notes: [
      ...new Set([...notes, "reference_material", ...(site.notes.includes("robots_unavailable") ? ["robots_unavailable"] : [])]),
    ],
  };
}

function industryKeywords(industry: BrandIndustry): string[] {
  const words: Record<BrandIndustry, string[]> = {
    fashion: ["mode", "kläder", "fashion", "apparel"],
    jewelry: ["smycken", "jewelry", "accessories"],
    beauty: ["hudvård", "beauty", "skincare"],
    home: ["inredning", "home", "interior"],
    food: ["mat", "dryck", "food"],
    kids: ["barn", "kids", "family"],
    electronics: ["teknik", "electronics", "gadgets"],
    sport: ["sport", "träning", "fitness"],
    pets: ["djur", "pets", "accessories"],
    art: ["konst", "art", "prints"],
    flowers: ["blommor", "flowers", "gifts"],
    services: ["tjänster", "services", "expertis"],
    other: ["handel", "shopping", "online"],
  };
  return words[industry];
}

/* ------------------------------------------------------------------ */
/* Applicera på temat                                                  */
/* ------------------------------------------------------------------ */

export function applyDna(config: ThemeConfig, dna: BrandDna): ThemeConfig {
  const { palette, typography, design, copy, brandName, products } = dna;
  const brand: BrandKit = {
    source: "url",
    sourceLabel: dna.domain,
    styleId: design.style,
    tone: dna.voice.tone,
    logoUrl: dna.logo.url || config.brand.logoUrl,
    logoMark: brandName || config.brand.logoMark,
    logoVariantMark: config.brand.logoVariantMark,
    colors: dna.palette.swatches.length ? dna.palette.swatches : config.brand.colors,
    updatedAt: new Date().toISOString(),
    dna,
  };

  const currency = dna.currency || (/^(sv|nb|da)$/.test(dna.voice.language) ? "SEK" : "EUR");
  const nextProducts = products.map((product, index) => ({
    id: product.id || `dna-${index + 1}`,
    name: product.name,
    price: product.price,
    tag: "",
    tone: (index % 6) + 1,
    image: product.image,
    description: "",
  }));
  const isDark = luminance(palette.background) < 0.5;
  const surface = isDark ? mix(palette.background, "#FFFFFF", 0.07) : "#FFFFFF";
  const muted = mix(palette.text, palette.background, isDark ? 0.4 : 0.45);
  const border = isDark ? mix(palette.background, "#FFFFFF", 0.14) : mix(palette.background, palette.text, 0.13);

  return {
    ...config,
    seo: { title: copy.seoTitle || config.seo.title, description: copy.seoDescription || config.seo.description },
    shop: {
      ...config.shop,
      name: brandName || config.shop.name,
      tagline: copy.slogan || copy.heroSubtitle || config.shop.tagline,
      currency,
      products: nextProducts.length ? nextProducts : config.shop.products,
    },
    palette: {
      ...config.palette,
      primary: palette.primary,
      accent: palette.accent,
      background: palette.background,
      text: palette.text,
      surface,
      muted,
      border,
    },
    typography: {
      ...config.typography,
      heading: typography.heading,
      body: typography.body,
      baseSize: typography.baseSize,
      scale: clamp(typography.headingSize / Math.max(12, typography.baseSize), 1.1, 1.6),
      headingWeight: typography.headingWeight,
      tracking: typography.tracking,
      uppercaseHeadings: typography.uppercaseHeadings,
    },
    shape: {
      ...config.shape,
      radius: design.radius,
      buttonRadius: design.buttonRadius,
      shadow: design.shadow,
    },
    tokens: {
      ...config.tokens,
      roundness: Math.round(clamp((design.radius / 28) * 100, 0, 100)),
      shadowLevel: Math.round(clamp((design.shadow / 40) * 100, 0, 100)),
      spaceScale: design.density === "airy" ? 1.1 : design.density === "compact" ? 0.9 : 1,
      buttonStyle: design.buttonStyle,
      inputRadius: Math.round(design.radius * 0.5),
      imageRadius: design.imageRadius,
      cardRadius: design.cardRadius,
    },
    layout: { ...config.layout, density: design.density, sectionSpacing: design.sectionSpacing, gridGap: design.gridGap },
    header: {
      ...config.header,
      logoText: brandName || config.header.logoText,
      announcement: copy.announcement || config.header.announcement,
      links: pickHeaderLinks(dna, config.header.links),
    },
    footer: {
      ...config.footer,
      text: copy.slogan || copy.collectionText || config.footer.text,
      social: dna.socials.length ? dna.socials.map((social) => social.platform.charAt(0).toUpperCase() + social.platform.slice(1)) : config.footer.social,
    },
    media: { ...config.media, logo: dna.logo.url || config.media.logo },
    brand,
    sections: config.sections.map((section) => applyCopyToSection(section, dna)),
  };
}

function pickHeaderLinks(dna: BrandDna, fallback: string[]): string[] {
  const labels = dna.phrases.filter((phrase) => phrase.split(" ").length <= 3 && phrase.length <= 18).slice(0, 4);
  return labels.length >= 3 ? labels : fallback;
}

function applyCopyToSection(section: Section, dna: BrandDna): Section {
  const { copy } = dna;
  switch (section.type) {
    case "hero":
      return {
        ...section,
        eyebrow: copy.slogan || section.eyebrow,
        title: copy.heroTitle || section.title,
        subtitle: copy.heroSubtitle || section.subtitle,
        ctaLabel: copy.heroCta || section.ctaLabel,
        secondaryLabel: copy.heroSecondary || section.secondaryLabel,
      };
    case "productGrid":
      return {
        ...section,
        title: copy.collectionTitle || section.title,
        subtitle: copy.collectionText || section.subtitle,
        collectionLabel: copy.collectionTitle || section.collectionLabel,
      };
    case "newsletter":
      return {
        ...section,
        title: copy.newsletterTitle || section.title,
        text: copy.newsletterText || section.text,
        ctaLabel: copy.newsletterCta || section.ctaLabel,
      };
    case "marquee":
      return { ...section, text: copy.announcement || section.text };
    case "imageText":
      return { ...section, title: copy.slogan || section.title, text: copy.collectionText || section.text };
    case "trust":
      return {
        ...section,
        shipping: dna.policies.shipping ? dna.policies.shipping.slice(0, 120) : section.shipping,
        returns: dna.policies.returns ? dna.policies.returns.slice(0, 120) : section.returns,
      };
    default:
      return section;
  }
}

/** Kort text som skickas med AI-anrop för att hålla ton, bildspråk och copy konsekvent. */
export function dnaPrompt(dna: BrandDna | null | undefined): string {
  if (!dna) return "";
  const productNames = dna.products.slice(0, 6).map((product) => product.name).join(", ");
  return [
    `Brand: ${dna.brandName} (${dna.domain})`,
    `Industry: ${dna.audience.industry}. Audience: ${dna.audience.segment}`,
    `Voice: ${dna.voice.primary} (${dna.voice.formality}), language ${dna.voice.language}. Keywords: ${dna.voice.keywords.join(", ")}`,
    `Palette: primary ${dna.palette.primary}, accent ${dna.palette.accent}, background ${dna.palette.background}, text ${dna.palette.text}`,
    `Type: ${dna.typography.headingFamily} / ${dna.typography.bodyFamily}. Radius ${dna.design.radius}px, buttons ${dna.design.buttonRadius}px, shadow ${dna.design.shadow}`,
    `Photography: ${dna.imagery.style}${dna.imagery.lifestyle ? ", lifestyle" : ""}${dna.imagery.productPhotos ? ", product shots" : ""}. Keywords: ${dna.imagery.keywords.join(", ")}`,
    `Products: ${productNames}`,
    `Hero: ${dna.copy.heroTitle} — ${dna.copy.heroSubtitle}`,
    `Phrases: ${dna.phrases.slice(0, 6).join(" | ")}`,
  ].join("\n");
}

/** Uppdaterar ett fält i DNA:t och markerar det som manuellt redigerat. */
export function editDna(dna: BrandDna, path: string, value: unknown): BrandDna {
  const next = structuredClone(dna);
  const parts = path.split(".");
  let target: Record<string, unknown> = next as unknown as Record<string, unknown>;
  for (const part of parts.slice(0, -1)) {
    const child = target[part];
    if (!child || typeof child !== "object") return dna;
    target = child as Record<string, unknown>;
  }
  target[parts[parts.length - 1]] = value;
  next.suggested = next.suggested.filter((entry) => entry !== path);
  next.missing = next.missing.filter((entry) => entry !== path);
  return next;
}
