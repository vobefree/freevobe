import type {
  HeaderSettings,
  HeroSection,
  LayoutRecipeId,
  Locale,
  Market,
  ProductGridSection,
  Section,
  SectionColumns,
  SectionRatio,
  SectionSpan,
  SectionType,
  ThemeConfig,
} from "./types";
import { emptySection } from "./presets";

/* ------------------------------------------------------------------ */
/* Responsivt grid                                                     */
/* ------------------------------------------------------------------ */

export type GridPlan = { desktop: SectionColumns; tablet: number; mobile: number };

/**
 * En kolumnsiffra räknas ned för mindre skärmar så att en tät varuhusvy på
 * desktop blir läsbar på mobil – utan att användaren behöver göra något.
 */
export function gridPlan(columns: SectionColumns): GridPlan {
  const desktop = Math.max(2, Math.min(6, columns)) as SectionColumns;
  const tablet = desktop >= 5 ? 3 : desktop >= 4 ? 2 : desktop;
  const mobile = desktop >= 4 ? 2 : desktop >= 3 ? 2 : 2;
  return { desktop, tablet, mobile };
}

const RATIO: Record<SectionRatio, string> = {
  square: "1 / 1",
  portrait: "4 / 5",
  landscape: "4 / 3",
  wide: "16 / 9",
};

export function ratioCss(ratio: SectionRatio | undefined): string {
  return RATIO[ratio ?? "portrait"];
}

/**
 * Sektionens grid som CSS-variabler. Preview och export läser samma värden, så
 * förhandsvisningen och det färdiga temat kan inte glida ifrån varandra.
 */
export function gridVars(section: Section): Record<string, string | number> {
  const columns = (section.columns ?? defaultColumns(section.type)) as SectionColumns;
  const plan = gridPlan(columns);
  const span = section.span ?? "even";
  return {
    "--sf-columns": plan.desktop,
    "--sf-columns-tablet": plan.tablet,
    "--sf-columns-mobile": plan.mobile,
    "--sf-ratio": ratioCss(section.ratio),
    "--sf-gap": section.gap ?? 1,
    "--sf-span": span,
  };
}

/** Standardkolumner per sektionstyp när användaren inte valt något. */
export function defaultColumns(type: SectionType): SectionColumns {
  switch (type) {
    case "productGrid":
    case "collection":
    case "lookbook":
      return 4;
    case "comparison":
      return 3;
    case "completeTheLook":
      return 4;
    case "ugc":
      return 4;
    case "features":
    case "trust":
      return 3;
    case "testimonials":
      return 3;
    case "faq":
    case "story":
    case "imageText":
      return 2;
    default:
      return 2;
  }
}

/**
 * Sektionsbiblioteket: varje typ har flera layoutvarianter som byts med ett
 * klick. Varianten blir en klass på sektionen både i förhandsvisningen och i
 * det exporterade temat, så samma val ger samma resultat överallt.
 */
