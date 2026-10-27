import type { Section, ThemeConfig } from "@/lib/theme/types";
import { LOCALES } from "@/lib/theme/types";
import {
  CATEGORY_LABELS,
  CATEGORY_WEIGHTS,
  type HealthCategory,
  type HealthCategoryId,
  type HealthIssue,
  type HealthMetric,
  type HealthReport,
  type PsiMetrics,
} from "./types";

/**
 * Theme Health analyserar temakonfigurationen och – när butiken är ansluten –
 * den publika butiken (PageSpeed + riktiga länkar). Allt som går att avgöra
 * lokalt görs lokalt så att analysen fungerar utan nycklar och nätverk.
 */

type AuditInput = {
  config: ThemeConfig;
  psi?: PsiMetrics | null;
  shop?: string | null;
  links?: { checked: number; broken: { url: string; status: number }[] } | null;
};

const IMAGE_TYPES: Section["type"][] = ["hero", "imageText", "collection", "lookbook", "ugc", "story", "completeTheLook"];

function hexToRgb(hex: string): [number, number, number] | null {
  const value = hex.trim().replace("#", "");
  const full = value.length === 3 ? value.split("").map((char) => char + char).join("") : value;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

function luminance(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number | null {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return null;
  const light = Math.max(la, lb);
  const dark = Math.min(la, lb);
  return Math.round(((light + 0.05) / (dark + 0.05)) * 100) / 100;
}

function bestOn(color: string): number | null {
  const white = contrastRatio(color, "#ffffff");
  const black = contrastRatio(color, "#111111");
  if (white === null || black === null) return null;
  return Math.max(white, black);
}

/**
 * Alt-texten i det exporterade temat härleds från rubriken eller titeln som
 * hör till bilden. Analysen gör samma härledning, så att den bara flaggar
 * bilder som verkligen saknar beskrivning.
 */
function images(config: ThemeConfig): { url: string; where: string; alt: string | null }[] {
  const list: { url: string; where: string; alt: string | null }[] = [];
  const heroTitle = config.sections.find((section) => section.type === "hero" && section.visible)?.type === "hero"
    ? (config.sections.find((section) => section.type === "hero" && section.visible) as Extract<Section, { type: "hero" }>).title.trim()
    : "";
  if (config.media.heroImage) list.push({ url: config.media.heroImage, where: "Hero (media)", alt: heroTitle || config.shop.name });
  if (config.media.bannerImage) list.push({ url: config.media.bannerImage, where: "Kampanjbanner", alt: config.shop.name });
  if (config.media.logo) list.push({ url: config.media.logo, where: "Logotyp", alt: config.shop.name });
  for (const product of config.shop.products) {
    if (product.image) list.push({ url: product.image, where: `Produkt: ${product.name}`, alt: product.name.trim() || null });
  }
  for (const section of config.sections) {
    if (!section.visible) continue;
    if (IMAGE_TYPES.includes(section.type)) {
      const data = section as { id: string; title?: string; image?: string; text?: string };
      if (typeof data.image === "string" && data.image) {
        const label = (data.title ?? "").trim() || (data.text ?? "").trim().slice(0, 80) || null;
        list.push({ url: data.image, where: `${section.type} (${section.id})`, alt: label });
      }
    }
    if (section.type === "collection") {
      for (const tile of section.tiles ?? []) {
        if (tile.image) list.push({ url: tile.image, where: `Kategori: ${tile.title}`, alt: tile.title.trim() || null });
      }
    }
    if (section.type === "lookbook") {
      for (const item of section.items ?? []) {
        if (item.image) list.push({ url: item.image, where: `Lookbook: ${item.caption}`, alt: item.caption.trim() || null });
      }
    }
    if (section.type === "ugc") {
      for (const item of section.items ?? []) {
        if (item.image) list.push({ url: item.image, where: `UGC: ${item.handle}`, alt: (item.caption || item.author).trim() || null });
      }
    }
    if (section.type === "completeTheLook") {
      for (const item of section.items ?? []) {
        if (item.image) list.push({ url: item.image, where: `Complete the look: ${item.name}`, alt: item.name.trim() || null });
      }
    }
  }
  return list;
}

function imageFormat(url: string): string {
  const clean = url.split("?")[0].toLowerCase();
  const match = clean.match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "okänt";
}

function shopifyWidth(url: string): number | null {
  try {
    const value = new URL(url, "https://example.com").searchParams.get("width");
    return value ? Number(value) : null;
  } catch {
    return null;
  }
}

const SWEDISH_HINTS = /\b(fri frakt|köp nu|handla|varukorg|öppet köp|leverans|erbjudande|nyheter|snabbt|idag)\b/i;

function isMissing(value: string | undefined | null): boolean {
  return !value || !value.trim();
}

function sectionOf(config: ThemeConfig, type: Section["type"]): Section[] {
  return config.sections.filter((section) => section.visible && section.type === type);
}

function issueList(category: HealthCategoryId, issues: HealthIssue[]): HealthIssue[] {
  return issues.filter((issue) => issue.category === category);
}

function scoreFor(category: HealthCategoryId, issues: HealthIssue[]): number {
  const deduction = issueList(category, issues).reduce((sum, issue) => sum + issue.weight, 0);
  return Math.max(0, Math.min(100, Math.round(100 - deduction)));
}

function grade(score: number): HealthReport["grade"] {
  if (score >= 90) return "A";
  if (score >= 78) return "B";
  if (score >= 64) return "C";
  if (score >= 50) return "D";
  return "E";
}

function summaryFor(category: HealthCategoryId, score: number, issues: HealthIssue[]): string {
  const critical = issueList(category, issues).filter((issue) => issue.severity === "critical").length;
  if (score >= 90) return "Ser starkt ut – inga akuta brister.";
  if (score >= 75) return critical ? `${critical} sak som påverkar resultatet.` : "Bra grund, några förbättringar kvar.";
  if (score >= 55) return `${issueList(category, issues).length} punkter att åtgärda.`;
  return "Behöver ses över – påverkar kunder och sälj direkt.";
}

export function runThemeHealth(input: AuditInput): HealthReport {
  const { config } = input;
  const issues: HealthIssue[] = [];
  const metricsByCategory: Partial<Record<HealthCategoryId, HealthMetric[]>> = {};
  const add = (issue: HealthIssue) => issues.push(issue);

  /* ---------------------------------------------------------------- prestanda */
  const enabledSections = config.sections.filter((section) => section.visible);
  const productCount = config.shop.products.length;
  const imageList = images(config);
  const psi = input.psi ?? null;

  if (enabledSections.length > 14) {
    add({
      id: "perf.sections-many",
      category: "performance",
      severity: "warning",
      title: `${enabledSections.length} sektioner på startsidan`,
      detail: "Varje sektion är egna bilder, typsnitt och animationer. Långa sidor ger sämre LCP på mobil.",
      fix: "Slå ihop eller dölj de svagaste sektionerna – sikta på 8–12.",
      weight: 12,
      autoFix: false,
      metric: `${enabledSections.length} st`,
    });
  }
  if (imageList.length > 30) {
    add({
      id: "perf.images-many",
      category: "performance",
      severity: "warning",
      title: `${imageList.length} bilder laddas`,
      detail: "Många bilder i första vyn konkurrerar om bandbredden, särskilt på mobil.",
      fix: "Lazy-load allt under första skärmen och håll hero-bilden under 250 kB.",
      weight: 10,
      autoFix: false,
      metric: `${imageList.length} st`,
    });
  }
  if (config.motion.enabled && config.motion.speed > 1.2) {
    add({
      id: "perf.motion-heavy",
      category: "performance",
      severity: "warning",
      title: "Tunga animationer",
      detail: `Rörelsehastigheten är ${config.motion.speed.toFixed(1)} – animationer på stora element kostar bildrutor på äldre mobiler.`,
      fix: "Sänk hastigheten eller stäng av rörelse för sektioner med stora bilder.",
      weight: 8,
      autoFix: false,
    });
  }
  const scripts = [
    config.integrations.klaviyo,
    config.integrations.blocks.analytics.enabled,
    config.integrations.blocks.chat.enabled,
    config.integrations.blocks.reviews.enabled || config.integrations.reviews !== "none",
    config.conversion.exitIntent,
    config.conversion.ugc,
  ].filter(Boolean).length;
  if (scripts >= 4) {
    add({
      id: "perf.scripts-many",
      category: "performance",
      severity: "warning",
      title: `${scripts} tredjepartsskript aktiva`,
      detail: "Recensioner, chatt, analys och popups laddar var sitt skript. Det är den vanligaste orsaken till långsamma butiker.",
      fix: "Ladda skripten efter interaktion (defer/onload) och ta bort det du inte använder.",
      weight: 10,
      autoFix: false,
    });
  }
  if (config.media.heroVideo) {
    add({
      id: "perf.hero-video",
      category: "performance",
      severity: "info",
      title: "Video i hero",
      detail: "Video ger stark känsla men väger ofta 3–10 MB och fördröjer LCP.",
      fix: "Använd poster-bild, `preload=\"none\"` och max 720p på mobil.",
      weight: 6,
      autoFix: false,
    });
  }
  if (psi) {
    if (psi.performance !== null && psi.performance < 60) {
      add({
        id: "perf.psi-score",
        category: "performance",
        severity: psi.performance < 40 ? "critical" : "warning",
        title: `PageSpeed mobil: ${psi.performance}/100`,
        detail: "Google mäter den publika butiken. Under 60 tappar du rank och konvertering på mobil.",
        fix: "Börja med bilderna och tredjepartsskripten – de ger oftast störst lyft per timme.",
        weight: psi.performance < 40 ? 26 : 16,
        autoFix: false,
        metric: `${psi.performance}/100`,
      });
    }
    if (psi.lcpMs !== null && psi.lcpMs > 2500) {
      add({
        id: "perf.lcp",
        category: "performance",
        severity: psi.lcpMs > 4000 ? "critical" : "warning",
        title: `LCP ${(psi.lcpMs / 1000).toFixed(1)} s`,
        detail: "Största innehållselementet tar för lång tid. Oftast hero-bilden eller ett typsnitt.",
        fix: "Servera hero-bilden i WebP/AVIF med rätt bredd och preload:a den.",
        weight: 14,
        autoFix: false,
        metric: `${Math.round(psi.lcpMs)} ms`,
      });
    }
    if (psi.cls !== null && psi.cls > 0.1) {
      add({
        id: "perf.cls",
        category: "performance",
        severity: "warning",
        title: `CLS ${psi.cls.toFixed(2)}`,
        detail: "Sidan hoppar när den laddas – banners och bilder utan höjd är vanliga orsaker.",
        fix: "Sätt bredd/höjd eller aspect-ratio på alla bilder och reservera plats för banners.",
        weight: 8,
        autoFix: false,
      });
    }
    if (psi.tbtMs !== null && psi.tbtMs > 300) {
      add({
        id: "perf.tbt",
        category: "performance",
        severity: "warning",
        title: `Blockerande tid ${Math.round(psi.tbtMs)} ms`,
        detail: "JavaScript blockerar huvudtråden och gör sidan trög vid scroll och klick.",
        fix: "Skjut upp skript och undvik att ladda appar i första vyn.",
        weight: 10,
        autoFix: false,
      });
    }
  }
  metricsByCategory.performance = [
    { label: "Sektioner", value: String(enabledSections.length), tone: enabledSections.length > 14 ? "warn" : "good" },
    { label: "Bilder", value: String(imageList.length), tone: imageList.length > 30 ? "warn" : "good" },
    {
      label: "PageSpeed (mobil)",
      value: psi?.performance !== null && psi ? `${psi.performance}/100` : "ej mätt",
      tone: psi?.performance == null ? undefined : psi.performance >= 90 ? "good" : psi.performance >= 60 ? "warn" : "bad",
    },
    {
      label: "LCP",
      value: psi?.lcpMs ? `${(psi.lcpMs / 1000).toFixed(1)} s` : "–",
      tone: psi?.lcpMs ? (psi.lcpMs <= 2500 ? "good" : "warn") : undefined,
    },
  ];

  /* --------------------------------------------------------------------- SEO */
  const titleLength = config.seo.title.trim().length;
  const descriptionLength = config.seo.description.trim().length;
  if (isMissing(config.seo.title)) {
    add({
      id: "seo.title-missing",
      category: "seo",
      severity: "critical",
      title: "Meta-titel saknas",
      detail: "Google skriver sin egen titel när den saknas – du tappar kontrollen över sökresultatet.",
      fix: "Skriv en titel med butiksnamn och huvudkategori, 30–60 tecken.",
      weight: 25,
      autoFix: true,
    });
  } else if (titleLength < 30) {
    add({
      id: "seo.title-short",
      category: "seo",
      severity: "warning",
      title: "Meta-titeln är kort",
      detail: `Titeln är ${titleLength} tecken. Du använder inte utrymmet Google ger.`,
      fix: "Lägg till nyckelord och löfte, t.ex. \"Handgjorda keramikmuggar | Fri frakt – Dinshop\".",
      weight: 10,
      autoFix: true,
      metric: `${titleLength} tecken`,
    });
  } else if (titleLength > 60) {
    add({
      id: "seo.title-long",
      category: "seo",
      severity: "info",
      title: "Meta-titeln kapas",
      detail: `Titeln är ${titleLength} tecken – Google visar ungefär 60.`,
      fix: "Flytta det viktigaste först och korta till under 60 tecken.",
      weight: 6,
      autoFix: true,
      metric: `${titleLength} tecken`,
    });
  }
  if (isMissing(config.seo.description)) {
    add({
      id: "seo.description-missing",
      category: "seo",
      severity: "critical",
      title: "Meta-beskrivning saknas",
      detail: "Utan beskrivning väljer Google ett slumpmässigt utdrag ur sidan.",
      fix: "Skriv 120–155 tecken med nyckelord, sortiment och trygghet (frakt, retur).",
      weight: 22,
      autoFix: true,
    });
  } else if (descriptionLength < 70) {
    add({
      id: "seo.description-short",
      category: "seo",
      severity: "warning",
      title: "Meta-beskrivningen är kort",
      detail: `Beskrivningen är ${descriptionLength} tecken. Rekommenderat är 120–155.`,
      fix: "Bygg ut med vad kunden får, inte bara vad ni säljer.",
      weight: 10,
      autoFix: true,
      metric: `${descriptionLength} tecken`,
    });
  } else if (descriptionLength > 165) {
    add({
      id: "seo.description-long",
      category: "seo",
      severity: "info",
      title: "Meta-beskrivningen kapas",
      detail: `Beskrivningen är ${descriptionLength} tecken – allt över ~155 klipps bort.`,
      fix: "Korta så att hela löftet syns i sökresultatet.",
      weight: 5,
      autoFix: true,
      metric: `${descriptionLength} tecken`,
    });
  }

  const heroSections = sectionOf(config, "hero");
  if (heroSections.length === 0) {
    add({
      id: "seo.no-h1",
      category: "seo",
      severity: "critical",
      title: "Ingen H1 på startsidan",
      detail: "Hero-sektionen är dold, så startsidan saknar rubrik. Google tappar ämnet.",
      fix: "Visa hero-sektionen eller lägg till en rubriksektion.",
      weight: 20,
      autoFix: true,
    });
  } else if (heroSections.length > 1) {
    add({
      id: "seo.multiple-h1",
      category: "seo",
      severity: "warning",
      title: `${heroSections.length} hero-sektioner = flera H1`,
      detail: "Flera H1 konkurrerar om samma signal och gör rubrikstrukturen otydlig.",
      fix: "Behåll en hero som H1 och gör övriga rubriker till H2.",
      weight: 8,
      autoFix: false,
    });
  }

  const missingAlt = imageList.filter((item) => isMissing(item.alt));
  if (missingAlt.length > 0) {
    add({
      id: "seo.alt-text",
      category: "seo",
      severity: "warning",
      title: `${missingAlt.length} bilder saknar alt-text`,
      detail: `Bilder utan beskrivning: ${missingAlt.slice(0, 3).map((item) => item.where).join(", ")}${missingAlt.length > 3 ? " …" : ""}. Både Google och skärmläsare behöver beskrivningen.`,
      fix: "Skriv en rubrik eller bildtext för bilden, eller beskriv motivet i Shopify – då får bilden alt-text automatiskt.",
      weight: Math.min(18, 6 + missingAlt.length),
      autoFix: false,
      metric: `${missingAlt.length}/${imageList.length} utan alt`,
    });
  }

  const ogImage = config.media.bannerImage || config.media.heroImage || config.brand.logoUrl;
  if (!ogImage) {
    add({
      id: "seo.og-image",
      category: "seo",
      severity: "info",
      title: "Ingen delningsbild",
      detail: "När kunder delar butiken i sociala medier visas ingen bild.",
      fix: "Ladda upp en kampanjbild (1200×630) för delning.",
      weight: 6,
      autoFix: false,
    });
  }
  metricsByCategory.seo = [
    { label: "Titel", value: `${titleLength} tecken`, tone: titleLength >= 30 && titleLength <= 60 ? "good" : "warn" },
    {
      label: "Beskrivning",
      value: `${descriptionLength} tecken`,
      tone: descriptionLength >= 120 && descriptionLength <= 155 ? "good" : descriptionLength === 0 ? "bad" : "warn",
    },
    { label: "Alt-texter", value: `${imageList.length - missingAlt.length}/${imageList.length}`, tone: missingAlt.length ? "warn" : "good" },
    { label: "H1", value: heroSections.length === 1 ? "1 (korrekt)" : String(heroSections.length), tone: heroSections.length === 1 ? "good" : "warn" },
  ];

  /* ------------------------------------------------------------------- mobil */
  const smallText = config.typography.baseSize < 15;
  if (smallText) {
    add({
      id: "mobile.small-text",
      category: "mobile",
      severity: "warning",
      title: `Brödtext ${config.typography.baseSize} px`,
      detail: "Under 15 px blir svårläst på mobil och kan ge zoom hos iOS.",
      fix: "Höj till 16 px på mobil – design tokens skalar resten.",
      weight: 14,
      autoFix: true,
    });
  }
  const hugeHeadings = config.typography.scale > 1.35;
  if (hugeHeadings) {
    add({
      id: "mobile.heading-scale",
      category: "mobile",
      severity: "info",
      title: "Stor rubrikskala",
      detail: `Skalan ${config.typography.scale.toFixed(2)} kan få rubriker att brytas på smala skärmar.`,
      fix: "Använd clamp i rubriker (görs automatiskt) och kontrollera längsta rubriken i mobilvyn.",
      weight: 6,
      autoFix: false,
    });
  }
  const wideGrids = enabledSections.filter(
    (section) => section.type === "productGrid" && (section.columns ?? 3) >= 5,
  );
  if (wideGrids.length > 0) {
    add({
      id: "mobile.grid-density",
      category: "mobile",
      severity: "warning",
      title: `${wideGrids.length} produktgrid med 5+ kolumner`,
      detail: "Fler än fyra produkter i bredd ger små kort och svårtryckta knappar på mobil.",
      fix: "Låt gridet gå till två kolumner under 700 px.",
      weight: 10,
      autoFix: false,
    });
  }
  if (config.header.links.length > 5 && !config.header.mega.enabled) {
    add({
      id: "mobile.nav-crowded",
      category: "mobile",
      severity: "warning",
      title: `${config.header.links.length} menylänkar utan mega-meny`,
      detail: "Hamburgermenyn blir lång och svår att överblicka på mobil.",
      fix: "Gruppera i mega-meny eller korta menyn till 4–5 poster.",
      weight: 9,
      autoFix: false,
    });
  }
  if (config.header.announcement.trim().length > 70) {
    add({
      id: "mobile.announcement-long",
      category: "mobile",
      severity: "info",
      title: "Kampanjbandet är långt",
      detail: `${config.header.announcement.trim().length} tecken kapas på mobil.`,
      fix: "Korta till en rad, t.ex. \"Fri frakt över 799 kr · Leverans 1–3 dagar\".",
      weight: 5,
      autoFix: false,
    });
  }
  metricsByCategory.mobile = [
    { label: "Brödtext", value: `${config.typography.baseSize} px`, tone: smallText ? "warn" : "good" },
    { label: "Menyval", value: String(config.header.links.length), tone: config.header.links.length > 5 ? "warn" : "good" },
    { label: "Gridkolumner", value: `${Math.max(...enabledSections.map((section) => (section.type === "productGrid" ? section.columns ?? 3 : 0)), 0)} max`, tone: wideGrids.length ? "warn" : "good" },
    { label: "Sticky köp", value: config.conversion.stickyAtc ? "på" : "av", tone: config.conversion.stickyAtc ? "good" : "warn" },
  ];

  /* ------------------------------------------------------------------ bilder */
  const legacy = imageList.filter((item) => ["jpg", "jpeg", "png", "gif"].includes(imageFormat(item.url)));
  if (legacy.length > 0) {
    add({
      id: "images.format",
      category: "images",
      severity: "warning",
      title: `${legacy.length} bilder i gammalt format`,
      detail: "JPEG/PNG väger 30–60 % mer än WebP och AVIF vid samma kvalitet.",
      fix: "Exportera om till WebP (eller AVIF) och ladda upp igen.",
      weight: Math.min(18, 8 + legacy.length),
      autoFix: false,
      metric: `${legacy.length} st`,
    });
  }
  const noWidth = imageList.filter((item) => item.url.includes("cdn.shopify.com") && shopifyWidth(item.url) === null);
  if (noWidth.length > 0) {
    add({
      id: "images.no-width",
      category: "images",
      severity: "warning",
      title: `${noWidth.length} Shopify-bilder utan bredd`,
      detail: "Utan `width=`-parameter levererar CDN:et originalfilen – ofta 2000+ px på mobil.",
      fix: "Lägg till `&width=800` (och `srcset` för 400/800/1200).",
      weight: Math.min(16, 6 + noWidth.length),
      autoFix: false,
    });
  }
  const oversized = imageList.filter((item) => (shopifyWidth(item.url) ?? 0) >= 1600);
  if (oversized.length > 0) {
    add({
      id: "images.oversized",
      category: "images",
      severity: "info",
      title: `${oversized.length} bilder bredare än 1600 px`,
      detail: "Stora bilder kostar LCP och data för kunden.",
      fix: "Använd 1200–1600 px för hero, 800 px för kort.",
      weight: 8,
      autoFix: false,
    });
  }
  const productsWithoutImage = config.shop.products.filter((product) => !product.image);
  if (productsWithoutImage.length > 0) {
    add({
      id: "images.product-missing",
      category: "images",
      severity: productsWithoutImage.length > 2 ? "critical" : "warning",
      title: `${productsWithoutImage.length} produkter saknar bild`,
      detail: `Produktkort utan bild säljer i princip inte: ${productsWithoutImage.slice(0, 3).map((product) => product.name).join(", ")}.`,
      fix: "Ladda upp produktbild i Shopify och synka till temat.",
      weight: Math.min(24, 10 + productsWithoutImage.length * 3),
      autoFix: false,
    });
  }
  if (psi?.pageWeightKb && psi.pageWeightKb > 2500) {
    add({
      id: "images.page-weight",
      category: "images",
      severity: "warning",
      title: `Sidan väger ${(psi.pageWeightKb / 1024).toFixed(1)} MB`,
      detail: "Över 2,5 MB är mycket för en mobilanslutning.",
      fix: "Komprimera bilder och kontrollera att inga originalfilen laddas.",
      weight: 12,
      autoFix: false,
      metric: `${psi.pageWeightKb} kB`,
    });
  }
  metricsByCategory.images = [
    { label: "Bilder totalt", value: String(imageList.length) },
    { label: "WebP/AVIF", value: `${imageList.length - legacy.length}/${imageList.length}`, tone: legacy.length ? "warn" : "good" },
    { label: "Utan bredd", value: String(noWidth.length), tone: noWidth.length ? "warn" : "good" },
    { label: "Sidvikt", value: psi?.pageWeightKb ? `${(psi.pageWeightKb / 1024).toFixed(1)} MB` : "–", tone: psi?.pageWeightKb ? (psi.pageWeightKb < 2000 ? "good" : "warn") : undefined },
  ];

  /* ------------------------------------------------------------------ länkar */
  const placeholderLinks = [...config.header.links, ...config.footer.columns.flatMap((column) => column.links)].filter(
    (link) => !link.trim() || link.trim() === "#",
  );
  if (placeholderLinks.length > 0) {
    add({
      id: "links.placeholders",
      category: "links",
      severity: "warning",
      title: `${placeholderLinks.length} länkplatshållare`,
      detail: "Länkar som pekar på \"#\" gör ingenting när kunden klickar – det ser ut som en trasig butik.",
      fix: "Koppla varje menyval till en riktig kollektion eller sida.",
      weight: Math.min(20, 8 + placeholderLinks.length),
      autoFix: true,
      metric: `${placeholderLinks.length} st`,
    });
  }
  const duplicateLinks = config.header.links.filter(
    (link, index) => config.header.links.findIndex((other) => other.trim().toLowerCase() === link.trim().toLowerCase()) !== index,
  );
  if (duplicateLinks.length > 0) {
    add({
      id: "links.duplicates",
      category: "links",
      severity: "info",
      title: "Dubblerade menylänkar",
      detail: `${duplicateLinks.length} menyval förekommer flera gånger: ${[...new Set(duplicateLinks)].join(", ")}.`,
      fix: "Ta bort dubbletterna så att menyn blir tydligare.",
      weight: 5,
      autoFix: true,
    });
  }
  const emptyFooter = config.footer.columns.filter((column) => column.links.length === 0);
  if (emptyFooter.length > 0) {
    add({
      id: "links.footer-empty",
      category: "links",
      severity: "info",
      title: `${emptyFooter.length} tomma footer-kolumner`,
      detail: "Tomma kolumner ser ut som ett misstag och ger ingen intern länkning.",
      fix: "Fyll med kundservice, frakt & retur och om oss.",
      weight: 6,
      autoFix: false,
    });
  }
  if (input.links && input.links.broken.length > 0) {
    add({
      id: "links.broken",
      category: "links",
      severity: "critical",
      title: `${input.links.broken.length} trasiga länkar i butiken`,
      detail: `404: ${input.links.broken.slice(0, 3).map((link) => link.url.replace(/^https?:\/\/[^/]+/, "")).join(", ")}${input.links.broken.length > 3 ? " …" : ""}.`,
      fix: "Uppdatera länken eller lägg en omdirigering i Shopify (Navigation → URL redirects).",
      weight: Math.min(30, 12 + input.links.broken.length * 4),
      autoFix: false,
    });
  }
  metricsByCategory.links = [
    { label: "Menylänkar", value: String(config.header.links.length) },
    { label: "Platshållare", value: String(placeholderLinks.length), tone: placeholderLinks.length ? "warn" : "good" },
    {
      label: "Kontrollerade live",
      value: input.links ? String(input.links.checked) : "–",
      tone: input.links ? (input.links.broken.length ? "bad" : "good") : undefined,
    },
    { label: "Trasiga", value: input.links ? String(input.links.broken.length) : "–", tone: input.links ? (input.links.broken.length ? "bad" : "good") : undefined },
  ];

  /* ----------------------------------------------------------- tillgänglighet */
  const textContrast = contrastRatio(config.palette.text, config.palette.background);
  const mutedContrast = contrastRatio(config.palette.muted, config.palette.background);
  const primaryContrast = bestOn(config.palette.primary);
  if (textContrast !== null && textContrast < 4.5) {
    add({
      id: "a11y.contrast-text",
      category: "a11y",
      severity: "critical",
      title: `Textkontrast ${textContrast}:1`,
      detail: "WCAG kräver 4,5:1 för brödtext. Låg kontrast är den vanligaste anmärkningen vid tillgänglighetsgranskning.",
      fix: "Mörka textfärgen tills kontrasten mot bakgrunden är minst 4,5:1.",
      weight: 24,
      autoFix: true,
      metric: `${textContrast}:1`,
    });
  }
  if (mutedContrast !== null && mutedContrast < 4.5) {
    add({
      id: "a11y.contrast-muted",
      category: "a11y",
      severity: "warning",
      title: `Dämpad text ${mutedContrast}:1`,
      detail: "Priser, fraktinfo och hjälptexter använder den dämpade färgen och blir svårlästa.",
      fix: "Mörka den dämpade färgen till minst 4,5:1 mot bakgrunden.",
      weight: 14,
      autoFix: true,
      metric: `${mutedContrast}:1`,
    });
  }
  if (primaryContrast !== null && primaryContrast < 3) {
    add({
      id: "a11y.contrast-primary",
      category: "a11y",
      severity: "warning",
      title: `Knapptext ${primaryContrast}:1`,
      detail: "Texten på primärfärgen når inte 3:1, vilket krävs för stora knappar.",
      fix: "Välj en mörkare primärfärg eller byt textfärg på knappar.",
      weight: 12,
      autoFix: false,
      metric: `${primaryContrast}:1`,
    });
  }
  if (config.typography.uppercaseHeadings && config.typography.tracking < 0.02) {
    add({
      id: "a11y.uppercase",
      category: "a11y",
      severity: "info",
      title: "Versaler utan spärrning",
      detail: "Versala rubriker utan letter-spacing är svårare att läsa, särskilt för personer med dyslexi.",
      fix: "Öka spärrningen till 0,03–0,08 em eller använd normal versalhöjd.",
      weight: 6,
      autoFix: false,
    });
  }
  if (config.motion.enabled && !psi) {
    add({
      id: "a11y.motion",
      category: "a11y",
      severity: "info",
      title: "Rörelse är på",
      detail: "Temats animationer respekterar `prefers-reduced-motion`, men kontrollera att egna sektioner gör det också.",
      fix: "Behåll reduced-motion-regeln och undvik automatisk karusell.",
      weight: 4,
      autoFix: false,
    });
  }
  metricsByCategory.a11y = [
    { label: "Textkontrast", value: textContrast ? `${textContrast}:1` : "–", tone: textContrast && textContrast >= 4.5 ? "good" : "bad" },
    { label: "Dämpad text", value: mutedContrast ? `${mutedContrast}:1` : "–", tone: mutedContrast && mutedContrast >= 4.5 ? "good" : "warn" },
    { label: "Knappkontrast", value: primaryContrast ? `${primaryContrast}:1` : "–", tone: primaryContrast && primaryContrast >= 3 ? "good" : "warn" },
    { label: "Teckenstorlek", value: `${config.typography.baseSize} px`, tone: config.typography.baseSize >= 15 ? "good" : "warn" },
  ];

  /* ------------------------------------------------------------ konvertering */
  const hasTestimonials = sectionOf(config, "testimonials").length > 0;
  const hasReviews = config.integrations.reviews !== "none" || config.integrations.blocks.reviews.enabled;
  if (!hasTestimonials && !hasReviews) {
    add({
      id: "conversion.reviews",
      category: "conversion",
      severity: "critical",
      title: "Inga recensioner eller kundröster",
      detail: "Socialt bevis är det som oftast saknas när trafik inte blir försäljning.",
      fix: "Visa recensioner på produktkort och produktsida, eller lägg till en kundröstsektion.",
      weight: 22,
      autoFix: true,
    });
  }
  const hasTrust = config.conversion.trustBadges || sectionOf(config, "trust").length > 0;
  if (!hasTrust) {
    add({
      id: "conversion.trust",
      category: "conversion",
      severity: "warning",
      title: "Inga trygghetsmärken",
      detail: "Frakt, retur, betalning och garanti syns inte – kunden tvekar vid kassan.",
      fix: "Aktivera trygghetsmärken under hero och i footern.",
      weight: 14,
      autoFix: true,
    });
  }
  const hasNewsletter =
    sectionOf(config, "newsletter").length > 0 || config.integrations.blocks.newsletter.enabled || config.integrations.klaviyo;
  if (!hasNewsletter) {
    add({
      id: "conversion.newsletter",
      category: "conversion",
      severity: "warning",
      title: "Ingen nyhetsbrevsfångst",
      detail: "Utan e-postlista betalar du för samma kund varje gång.",
      fix: "Lägg till nyhetsbrevssektion med rabatt på första köpet.",
      weight: 12,
      autoFix: true,
    });
  }
  if (!config.conversion.stickyAtc) {
    add({
      id: "conversion.sticky-atc",
      category: "conversion",
      severity: "warning",
      title: "Sticky köpknapp är av",
      detail: "På mobil scrollar kunden förbi köpknappen och tappar köpet.",
      fix: "Slå på sticky add-to-cart – mätbar effekt på konvertering.",
      weight: 10,
      autoFix: true,
    });
  }
  if (!config.conversion.freeShippingBar) {
    add({
      id: "conversion.free-shipping",
      category: "conversion",
      severity: "info",
      title: "Ingen fri frakt-bar",
      detail: "En progressbar mot fri frakt är ett av de enklaste sätten att höja ordervärdet.",
      fix: "Slå på fri frakt-bar och sätt tröskeln strax över snittordern.",
      weight: 8,
      autoFix: true,
    });
  }
  if (!config.header.showSearch) {
    add({
      id: "conversion.search",
      category: "conversion",
      severity: "warning",
      title: "Sök saknas i headern",
      detail: "Kunder som söker konverterar betydligt bättre än de som bläddrar.",
      fix: "Visa sökikonen och koppla Search & Discovery.",
      weight: 9,
      autoFix: true,
    });
  }
  if (sectionOf(config, "countdown").length === 0 && config.conversion.abTest === "off") {
    add({
      id: "conversion.urgency",
      category: "conversion",
      severity: "info",
      title: "Ingen brådska i sidan",
      detail: "Kampanjband och nedräkning skapar anledning att köpa nu.",
      fix: "Testa en nedräkningssektion under en begränsad kampanj.",
      weight: 6,
      autoFix: true,
    });
  }
  const noDescription = config.shop.products.filter((product) => !product.description || product.description.trim().length < 40);
  if (noDescription.length > 0) {
    add({
      id: "conversion.product-copy",
      category: "conversion",
      severity: "warning",
      title: `${noDescription.length} produkter med tunn text`,
      detail: "Korta produkttexter ger sämre SEO och fler frågor till kundservice.",
      fix: "Skriv 60–120 ord per produkt: material, passform, skötsel och vem den passar.",
      weight: Math.min(14, 5 + noDescription.length * 2),
      autoFix: false,
    });
  }
  metricsByCategory.conversion = [
    { label: "Recensioner", value: hasTestimonials || hasReviews ? "på" : "saknas", tone: hasTestimonials || hasReviews ? "good" : "bad" },
    { label: "Trygghet", value: hasTrust ? "på" : "saknas", tone: hasTrust ? "good" : "warn" },
    { label: "Nyhetsbrev", value: hasNewsletter ? "på" : "saknas", tone: hasNewsletter ? "good" : "warn" },
    { label: "Sticky köp", value: config.conversion.stickyAtc ? "på" : "av", tone: config.conversion.stickyAtc ? "good" : "warn" },
  ];

  /* ---------------------------------------------------------- översättningar */
  const activeMarket = config.markets.markets.find((market) => market.id === config.markets.activeId) ?? config.markets.markets[0];
  const activeLocale = activeMarket?.locale ?? "sv";
  const languages = new Set(config.markets.markets.map((market) => market.locale));
  if (config.markets.enabled && config.markets.markets.length > 1) {
    const incomplete = config.markets.markets.filter(
      (market) => isMissing(market.heroTitle) || isMissing(market.campaign) || isMissing(market.shipping),
    );
    if (incomplete.length > 0) {
      add({
        id: "translations.market-copy",
        category: "translations",
        severity: "warning",
        title: `${incomplete.length} marknader saknar egen text`,
        detail: "Marknader utan hero-text och kampanj visar svensk copy till utländska kunder.",
        fix: "Fyll i hero, kampanj och frakttext per marknad.",
        weight: Math.min(24, 10 + incomplete.length * 4),
        autoFix: false,
      });
    }
    const duplicates = config.markets.markets.filter(
      (market) => market.locale !== "sv" && SWEDISH_HINTS.test(`${market.heroTitle} ${market.campaign} ${market.shipping}`),
    );
    if (duplicates.length > 0) {
      add({
        id: "translations.swedish-leak",
        category: "translations",
        severity: "critical",
        title: `${duplicates.length} marknader visar svensk text`,
        detail: `Svenska ord hittades i ${duplicates.map((market) => market.label).join(", ")} – kunden möts av fel språk.`,
        fix: "Översätt hero, kampanj och frakttext, eller koppla Shopify Markets-översättningar.",
        weight: 26,
        autoFix: false,
      });
    }
  } else {
    add({
      id: "translations.single-market",
      category: "translations",
      severity: "info",
      title: "En marknad konfigurerad",
      detail: `Butiken kör ${activeMarket?.label ?? "Sverige"} och språket ${activeLocale.toUpperCase()}. Fler marknader kräver översatt copy.`,
      fix: "Lägg till en marknad när du är redo – temat har stöd för språk, valuta och kampanj per marknad.",
      weight: 4,
      autoFix: false,
    });
  }
  if (activeLocale !== "sv" && SWEDISH_HINTS.test(`${config.seo.title} ${config.seo.description}`)) {
    add({
      id: "translations.seo-locale",
      category: "translations",
      severity: "warning",
      title: "Svensk SEO-text på annan marknad",
      detail: `Aktiv marknad använder ${activeLocale.toUpperCase()} men meta-texten är svensk.`,
      fix: "Skriv marknadsspecifik titel och beskrivning.",
      weight: 14,
      autoFix: false,
    });
  }
  metricsByCategory.translations = [
    { label: "Marknader", value: String(config.markets.enabled ? config.markets.markets.length : 1) },
    { label: "Språk", value: String(config.markets.enabled ? languages.size : 1) },
    { label: "Aktivt språk", value: activeLocale.toUpperCase() },
    { label: "Tillgängliga i temat", value: String(LOCALES.length) },
  ];

  const categoryIds = Object.keys(CATEGORY_WEIGHTS) as HealthCategoryId[];
  const categories: HealthCategory[] = categoryIds.map((id) => {
    const score = scoreFor(id, issues);
    return {
      id,
      label: CATEGORY_LABELS[id],
      score,
      summary: summaryFor(id, score, issues),
      metrics: metricsByCategory[id] ?? [],
      issues: issueList(id, issues).sort((a, b) => b.weight - a.weight),
    };
  });

  const score = Math.round(
    categories.reduce((sum, category) => sum + category.score * CATEGORY_WEIGHTS[category.id], 0) /
      Object.values(CATEGORY_WEIGHTS).reduce((sum, weight) => sum + weight, 0),
  );

  const counts = {
    critical: issues.filter((issue) => issue.severity === "critical").length,
    warning: issues.filter((issue) => issue.severity === "warning").length,
    info: issues.filter((issue) => issue.severity === "info").length,
  };

  const sorted = [...issues].sort((a, b) => {
    const rank = { critical: 0, warning: 1, info: 2 };
    return rank[a.severity] - rank[b.severity] || b.weight - a.weight;
  });

  const digest = [
    `Tema: ${config.name} (${config.layoutRecipe})`,
    `Butik: ${config.shop.name}`,
    `Health score: ${score}/100 (${grade(score)})`,
    ...categories.map((category) => `${category.label}: ${category.score}/100 – ${category.summary}`),
    `Toppbrister: ${sorted.slice(0, 6).map((issue) => `[${issue.id}] ${issue.title}`).join(" | ") || "inga"}`,
    psi ? `PageSpeed mobil: ${psi.performance ?? "?"}/100, LCP ${psi.lcpMs ?? "?"} ms, CLS ${psi.cls ?? "?"}` : "PageSpeed: ej mätt",
  ].join("\n");

  return {
    score,
    grade: grade(score),
    checkedAt: new Date().toISOString(),
    categories,
    issues: sorted,
    counts,
    source: {
      psi: Boolean(psi),
      crawl: Boolean(input.links),
      shop: input.shop ?? null,
      pagesCrawled: input.links?.checked ?? 0,
      brokenLinks: input.links?.broken ?? [],
    },
    psi,
    digest,
  };
}
