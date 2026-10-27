import type {
  ConversionSettings,
  Integrations,
  Market,
  MediaLibrary,
  MoodId,
  Palette,
  Product,
  Section,
  SectionType,
  Shape,
  ThemeConfig,
  Typography,
} from "./types";
import { DEFAULT_BRAND } from "@/lib/brand/kit";
import { DEFAULT_CANVA, defaultIntegrationBlocks } from "@/lib/integrations/catalog";
import { DEFAULT_TOKENS } from "./tokens";
import { emptyCanvas } from "@/lib/advanced/canvas";

export const DEFAULT_MEDIA: MediaLibrary = {
  logo: "",
  heroImage: "",
  heroVideo: "",
  bannerImage: "",
  productVideo: "",
  focal: { x: 50, y: 50 },
  removeBackground: false,
  smartCrop: true,
  stockQuery: "",
};

export const DEFAULT_CONVERSION: ConversionSettings = {
  stickyAtc: true,
  dynamicCheckout: true,
  freeShippingBar: true,
  freeShippingThreshold: 799,
  trustBadges: true,
  ugc: true,
  bundle: false,
  sizeGuide: false,
  completeTheLook: false,
  recentlyViewed: true,
  exitIntent: false,
  gdprConsent: true,
  abTest: "off",
  abHeadline: "",
  abCta: "",
};

export const DEFAULT_INTEGRATIONS: Integrations = {
  klaviyo: false,
  klaviyoCompanyId: "",
  reviews: "none",
  reviewsShopId: "",
  appBlocks: true,
  searchDiscovery: true,
  markets: true,
  flow: false,
  blocks: defaultIntegrationBlocks(),
  canva: DEFAULT_CANVA,
};

export { PRESET_ORDER } from "./types";

/** Standardmarknader: svensk hemmamarknad plus en EU-marknad. */
export const DEFAULT_MARKETS: Market[] = [
  {
    id: "se",
    label: "Sverige",
    locale: "sv",
    currency: "SEK",
    shipping: "Fri frakt över 799 kr · Leverans 1–3 dagar",
    returns: "30 dagars öppet köp",
    campaign: "Fri frakt över 799 kr · Snabb leverans",
    heroTitle: "",
    heroSubtitle: "",
  },
  {
    id: "eu",
    label: "EU",
    locale: "en",
    currency: "EUR",
    shipping: "Free shipping over €79 · 2–5 days",
    returns: "30-day returns",
    campaign: "Free shipping over €79",
    heroTitle: "",
    heroSubtitle: "",
  },
];

export const DEFAULT_MEGA = {
  enabled: false,
  columns: 3 as const,
  groups: [
    { id: "m1", label: "Handla", children: ["Alla produkter", "Nyheter", "Bästsäljare", "Outlet"], highlight: true },
    { id: "m2", label: "Kategorier", children: ["Hemmet", "Köket", "Present"], highlight: false },
    { id: "m3", label: "Service", children: ["Leverans", "Returer", "Kontakt"], highlight: false },
  ],
};

export const MOODS: Record<
  MoodId,
  {
    palette: Palette;
    typography: Typography;
    shape: Shape;
    hero: "split" | "center" | "overlay";
    productStyle: "cards" | "minimal" | "rounded";
    sampleShop: string;
    sampleTagline: string;
  }