export const SECTION_VARIANTS: Record<SectionType, { id: string; label: string }[]> = {
  hero: [
    { id: "split", label: "Split" },
    { id: "center", label: "Centrerad" },
    { id: "overlay", label: "Över bild" },
    { id: "campaign", label: "Kampanj" },
    { id: "product", label: "Produkt" },
    { id: "editorial", label: "Redaktionell" },
  ],
  productGrid: [
    { id: "grid", label: "Grid" },
    { id: "dense", label: "Tät" },
    { id: "deal", label: "Kampanj" },
    { id: "showcase", label: "Utvald" },
    { id: "editorial", label: "Redaktionell" },
    { id: "spec", label: "Specifikation" },
  ],
  collection: [
    { id: "grid", label: "Grid" },
    { id: "mosaic", label: "Mosaik" },
    { id: "carousel", label: "Karusell" },
  ],
  countdown: [
    { id: "band", label: "Band" },
    { id: "box", label: "Ruta" },
  ],
  comparison: [
    { id: "table", label: "Tabell" },
    { id: "cards", label: "Kort" },
  ],
  lookbook: [
    { id: "grid", label: "Grid" },
    { id: "mosaic", label: "Mosaik" },
    { id: "editorial", label: "Redaktionell" },
  ],
  completeTheLook: [
    { id: "bundle", label: "Paket" },
    { id: "cards", label: "Kort" },
  ],
  story: [
    { id: "steps", label: "Kapitel" },
    { id: "split", label: "Split" },
    { id: "overlay", label: "Över bild" },
  ],
  trust: [
    { id: "badges", label: "Badges" },
    { id: "rows", label: "Rader" },
  ],
  features: [
    { id: "cards", label: "Kort" },
    { id: "list", label: "Lista" },
    { id: "icons", label: "Ikoner" },
  ],
  testimonials: [
    { id: "cards", label: "Kort" },
    { id: "quotes", label: "Citat" },
    { id: "wall", label: "Vägg" },
  ],
  faq: [
    { id: "accordion", label: "Dragspel" },
    { id: "columns", label: "Kolumner" },
  ],
  newsletter: [
    { id: "split", label: "Split" },
    { id: "banner", label: "Banner" },
  ],
  marquee: [
    { id: "solid", label: "Fylld" },
    { id: "outline", label: "Kontur" },
  ],
  imageText: [
    { id: "split", label: "Split" },
    { id: "overlay", label: "Över bild" },
  ],
  bundle: [
    { id: "tiers", label: "Nivåer" },
    { id: "cards", label: "Kort" },
  ],
  sizeGuide: [
    { id: "table", label: "Tabell" },
    { id: "cards", label: "Kort" },
  ],
  ugc: [
    { id: "grid", label: "Grid" },
    { id: "carousel", label: "Karusell" },
  ],
};

export function variantOptions(type: SectionType) {
  return SECTION_VARIANTS[type] ?? [];
}

/** Sektioner vars grid styrs av layoutmotorn. */
export const GRID_SECTIONS: SectionType[] = [
  "productGrid",
  "collection",
  "lookbook",
  "ugc",
  "completeTheLook",
  "features",
  "testimonials",
];

function withGrid(type: SectionType, patch: Partial<Section>): Partial<Section> {
  return GRID_SECTIONS.includes(type) ? patch : {};
}

/** Sätter kolumner/format på alla gridsektioner samtidigt. */
export function setGlobalGrid(config: ThemeConfig, patch: { columns?: SectionColumns; ratio?: SectionRatio; span?: SectionSpan; gap?: number }): ThemeConfig {
  return {
    ...config,
    sections: config.sections.map((section) => ({ ...section, ...withGrid(section.type, patch) }) as Section),
  };
}

/* ------------------------------------------------------------------ */
/* Layoutrecept                                                        */
/* ------------------------------------------------------------------ */

export type RecipeStep = {
  type: SectionType;
  variant?: string;
  columns?: SectionColumns;
  ratio?: SectionRatio;
  span?: SectionSpan;
  width?: Section["width"];
  gap?: number;
};

export type LayoutRecipe = {
  id: LayoutRecipeId;
  /** Täthet: hur mycket luft temat har mellan sektioner. */
  density: ThemeConfig["layout"]["density"];
  columns: SectionColumns;
  ratio: SectionRatio;
  span: SectionSpan;
  gridGap: number;
  sectionSpacing: number;
  maxWidth: number;
  hero: HeroSection["layout"];
  productStyle: ProductGridSection["style"];
  mega: HeaderSettings["mega"]["enabled"];
  megaColumns: HeaderSettings["mega"]["columns"];
  /** Sektionsplanen layoutmotorn bygger butiken från. */
  plan: RecipeStep[];
};

const CORE: RecipeStep[] = [
  { type: "trust" },
  { type: "features" },
  { type: "testimonials" },
  { type: "faq" },
  { type: "newsletter" },
];

/**
 * Sex recept som spänner från liten varumärkesbutik till kampanjdrivet varuhus.
 * Recepten är generella: de beskriver struktur och täthet, inte bransch.
 */
