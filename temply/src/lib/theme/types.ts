export const LOCALES = ["sv", "nb", "fi", "da", "en", "fr", "de", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "sv";

export function isLocale(value: string | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

export type FontKey =
  | "inter"
  | "dm"
  | "manrope"
  | "space"
  | "sora"
  | "archivo"
  | "playfair"
  | "fraunces"
  | "instrument"
  | "libre";

export const FONTS: Record<
  FontKey,
  { label: string; stack: string; google: string; kind: "sans" | "serif" }
> = {
  inter: { label: "Inter", stack: "'Inter', system-ui, sans-serif", google: "Inter:wght@300;400;500;600;700;800", kind: "sans" },
  dm: { label: "DM Sans", stack: "'DM Sans', system-ui, sans-serif", google: "DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,700", kind: "sans" },
  manrope: { label: "Manrope", stack: "'Manrope', system-ui, sans-serif", google: "Manrope:wght@300;400;500;600;700;800", kind: "sans" },
  space: { label: "Space Grotesk", stack: "'Space Grotesk', system-ui, sans-serif", google: "Space+Grotesk:wght@300;400;500;600;700", kind: "sans" },
  sora: { label: "Sora", stack: "'Sora', system-ui, sans-serif", google: "Sora:wght@300;400;500;600;700;800", kind: "sans" },
  archivo: { label: "Archivo", stack: "'Archivo', system-ui, sans-serif", google: "Archivo:wght@300;400;500;600;700;800;900", kind: "sans" },
  playfair: { label: "Playfair Display", stack: "'Playfair Display', Georgia, serif", google: "Playfair+Display:wght@400;500;600;700", kind: "serif" },
  fraunces: { label: "Fraunces", stack: "'Fraunces', Georgia, serif", google: "Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600;9..144,700", kind: "serif" },
  instrument: { label: "Instrument Serif", stack: "'Instrument Serif', Georgia, serif", google: "Instrument+Serif:ital@0;1", kind: "serif" },
  libre: { label: "Libre Baskerville", stack: "'Libre Baskerville', Georgia, serif", google: "Libre+Baskerville:ital,wght@0,400;0,700;1,400", kind: "serif" },
};

export const SANS_FONTS: FontKey[] = ["inter", "dm", "manrope", "space", "sora", "archivo"];
export const SERIF_FONTS: FontKey[] = ["playfair", "fraunces", "instrument", "libre"];

export const FONT_PAIRINGS: { id: string; heading: FontKey; body: FontKey }[] = [
  { id: "modern", heading: "manrope", body: "inter" },
  { id: "editorial", heading: "fraunces", body: "dm" },
  { id: "luxe", heading: "playfair", body: "archivo" },
  { id: "tech", heading: "space", body: "inter" },
  { id: "soft", heading: "sora", body: "manrope" },
  { id: "classic", heading: "instrument", body: "libre" },
];

export type Palette = {
  background: string;
  surface: string;
  text: string;
  muted: string;
  primary: string;
  accent: string;
  border: string;
};

export type Typography = {
  heading: FontKey;
  body: FontKey;
  baseSize: number;
  scale: number;
  headingWeight: number;
  tracking: number;
  uppercaseHeadings: boolean;
};

export type Shape = {
  radius: number;
  buttonRadius: number;
  borderWidth: number;
  shadow: number;
};

export type Layout = {
  maxWidth: number;
  sectionSpacing: number;
  gridGap: number;
  density: "compact" | "cozy" | "airy";
};

export type Motion = { enabled: boolean; speed: number };

export type Product = {
  id: string;
  name: string;
  price: string;
  compareAt?: string;
  tag?: string;
  tone: number;
  image?: string;
  /** AI-skriven produkttext (demo/klipp-och-klistra i Shopify). */
  description?: string;
};

export type HeroSection = {
  id: string;
  type: "hero";
  visible: boolean;
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  secondaryLabel: string;
  layout: "split" | "center" | "overlay";
  align: "left" | "center";
  image: string;
  showImage: boolean;
};

export type ProductGridSection = {
  id: string;
  type: "productGrid";
  visible: boolean;
  title: string;
  subtitle: string;
  columns: SectionColumns;
  style: "cards" | "minimal" | "rounded";
  showPrice: boolean;
  showRating: boolean;
  collectionLabel: string;
};

export type FeatureItem = { id: string; icon: string; title: string; text: string };
export type FeaturesSection = {
  id: string;
  type: "features";
  visible: boolean;
  title: string;
  subtitle: string;
  items: FeatureItem[];
};

export type ImageTextSection = {
  id: string;
  type: "imageText";
  visible: boolean;
  title: string;
  text: string;
  ctaLabel: string;
  imageSide: "left" | "right";
};

export type TestimonialItem = { id: string; quote: string; author: string; role: string; rating: number };
export type TestimonialsSection = {
  id: string;
  type: "testimonials";
  visible: boolean;
  title: string;
  items: TestimonialItem[];
};

export type MarqueeSection = {
  id: string;
  type: "marquee";
  visible: boolean;
  text: string;
  speed: number;
  style: "solid" | "outline";
};

export type FaqItem = { id: string; q: string; a: string };
export type FaqSection = {
  id: string;
  type: "faq";
  visible: boolean;
  title: string;
  items: FaqItem[];
};

export type NewsletterSection = {
  id: string;
  type: "newsletter";
  visible: boolean;
  title: string;
  text: string;
  ctaLabel: string;
};

export type UgcItem = { id: string; caption: string; author: string; handle: string; image: string; tone: number };
export type UgcSection = {
  id: string;
  type: "ugc";
  visible: boolean;
  title: string;
  subtitle: string;
  source: "instagram" | "tiktok" | "customers";
  items: UgcItem[];
};

export type TrustSection = {
  id: string;
  type: "trust";
  visible: boolean;
  title: string;
  badges: { id: string; icon: string; title: string; text: string }[];
  shipping: string;
  returns: string;
};

export type BundleTier = { id: string; quantity: number; discount: number; label: string };
export type BundleSection = {
  id: string;
  type: "bundle";
  visible: boolean;
  title: string;
  subtitle: string;
  tiers: BundleTier[];
};

export type SizeGuideRow = { id: string; size: string; chest: string; length: string; sleeve: string };
export type SizeGuideSection = {
  id: string;
  type: "sizeGuide";
  visible: boolean;
  title: string;
  note: string;
  rows: SizeGuideRow[];
};

/** Kampanjband med nedräkning – för kampanjdrivna butiker. */
export type CountdownSection = {
  id: string;
  type: "countdown";
  visible: boolean;
  eyebrow: string;
  title: string;
  text: string;
  /** ISO-datum då kampanjen tar slut. */
  endsAt: string;
  ctaLabel: string;
  style: "band" | "box";
};

/** Kategorikort: kollektioner, avdelningar eller kampanjyta. */
export type CollectionTile = { id: string; title: string; count: string; image: string; tone: number };
export type CollectionSection = {
  id: string;
  type: "collection";
  visible: boolean;
  title: string;
  subtitle: string;
  layout: "grid" | "editorial" | "mosaic";
  tiles: CollectionTile[];
};

/** Jämförelsetabell: modeller eller paket sida vid sida. */
export type CompareColumn = { id: string; title: string; price: string; highlight: boolean };
export type CompareRow = { id: string; label: string; values: string[] };
export type ComparisonSection = {
  id: string;
  type: "comparison";
  visible: boolean;
  title: string;
  subtitle: string;
  note: string;
  /** Kolumnerna heter plans för att inte krocka med layoutens columns. */
  plans: CompareColumn[];
  rows: CompareRow[];
};

/** Lookbook: redaktionella bilder med bildtext. */
export type LookbookItem = { id: string; caption: string; tag: string; image: string; tone: number };
export type LookbookSection = {
  id: string;
  type: "lookbook";
  visible: boolean;
  title: string;
  subtitle: string;
  items: LookbookItem[];
};

/** "Complete the look": en huvudprodukt plus tillbehör och totalsumma. */
export type CompleteItem = { id: string; name: string; price: string; image: string; tone: number };
export type CompleteTheLookSection = {
  id: string;
  type: "completeTheLook";
  visible: boolean;
  title: string;
  subtitle: string;
  hero: string;
  heroTone: number;
  items: CompleteItem[];
  total: string;
  ctaLabel: string;
};

/** Storytelling: rubrik, brödtext och ett antal kapitel med siffror. */
export type StoryStep = { id: string; title: string; text: string };
export type StorySection = {
  id: string;
  type: "story";
  visible: boolean;
  title: string;
  text: string;
  image: string;
  imageSide: "left" | "right";
  steps: StoryStep[];
};

export type SectionColumns = 2 | 3 | 4 | 5 | 6;
export type SectionRatio = "square" | "portrait" | "landscape" | "wide";
export type SectionSpan = "even" | "feature" | "mosaic";
export type SectionWidth = "narrow" | "boxed" | "wide" | "full";

/**
 * Layoutmotorn: varje sektion kan styras med kolumner, bildformat, luft och en
 * variant. Samma fält fungerar för alla sektionstyper, så en ny sektion aldrig
 * behöver egna layoutregler.
 */
export type SectionLayout = {
  width?: SectionWidth;
  space?: number;
  /** Kolumner på desktop. Mobil och surfplatta räknas ned automatiskt. */
  columns?: SectionColumns;
  /** Format på kort och bilder i sektionen. */
  ratio?: SectionRatio;
  /** Luftmultiplikator inom sektionen. */
  gap?: number;
  /** Layoutvariant inom typen – byts med ett klick. */
  variant?: string;
  /** Asymmetri: jämnt grid, ett framhävt kort eller mosaik. */
  span?: SectionSpan;
};

export type Section = (
  | HeroSection
  | ProductGridSection
  | FeaturesSection
  | ImageTextSection
  | TestimonialsSection
  | MarqueeSection
  | FaqSection
  | NewsletterSection
  | UgcSection
  | TrustSection
  | BundleSection
  | SizeGuideSection
  | CountdownSection
  | CollectionSection
  | ComparisonSection
  | LookbookSection
  | CompleteTheLookSection
  | StorySection
) &
  SectionLayout;

export type SectionType = Section["type"];

/** Mega-meny: många kategorier och underkategorier i kolumner. */
export type MegaGroup = { id: string; label: string; children: string[]; highlight: boolean };
export type MegaMenu = { enabled: boolean; columns: 2 | 3 | 4; groups: MegaGroup[] };

export type HeaderSettings = {
  logoText: string;
  style: "minimal" | "boxed";
  showSearch: boolean;
  showCart: boolean;
  sticky: boolean;
  announcement: string;
  links: string[];
  /** Var sök och varukorg sitter i headern. */
  actionsPosition?: "left" | "center" | "right";
  mega: MegaMenu;
};

export type FooterSettings = {
  text: string;
  social: string[];
  columns: { title: string; links: string[] }[];
};

export type ShopInfo = {
  name: string;
  tagline: string;
  currency: string;
  products: Product[];
  rating: string;
  customers: string;
};

export type SeoSettings = { title: string; description: string };

/**
 * Marknad: språk, valuta, kampanj och frakt per land. Samma tema kan driva
 * flera butiker utan att kopior behöver underhållas.
 */
export type Market = {
  id: string;
  label: string;
  locale: Locale;
  currency: string;
  /** Frakttext som visas i trust-bar och kassa. */
  shipping: string;
  returns: string;
  /** Kampanjbandets text för marknaden. */
  campaign: string;
  /** Egen hero-text per marknad (valfritt). */
  heroTitle: string;
  heroSubtitle: string;
};

export type MarketSettings = { enabled: boolean; activeId: string; markets: Market[] };

export type LayoutRecipeId = "brand" | "boutique" | "warehouse" | "campaign" | "editorial" | "tech";

/* ------------------------------------------------------------------ */
/* Advanced: fri canvas vid sidan av det temastyrda läget               */
/* ------------------------------------------------------------------ */

/**
 * Tema-styrd är standard. Advanced är ett val, inte en ersättning: sektioner,
 * tokens och Brand DNA ligger kvar och kan användas igen när som helst.
 */
export type BuilderMode = "theme" | "advanced";

export type AdvancedNodeType =
  | "text"
  | "heading"
  | "image"
  | "button"
  | "product"
  | "products"
  | "section"
  | "shape"
  | "drawing"
  | "connector"
  /* Global sidhuvud-yta: logotyp, meny, sök och varukorg */
  | "logo"
  | "nav"
  | "cart"
  | "search";

/** Sidor som Advanced kan bygga. Samma fem sidor som studiots förhandsvisning. */
export type AdvancedPage =
  | "home"
  | "product"
  | "collection"
  | "search"
  | "about"
  | "contact"
  | "cart"
  | "404";

export type AdvancedSectionPreset = "hero" | "campaign" | "products" | "features" | "testimonial" | "banner";

export type AdvancedColorToken = "text" | "muted" | "primary" | "accent" | "surface" | "background" | "onPrimary";

export type AdvancedPoint = { x: number; y: number };

/**
 * En nod på canvasen. Mått och positioner anges i designkoordinater (1200 ×
 * 1400) och skalas proportionellt i förhandsvisningen och i Shopify-temat.
 */
/** Hover-effekt på ett element – ren CSS, fungerar även i Shopify-exporten. */
export type AdvancedHover = "none" | "lift" | "grow" | "glow" | "dim" | "underline" | "tilt";

/** Entréeffekt när sidan laddas. Scrollstyrning kräver JS och undviks. */
export type AdvancedReveal = "none" | "fade-up" | "zoom" | "slide-left" | "slide-right";

export type AdvancedNode = {
  id: string;
  type: AdvancedNodeType;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  rotation: number;
  radius: number;
  opacity: number;
  /* Text, knapp och sektionsinnehåll */
  text?: string;
  eyebrow?: string;
  title?: string;
  ctaLabel?: string;
  href?: string;
  badge?: string;
  /* Bild */
  src?: string;
  alt?: string;
  fit?: "cover" | "contain";
  /* Typografi och färg. Färg är antingen en palettnyckel eller vilken
     giltig CSS-färg som helst (#hex, rgb(), hsl(), namn). */
  color?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  fontSize?: number;
  fontWeight?: number;
  align?: "left" | "center" | "right";
  letterSpacing?: number;
  lineHeight?: number;
  /** Typsnitt: nyckel ur FONTS eller en egen familj i fontFamily. */
  font?: string;
  fontFamily?: string;
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  italic?: boolean;
  /** Ikon för butiksdelar (varukorg, sök) – valfri exportikon. */
  icon?: string;
  /** Sanerad SVG-markup för en egen/uppladdad ikon. */
  iconSvg?: string;
  /** Data-URL för en egen rasterikon (PNG/JPG/WebP/GIF). */
  iconImage?: string;
  iconStroke?: number;
  /** Låst nod: går att markera i lagerlistan men inte flytta på canvasen. */
  locked?: boolean;
  /** Dold nod: syns inte på canvasen och följer inte med i exporten. */
  hidden?: boolean;
  /** Noder med samma grupp-id flyttas tillsammans. */
  groupId?: string;
  /** Effekt när pekaren är över elementet. */
  hover?: AdvancedHover;
  /** Entréeffekt när sidan laddas. */
  reveal?: AdvancedReveal;
  /* Fritt val för produktrader */
  columns?: number;
  gap?: number;
  count?: number;
  /* Form och innehåll */
  shape?: "rect" | "ellipse" | "line";
  preset?: AdvancedSectionPreset;
  productIndex?: number;
  points?: AdvancedPoint[];
  /* Butiksdelar: logotyp, meny, sök och varukorg */
  /** Shopify-handtag för en meny, t.ex. "main-menu". */
  menu?: string;
  /* Koppling mellan två noder */
  fromId?: string;
  toId?: string;
  /**
   * Länk till en riktig Section i config.sections. Finns på startsidans
   * sektionsnoder så att Advanced och det temastyrda läget delar innehåll.
   */
  sectionId?: string;
};

export type AdvancedCanvas = {
  version: 1;
  width: number;
  height: number;
  /** Palettnyckel, egen CSS-färg eller "transparent". */
  background: string;
  /** På undersidor: låt canvasen ersätta standardsidan i stället för att läggas ovanpå. */
  replaceDefault?: boolean;
  /**
   * Senast applicerade designgreppet. `spacing` gör att en ny stil räknas om
   * från föregående luft i stället för att staplas ovanpå – "mer premium" två
   * gånger ger samma yta, inte dubbelt så mycket luft.
   */
  design?: { moods: string[]; spacing: number; scales: { heading: number; body: number; section: number } };
  nodes: AdvancedNode[];
};

export type BuilderSettings = {
  mode: BuilderMode;
  /** Startsidans canvas. Behålls för äldre projekt och är alltid samma som canvases.home. */
  canvas: AdvancedCanvas;
  /** Per-sida-canvasar. Saknade sidor får en tom yta tills de byggs. */
  canvases?: Partial<Record<AdvancedPage, AdvancedCanvas>>;
  /** Global header/varukorg. Ligger över alla sidor och ersätter den vanliga headern. */
  chrome?: AdvancedCanvas;
  /** Fritt redigerbart sidhuvud. Ersätter den temastyrda headern i Advanced. */
  header?: AdvancedCanvas;
  /** Fritt redigerbar sidfot. Ersätter den temastyrda footern i Advanced. */
  footer?: AdvancedCanvas;
};

export type ThemeConfig = {
  version: 1;
  name: string;
  seo: SeoSettings;
  shop: ShopInfo;
  palette: Palette;
  typography: Typography;
  shape: Shape;
  layout: Layout;
  motion: Motion;
  header: HeaderSettings;
  sections: Section[];
  footer: FooterSettings;
  tokens: DesignTokens;
  brand: BrandKit;
  media: MediaLibrary;
  conversion: ConversionSettings;
  integrations: Integrations;
  /** Vilken layoutrecept butiken byggdes från. */
  layoutRecipe: LayoutRecipeId;
  markets: MarketSettings;
  /** Valfritt Advanced-läge. Standard är det temastyrda läget. */
  builder: BuilderSettings;
};

export type MoodId = "minimal" | "warm" | "playful" | "luxe" | "nature" | "neon";

export const PRESET_ORDER: MoodId[] = ["minimal", "warm", "playful", "luxe", "nature", "neon"];

/** Design tokens: en ändring sprider sig genom knappar, kort, bilder och inputs. */
export type DesignTokens = {
  /** Global rundhet 0–100 (0 = rakt, 100 = helt runt). */
  roundness: number;
  /** Skuggnivå 0–100. */
  shadowLevel: number;
  /** Luftmultiplikator 0.75–1.4. */
  spaceScale: number;
  /** Textmultiplikator 0.9–1.2. */
  typeScale: number;
  buttonStyle: "solid" | "outline" | "soft";
  inputRadius: number;
  imageRadius: number;
  cardRadius: number;
};

export type BrandTone = "warm" | "premium" | "bold" | "calm" | "playful" | "technical";
export type BrandSource = "manual" | "url" | "logo" | "palette" | "preset";

/** Varifrån ett värde i Brand DNA:t kommer: sajten, en branschmall eller användaren. */
export type DnaSource = "site" | "suggested" | "manual";

/** Tonläge i språket – bredare än temats BrandTone. */
export type BrandVoice = "formal" | "friendly" | "luxury" | "youthful" | "minimal" | "playful";

export type BrandIndustry =
  | "fashion"
  | "jewelry"
  | "beauty"
  | "home"
  | "food"
  | "kids"
  | "electronics"
  | "sport"
  | "pets"
  | "art"
  | "flowers"
  | "services"
  | "other";

export type DnaAsset = { url: string; source: DnaSource };

export type DnaPalette = {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  button: string;
  swatches: string[];
};

export type DnaTypography = {
  /** Typsnittsnamnet som hittades på sajten (visas för användaren). */
  headingFamily: string;
  bodyFamily: string;
  /** Närmaste typsnitt i temats bibliotek. */
  heading: FontKey;
  body: FontKey;
  baseSize: number;
  headingSize: number;
  lineHeight: number;
  headingWeight: number;
  bodyWeight: number;
  tracking: number;
  uppercaseHeadings: boolean;
};

export type DnaDesign = {
  style: StylePresetId;
  radius: number;
  buttonRadius: number;
  cardRadius: number;
  imageRadius: number;
  sectionSpacing: number;
  gridGap: number;
  shadow: number;
  buttonStyle: DesignTokens["buttonStyle"];
  density: Layout["density"];
};

export type DnaImagery = {
  style: "photography" | "illustration" | "3d" | "mixed";
  productPhotos: boolean;
  lifestyle: boolean;
  keywords: string[];
};

export type DnaProduct = {
  id: string;
  name: string;
  price: string;
  category: string;
  image: string;
  url: string;
  source: DnaSource;
};

export type DnaCopy = {
  slogan: string;
  heroTitle: string;
  heroSubtitle: string;
  heroCta: string;
  heroSecondary: string;
  announcement: string;
  collectionTitle: string;
  collectionText: string;
  productIntro: string;
  newsletterTitle: string;
  newsletterText: string;
  newsletterCta: string;
  seoTitle: string;
  seoDescription: string;
};

export type DnaPageKey = "home" | "about" | "product" | "collection" | "contact" | "footer";
export type DnaPage = { key: DnaPageKey; url: string; found: boolean; title: string };

export type DnaSocial = { platform: string; url: string };

/** Ett komplett, redigerbart Brand DNA byggt från en webbplats. */
export type BrandDna = {
  version: 1;
  url: string;
  domain: string;
  fetchedAt: string;
  pagesCrawled: number;
  brandName: string;
  /** Butikens valuta när den gick att läsa ut (SEK, USD …). */
  currency: string;
  slogan: string;
  logo: DnaAsset;
  favicon: DnaAsset;
  appIcon: DnaAsset;
  socialImage: DnaAsset;
  palette: DnaPalette;
  typography: DnaTypography;
  design: DnaDesign;
  imagery: DnaImagery;
  voice: {
    primary: BrandVoice;
    tone: BrandTone;
    language: string;
    formality: "formal" | "neutral" | "casual";
    keywords: string[];
    scores: Record<BrandVoice, number>;
  };
  audience: { industry: BrandIndustry; segment: string; keywords: string[] };
  products: DnaProduct[];
  copy: DnaCopy;
  headings: string[];
  phrases: string[];
  pages: DnaPage[];
  socials: DnaSocial[];
  contact: { email: string; phone: string; address: string };
  policies: { returns: string; shipping: string };
  /** Dot-paths som saknades på sajten och fylldes med branschförslag. */
  missing: string[];
  /** Dot-paths som är förslag (sajten saknade värdet). */
  suggested: string[];
  notes: string[];
};

export type BrandKit = {
  source: BrandSource;
  sourceLabel: string;
  styleId: StylePresetId;
  tone: BrandTone;
  logoUrl: string;
  logoMark: string;
  logoVariantMark: string;
  colors: string[];
  updatedAt: string;
  /** Senast importerade Brand DNA – används av AI, copy och sektioner. */
  dna?: BrandDna | null;
};

export type MediaLibrary = {
  logo: string;
  heroImage: string;
  heroVideo: string;
  bannerImage: string;
  productVideo: string;
  focal: { x: number; y: number };
  removeBackground: boolean;
  smartCrop: boolean;
  stockQuery: string;
};

export type AbTestId = "off" | "hero" | "cta" | "layout" | "colors";

export type ConversionSettings = {
  stickyAtc: boolean;
  dynamicCheckout: boolean;
  freeShippingBar: boolean;
  freeShippingThreshold: number;
  trustBadges: boolean;
  ugc: boolean;
  bundle: boolean;
  sizeGuide: boolean;
  completeTheLook: boolean;
  recentlyViewed: boolean;
  exitIntent: boolean;
  gdprConsent: boolean;
  abTest: AbTestId;
  abHeadline: string;
  abCta: string;
};

/** Förberedda integrationsplatser: recensioner, nyhetsbrev, chat, lojalitet,
 *  analys, samtycke, betalningar, UGC och kampanj. */
export type IntegrationBlockId =
  | "reviews"
  | "newsletter"
  | "chat"
  | "loyalty"
  | "analytics"
  | "consent"
  | "payments"
  | "ugc"
  | "campaign";

export type IntegrationSlot =
  | "product.reviews"
  | "footer.newsletter"
  | "global.chat"
  | "account.loyalty"
  | "global.analytics"
  | "global.consent"
  | "checkout.payments"
  | "social.ugc"
  | "home.campaign";

export type IntegrationConnection = {
  enabled: boolean;
  providers: string[];
  account: string;
  slot: IntegrationSlot;
  connectedAt: string | null;
  consentAt?: string | null;
};

export type CanvaFormat = "hero" | "campaign" | "product" | "og" | "social" | "email";
export type CanvaUse = "hero" | "campaign" | "product" | "og" | "";

export type CanvaDesign = {
  id: string;
  name: string;
  url: string;
  format: CanvaFormat;
  use: CanvaUse;
  createdAt: string;
};

export type CanvaSource = {
  connected: boolean;
  folder: string;
  lastExportAt: string | null;
  approvedAt?: string | null;
  designs: CanvaDesign[];
};

export type Integrations = {
  klaviyo: boolean;
  klaviyoCompanyId: string;
  reviews: "none" | "judgeme" | "loox" | "shopify";
  reviewsShopId: string;
  appBlocks: boolean;
  searchDiscovery: boolean;
  markets: boolean;
  flow: boolean;
  blocks: Record<IntegrationBlockId, IntegrationConnection>;
  canva: CanvaSource;
};

export type StylePresetId =
  | "premiumSkincare"
  | "gaming"
  | "kidsClothes"
  | "nordicMinimal"
  | "luxury"
  | "streetwear";

export const STYLE_PRESET_ORDER: StylePresetId[] = [
  "premiumSkincare",
  "gaming",
  "kidsClothes",
  "nordicMinimal",
  "luxury",
  "streetwear",
];