> = {
  minimal: {
    palette: {
      background: "#FAFAF7",
      surface: "#FFFFFF",
      text: "#14140F",
      muted: "#6D6D63",
      primary: "#17171A",
      accent: "#D9F25C",
      border: "#E7E5DC",
    },
    typography: { heading: "manrope", body: "inter", baseSize: 16, scale: 1.24, headingWeight: 700, tracking: -0.02, uppercaseHeadings: false },
    shape: { radius: 10, buttonRadius: 10, borderWidth: 1, shadow: 0 },
    hero: "split",
    productStyle: "minimal",
    sampleShop: "Nord & Form",
    sampleTagline: "Tidlös form, gjord för vardagen.",
  },
  warm: {
    palette: {
      background: "#F7EEE4",
      surface: "#FFF9F1",
      text: "#2B1D15",
      muted: "#7E6A5A",
      primary: "#C2542D",
      accent: "#E9B44C",
      border: "#E6D5C3",
    },
    typography: { heading: "fraunces", body: "dm", baseSize: 17, scale: 1.28, headingWeight: 500, tracking: -0.01, uppercaseHeadings: false },
    shape: { radius: 18, buttonRadius: 999, borderWidth: 1, shadow: 10 },
    hero: "split",
    productStyle: "rounded",
    sampleShop: "Lera & Sol",
    sampleTagline: "Handgjord keramik från Skåne.",
  },
  playful: {
    palette: {
      background: "#FFF7E8",
      surface: "#FFFFFF",
      text: "#201436",
      muted: "#6F6585",
      primary: "#6C4CF1",
      accent: "#FF8A3D",
      border: "#EFE6FF",
    },
    typography: { heading: "sora", body: "manrope", baseSize: 17, scale: 1.32, headingWeight: 800, tracking: -0.03, uppercaseHeadings: false },
    shape: { radius: 28, buttonRadius: 999, borderWidth: 2, shadow: 18 },
    hero: "overlay",
    productStyle: "cards",
    sampleShop: "Snask",
    sampleTagline: "Roliga saker för roliga människor.",
  },
  luxe: {
    palette: {
      background: "#0D0D0D",
      surface: "#171716",
      text: "#F6F1E7",
      muted: "#A49A87",
      primary: "#D9C6A0",
      accent: "#B08C4F",
      border: "#2B2A27",
    },
    typography: { heading: "playfair", body: "archivo", baseSize: 16, scale: 1.42, headingWeight: 500, tracking: 0.02, uppercaseHeadings: true },
    shape: { radius: 2, buttonRadius: 2, borderWidth: 1, shadow: 0 },
    hero: "overlay",
    productStyle: "minimal",
    sampleShop: "MAISON NOIR",
    sampleTagline: "Exceptionella objekt sedan 1984.",
  },
  nature: {
    palette: {
      background: "#F2F4EC",
      surface: "#FFFFFF",
      text: "#1B2A22",
      muted: "#60736A",
      primary: "#245C43",
      accent: "#BCCF8D",
      border: "#DDE3D2",
    },
    typography: { heading: "instrument", body: "inter", baseSize: 17, scale: 1.3, headingWeight: 400, tracking: 0, uppercaseHeadings: false },
    shape: { radius: 6, buttonRadius: 4, borderWidth: 1, shadow: 0 },
    hero: "split",
    productStyle: "minimal",
    sampleShop: "Växthuset",
    sampleTagline: "Växter, jord och långsamma morgnar.",
  },
  neon: {
    palette: {
      background: "#0A0A0F",
      surface: "#14141D",
      text: "#F4F4FF",
      muted: "#9898B4",
      primary: "#B8FF2E",
      accent: "#FF3D9A",
      border: "#262635",
    },
    typography: { heading: "space", body: "inter", baseSize: 16, scale: 1.36, headingWeight: 700, tracking: -0.04, uppercaseHeadings: true },
    shape: { radius: 14, buttonRadius: 14, borderWidth: 1, shadow: 24 },
    hero: "center",
    productStyle: "cards",
    sampleShop: "VOLTAGE",
    sampleTagline: "Ljud för nästa natt.",
  },
};

export const SAMPLE_PRODUCTS: Product[] = [
  { id: "p1", name: "Morgonmugg", price: "249 kr", compareAt: "299 kr", tag: "Nyhet", tone: 1 },
  { id: "p2", name: "Stilla vas", price: "389 kr", tag: "Bästsäljare", tone: 2 },
  { id: "p3", name: "Lerfat", price: "459 kr", tag: "", tone: 3 },
  { id: "p4", name: "Ljusstake No. 2", price: "279 kr", tag: "", tone: 4 },
  { id: "p5", name: "Tekanna Sand", price: "649 kr", tag: "Fåtal kvar", tone: 5 },
  { id: "p6", name: "Dryckeskanna", price: "529 kr", compareAt: "599 kr", tag: "", tone: 6 },
];

