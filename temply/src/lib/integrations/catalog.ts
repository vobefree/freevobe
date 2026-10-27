import type {
  CanvaFormat,
  CanvaSource,
  CanvaUse,
  IntegrationBlockId,
  IntegrationConnection,
  IntegrationSlot,
  ThemeConfig,
} from "@/lib/theme/types";

export type IntegrationProvider = {
  id: string;
  name: string;
  /** Kort rad i leverantörslistan. */
  note?: string;
  setupUrl: string;
};

export type IntegrationBlockDefinition = {
  id: IntegrationBlockId;
  icon: "star" | "mail" | "quote" | "heart" | "chart" | "shield" | "card" | "images" | "zap";
  kind: "app-block" | "app-embed";
  slot: IntegrationSlot;
  /** Flera leverantörer kan vara kopplade samtidigt (t.ex. flera pixlar). */
  multi: boolean;
  providers: IntegrationProvider[];
  /** Var blocket hamnar i temat – används i exporten. */
  exportKey: string;
};

export const SLOT_ORDER: IntegrationSlot[] = [
  "product.reviews",
  "footer.newsletter",
  "global.chat",
  "account.loyalty",
  "global.analytics",
  "global.consent",
  "checkout.payments",
  "social.ugc",
  "home.campaign",
];

export const INTEGRATION_BLOCKS: IntegrationBlockDefinition[] = [
  {
    id: "reviews",
    icon: "star",
    kind: "app-block",
    slot: "product.reviews",
    multi: false,
    exportKey: "reviews",
    providers: [
      { id: "judgeme", name: "Judge.me", note: "Betyg, recensioner och bilder", setupUrl: "https://apps.shopify.com/judgeme" },
      { id: "loox", name: "Loox", note: "Foto- och videorecensioner", setupUrl: "https://apps.shopify.com/loox" },
      { id: "shopify", name: "Shopify Reviews", note: "Inbyggda produktbetyg", setupUrl: "https://apps.shopify.com/product-reviews" },
    ],
  },
  {
    id: "newsletter",
    icon: "mail",
    kind: "app-embed",
    slot: "footer.newsletter",
    multi: false,
    exportKey: "newsletter",
    providers: [
      { id: "klaviyo", name: "Klaviyo", note: "Formulär, popup och flöden", setupUrl: "https://apps.shopify.com/klaviyo-email-marketing" },
      { id: "omnisend", name: "Omnisend", note: "Nyhetsbrev och automation", setupUrl: "https://apps.shopify.com/omnisend" },
      { id: "mailchimp", name: "Mailchimp", note: "Enkla nyhetsbrev", setupUrl: "https://apps.shopify.com/mailchimp" },
    ],
  },
  {
    id: "chat",
    icon: "quote",
    kind: "app-embed",
    slot: "global.chat",
    multi: false,
    exportKey: "chat",
    providers: [
      { id: "tidio", name: "Tidio", note: "Livechatt och chatbot", setupUrl: "https://apps.shopify.com/tidio-chat" },
      { id: "gorgias", name: "Gorgias", note: "Support och ärenden", setupUrl: "https://apps.shopify.com/gorgias" },
      { id: "intercom", name: "Intercom", note: "Chatt och hjälpcenter", setupUrl: "https://apps.shopify.com/intercom" },
    ],
  },
  {
    id: "loyalty",
    icon: "heart",
    kind: "app-block",
    slot: "account.loyalty",
    multi: false,
    exportKey: "loyalty",
    providers: [
      { id: "smile", name: "Smile.io", note: "Poäng och belöningar", setupUrl: "https://apps.shopify.com/smile-io" },
      { id: "loyaltylion", name: "LoyaltyLion", note: "Lojalitetsprogram", setupUrl: "https://apps.shopify.com/loyaltylion" },
    ],
  },
  {
    id: "analytics",
    icon: "chart",
    kind: "app-embed",
    slot: "global.analytics",
    multi: true,
    exportKey: "analytics",
    providers: [
      { id: "ga4", name: "Google Analytics 4", setupUrl: "https://analytics.google.com" },
      { id: "meta", name: "Meta Pixel", setupUrl: "https://business.facebook.com/events_manager" },
      { id: "tiktok", name: "TikTok Pixel", setupUrl: "https://ads.tiktok.com" },
    ],
  },
  {
    id: "consent",
    icon: "shield",
    kind: "app-embed",
    slot: "global.consent",
    multi: false,
    exportKey: "consent",
    providers: [
      { id: "shopify", name: "Shopify Customer Privacy", note: "Inbyggt samtycke", setupUrl: "https://help.shopify.com/manual/privacy-and-security/privacy/consent" },
      { id: "cookiebot", name: "Cookiebot", setupUrl: "https://apps.shopify.com/cookiebot" },
      { id: "consentmo", name: "Consentmo", setupUrl: "https://apps.shopify.com/gdpr-consent" },
    ],
  },
  {
    id: "payments",
    icon: "card",
    kind: "app-block",
    slot: "checkout.payments",
    multi: true,
    exportKey: "payments",
    providers: [
      { id: "klarna", name: "Klarna", note: "Betala senare", setupUrl: "https://apps.shopify.com/klarna" },
      { id: "paypal", name: "PayPal", setupUrl: "https://apps.shopify.com/paypal-express-checkout" },
      { id: "shoppay", name: "Shop Pay", setupUrl: "https://help.shopify.com/manual/payments/shop-pay" },
      { id: "applepay", name: "Apple Pay", setupUrl: "https://help.shopify.com/manual/payments/apple-pay" },
    ],
  },
  {
    id: "ugc",
    icon: "images",
    kind: "app-block",
    slot: "social.ugc",
    multi: false,
    exportKey: "ugc",
    providers: [
      { id: "instagram", name: "Instagram-feed", note: "Kundbilder och socialt bevis", setupUrl: "https://apps.shopify.com/instagram-feed" },
      { id: "foursixty", name: "Foursixty", setupUrl: "https://apps.shopify.com/foursixty" },
    ],
  },
  {
    id: "campaign",
    icon: "zap",
    kind: "app-block",
    slot: "home.campaign",
    multi: false,
    exportKey: "campaign",
    providers: [
      { id: "native", name: "Temply kampanjband", note: "Byggs i temat, ingen app krävs", setupUrl: "" },
      { id: "shopify", name: "Shopify Campaigns", setupUrl: "https://apps.shopify.com/shopify-email" },
    ],
  },
];

