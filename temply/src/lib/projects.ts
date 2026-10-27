import { baseTheme, DEFAULT_CONVERSION, DEFAULT_INTEGRATIONS, DEFAULT_MARKETS, DEFAULT_MEDIA } from "./theme/presets";
import { DEFAULT_TOKENS } from "./theme/tokens";
import { DEFAULT_BRAND } from "./brand/kit";
import { normalizeCanvas } from "./advanced/canvas";
import type { ThemeConfig } from "./theme/types";
import type { ProjectRow } from "./db";

function normalizeBuilder(builder: ThemeConfig["builder"] | undefined): ThemeConfig["builder"] {
  const canvas = normalizeCanvas(builder?.canvases?.home ?? builder?.canvas);
  const canvases = Object.fromEntries(
    Object.entries(builder?.canvases ?? {}).map(([page, value]) => [page, normalizeCanvas(value)]),
  ) as ThemeConfig["builder"]["canvases"];
  return {
    mode: builder?.mode === "advanced" ? "advanced" : "theme",
    canvas,
    canvases: { ...canvases, home: canvas },
    chrome: normalizeCanvas(builder?.chrome),
    // Saknas ytorna seedas de från butikens header/footer. Finns de sparas
    // varje fri placering och färg exakt som användaren lämnade dem.
    header: builder?.header ? normalizeCanvas(builder.header, 80) : undefined,
    footer: builder?.footer ? normalizeCanvas(builder.footer, 80) : undefined,
  };
}

/**
 * Fyller på nya fält utan att röra det som redan finns, så att projekt sparade
 * före varumärkeskit, tokens, media och konverteringsblock fortsätter fungera.
 */
export function normalizeTheme(parsed: Partial<ThemeConfig> | null | undefined): ThemeConfig {
  const base = baseTheme();
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.sections) || !parsed.palette) return base;
  return {
    ...base,
    ...parsed,
    seo: { ...base.seo, ...parsed.seo },
    shop: { ...base.shop, ...parsed.shop },
    palette: { ...base.palette, ...parsed.palette },
    typography: { ...base.typography, ...parsed.typography },
    shape: { ...base.shape, ...parsed.shape },
    layout: { ...base.layout, ...parsed.layout },
    motion: { ...base.motion, ...parsed.motion },
    header: { ...base.header, ...parsed.header, mega: { ...base.header.mega, ...parsed.header?.mega, groups: parsed.header?.mega?.groups ?? base.header.mega.groups } },
    footer: { ...base.footer, ...parsed.footer },
    tokens: { ...DEFAULT_TOKENS, ...parsed.tokens },
    brand: { ...DEFAULT_BRAND, ...parsed.brand },
    media: { ...DEFAULT_MEDIA, ...parsed.media, focal: { ...DEFAULT_MEDIA.focal, ...parsed.media?.focal } },
    conversion: { ...DEFAULT_CONVERSION, ...parsed.conversion },
    integrations: {
      ...DEFAULT_INTEGRATIONS,
      ...parsed.integrations,
      blocks: { ...DEFAULT_INTEGRATIONS.blocks, ...parsed.integrations?.blocks },
      canva: { ...DEFAULT_INTEGRATIONS.canva, ...parsed.integrations?.canva, designs: parsed.integrations?.canva?.designs ?? [] },
    },
    markets: {
      ...base.markets,
      ...parsed.markets,
      markets: parsed.markets?.markets?.length ? parsed.markets.markets : DEFAULT_MARKETS.map((market) => ({ ...market })),
      activeId: parsed.markets?.activeId || base.markets.activeId,
    },
    layoutRecipe: parsed.layoutRecipe ?? base.layoutRecipe,
    builder: normalizeBuilder(parsed.builder),
    sections: parsed.sections,
  };
}

export function parseConfig(json: string): ThemeConfig {
  try {
    return normalizeTheme(JSON.parse(json) as Partial<ThemeConfig>);
  } catch {
    return baseTheme();
  }
}

export function isValidConfig(value: unknown): value is ThemeConfig {
  if (!value || typeof value !== "object") return false;
  const config = value as ThemeConfig;
  if (config.version !== 1) return false;
  if (!config.palette || !config.typography || !config.shape || !config.layout) return false;
  if (!config.shop || !config.footer || !config.header) return false;
  if (!Array.isArray(config.sections) || config.sections.length > 60) return false;
  // Advanced-canvasen får inte bli en väg runt gränserna för ett projekt.
  if (config.builder !== undefined) {
    if (!config.builder || (config.builder.mode !== "theme" && config.builder.mode !== "advanced")) return false;
    if (!config.builder.canvas || !Array.isArray(config.builder.canvas.nodes) || config.builder.canvas.nodes.length > 240) return false;
    for (const canvas of Object.values(config.builder.canvases ?? {})) {
      if (canvas && (!Array.isArray(canvas.nodes) || canvas.nodes.length > 240)) return false;
    }
  }
  return true;
}

export type ProjectSummary = {
  id: string;
  name: string;
  config: ThemeConfig;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  shopifyThemeId: string | null;
};

export function projectSummary(row: ProjectRow): ProjectSummary {
  return {
    id: row.id,
    name: row.name,
    config: parseConfig(row.config),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.last_published_at,
    shopifyThemeId: row.shopify_theme_id,
  };
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "temply-theme";
}
