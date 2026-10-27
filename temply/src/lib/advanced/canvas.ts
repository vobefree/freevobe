import { sanitizeSvg } from "./icons";
import type {
  AdvancedCanvas,
  AdvancedColorToken,
  AdvancedHover,
  AdvancedNode,
  AdvancedNodeType,
  AdvancedPage,
  AdvancedReveal,
  ThemeConfig,
} from "@/lib/theme/types";

/** Designytan är fast; alla mått skalas proportionellt mot den. */
export const DESIGN_WIDTH = 1200;
export const DESIGN_HEIGHT = 1400;

/** En sida kan bli betydligt längre än förstaintrycket. */
export const MIN_CANVAS_HEIGHT = 800;
export const MAX_CANVAS_HEIGHT = 20_000;

const NODE_TYPES: AdvancedNodeType[] = [
  "text",
  "heading",
  "image",
  "button",
  "product",
  "products",
  "section",
  "shape",
  "drawing",
  "connector",
  "logo",
  "nav",
  "cart",
  "search",
];

const COLOR_TOKENS: AdvancedColorToken[] = ["text", "muted", "primary", "accent", "surface", "background", "onPrimary"];

/** Effekterna är en slutlig uppräkning – okända värden faller bort vid inläsning. */
export const HOVER_EFFECTS: AdvancedHover[] = ["none", "lift", "grow", "glow", "dim", "underline", "tilt"];
export const REVEAL_EFFECTS: AdvancedReveal[] = ["none", "fade-up", "zoom", "slide-left", "slide-right"];

/**
 * Klassnamnen delas av editorn, förhandsvisningen och Shopify-exporten så att
 * en hover- eller entréeffekt ser exakt likadan ut på alla tre ställen.
 */
export function fxClasses(node: AdvancedNode): string {
  const hover = node.hover && node.hover !== "none" ? ` adv-fx-hover--${node.hover}` : "";
  const reveal = node.reveal && node.reveal !== "none" ? ` adv-fx-reveal--${node.reveal}` : "";
  return `${hover}${reveal}`;
}

/**
 * Färger är inte begränsade till paletten. Allt som webbläsaren förstår som
 * en färg ska kunna användas, men bara tecken som är säkra i en style-attribut
 * släpps igenom (inget `;`, `"` eller `}`).
 */
export function isColorValue(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 64) return false;
  return /^[#a-zA-Z0-9(),.%\s-]+$/.test(trimmed);
}

function colorValue(value: unknown, fallback: string): string {
  return isColorValue(value) ? value.trim() : fallback;
}