export const LAYOUT_RECIPES: Record<LayoutRecipeId, LayoutRecipe> = {
  brand: {
    id: "brand",
    density: "airy",
    columns: 2,
    ratio: "portrait",
    span: "even",
    gridGap: 40,
    sectionSpacing: 132,
    maxWidth: 1080,
    hero: "center",
    productStyle: "minimal",
    mega: false,
    megaColumns: 3,
    plan: [
      { type: "hero", variant: "editorial" },
      { type: "story", columns: 2 },
      { type: "productGrid", variant: "showcase", columns: 2 },
      { type: "lookbook", columns: 2 },
      ...CORE,
    ],
  },
  boutique: {
    id: "boutique",
    density: "cozy",
    columns: 3,
    ratio: "portrait",
    span: "even",
    gridGap: 26,
    sectionSpacing: 96,
    maxWidth: 1220,
    hero: "split",
    productStyle: "rounded",
    mega: false,
    megaColumns: 3,
    plan: [
      { type: "hero", variant: "split" },
      { type: "collection", columns: 3 },
      { type: "productGrid", variant: "featured", columns: 3 },
      { type: "imageText", columns: 2 },
      { type: "marquee" },
      { type: "testimonials" },
      { type: "trust" },
      { type: "faq" },
      { type: "newsletter" },
    ],
  },
  editorial: {
    id: "editorial",
    density: "cozy",
    columns: 3,
    ratio: "landscape",
    span: "feature",
    gridGap: 22,
    sectionSpacing: 104,
    maxWidth: 1280,
    hero: "overlay",
    productStyle: "cards",
    mega: true,
    megaColumns: 3,
    plan: [
      { type: "hero", variant: "campaign" },
      { type: "lookbook", columns: 3, span: "feature" },
      { type: "productGrid", variant: "editorial", columns: 3 },
      { type: "story", columns: 2 },
      { type: "countdown", width: "wide" },
      { type: "completeTheLook", columns: 4 },
      ...CORE,
    ],
  },
  campaign: {
    id: "campaign",
    density: "compact",
    columns: 4,
    ratio: "square",
    span: "even",
    gridGap: 18,
    sectionSpacing: 68,
    maxWidth: 1320,
    hero: "overlay",
    productStyle: "cards",
    mega: true,
    megaColumns: 4,
    plan: [
      { type: "countdown", variant: "band", width: "full" },
      { type: "hero", variant: "campaign" },
      { type: "collection", columns: 4 },
      { type: "productGrid", variant: "deal", columns: 4 },
      { type: "bundle", columns: 3 },
      { type: "trust" },
      { type: "testimonials" },
      { type: "ugc", columns: 4 },
      { type: "newsletter" },
    ],
  },
  warehouse: {
    id: "warehouse",
    density: "compact",
    columns: 5,
    ratio: "square",
    span: "even",
    gridGap: 14,
    sectionSpacing: 60,
    maxWidth: 1440,
    hero: "overlay",
    productStyle: "cards",
    mega: true,
    megaColumns: 4,
    plan: [
      { type: "countdown", variant: "band", width: "full" },
      { type: "collection", columns: 5 },
      { type: "productGrid", variant: "deal", columns: 5 },
      { type: "comparison", columns: 3, width: "wide" },
      { type: "productGrid", variant: "dense", columns: 6 },
      { type: "trust" },
      { type: "bundle", columns: 4 },
      { type: "features", columns: 4 },
      { type: "faq", columns: 2 },
      { type: "newsletter" },
    ],
  },
  tech: {
    id: "tech",
    density: "compact",
    columns: 4,
    ratio: "landscape",
    span: "mosaic",
    gridGap: 16,
    sectionSpacing: 72,
    maxWidth: 1400,
    hero: "split",
    productStyle: "cards",
    mega: true,
    megaColumns: 4,
    plan: [
      { type: "hero", variant: "product" },
      { type: "collection", columns: 4, span: "mosaic" },
      { type: "productGrid", variant: "spec", columns: 4 },
      { type: "comparison", columns: 3, width: "wide" },
      { type: "completeTheLook", columns: 4 },
      { type: "trust" },
      { type: "countdown", width: "wide" },
      { type: "features", columns: 4 },
      { type: "testimonials" },
      { type: "newsletter" },
    ],
  },
};