export function baseTheme(): ThemeConfig {
  const canvas = emptyCanvas();
  return {
    version: 1,
    name: "Mitt första tema",
    seo: { title: "Nord & Form", description: "" },
    shop: {
      name: "Nord & Form",
      tagline: "Tidlös form, gjord för vardagen.",
      currency: "SEK",
      products: SAMPLE_PRODUCTS,
      rating: "4,9",
      customers: "2 400+",
    },
    palette: { ...MOODS.warm.palette },
    typography: { ...MOODS.warm.typography },
    shape: { ...MOODS.warm.shape },
    layout: { maxWidth: 1180, sectionSpacing: 88, gridGap: 24, density: "cozy" },
    motion: { enabled: true, speed: 600 },
    header: {
      logoText: "Nord & Form",
      style: "minimal",
      showSearch: true,
      showCart: true,
      sticky: true,
      announcement: "Fri frakt över 799 kr · Leverans 1–3 dagar",
      links: ["Shop", "Nyheter", "Om oss", "Kontakt"],
      actionsPosition: "right",
      mega: { ...DEFAULT_MEGA, groups: DEFAULT_MEGA.groups.map((group) => ({ ...group, children: [...group.children] })) },
    },
    sections: [
      {
        id: "hero",
        type: "hero",
        visible: true,
        eyebrow: "Nytillverkat i Sverige",
        title: "Form som håller i generationer.",
        subtitle: "Handgjord keramik och tidlösa objekt för hemmet. Små serier, stor omsorg.",
        ctaLabel: "Utforska kollektionen",
        secondaryLabel: "Vår historia",
        layout: "split",
        align: "left",
        image: "",
        showImage: true,
      },
      {
        id: "products",
        type: "productGrid",
        visible: true,
        title: "Utvalt just nu",
        subtitle: "Säsongens favoriter, gjorda för att användas varje dag.",
        columns: 3,
        style: "rounded",
        showPrice: true,
        showRating: true,
        collectionLabel: "Alla produkter",
      },
      {
        id: "features",
        type: "features",
        visible: true,
        title: "Därför älskar kunderna oss",
        subtitle: "Hantverk, hållbarhet och service i varje paket.",
        items: [
          { id: "f1", icon: "leaf", title: "Hållbart material", text: "Återvunnen lera och naturliga glasyrer utan skadliga ämnen." },
          { id: "f2", icon: "hand", title: "Handgjort", text: "Varje objekt formas och glaseras för hand i vår verkstad." },
          { id: "f3", icon: "truck", title: "Snabb leverans", text: "Skickas inom 24 timmar med spårbar frakt och trygg retur." },
        ],
      },
      {
        id: "story",
        type: "imageText",
        visible: true,
        title: "Lera, eld och tid",
        text: "I en liten verkstad utanför Lund arbetar vi långsamt med material som får åldras vackert. Inga genvägar, inga överflödiga detaljer – bara objekt som vill användas.",
        ctaLabel: "Läs vår historia",
        imageSide: "left",
      },
      {
        id: "marquee",
        type: "marquee",
        visible: true,
        text: "Fri frakt över 799 kr · Handgjort i Sverige · 30 dagars öppet köp · Klimatkompenserad frakt",
        speed: 28,
        style: "solid",
      },
      {
        id: "reviews",
        type: "testimonials",
        visible: true,
        title: "Ord från våra kunder",
        items: [
          { id: "t1", quote: "Muggarna är ännu vackrare i verkligheten. Känslan av handgjort är påtaglig.", author: "Elin S.", role: "Malmö", rating: 5 },
          { id: "t2", quote: "Snabb leverans och fantastiskt paketerat. Jag kommer tillbaka.", author: "Johan K.", role: "Stockholm", rating: 5 },
          { id: "t3", quote: "Vasen har blivit en självklar del av vardagsrummet. Så tidlös.", author: "Amanda L.", role: "Göteborg", rating: 5 },
        ],
      },
      {
        id: "faq",
        type: "faq",
        visible: true,
        title: "Vanliga frågor",
        items: [
          { id: "q1", q: "Hur lång är leveranstiden?", a: "Vi skickar inom 24 timmar på vardagar. Leverans sker normalt inom 1–3 arbetsdagar i Sverige." },
          { id: "q2", q: "Kan jag byta eller returnera?", a: "Självklart. Du har 30 dagars öppet köp från att du tagit emot din order." },
          { id: "q3", q: "Tål keramiken diskmaskin?", a: "Våra glaserade produkter tål maskindisk, men vi rekommenderar handdisk för längsta livslängd." },
        ],
      },
      {
        id: "signup",
        type: "newsletter",
        visible: true,
        title: "Bli först att veta",
        text: "Nya kollektioner, verkstadsdagboken och 10 % på ditt första köp.",
        ctaLabel: "Prenumerera",
      },
    ],
    footer: {
      text: "Handgjord keramik från Skåne. Små serier, stor omsorg.",
      social: ["Instagram", "Pinterest", "Journal"],
      columns: [
        { title: "Handla", links: ["Alla produkter", "Nyheter", "Bästsäljare", "Gåvokort"] },
        { title: "Hjälp", links: ["Leverans", "Returer", "Kontakt", "FAQ"] },
        { title: "Om oss", links: ["Vår historia", "Verkstaden", "Hållbarhet", "Press"] },
      ],
    },
    tokens: { ...DEFAULT_TOKENS },
    brand: { ...DEFAULT_BRAND },
    media: { ...DEFAULT_MEDIA },
    conversion: { ...DEFAULT_CONVERSION },
    integrations: { ...DEFAULT_INTEGRATIONS },
    layoutRecipe: "boutique",
    markets: {
      enabled: true,
      activeId: DEFAULT_MARKETS[0].id,
      markets: DEFAULT_MARKETS.map((market) => ({ ...market })),
    },
    // Standard är det temastyrda läget. Advanced aktiveras först när användaren väljer det.
    builder: { mode: "theme", canvas, canvases: { home: canvas } },
  };
}