export function uid(prefix = "adv"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyCanvas(height = DESIGN_HEIGHT): AdvancedCanvas {
  return { version: 1, width: DESIGN_WIDTH, height, background: "background", nodes: [] };
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizeNode(raw: Partial<AdvancedNode> | null | undefined, index = 0): AdvancedNode | null {
  if (!raw || !NODE_TYPES.includes(raw.type as AdvancedNodeType)) return null;
  const type = raw.type as AdvancedNodeType;
  const node: AdvancedNode = {
    id: text(raw.id) || uid(type),
    type,
    // Den fria ytan ska inte sätta konstgjorda gränser för hur långt eller
    // stort ett element får bli. Värdena nedan är bara skydd mot trasig data.
    x: clamp(raw.x, -20_000, 20_000, 40),
    y: clamp(raw.y, -20_000, 20_000, 40),
    w: clamp(raw.w, 4, 20_000, 240),
    h: clamp(raw.h, 4, 20_000, 120),
    z: clamp(raw.z, 0, 9_999, index + 1),
    rotation: clamp(raw.rotation, -360, 360, 0),
    radius: clamp(raw.radius, 0, 4_000, 0),
    opacity: clamp(raw.opacity, 0, 1, 1),
  };
  if (typeof raw.text === "string") node.text = raw.text.slice(0, 2000);
  if (typeof raw.eyebrow === "string") node.eyebrow = raw.eyebrow.slice(0, 120);
  if (typeof raw.title === "string") node.title = raw.title.slice(0, 200);
  if (typeof raw.ctaLabel === "string") node.ctaLabel = raw.ctaLabel.slice(0, 80);
  if (typeof raw.href === "string") node.href = raw.href.slice(0, 500);
  if (typeof raw.badge === "string") node.badge = raw.badge.slice(0, 40);
  // AI-bilder kommer som data-URL:er och kan vara flera megabyte. Kapa inte
  // dem vid en liten gräns, då blir bilden trasig vid nästa inläsning.
  if (typeof raw.src === "string") node.src = raw.src.slice(0, 8_000_000);
  if (typeof raw.alt === "string") node.alt = raw.alt.slice(0, 160);
  if (raw.fit === "contain" || raw.fit === "cover") node.fit = raw.fit;
  if (isColorValue(raw.color)) node.color = raw.color.trim();
  if (isColorValue(raw.fill)) node.fill = raw.fill.trim();
  if (isColorValue(raw.stroke)) node.stroke = raw.stroke.trim();
  if (typeof raw.strokeWidth === "number") node.strokeWidth = clamp(raw.strokeWidth, 0, 40, 2);
  if (typeof raw.fontSize === "number") node.fontSize = clamp(raw.fontSize, 4, 2_000, 28);
  if (typeof raw.fontWeight === "number") node.fontWeight = clamp(raw.fontWeight, 100, 900, 500);
  if (raw.align === "left" || raw.align === "center" || raw.align === "right") node.align = raw.align;
  if (typeof raw.letterSpacing === "number") node.letterSpacing = clamp(raw.letterSpacing, -0.5, 1, 0);
  if (typeof raw.lineHeight === "number") node.lineHeight = clamp(raw.lineHeight, 0.5, 4, 1.25);
  if (typeof raw.menu === "string") node.menu = raw.menu.slice(0, 120);
  if (typeof raw.font === "string" && /^[a-zA-Z0-9_-]{1,40}$/.test(raw.font)) node.font = raw.font;
  if (typeof raw.fontFamily === "string") node.fontFamily = raw.fontFamily.slice(0, 120);
  if (raw.textTransform === "none" || raw.textTransform === "uppercase" || raw.textTransform === "lowercase" || raw.textTransform === "capitalize") node.textTransform = raw.textTransform;
  if (typeof raw.italic === "boolean") node.italic = raw.italic;
  if (typeof raw.icon === "string" && /^[a-zA-Z0-9_:-]{1,80}$/.test(raw.icon)) node.icon = raw.icon;
  if (typeof raw.iconSvg === "string" && raw.iconSvg.trim()) node.iconSvg = sanitizeSvg(raw.iconSvg).slice(0, 20_000);
  // Endast rasterbilder som data-URL – aldrig http(s) eller javascript.
  if (typeof raw.iconImage === "string" && /^data:image\/(png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=]+$/.test(raw.iconImage) && raw.iconImage.length <= 420_000) {
    node.iconImage = raw.iconImage;
  }
  if (typeof raw.iconStroke === "number") node.iconStroke = clamp(raw.iconStroke, 0.25, 8, 1.75);
  if (raw.locked === true) node.locked = true;
  if (raw.hidden === true) node.hidden = true;
  if (typeof raw.groupId === "string" && /^[a-zA-Z0-9_-]{1,40}$/.test(raw.groupId)) node.groupId = raw.groupId;
  if (HOVER_EFFECTS.includes(raw.hover as AdvancedHover)) node.hover = raw.hover as AdvancedHover;
  if (REVEAL_EFFECTS.includes(raw.reveal as AdvancedReveal)) node.reveal = raw.reveal as AdvancedReveal;
  if (typeof raw.columns === "number") node.columns = clamp(raw.columns, 1, 12, 3);
  if (typeof raw.gap === "number") node.gap = clamp(raw.gap, 0, 400, 24);
  if (typeof raw.count === "number") node.count = clamp(raw.count, 1, 24, 6);
  if (raw.shape === "rect" || raw.shape === "ellipse" || raw.shape === "line") node.shape = raw.shape;
  if (raw.preset === "hero" || raw.preset === "campaign" || raw.preset === "products" || raw.preset === "features" || raw.preset === "testimonial" || raw.preset === "banner") {
    node.preset = raw.preset;
  }
  if (typeof raw.productIndex === "number") node.productIndex = clamp(raw.productIndex, 0, 99, 0);
  if (Array.isArray(raw.points)) {
    node.points = raw.points
      .filter((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y))
      .slice(0, 900)
      .map((point) => ({ x: clamp(point.x, 0, 1, 0), y: clamp(point.y, 0, 1, 0) }));
  }
  if (typeof raw.fromId === "string") node.fromId = raw.fromId;
  if (typeof raw.toId === "string") node.toId = raw.toId;
  if (typeof raw.sectionId === "string") node.sectionId = raw.sectionId;
  return node;
}

export function normalizeCanvas(raw: Partial<AdvancedCanvas> | null | undefined, minimumHeight = MIN_CANVAS_HEIGHT): AdvancedCanvas {
  if (!raw || !Array.isArray(raw.nodes)) return emptyCanvas(minimumHeight);
  const background: AdvancedCanvas["background"] =
    raw.background === "transparent" ? "transparent" : colorValue(raw.background, "background");
  const nodes = raw.nodes
    .map((node, index) => normalizeNode(node, index))
    .filter((node): node is AdvancedNode => Boolean(node))
    .slice(0, 240);
  return {
    version: 1,
    width: DESIGN_WIDTH,
    height: clamp(raw.height, minimumHeight, MAX_CANVAS_HEIGHT, DESIGN_HEIGHT),
    background,
    replaceDefault: bool(raw.replaceDefault, false),
    ...(raw.design && typeof raw.design === "object"
      ? {
          design: {
            moods: Array.isArray(raw.design.moods) ? raw.design.moods.filter((mood) => typeof mood === "string").slice(0, 8) : [],
            spacing: clamp(raw.design.spacing, 0.5, 2, 1),
            scales: {
              heading: clamp(raw.design.scales?.heading, 0.6, 1.6, 1),
              body: clamp(raw.design.scales?.body, 0.6, 1.6, 1),
              section: clamp(raw.design.scales?.section, 0.6, 1.6, 1),
            },
          },
        }
      : {}),
    nodes,
  };
}

export function canvasForPage(config: ThemeConfig, page: AdvancedPage): AdvancedCanvas {
  if (page === "home") return config.builder.canvases?.home ?? config.builder.canvas;
  return config.builder.canvases?.[page] ?? emptyCanvas();
}

/** Global yta för logotyp, meny, sök och varukorg. */
export function canvasForChrome(config: ThemeConfig): AdvancedCanvas {
  return config.builder.chrome ?? emptyCanvas();
}

export function withChromeCanvas(config: ThemeConfig, canvas: AdvancedCanvas): ThemeConfig {
  return { ...config, builder: { ...config.builder, chrome: canvas } };
}

/**
 * Sidhuvudet och sidfoten är egna fria ytor. De seedas från butikens
 * inställningar första gången de öppnas, så logotyp, meny, sök, varukorg och
 * footer-kolumner ligger på plats – men de går att dra, bygga om och färga om
 * precis som allt annat i Advanced.
 */
export const HEADER_CANVAS_HEIGHT = 200;
export const FOOTER_CANVAS_HEIGHT = 460;

function seedHeaderCanvas(config: ThemeConfig): AdvancedCanvas {
  const headingWeight = config.typography.headingWeight;
  return {
    ...emptyCanvas(HEADER_CANVAS_HEIGHT),
    background: "transparent",
    nodes: [
      {
        id: "adv-header-logo",
        type: "logo",
        x: 64,
        y: 68,
        w: 360,
        h: 64,
        z: 2,
        rotation: 0,
        radius: 0,
        opacity: 1,
        text: config.header.logoText || config.shop.name,
        fontSize: 44,
        fontWeight: headingWeight,
        align: "left",
        color: "text",
      },
      {
        id: "adv-header-nav",
        type: "nav",
        x: 460,
        y: 84,
        w: 440,
        h: 32,
        z: 2,
        rotation: 0,
        radius: 0,
        opacity: 1,
        menu: "main-menu",
        fontSize: 16,
        fontWeight: 500,
        align: "left",
        color: "text",
      },
      {
        id: "adv-header-search",
        type: "search",
        x: 1000,
        y: 78,
        w: 40,
        h: 44,
        z: 2,
        rotation: 0,
        radius: 0,
        opacity: 1,
        fontSize: 24,
        color: "text",
      },
      {
        id: "adv-header-cart",
        type: "cart",
        x: 1078,
        y: 78,
        w: 44,
        h: 44,
        z: 2,
        rotation: 0,
        radius: 0,
        opacity: 1,
        fontSize: 24,
        color: "text",
        fill: "primary",
      },
    ],
  };
}

function seedFooterCanvas(config: ThemeConfig): AdvancedCanvas {
  const columns = config.footer.columns.slice(0, 4);
  const nodes: AdvancedNode[] = [
    {
      id: "adv-footer-brand",
      type: "heading",
      x: 64,
      y: 64,
      w: 360,
      h: 56,
      z: 2,
      rotation: 0,
      radius: 0,
      opacity: 1,
      text: config.shop.name,
      fontSize: 36,
      fontWeight: config.typography.headingWeight,
      align: "left",
      color: "text",
    },
    {
      id: "adv-footer-about",
      type: "text",
      x: 64,
      y: 136,
      w: 360,
      h: 132,
      z: 2,
      rotation: 0,
      radius: 0,
      opacity: 1,
      text: config.footer.text || config.shop.tagline,
      fontSize: 16,
      fontWeight: 400,
      align: "left",
      lineHeight: 1.5,
      color: "muted",
    },
    {
      id: "adv-footer-social",
      type: "text",
      x: 64,
      y: 300,
      w: 360,
      h: 40,
      z: 2,
      rotation: 0,
      radius: 0,
      opacity: 1,
      text: config.footer.social.join("  ·  "),
      fontSize: 14,
      fontWeight: 500,
      align: "left",
      color: "text",
    },
    {
      id: "adv-footer-copy",
      type: "text",
      x: 64,
      y: 376,
      w: 360,
      h: 32,
      z: 2,
      rotation: 0,
      radius: 0,
      opacity: 1,
      text: `© ${config.shop.name}`,
      fontSize: 13,
      fontWeight: 400,
      align: "left",
      color: "muted",
    },
  ];
  columns.forEach((column, index) => {
    nodes.push({
      id: `adv-footer-col-${index}`,
      type: "text",
      x: 500 + index * 190,
      y: 72,
      w: 180,
      h: 250,
      z: 2,
      rotation: 0,
      radius: 0,
      opacity: 1,
      text: `${column.title}\n\n${column.links.join("\n")}`,
      fontSize: 15,
      fontWeight: 400,
      align: "left",
      lineHeight: 1.7,
      color: "text",
    });
  });
  return { ...emptyCanvas(FOOTER_CANVAS_HEIGHT), background: "surface", nodes };
}

export function canvasForHeader(config: ThemeConfig): AdvancedCanvas {
  return config.builder.header ?? seedHeaderCanvas(config);
}

export function canvasForFooter(config: ThemeConfig): AdvancedCanvas {
  return config.builder.footer ?? seedFooterCanvas(config);
}

export function withHeaderCanvas(config: ThemeConfig, canvas: AdvancedCanvas): ThemeConfig {
  return { ...config, builder: { ...config.builder, header: canvas } };
}

export function withFooterCanvas(config: ThemeConfig, canvas: AdvancedCanvas): ThemeConfig {
  return { ...config, builder: { ...config.builder, footer: canvas } };
}

export function withPageCanvas(config: ThemeConfig, page: AdvancedPage, canvas: AdvancedCanvas): ThemeConfig {
  const canvases = { ...config.builder.canvases, [page]: canvas };
  return {
    ...config,
    builder: {
      ...config.builder,
      canvas: page === "home" ? canvas : config.builder.canvas,
      canvases,
    },
  };
}

export function canvasHasContent(canvas: AdvancedCanvas): boolean {
  return canvas.nodes.some((node) => node.type !== "connector");
}

/**
 * Låt ytan växa när något placeras eller dras långt ned. Höjden krymper aldrig
 * automatiskt, så en påbörjad lång sida inte hoppar ihop mitt i arbetet.
 */
export function growCanvasToFit(canvas: AdvancedCanvas, minimum = MIN_CANVAS_HEIGHT): AdvancedCanvas {
  const bottom = canvas.nodes.reduce((max, node) => Math.max(max, node.y + node.h), 0);
  const height = Math.min(MAX_CANVAS_HEIGHT, Math.max(canvas.height, minimum, Math.ceil((bottom + 160) / 100) * 100));
  return height === canvas.height ? canvas : { ...canvas, height };
}

export function resizeCanvasHeight(canvas: AdvancedCanvas, height: number, minimum = MIN_CANVAS_HEIGHT): AdvancedCanvas {
  const next = Math.max(minimum, Math.min(MAX_CANVAS_HEIGHT, Math.round(height)));
  return next === canvas.height ? canvas : { ...canvas, height: next };
}

export function cloneNode(node: AdvancedNode, offset = 24): AdvancedNode {
  return {
    ...node,
    id: uid(node.type),
    x: node.x + offset,
    y: node.y + offset,
    z: node.z + 1,
    ...(node.points ? { points: node.points.map((point) => ({ ...point })) } : {}),
  };
}

export function createNode(
  type: AdvancedNodeType,
  config: ThemeConfig,
  patch: Partial<AdvancedNode> = {},
  page: AdvancedPage = "home",
): AdvancedNode {
  const headingWeight = config.typography.headingWeight;
  const base: AdvancedNode = {
    id: uid(type),
    type,
    x: 120,
    y: 160,
    w: 360,
    h: 120,
    z: Math.max(1, ...canvasForPage(config, page).nodes.map((node) => node.z)) + 1,
    rotation: 0,
    radius: 0,
    opacity: 1,
  };
  switch (type) {
    case "text":
      return { ...base, x: 100, y: 180, w: 440, h: 110, text: "Skriv din text här.", fontSize: 24, color: "text", lineHeight: 1.45 };
    case "heading":
      return { ...base, x: 100, y: 90, w: 620, h: 150, text: "En rubrik som syns.", fontSize: 62, fontWeight: headingWeight, color: "text", lineHeight: 1.05 };
    case "image":
      return {
        ...base,
        x: 600,
        y: 120,
        w: 440,
        h: 480,
        src: config.media.heroImage || "",
        alt: config.shop.name,
        fit: "cover",
        radius: config.tokens.imageRadius,
      };
    case "logo":
      return {
        ...base,
        x: 60,
        y: 55,
        w: 360,
        h: 86,
        text: config.header.logoText || config.shop.name,
        fontSize: 64,
        fontWeight: config.typography.headingWeight,
        color: "text",
        align: "left",
      };
    case "nav":
      return {
        ...base,
        x: 420,
        y: 72,
        w: 460,
        h: 44,
        fontSize: 18,
        fontWeight: 500,
        color: "text",
        align: "left",
        menu: "main-menu",
      };
    case "cart":
      return {
        ...base,
        x: 1040,
        y: 62,
        w: 54,
        h: 50,
        color: "text",
        fill: "primary",
        fontSize: 18,
        icon: "cart",
        iconStroke: 1.75,
      };
    case "search":
      return {
        ...base,
        x: 980,
        y: 62,
        w: 44,
        h: 44,
        color: "text",
        fontSize: 18,
        icon: "search",
        iconStroke: 1.75,
      };
    case "button":
      return {
        ...base,
        x: 100,
        y: 330,
        w: 220,
        h: 58,
        ctaLabel: "Handla nu",
        href: "/collections/all",
        fill: "primary",
        color: "onPrimary",
        fontSize: 18,
        fontWeight: 600,
        radius: config.shape.buttonRadius,
        align: "center",
      };
    case "product":
      return {
        ...base,
        x: 100,
        y: 780,
        w: 260,
        h: 350,
        productIndex: 0,
        fill: "surface",
        radius: config.tokens.cardRadius,
      };
    case "products":
      return {
        ...base,
        x: 80,
        y: 780,
        w: 1040,
        h: 440,
        columns: 3,
        gap: 24,
        count: 3,
        productIndex: 0,
        fill: "surface",
        radius: config.tokens.cardRadius,
      };
    case "section":
      return {
        ...base,
        x: 100,
        y: 520,
        w: 1000,
        h: 360,
        preset: "hero",
        eyebrow: config.shop.tagline,
        title: "En sektion att bygga vidare på",
        text: "Beskriv erbjudandet och låt kunden ta nästa steg.",
        ctaLabel: "Upptäck mer",
        href: "/collections/all",
        fill: "accent",
        color: "text",
        fontSize: 48,
        radius: config.tokens.cardRadius,
      };
    case "shape":
      return { ...base, x: 620, y: 90, w: 470, h: 540, shape: "rect", fill: "accent", radius: 36 };
    case "drawing":
      return { ...base, x: 200, y: 300, w: 300, h: 220, points: [], stroke: "primary", strokeWidth: 6 };
    case "connector":
      return { ...base, x: 0, y: 0, w: 0, h: 0, stroke: "primary", strokeWidth: 3 };
  }
  return { ...base, ...patch };
}

/**
 * Startcanvas: en redigerbar version av det temastyrda förstaintrycket. Den
 * använder samma copy, färger och produkter som temat, så bytet till Advanced
 * känns som en fortsättning – inte som en tom yta.
 */
export function starterCanvas(config: ThemeConfig): AdvancedCanvas {
  const hero = config.sections.find((section) => section.type === "hero" && section.visible);
  const products = config.sections.find((section) => section.type === "productGrid" && section.visible);
  const firstProduct = config.shop.products[0];
  const heroImage = config.media.heroImage || firstProduct?.image || "";
  const title = hero && hero.type === "hero" ? hero.title : config.shop.tagline || config.shop.name;
  const subtitle = hero && hero.type === "hero" ? hero.subtitle : config.shop.tagline;
  const cta = hero && hero.type === "hero" ? hero.ctaLabel : "Handla nu";
  const productTitle = products && products.type === "productGrid" ? products.title : "Utvalt just nu";

  const nodes: AdvancedNode[] = [
    {
      id: uid("shape"),
      type: "shape",
      x: 610,
      y: 100,
      w: 490,
      h: 540,
      z: 1,
      rotation: 0,
      radius: 40,
      opacity: 1,
      shape: "rect",
      fill: "accent",
    },
    heroImage
      ? {
          id: uid("image"),
          type: "image",
          x: 590,
          y: 80,
          w: 520,
          h: 580,
          z: 2,
          rotation: 0,
          radius: config.tokens.imageRadius,
          opacity: 1,
          src: heroImage,
          alt: config.shop.name,
          fit: "cover",
        }
      : {
          id: uid("image"),
          type: "image",
          x: 590,
          y: 80,
          w: 520,
          h: 580,
          z: 2,
          rotation: 0,
          radius: config.tokens.imageRadius,
          opacity: 1,
          src: "",
          alt: config.shop.name,
          fit: "cover",
        },
    {
      id: uid("text"),
      type: "text",
      x: 80,
      y: 100,
      w: 470,
      h: 40,
      z: 5,
      rotation: 0,
      radius: 0,
      opacity: 1,
      text: config.header.announcement || config.shop.tagline,
      fontSize: 16,
      fontWeight: 600,
      color: "muted",
      letterSpacing: 0.08,
    },
    {
      id: uid("heading"),
      type: "heading",
      x: 80,
      y: 155,
      w: 500,
      h: 190,
      z: 5,
      rotation: 0,
      radius: 0,
      opacity: 1,
      text: title,
      fontSize: 64,
      fontWeight: config.typography.headingWeight,
      color: "text",
      lineHeight: 1.04,
    },
    {
      id: uid("text"),
      type: "text",
      x: 80,
      y: 365,
      w: 450,
      h: 110,
      z: 5,
      rotation: 0,
      radius: 0,
      opacity: 1,
      text: subtitle || config.shop.tagline,
      fontSize: 23,
      color: "muted",
      lineHeight: 1.5,
    },
    {
      id: uid("button"),
      type: "button",
      x: 80,
      y: 500,
      w: 230,
      h: 60,
      z: 6,
      rotation: 0,
      radius: config.shape.buttonRadius,
      opacity: 1,
      ctaLabel: cta,
      href: "/collections/all",
      fill: "primary",
      color: "onPrimary",
      fontSize: 18,
      fontWeight: 600,
      align: "center",
    },
    {
      id: uid("heading"),
      type: "heading",
      x: 80,
      y: 720,
      w: 700,
      h: 70,
      z: 5,
      rotation: 0,
      radius: 0,
      opacity: 1,
      text: productTitle,
      fontSize: 36,
      fontWeight: config.typography.headingWeight,
      color: "text",
    },
  ];

  const seed = config.shop.products.slice(0, 3);
  seed.forEach((product, index) => {
    nodes.push({
      id: uid("product"),
      type: "product",
      x: 80 + index * 350,
      y: 810,
      w: 320,
      h: 360,
      z: 4,
      rotation: 0,
      radius: config.tokens.cardRadius,
      opacity: 1,
      productIndex: index,
      fill: "surface",
    });
  });

  nodes.push({
    id: uid("section"),
    type: "section",
    x: 80,
    y: 1190,
    w: 1040,
    h: 150,
    z: 3,
    rotation: 0,
    radius: config.tokens.cardRadius,
    opacity: 1,
    preset: "banner",
    eyebrow: "",
    title: `Fri frakt över ${config.conversion.freeShippingThreshold} kr`,
    text: config.footer.text || "Snabb leverans och enkla returer.",
    ctaLabel: "Shoppa nu",
    href: "/collections/all",
    fill: "primary",
    color: "onPrimary",
    fontSize: 32,
  });

  return {
    version: 1,
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
    background: "background",
    nodes,
  };
}

/**
 * Startyta för de sidor som inte har temastyrda sektioner. Den ger en
 * redigerbar stomme i stället för en tom ruta, men låser ingenting: allt kan
 * flyttas, tas bort eller byggas om.
 */
export function pageStarterCanvas(config: ThemeConfig, page: AdvancedPage): AdvancedCanvas {
  if (page === "home") return starterCanvas(config);
  const product = config.shop.products[0];
  const nodes: AdvancedNode[] = [];
  const base = (type: AdvancedNodeType, patch: Partial<AdvancedNode>): AdvancedNode => ({
    id: uid(type),
    type,
    x: 0,
    y: 0,
    w: 300,
    h: 100,
    z: 1,
    rotation: 0,
    radius: 0,
    opacity: 1,
    ...patch,
  });

  if (page === "product") {
    nodes.push(
      base("shape", { x: 40, y: 60, w: 1120, h: 560, z: 1, radius: 32, fill: "accent" }),
      base("image", {
        x: 620,
        y: 40,
        w: 500,
        h: 600,
        z: 2,
        radius: config.tokens.imageRadius,
        src: product?.image ?? config.media.heroImage ?? "",
        alt: product?.name ?? config.shop.name,
        fit: "cover",
      }),
      base("text", {
        x: 80,
        y: 110,
        w: 440,
        h: 40,
        z: 4,
        text: config.header.announcement || "Ny kollektion",
        fontSize: 15,
        fontWeight: 600,
        color: "muted",
        letterSpacing: 0.08,
      }),
      base("heading", {
        x: 80,
        y: 165,
        w: 500,
        h: 140,
        z: 4,
        text: product?.name ?? config.shop.name,
        fontSize: 58,
        fontWeight: config.typography.headingWeight,
        color: "text",
        lineHeight: 1.05,
      }),
      base("text", {
        x: 80,
        y: 320,
        w: 470,
        h: 100,
        z: 4,
        text: product?.description ?? config.shop.tagline,
        fontSize: 19,
        color: "muted",
        lineHeight: 1.5,
      }),
      base("button", {
        x: 80,
        y: 460,
        w: 250,
        h: 58,
        z: 4,
        ctaLabel: "Lägg i varukorg",
        href: "/cart",
        fill: "primary",
        color: "onPrimary",
        radius: config.shape.buttonRadius,
        fontSize: 18,
        fontWeight: 600,
        align: "center",
      }),
    );
  } else if (page === "collection") {
    nodes.push(
      base("heading", {
        x: 60,
        y: 90,
        w: 760,
        h: 120,
        z: 2,
        text: "Alla produkter",
        fontSize: 58,
        fontWeight: config.typography.headingWeight,
        color: "text",
        lineHeight: 1.04,
      }),
      base("text", {
        x: 60,
        y: 220,
        w: 620,
        h: 70,
        z: 2,
        text: `Hela kollektionen · ${config.shop.products.length} produkter`,
        fontSize: 19,
        color: "muted",
        lineHeight: 1.5,
      }),
      base("section", {
        x: 40,
        y: 330,
        w: 1120,
        h: 820,
        z: 1,
        preset: "products",
        title: "Utvalt just nu",
        text: "Filtrera och sortera precis som i butiken.",
        fill: "surface",
        color: "text",
        radius: config.tokens.cardRadius,
        fontSize: 44,
      }),
    );
  } else if (page === "search") {
    nodes.push(
      base("heading", {
        x: 60,
        y: 90,
        w: 760,
        h: 110,
        z: 2,
        text: "Sök i butiken",
        fontSize: 54,
        fontWeight: config.typography.headingWeight,
        color: "text",
        lineHeight: 1.05,
      }),
      base("shape", {
        x: 60,
        y: 240,
        w: 760,
        h: 70,
        z: 1,
        shape: "rect",
        fill: "surface",
        stroke: "primary",
        strokeWidth: 1,
        radius: config.tokens.inputRadius,
      }),
      base("text", {
        x: 88,
        y: 260,
        w: 560,
        h: 34,
        z: 2,
        text: "Sök produkt, kollektion eller guide",
        fontSize: 18,
        color: "muted",
        lineHeight: 1.3,
      }),
      base("button", {
        x: 840,
        y: 240,
        w: 220,
        h: 70,
        z: 2,
        ctaLabel: "Sök",
        fill: "primary",
        color: "onPrimary",
        radius: config.tokens.inputRadius,
        fontSize: 18,
        fontWeight: 600,
        align: "center",
      }),
      base("section", {
        x: 40,
        y: 390,
        w: 1120,
        h: 720,
        z: 1,
        preset: "products",
        title: "Populära sökningar",
        text: "Nyheter, bästsäljare, keramik och presenttips.",
        fill: "surface",
        color: "text",
        radius: config.tokens.cardRadius,
        fontSize: 42,
      }),
    );
  } else if (page === "404") {
    nodes.push(
      base("text", {
        x: 60,
        y: 150,
        w: 1080,
        h: 40,
        z: 2,
        text: "404",
        fontSize: 15,
        fontWeight: 700,
        color: "primary",
        letterSpacing: 0.18,
        align: "center",
      }),
      base("heading", {
        x: 150,
        y: 220,
        w: 900,
        h: 160,
        z: 2,
        text: "Sidan kunde inte hittas",
        fontSize: 64,
        fontWeight: config.typography.headingWeight,
        color: "text",
        lineHeight: 1.02,
        align: "center",
      }),
      base("text", {
        x: 260,
        y: 410,
        w: 680,
        h: 90,
        z: 2,
        text: "Länken kan vara gammal, eller så har sidan flyttats. Prova startsidan eller sök i butiken.",
        fontSize: 20,
        color: "muted",
        lineHeight: 1.5,
        align: "center",
      }),
      base("button", {
        x: 460,
        y: 540,
        w: 280,
        h: 60,
        z: 3,
        ctaLabel: "Till startsidan",
        href: "/",
        fill: "primary",
        color: "onPrimary",
        radius: config.shape.buttonRadius,
        fontSize: 18,
        fontWeight: 600,
        align: "center",
      }),
    );
  } else {
    const title = page === "about" ? config.shop.name : page === "contact" ? "Kontakta oss" : "Din varukorg";
    const text =
      page === "about"
        ? config.footer.text || config.shop.tagline
        : page === "contact"
          ? "Vi svarar normalt inom några timmar på vardagar."
          : "Granska din order och gå vidare till kassan.";
    nodes.push(
      base("heading", {
        x: 80,
        y: 110,
        w: 760,
        h: 130,
        z: 2,
        text: title,
        fontSize: 56,
        fontWeight: config.typography.headingWeight,
        color: "text",
        lineHeight: 1.06,
      }),
      base("text", {
        x: 80,
        y: 260,
        w: 620,
        h: 110,
        z: 2,
        text,
        fontSize: 20,
        color: "muted",
        lineHeight: 1.55,
      }),
    );
    if (page === "about") {
      nodes.push(base("image", { x: 760, y: 90, w: 360, h: 440, z: 1, radius: config.tokens.imageRadius, src: config.media.heroImage, alt: config.shop.name, fit: "cover" }));
    } else {
      nodes.push(
        base("button", {
          x: 80,
          y: 400,
          w: 240,
          h: 56,
          z: 3,
          ctaLabel: page === "contact" ? "Skicka meddelande" : "Till kassan",
          href: page === "contact" ? "/pages/contact" : "/checkout",
          fill: "primary",
          color: "onPrimary",
          radius: config.shape.buttonRadius,
          fontSize: 17,
          fontWeight: 600,
          align: "center",
        }),
      );
    }
  }

  return {
    version: 1,
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
    background: "background",
    // Kollektion, sök och 404 har inget formulär som måste bevaras: där är den
    // fria ytan hela sidan. Produkt, kundvagn och kontakt behåller sin funktion.
    replaceDefault: page === "collection" || page === "search" || page === "404",
    nodes,
  };
}

/** Färgnyckel eller hex – används av både preview och export. */
export function colorFor(token: string | undefined, config: ThemeConfig, fallback: AdvancedColorToken = "text"): string {
  // Egna färger (hex, rgb(), hsl(), namn) går rakt igenom. Palettnycklar
  // slås upp mot temat så att en ändring i paletten slår igenom överallt.
  if (isColorValue(token) && !COLOR_TOKENS.includes(token.trim() as AdvancedColorToken)) return token.trim();
  const value = (token || fallback) as AdvancedColorToken;
  switch (value) {
    case "muted":
      return config.palette.muted;
    case "primary":
      return config.palette.primary;
    case "accent":
      return config.palette.accent;
    case "surface":
      return config.palette.surface;
    case "background":
      return config.palette.background;
    case "onPrimary":
      return readableOn(config.palette.primary);
    default:
      return config.palette.text;
  }
}

export function readableOn(hex: string): string {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((char) => char + char).join("") : value;
  if (full.length !== 6) return "#FFFFFF";
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? "#14140F" : "#FFFFFF";
}

/** Proportionell enhet: 1 designpixel blir lika många cqw som canvasen bredd. */
export function cqw(px: number, canvas: AdvancedCanvas = emptyCanvas()): string {
  return `${((px / canvas.width) * 100).toFixed(4)}cqw`;
}

export function safeHref(value: string | undefined): string {
  const href = (value ?? "").trim();
  if (!href) return "#";
  if (/^(https?:\/\/|\/|#|mailto:|tel:)/i.test(href)) return href;
  return "#";
}

export function safeSrc(value: string | undefined): string {
  const src = (value ?? "").trim();
  if (!src) return "";
  if (/^(https?:\/\/|\/|data:image\/)/i.test(src)) return src;
  return "";
}

export function nodeCenter(node: AdvancedNode): { x: number; y: number } {
  return { x: node.x + node.w / 2, y: node.y + node.h / 2 };
}

/**
 * Kopplingar ritas mellan två noders mittpunkter. Slutpunkterna räknas fram
 * live, så en koppling följer med när noderna flyttas.
 */
export function connectorGeometry(
  node: AdvancedNode,
  nodes: AdvancedNode[],
): { x1: number; y1: number; x2: number; y2: number } | null {
  const from = nodes.find((item) => item.id === node.fromId);
  const to = nodes.find((item) => item.id === node.toId);
  if (!from || !to) return null;
  const a = nodeCenter(from);
  const b = nodeCenter(to);
  return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
}

export function nextZ(nodes: AdvancedNode[]): number {
  return Math.max(0, ...nodes.map((node) => node.z)) + 1;
}

/** Snygg standardplacering för nya element: mitten, men aldrig utanför ytan. */
export function centeredPlacement(node: AdvancedNode, canvas: AdvancedCanvas): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(canvas.width - node.w, (canvas.width - node.w) / 2)),
    y: Math.max(0, Math.min(canvas.height - node.h, (canvas.height - node.h) / 2)),
  };
}

export function canvasNodeLabel(node: AdvancedNode): string {
  switch (node.type) {
    case "heading":
      return node.text?.slice(0, 40) || "Rubrik";
    case "text":
      return node.text?.slice(0, 40) || "Text";
    case "image":
      return node.alt || "Bild";
    case "button":
      return node.ctaLabel || "Knapp";
    case "product":
      return "Produkt";
    case "products":
      return "Produktrad";
    case "section":
      return node.title?.slice(0, 40) || "Sektion";
    case "shape":
      return node.shape === "ellipse" ? "Ellips" : node.shape === "line" ? "Linje" : "Form";
    case "drawing":
      return "Ritning";
    case "connector":
      return "Koppling";
    case "logo":
      return node.text?.slice(0, 40) || "Logotyp";
    case "nav":
      return "Meny";
    case "cart":
      return "Varukorg";
    case "search":
      return "Sök";
  }
}