export const RECIPE_ORDER: LayoutRecipeId[] = ["brand", "boutique", "editorial", "campaign", "warehouse", "tech"];

/** Sektioner som är kärnan i ett recept och som alltid behåller sin copy. */
const PRESERVED: SectionType[] = ["hero", "productGrid", "newsletter"];

function applyStep(section: Section, step: RecipeStep, recipe: LayoutRecipe): Section {
  // Kolumner och bildformat sätts bara på sektioner som faktiskt har ett grid.
  const gridded = GRID_SECTIONS.includes(step.type) || step.type === "comparison" || step.type === "story";
  return {
    ...section,
    ...(gridded
      ? {
          columns: step.columns ?? section.columns ?? recipe.columns,
          ratio: step.ratio ?? section.ratio ?? recipe.ratio,
          gap: step.gap ?? section.gap ?? 1,
          span: step.span ?? section.span ?? recipe.span,
        }
      : {}),
    variant: step.variant ?? section.variant,
    width: step.width ?? section.width,
  };
}

/**
 * Applicerar ett layoutrecept på temat: struktur, täthet, grid och mega-meny
 * ändras, medan text, produkter och Brand DNA behålls.
 */
export function applyRecipe(config: ThemeConfig, id: LayoutRecipeId): ThemeConfig {
  const recipe = LAYOUT_RECIPES[id] ?? LAYOUT_RECIPES.boutique;
  const byType = new Map<SectionType, Section[]>();
  for (const section of config.sections) {
    const list = byType.get(section.type) ?? [];
    list.push(section);
    byType.set(section.type, list);
  }

  const used = new Set<string>();
  const sections: Section[] = [];

  for (const step of recipe.plan) {
    const existing = byType.get(step.type)?.find((section) => !used.has(section.id));
    if (existing) {
      used.add(existing.id);
      sections.push(applyStep(existing, step, recipe));
      continue;
    }
    sections.push(applyStep(emptyStep(step.type), step, recipe));
  }

  // Sektioner användaren lagt till själv behålls sist, så inget arbete försvinner.
  for (const section of config.sections) {
    if (used.has(section.id)) continue;
    if (PRESERVED.includes(section.type) && !sections.some((item) => item.type === section.type)) {
      sections.unshift(section);
      continue;
    }
    sections.push(section);
  }

  return {
    ...config,
    layoutRecipe: id,
    layout: {
      ...config.layout,
      maxWidth: recipe.maxWidth,
      sectionSpacing: recipe.sectionSpacing,
      gridGap: recipe.gridGap,
      density: recipe.density,
    },
    header: {
      ...config.header,
      mega: { ...config.header.mega, enabled: recipe.mega, columns: recipe.megaColumns },
    },
    sections,
  };
}

function emptyStep(type: SectionType): Section {
  return emptySection(type);
}

/* ------------------------------------------------------------------ */
/* Marknader                                                           */
/* ------------------------------------------------------------------ */

export function activeMarket(config: ThemeConfig): Market | null {
  const settings = config.markets;
  if (!settings?.markets?.length) return null;
  return settings.markets.find((market) => market.id === settings.activeId) ?? settings.markets[0] ?? null;
}

export type ResolvedMarket = {
  market: Market | null;
  locale: Locale;
  currency: string;
  shipping: string;
  returns: string;
  campaign: string;
  heroTitle: string;
  heroSubtitle: string;
};

/**
 * Slår ihop marknadens värden med temat. Saknas marknaden används temats egna
 * texter, så äldre projekt utan marknader fungerar precis som förut.
 */
export function resolveMarket(config: ThemeConfig, fallbackLocale: Locale): ResolvedMarket {
  const market = activeMarket(config);
  return {
    market,
    locale: market?.locale ?? fallbackLocale,
    currency: market?.currency || config.shop.currency,
    shipping: market?.shipping || "",
    returns: market?.returns || "",
    campaign: market?.campaign || config.header.announcement,
    heroTitle: market?.heroTitle || "",
    heroSubtitle: market?.heroSubtitle || "",
  };
}

