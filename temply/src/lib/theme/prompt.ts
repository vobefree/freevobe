import { baseTheme, MOODS } from "./presets";
import { applyRecipe } from "./layout";
import type { LayoutRecipeId, MoodId, Product, ThemeConfig } from "./types";

/**
 * Layoutrecept från prompten. Beskrivningen styr struktur och täthet – inte
 * branschen – så samma ord fungerar för vilken butik som helst.
 */
const RECIPE_WORDS: [LayoutRecipeId, RegExp][] = [
  ["warehouse", /varuhus|stormarknad|warehouse|hypermarket|elgiganten|mediamarkt|media markt|best ?buy|currys|teknikmagasinet|stort sortiment|breda sortiment|många kategorier|manga kategorier/],
  ["tech", /gaming|teknik|electronics?|tech|specifikation|jämför|jamfor|dator|mobil|hörlurar|horlurar|skärm/],
  ["campaign", /kampanj|rea\b|black friday|deal|rabatt|erbjudande|sale|countdown|nedräkning/],
  ["editorial", /editorial|redaktionell|magasin|lookbook|lyxig|lyx|lux|exklusiv|ateljé|inredning|möbel|mobel/],
  ["brand", /minimalistisk|minimal|varumärkesbutik|ren och enkel|enkel butik|brand store|single brand/],
];

function recipeFromPrompt(query: string): LayoutRecipeId | null {
  for (const [id, test] of RECIPE_WORDS) if (test.test(query)) return id;
  return null;
}

type Niche = {
  shop: string;
  tagline: string;
  hero: string;
  eyebrow: string;
  products: Omit<Product, "id" | "tone">[];
  words: string[];
};

const NICHES: Niche[] = [
  {
    shop: "Lera & Sol",
    tagline: "Handgjord keramik från Skåne.",
    hero: "Keramik som får ta plats.",
    eyebrow: "Nytillverkat för hand",
    products: [
      { name: "Morgonmugg", price: "249 kr", tag: "Nyhet" },
      { name: "Stilla vas", price: "389 kr", tag: "Bästsäljare" },
      { name: "Lerfat", price: "459 kr" },
      { name: "Ljusstake No. 2", price: "279 kr" },
      { name: "Tekanna Sand", price: "649 kr", tag: "Fåtal kvar" },
      { name: "Dryckeskanna", price: "529 kr" },
    ],
    words: ["keramik", "ceramic", "pottery", "mugg", "vas", "lera", "porslin"],
  },
  {
    shop: "Studio Linne",
    tagline: "Vardagskläder i naturliga material.",
    hero: "Kläder man lever i.",
    eyebrow: "Ny kollektion",
    products: [
      { name: "Overshirt Ecru", price: "899 kr", tag: "Nyhet" },
      { name: "Linnebyxa", price: "749 kr" },
      { name: "T-shirt Heavy", price: "349 kr", tag: "Bästsäljare" },
      { name: "Knit Vest", price: "699 kr" },
      { name: "Canvas Bag", price: "399 kr" },
      { name: "Wool Sock", price: "149 kr" },
    ],
    words: ["kläder", "klader", "fashion", "mode", "apparel", "kläd", "shirt", "byxor"],
  },
  {
    shop: "Rosteriet",
    tagline: "Färskrostat kaffe, varje vecka.",
    hero: "Kaffe med karaktär.",
    eyebrow: "Rostat i Göteborg",
    products: [
      { name: "Filtret Blend", price: "129 kr", tag: "Nyhet" },
      { name: "Espresso No. 4", price: "139 kr" },
      { name: "Single Origin", price: "169 kr", tag: "Bästsäljare" },
      { name: "Prenumeration", price: "299 kr" },
      { name: "Handkvarn", price: "549 kr" },
      { name: "Mugg 25 cl", price: "189 kr" },
    ],
    words: ["kaffe", "coffee", "espresso", "roastery", "bönor", "te"],
  },
  {
    shop: "Hud & Hav",
    tagline: "Hudvård med rena ingredienser.",
    hero: "Hudvård som andas.",
    eyebrow: "Dermatologiskt testad",
    products: [
      { name: "Rengöring", price: "249 kr", tag: "Nyhet" },
      { name: "Ansiktsolja", price: "329 kr" },
      { name: "Fuktcreme", price: "289 kr", tag: "Bästsäljare" },
      { name: "Serum C", price: "399 kr" },
      { name: "Lerpasta", price: "199 kr" },
      { name: "Läppbalsam", price: "99 kr" },
    ],
    words: ["hudvård", "hudvard", "skincare", "beauty", "serum", "kräm", "creme"],
  },
  {
    shop: "Atelier Guld",
    tagline: "Smycken att ärva.",
    hero: "Detaljer som stannar.",
    eyebrow: "Handgjort i Stockholm",
    products: [
      { name: "Örhänge No. 1", price: "1 290 kr", tag: "Nyhet" },
      { name: "Signet Ring", price: "1 890 kr" },
      { name: "Halsband Fine", price: "1 490 kr", tag: "Bästsäljare" },
      { name: "Armband", price: "990 kr" },
      { name: "Berlock", price: "590 kr" },
      { name: "Stift", price: "790 kr" },
    ],
    words: ["smycken", "jewelry", "ring", "halsband", "guld", "silver", "örhänge"],
  },
  {
    shop: "Form & Trä",
    tagline: "Möbler för långsamma hem.",
    hero: "Möbler som åldras vackert.",
    eyebrow: "Svenskt hantverk",
    products: [
      { name: "Pall Ek", price: "1 490 kr", tag: "Nyhet" },
      { name: "Soffbord", price: "3 900 kr" },
      { name: "Konsol", price: "4 500 kr", tag: "Bästsäljare" },
      { name: "Stol Linne", price: "2 290 kr" },
      { name: "Hyllplan", price: "890 kr" },
      { name: "Lampa No. 3", price: "1 190 kr" },
    ],
    words: ["möbler", "mobler", "furniture", "inredning", "interior", "trä", "bord", "stol"],
  },
];