export const INTEGRATION_BY_ID: Record<IntegrationBlockId, IntegrationBlockDefinition> = Object.fromEntries(
  INTEGRATION_BLOCKS.map((block) => [block.id, block]),
) as Record<IntegrationBlockId, IntegrationBlockDefinition>;

export function providerName(blockId: IntegrationBlockId, providerId: string): string {
  const block = INTEGRATION_BY_ID[blockId];
  return block?.providers.find((provider) => provider.id === providerId)?.name ?? providerId;
}

export function integrationLabel(connection: IntegrationConnection, blockId: IntegrationBlockId): string {
  return connection.providers.map((provider) => providerName(blockId, provider)).join(" · ");
}

export function isIntegrationLive(connection: IntegrationConnection | undefined): boolean {
  return Boolean(connection && connection.enabled && connection.providers.length > 0 && connection.connectedAt);
}

export function liveProviders(config: ThemeConfig, blockId: IntegrationBlockId): IntegrationProvider[] {
  const connection = config.integrations.blocks?.[blockId];
  if (!isIntegrationLive(connection)) return [];
  return INTEGRATION_BY_ID[blockId].providers.filter((provider) => connection.providers.includes(provider.id));
}

export const DEFAULT_CANVA: CanvaSource = {
  connected: false,
  folder: "",
  lastExportAt: null,
  designs: [],
};

export function defaultIntegrationBlocks(): Record<IntegrationBlockId, IntegrationConnection> {
  const blocks = {} as Record<IntegrationBlockId, IntegrationConnection>;
  for (const block of INTEGRATION_BLOCKS) {
    blocks[block.id] = { enabled: false, providers: [], account: "", slot: block.slot, connectedAt: null };
  }
  return blocks;
}

export type CanvaFormatMeta = {
  id: CanvaFormat;
  width: number;
  height: number;
  ratio: string;
  createUrl: string;
};

export const CANVA_FORMATS: CanvaFormatMeta[] = [
  { id: "hero", width: 2400, height: 1200, ratio: "2:1", createUrl: "https://www.canva.com/create/banners/" },
  { id: "campaign", width: 1600, height: 600, ratio: "8:3", createUrl: "https://www.canva.com/create/banners/" },
  { id: "product", width: 1200, height: 1200, ratio: "1:1", createUrl: "https://www.canva.com/create/instagram-posts/" },
  { id: "og", width: 1200, height: 630, ratio: "1.91:1", createUrl: "https://www.canva.com/create/facebook-posts/" },
  { id: "social", width: 1080, height: 1080, ratio: "1:1", createUrl: "https://www.canva.com/create/instagram-posts/" },
  { id: "email", width: 600, height: 900, ratio: "2:3", createUrl: "https://www.canva.com/create/email-headers/" },
];

export function canvaDesignFor(config: ThemeConfig, use: Exclude<CanvaUse, "">) {
  return config.integrations.canva?.designs.find((design) => design.use === use) ?? null;
}

/** Kort brief som klistras in i Canva så att format, färger och typsnitt följer varumärket. */
export function canvaBrief(config: ThemeConfig, format: CanvaFormat): string {
  const meta = CANVA_FORMATS.find((item) => item.id === format) ?? CANVA_FORMATS[0];
  const products = config.shop.products.slice(0, 4).map((product) => `- ${product.name} (${product.price})`).join("\n");
  const productImages = config.shop.products
    .filter((product) => product.image)
    .slice(0, 4)
    .map((product) => `- ${product.name}: ${product.image}`)
    .join("\n");
  return [
    `Temply · Canva-brief för ${config.shop.name}`,
    `Format: ${meta.width} × ${meta.height} px (${meta.ratio})`,
    `Varumärkesfärger: ${config.brand.colors.join(", ") || config.palette.primary}`,
    `Typsnitt: ${config.typography.heading} (rubrik) / ${config.typography.body} (brödtext)`,
    `Känsla: ${config.brand.tone}`,
    products ? `Produkter att använda:\n${products}` : "",
    productImages ? `Shopify-produktbilder:\n${productImages}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