export function applyMood(config: ThemeConfig, mood: MoodId): ThemeConfig {
  const m = MOODS[mood];
  const next: ThemeConfig = {
    ...config,
    palette: { ...m.palette },
    typography: { ...m.typography },
    shape: { ...m.shape },
    shop: {
      ...config.shop,
      tagline: config.shop.tagline === MOODS.warm.sampleTagline || config.shop.tagline.length === 0 ? m.sampleTagline : config.shop.tagline,
    },
    sections: config.sections.map((section) => {
      if (section.type === "hero") {
        return { ...section, layout: m.hero, align: m.hero === "center" ? "center" : "left" } as Section;
      }
      if (section.type === "productGrid") {
        return { ...section, style: m.productStyle } as Section;
      }
      return section;
    }),
  };
  return next;
}

export function toneGradient(tone: number): string {
  const palettes = [
    ["#D9C7B0", "#B79E82"],
    ["#C9D5C4", "#9DB29A"],
    ["#E4B7A4", "#C88C74"],
    ["#C6C3DA", "#9C97BB"],
    ["#E8D6A8", "#C9B178"],
    ["#B8C6CF", "#8DA2B0"],
  ];
  const [a, b] = palettes[(tone - 1) % palettes.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

export function emptySection(type: SectionType): Section {
  const id = `${type}-${Math.random().toString(36).slice(2, 7)}`;
  switch (type) {
    case "hero":
      return { id, type, visible: true, eyebrow: "Ny kollektion", title: "En rubrik som fångar blicken.", subtitle: "Berätta kort vad du säljer och varför kunden ska stanna.", ctaLabel: "Handla nu", secondaryLabel: "Läs mer", layout: "center", align: "center", image: "", showImage: false };
    case "productGrid":
      return { id, type, visible: true, title: "Populära produkter", subtitle: "Utvalt av oss, älskat av kunderna.", columns: 3, style: "cards", showPrice: true, showRating: true, collectionLabel: "Alla produkter" };
    case "features":
      return { id, type, visible: true, title: "Varför välja oss", subtitle: "", items: [{ id: `f-${id}`, icon: "star", title: "Kvalitet", text: "Tillverkat för att hålla länge." }, { id: `f2-${id}`, icon: "leaf", title: "Hållbart", text: "Omsorg om material och miljö." }, { id: `f3-${id}`, icon: "truck", title: "Snabb frakt", text: "Skickas inom 24 timmar." }] };
    case "imageText":
      return { id, type, visible: true, title: "Vår berättelse", text: "Berätta om varumärket, hantverket eller produkten.", ctaLabel: "Läs mer", imageSide: "left" };
    case "testimonials":
      return { id, type, visible: true, title: "Kundomdömen", items: [{ id: `t-${id}`, quote: "Bästa köpet på länge.", author: "Kund", role: "Sverige", rating: 5 }] };
    case "marquee":
      return { id, type, visible: true, text: "Fri frakt över 799 kr · Snabb leverans · 30 dagars retur", speed: 28, style: "solid" };
    case "faq":
      return { id, type, visible: true, title: "Frågor & svar", items: [{ id: `q-${id}`, q: "Hur lång är leveransen?", a: "Normalt 1–3 arbetsdagar." }] };
    case "newsletter":
      return { id, type, visible: true, title: "Nyhetsbrev", text: "Få nyheter och erbjudanden först.", ctaLabel: "Prenumerera" };
    case "ugc":
      return {
        id,
        type,
        visible: true,
        title: "Delat av våra kunder",
        subtitle: "Tagga oss med @varumärke för att synas här.",
        source: "customers",
        items: [
          { id: `u1-${id}`, caption: "Perfekt till morgonkaffet.", author: "Sara", handle: "@sarahemma", image: "", tone: 1 },
          { id: `u2-${id}`, caption: "Färgen är ännu finare live.", author: "Olof", handle: "@olof.lund", image: "", tone: 2 },
          { id: `u3-${id}`, caption: "Använder den varje dag.", author: "Maryam", handle: "@maryam.k", image: "", tone: 3 },
          { id: `u4-${id}`, caption: "Snabb leverans och vackert paket.", author: "Peter", handle: "@peternilsson", image: "", tone: 4 },
        ],
      };
    case "trust":
      return {
        id,
        type,
        visible: true,
        title: "Tryggt att handla",
        badges: [
          { id: `b1-${id}`, icon: "truck", title: "Fri frakt över 799 kr", text: "Skickas inom 24 timmar" },
          { id: `b2-${id}`, icon: "shield", title: "Säker betalning", text: "Kort, Klarna och Swish" },
          { id: `b3-${id}`, icon: "hand", title: "30 dagars öppet köp", text: "Enkla returer" },
          { id: `b4-${id}`, icon: "star", title: "4,9 av 5", text: "2 400+ nöjda kunder" },
        ],
        shipping: "Leverans 1–3 arbetsdagar med spårning.",
        returns: "30 dagars öppet köp, fri retur i Norden.",
      };
    case "bundle":
      return {
        id,
        type,
        visible: true,
        title: "Köp fler, spara mer",
        subtitle: "Mängdrabatt räknas automatiskt i kundkorgen.",
        tiers: [
          { id: `t1-${id}`, quantity: 2, discount: 10, label: "2 för 10 %" },
          { id: `t2-${id}`, quantity: 3, discount: 15, label: "3 för 15 %" },
          { id: `t3-${id}`, quantity: 5, discount: 25, label: "5 för 25 %" },
        ],
      };
    case "sizeGuide":
      return {
        id,
        type,
        visible: true,
        title: "Storleksguide",
        note: "Måtten är i centimeter och mäts på plagget.",
        rows: [
          { id: `r1-${id}`, size: "XS", chest: "82", length: "64", sleeve: "58" },
          { id: `r2-${id}`, size: "S", chest: "88", length: "66", sleeve: "59" },
          { id: `r3-${id}`, size: "M", chest: "94", length: "68", sleeve: "60" },
          { id: `r4-${id}`, size: "L", chest: "100", length: "70", sleeve: "61" },
        ],
      };
    case "countdown":
      return {
        id,
        type,
        visible: true,
        eyebrow: "Kampanj",
        title: "Erbjudandet gäller i några dagar",
        text: "Utvalda produkter till kampanjpris så långt lagret räcker.",
        endsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        ctaLabel: "Handla kampanjen",
        style: "band",
      };
    case "collection":
      return {
        id,
        type,
        visible: true,
        title: "Kategorier",
        subtitle: "Hitta rätt bland våra avdelningar.",
        layout: "grid",
        tiles: [
          { id: `c1-${id}`, title: "Nyheter", count: "24 produkter", image: "", tone: 1 },
          { id: `c2-${id}`, title: "Bästsäljare", count: "18 produkter", image: "", tone: 2 },
          { id: `c3-${id}`, title: "Kampanj", count: "36 produkter", image: "", tone: 3 },
          { id: `c4-${id}`, title: "Present", count: "12 produkter", image: "", tone: 4 },
        ],
      };
    case "comparison":
      return {
        id,
        type,
        visible: true,
        title: "Jämför modeller",
        subtitle: "Samma översikt, sida vid sida.",
        note: "Skillnader kan förekomma mellan utföranden.",
        plans: [
          { id: `col1-${id}`, title: "Bas", price: "4 990 kr", highlight: false },
          { id: `col2-${id}`, title: "Plus", price: "7 490 kr", highlight: true },
          { id: `col3-${id}`, title: "Pro", price: "11 990 kr", highlight: false },
        ],
        rows: [
          { id: `row1-${id}`, label: "Skärm", values: ["55\"", "65\"", "75\""] },
          { id: `row2-${id}`, label: "Upplösning", values: ["4K", "4K 120 Hz", "4K 144 Hz"] },
          { id: `row3-${id}`, label: "Garanti", values: ["2 år", "3 år", "5 år"] },
        ],
      };
    case "lookbook":
      return {
        id,
        type,
        visible: true,
        title: "Lookbook",
        subtitle: "Så används kollektionen.",
        items: [
          { id: `l1-${id}`, caption: "Vardag i naturmaterial", tag: "Vår", image: "", tone: 1 },
          { id: `l2-${id}`, caption: "Lager på lager", tag: "Höst", image: "", tone: 2 },
          { id: `l3-${id}`, caption: "Kvällens favorit", tag: "Fest", image: "", tone: 3 },
        ],
      };
    case "completeTheLook":
      return {
        id,
        type,
        visible: true,
        title: "Complete the look",
        subtitle: "Allt som hör ihop, i ett köp.",
        hero: "Huvudprodukt",
        heroTone: 1,
        items: [
          { id: `i1-${id}`, name: "Tillbehör ett", price: "249 kr", image: "", tone: 2 },
          { id: `i2-${id}`, name: "Tillbehör två", price: "349 kr", image: "", tone: 3 },
          { id: `i3-${id}`, name: "Tillbehör tre", price: "199 kr", image: "", tone: 4 },
        ],
        total: "1 297 kr",
        ctaLabel: "Lägg allt i varukorgen",
      };
    case "story":
      return {
        id,
        type,
        visible: true,
        title: "Vår berättelse",
        text: "Berätta varför varumärket finns, vad som skiljer er och vad kunden kan vänta sig.",
        image: "",
        imageSide: "left",
        steps: [
          { id: `s1-${id}`, title: "Materialet", text: "Vi väljer material som håller och går att laga." },
          { id: `s2-${id}`, title: "Tillverkningen", text: "Små serier, gjorda nära kunden." },
          { id: `s3-${id}`, title: "Löftet", text: "Reparation, reservdelar och lång support." },
        ],
      };
  }
}