const MOOD_WORDS: [MoodId, RegExp][] = [
  ["luxe", /lyx|lux|elegant|premium|guld|gold|svart|black|maison|exklusiv/],
  ["playful", /lek|play|färg|color|ung|fun|glad|candy|rolig/],
  ["nature", /natur|nature|grön|green|skog|eko|organic|hållbar|vaxt|växt/],
  ["neon", /neon|tech|futur|cyber|gaming|ljud|audio|natt/],
  ["minimal", /minimal|ljus|light|clean|enkel|scandi|tidlös/],
  ["warm", /varm|warm|terrakotta|beige|kram|mjuk|jord|keramik/],
];

const COLOR_WORDS: [RegExp, string][] = [
  [/rosa|pink/, "#F26D9C"],
  [/lila|purple|violet/, "#6C4CF1"],
  [/blå|bla|blue/, "#2E5BFF"],
  [/grön|gron|green/, "#1F7A4D"],
  [/röd|rod|red/, "#D93A2B"],
  [/orange/, "#F2762E"],
  [/gul|yellow/, "#F2C230"],
  [/turkos|teal/, "#0E8B86"],
  [/brun|brown|terrakotta/, "#B0592F"],
];

export function parsePrompt(prompt: string, current: ThemeConfig, locale: string): { config: ThemeConfig; mood: MoodId; niche: string } {
  const q = prompt.toLowerCase();
  let config: ThemeConfig = { ...current, sections: current.sections.map((s) => ({ ...s })) };
  let mood: MoodId = "warm";
  for (const [id, rx] of MOOD_WORDS) {
    if (rx.test(q)) {
      mood = id;
      break;
    }
  }
  const preset = MOODS[mood];
  config.palette = { ...preset.palette };
  config.typography = { ...preset.typography };
  config.shape = { ...preset.shape };
  config.sections = config.sections.map((s) =>
    s.type === "hero" ? { ...s, layout: preset.hero, align: preset.hero === "center" ? "center" : "left" } : s.type === "productGrid" ? { ...s, style: preset.productStyle } : s,
  );

  let niche = "generic";
  for (const n of NICHES) {
    if (n.words.some((w) => q.includes(w))) {
      niche = n.shop;
      config.shop = {
        ...config.shop,
        name: n.shop,
        tagline: n.tagline,
        products: n.products.map((p, i) => ({ ...p, id: `p${i + 1}`, tone: i + 1 })),
      };
      config.header = { ...config.header, logoText: n.shop };
      config.sections = config.sections.map((s) => {
        if (s.type === "hero") return { ...s, title: n.hero, eyebrow: n.eyebrow, subtitle: n.tagline };
        if (s.type === "productGrid") return { ...s, title: "Utvalt just nu", subtitle: n.tagline };
        return s;
      });
      break;
    }
  }

  for (const [rx, color] of COLOR_WORDS) {
    if (rx.test(q)) {
      config.palette = { ...config.palette, primary: color, accent: color, ...(color === "#17171A" ? {} : {}) };
      break;
    }
  }

  if (/mörk|dark|natt|black/.test(q) && !/svart/.test(q)) {
    config.palette = { ...MOODS.luxe.palette, primary: config.palette.primary };
    config.typography = { ...config.typography, heading: MOODS.luxe.typography.heading, uppercaseHeadings: false };
  }
  if (/pill|rundad|rounded|mjuk/.test(q)) {
    config.shape = { ...config.shape, radius: Math.max(config.shape.radius, 24), buttonRadius: 999 };
  }
  if (/rak|square|sharp|kantig|minimal/.test(q)) {
    config.shape = { ...config.shape, radius: 2, buttonRadius: 2 };
  }
  if (/serif|klassisk|elegant|redaktionell|editorial/.test(q)) {
    config.typography = { ...config.typography, heading: "fraunces", body: "dm" };
  }
  if (/mono|tech|futuristisk/.test(q)) {
    config.typography = { ...config.typography, heading: "space", body: "inter" };
  }
  if (/stor text|stora rubriker|big type/.test(q)) {
    config.typography = { ...config.typography, scale: 1.5 };
  }
  if (/luftig|airy|rymlig/.test(q)) {
    config.layout = { ...config.layout, sectionSpacing: 120, density: "airy" };
  }
  if (/kompakt|compact|tat/.test(q)) {
    config.layout = { ...config.layout, sectionSpacing: 56, density: "compact" };
  }

  // Layoutmotorn: beskrivningen väljer struktur innan texten finslipas.
  // Receptet behåller copy, produkter och Brand DNA.
  const recipe = recipeFromPrompt(q);
  if (recipe) config = applyRecipe(config, recipe);

  const header = config.header;
  config.header = { ...header, logoText: config.shop.name };
  config.name = locale === "sv" || locale === "nb" || locale === "da" ? `${config.shop.name} – tema` : `${config.shop.name} theme`;
  return { config, mood, niche };
}
