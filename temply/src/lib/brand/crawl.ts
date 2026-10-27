import dns from "node:dns/promises";
import net from "node:net";
import type { DnaPageKey } from "@/lib/theme/types";
import { analyzePage, collectStylesheets, type ExtractedProduct, type IconHit, type PageFacts } from "./extract";

const USER_AGENT = "ThemeFold-BrandBot/1.0 (+https://temply.app/bot)";
const MAX_HTML_BYTES = 900_000;
const REQUEST_TIMEOUT = 9_000;
const CRAWL_BUDGET = 20_000;

export class CrawlError extends Error {
  code: "invalid_url" | "blocked_host" | "robots_blocked" | "fetch_failed" | "not_html";
  status: number;
  constructor(code: CrawlError["code"], status: number, message?: string) {
    super(message ?? code);
    this.code = code;
    this.status = status;
  }
}

export type CrawledPage = { role: DnaPageKey; facts: PageFacts };

export type CrawledSite = {
  url: string;
  origin: string;
  host: string;
  home: PageFacts;
  pages: CrawledPage[];
  facts: PageFacts[];
  shopifyProducts: ExtractedProduct[];
  currency: string;
  manifestIcons: { url: string; sizes: string }[];
  policies: {
    returns: string;
    shipping: string;
    returnsUrl: string;
    shippingUrl: string;
  };
  notes: string[];
};

/** robots.txt-regler för vår user-agent (eller * om ingen specifik grupp finns). */
type RobotsRules = { allow: string[]; disallow: string[] };

export function parseRobots(text: string): RobotsRules {
  const groups: { agents: string[]; allow: string[]; disallow: string[] }[] = [];
  let current: { agents: string[]; allow: string[]; disallow: string[] } | null = null;
  let expectingAgents = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const index = line.indexOf(":");
    if (index < 0) continue;
    const key = line.slice(0, index).trim().toLowerCase();
    const value = line.slice(index + 1).trim();

    if (key === "user-agent") {
      if (!current || !expectingAgents) {
        current = { agents: [], allow: [], disallow: [] };
        groups.push(current);
        expectingAgents = true;
      }
      current.agents.push(value.toLowerCase());
      continue;
    }
    if (key === "allow" || key === "disallow") {
      if (!current) continue;
      expectingAgents = false;
      if (value) (key === "allow" ? current.allow : current.disallow).push(value);
    }
  }

  const ours = groups.find((group) => group.agents.some((agent) => agent === "themefold-brandbot" || agent === "themefold"));
  const group = ours ?? groups.find((entry) => entry.agents.includes("*"));
  return { allow: group?.allow ?? [], disallow: group?.disallow ?? [] };
}

function ruleMatches(path: string, rule: string): boolean {
  const clean = rule.replace(/\*+$/, "");
  if (!clean) return false;
  if (clean.includes("*")) {
    const pattern = new RegExp(`^${clean.split("*").map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")}`);
    return pattern.test(path);
  }
  return path.startsWith(clean);
}

export function robotsAllows(path: string, rules: RobotsRules): boolean {
  let best: { length: number; allow: boolean } | null = null;
  for (const rule of rules.disallow) {
    if (ruleMatches(path, rule) && (!best || rule.length > best.length)) best = { length: rule.length, allow: false };
  }
  for (const rule of rules.allow) {
    if (ruleMatches(path, rule) && (!best || rule.length >= best.length)) best = { length: rule.length, allow: true };
  }
  return best?.allow ?? true;
}

const PRIVATE_V4 = [
  { mask: 8, net: [10, 0, 0, 0] },
  { mask: 8, net: [127, 0, 0, 0] },
  { mask: 16, net: [169, 254, 0, 0] },
  { mask: 12, net: [172, 16, 0, 0] },
  { mask: 16, net: [192, 168, 0, 0] },
  { mask: 24, net: [0, 0, 0, 0] },
  { mask: 4, net: [224, 0, 0, 0] },
  { mask: 4, net: [240, 0, 0, 0] },
];

function ipv4ToNumber(ip: string): number {
  return ip.split(".").reduce((sum, part) => (sum << 8) + Number(part), 0) >>> 0;
}

export function isPrivateAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    if (PRIVATE_V4.some(({ mask, net: base }) => ((ipv4ToNumber(address) ^ ipv4ToNumber(base.join("."))) >>> (32 - mask)) === 0)) return true;
    return false;
  }
  if (net.isIPv6(address)) {
    const lower = address.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    if (/^f[cd]/.test(lower)) return true;
    if (/^fe80:/.test(lower)) return true;
    const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return false;
  }
  return true;
}

const BLOCKED_NAMES = /^(localhost|.*\.local|.*\.internal|.*\.localhost|.*\.home\.arpa)$/i;

/** Normaliserar användarens inmatning till en http(s)-URL. */
export function normalizeInputUrl(raw: string): URL {
  const value = raw.trim();
  if (!value) throw new CrawlError("invalid_url", 400);
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new CrawlError("invalid_url", 400);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new CrawlError("invalid_url", 400);
  if (url.username || url.password) throw new CrawlError("invalid_url", 400);
  if (url.port && url.port !== "80" && url.port !== "443") throw new CrawlError("blocked_host", 400);
  if (!url.hostname.includes(".") || BLOCKED_NAMES.test(url.hostname) || net.isIP(url.hostname)) throw new CrawlError("blocked_host", 400);
  return url;
}

type ResolveCache = Map<string, Promise<string[]>>;

function resolver(cache: ResolveCache) {
  return async (hostname: string): Promise<string[]> => {
    const existing = cache.get(hostname);
    if (existing) return existing;
    const promise = dns.lookup(hostname, { all: true }).then((records) => records.map((record) => record.address));
    cache.set(hostname, promise);
    return promise;
  };
}

async function assertPublicHost(url: URL, resolve: (hostname: string) => Promise<string[]>) {
  if (BLOCKED_NAMES.test(url.hostname)) throw new CrawlError("blocked_host", 400, "private host");
  let addresses: string[];
  try {
    addresses = await resolve(url.hostname);
  } catch {
    throw new CrawlError("fetch_failed", 502, "dns_failed");
  }
  if (!addresses.length || addresses.some((address) => isPrivateAddress(address))) {
    throw new CrawlError("blocked_host", 400, "private address");
  }
}

async function readLimited(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return (await response.text()).slice(0, maxBytes);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      chunks.push(value);
      total += value.length;
      if (total >= maxBytes) {
        await reader.cancel().catch(() => undefined);
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }
  const size = Math.min(total, maxBytes);
  const merged = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    if (offset >= size) break;
    const take = Math.min(chunk.length, size - offset);
    merged.set(chunk.subarray(0, take), offset);
    offset += take;
  }
  return new TextDecoder("utf-8").decode(merged);
}

type FetchOptions = { accept: string; maxBytes?: number; timeout?: number };

async function fetchText(url: URL, options: FetchOptions, resolve: ResolveCache): Promise<{ text: string; type: string; finalUrl: URL }> {
  let current = url;
  for (let hop = 0; hop < 4; hop += 1) {
    await assertPublicHost(current, resolver(resolve));
    let response: Response;
    try {
      response = await fetch(current.toString(), {
        headers: { "User-Agent": USER_AGENT, Accept: options.accept, "Accept-Language": "sv,en;q=0.8" },
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(options.timeout ?? REQUEST_TIMEOUT),
      });
    } catch {
      throw new CrawlError("fetch_failed", 502);
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new CrawlError("fetch_failed", 502);
      const next = new URL(location, current);
      if (next.protocol !== "https:" && next.protocol !== "http:") throw new CrawlError("blocked_host", 400);
      if (next.port && next.port !== "80" && next.port !== "443") throw new CrawlError("blocked_host", 400);
      current = next;
      continue;
    }
    if (!response.ok) throw new CrawlError(response.status === 404 ? "not_html" : "fetch_failed", 502, `http_${response.status}`);
    const type = response.headers.get("content-type") ?? "";
    const robotsTag = response.headers.get("x-robots-tag") ?? "";
    if (/noindex/i.test(robotsTag)) throw new CrawlError("not_html", 422, "noindex");
    const text = await readLimited(response, options.maxBytes ?? MAX_HTML_BYTES);
    return { text, type, finalUrl: current };
  }
  throw new CrawlError("fetch_failed", 502, "too_many_redirects");
}

function sameSite(candidate: URL, origin: URL): boolean {
  return candidate.hostname.replace(/^www\./i, "") === origin.hostname.replace(/^www\./i, "");
}

type LinkCandidate = { url: string; label: string };

function collectLinks(html: string, base: string): LinkCandidate[] {
  const links: LinkCandidate[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = match[1].match(/href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const raw = href?.[2] ?? href?.[3] ?? href?.[4] ?? "";
    if (!raw || raw.startsWith("#") || /^(mailto|tel|javascript):/i.test(raw)) continue;
    let url: URL;
    try {
      url = new URL(raw, base);
    } catch {
      continue;
    }
    url.hash = "";
    const key = url.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    const label = match[2].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    links.push({ url: key, label });
  }
  return links;
}

const ROLE_PATTERNS: { role: DnaPageKey; path: RegExp; label?: RegExp }[] = [
  { role: "about", path: /\/(about|om-oss|om|vara-historia|var-historia|story|foretaget|uber-uns|a-propos|nosotros|meista|meist)(\/|$)/i, label: /(om oss|about|historia|story|über uns|à propos|nosotros|meistä)/i },
  { role: "contact", path: /\/(contact|kontakt|kontakta|yhteys|contacto|kontakt-os|support)(\/|$)/i, label: /(kontakt|contact|contacto|yhteys)/i },
  { role: "collection", path: /\/(collections?|kollektioner?|kategorier|category|categories|produkter|products|shop|butik|tienda|boutique|alle-produkte|sortiment)(\/|$)/i, label: /(shop|produkter|products|kollektion|collection|alla|all products|sortiment)/i },
  { role: "product", path: /\/(products?|produkt|produkter|p)\/[a-z0-9][a-z0-9-_]+/i },
];

function pickPage(links: LinkCandidate[], origin: URL, taken: Set<string>): Partial<Record<DnaPageKey, string>> {
  const picked: Partial<Record<DnaPageKey, string>> = {};
  for (const { role, path, label } of ROLE_PATTERNS) {
    let best: { url: string; score: number } | null = null;
    for (const link of links) {
      let url: URL;
      try {
        url = new URL(link.url);
      } catch {
        continue;
      }
      if (!sameSite(url, origin)) continue;
      if (/\.(pdf|jpg|jpeg|png|webp|zip|xml)$/i.test(url.pathname)) continue;
      if (/\/(cart|checkout|account|login|signin|signup|search|wp-admin|feed|tags?|author)\b/i.test(url.pathname)) continue;
      const pathMatch = path.test(url.pathname);
      const labelMatch = label ? label.test(link.label) : false;
      if (!pathMatch && !labelMatch) continue;
      if (taken.has(url.toString())) continue;
      const score = (pathMatch ? 2 : 0) + (labelMatch ? 2 : 0) + (url.pathname.split("/").filter(Boolean).length <= 2 ? 1 : 0);
      if (!best || score > best.score) best = { url: url.toString(), score };
    }
    if (best) picked[role] = best.url;
  }
  return picked;
}

const POLICY_PATTERNS: { key: "returns" | "shipping"; path: RegExp; label: RegExp }[] = [
  { key: "returns", path: /\/(policies\/refund-policy|refund|returns?|returer?|angerratt|widerruf|retours?|devoluciones)/i, label: /(retur|return|widerruf|retour|devoluci|ånger)/i },
  { key: "shipping", path: /\/(policies\/shipping-policy|shipping|frakt|leverans|versand|livraison|envio|toimitus)/i, label: /(frakt|shipping|leverans|delivery|versand|livraison|envío|toimitus)/i },
];

function pickPolicy(links: LinkCandidate[], origin: URL, key: "returns" | "shipping"): string {
  const pattern = POLICY_PATTERNS.find((entry) => entry.key === key)!;
  let best: { url: string; score: number } | null = null;
  for (const link of links) {
    let url: URL;
    try {
      url = new URL(link.url);
    } catch {
      continue;
    }
    if (!sameSite(url, origin)) continue;
    const pathMatch = pattern.path.test(url.pathname);
    const labelMatch = pattern.label.test(link.label);
    if (!pathMatch && !labelMatch) continue;
    const score = (pathMatch ? 2 : 0) + (labelMatch ? 1 : 0) + (/policies\//i.test(url.pathname) ? 2 : 0);
    if (!best || score > best.score) best = { url: url.toString(), score };
  }
  if (best) return best.url;
  if (key === "returns") return new URL("/policies/refund-policy", origin).toString();
  return new URL("/policies/shipping-policy", origin).toString();
}

function policyWords(key: "returns" | "shipping"): RegExp {
  return key === "returns"
    ? /(retur|återbetal|ångerrätt|return|refund|exchange|byte|widerruf|retour|devoluci|palautus)/i
    : /(frakt|leverans|shipping|delivery|versand|livraison|envío|toimitus|spårning|tracking)/i;
}

/** Ett policystycke ska vara en mening – inte en hopklämd menylista. */
function usablePolicyText(value: string): boolean {
  if (value.length < 40 || value.length > 900) return false;
  if (!/[.!?]/.test(value)) return false;
  if (/\+\s*-/.test(value)) return false;
  if ((value.match(/\s[•|]\s/g) ?? []).length > 2) return false;
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length < 8 || words.length > 150) return false;
  return true;
}

/** Meny- och sidfotsfraser som aldrig är själva policyn. */
const POLICY_NAV = /\b(all rights reserved|refund policy|privacy policy|terms of service|close|cookie|log in|sign in|search|menu|skip to)\b/gi;

/** Sidtiteln hamnar ofta först i brödtexten och tillhör inte policyn. */
function stripPageTitle(value: string, facts: PageFacts): string {
  let out = value.trim();
  for (const title of [facts.title, facts.ogTitle, facts.siteName]) {
    const clean = title?.trim() ?? "";
    if (clean.length > 8 && out.startsWith(clean)) out = out.slice(clean.length).trim();
  }
  return out;
}

/** Markuprester, script-utdrag och varukorgssiffror är inte policytext. */
const POLICY_JUNK = /[<>]|\bclass\b|\bdata-[a-z-]+\b|=|\(\s*['"]|subtotal|add to (cart|bag)|\bsku\b/i;

function policySentences(text: string, words: RegExp): { text: string; score: number }[] {
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter(
      (sentence) =>
        sentence.length >= 40 &&
        sentence.length <= 320 &&
        words.test(sentence) &&
        !POLICY_JUNK.test(sentence) &&
        !/\+\s*-/.test(sentence) &&
        sentence.split(" ").length <= 70,
    );
  return sentences.map((sentence) => {
    let score = 0;
    if (/\b(\d{1,3})\s*(days?|dagar|dage|dagen|päivää)\b/i.test(sentence)) score += 3;
    if (/\b(within|from the date|från (det att|och med)|senast|no later than|innan)\b/i.test(sentence)) score += 2;
    if (/\b(return|refund|exchange|shipping|delivery|cost|fee|deliver|ship|retur|återbetal|frakt|leverans|kostnad)\b/i.test(sentence)) score += 2;
    const nav = (sentence.match(POLICY_NAV) ?? []).length;
    score -= nav * 2;
    return { text: sentence, score };
  });
}

/** Plockar ut retur-/leveranstext från en policysida (eller, i strikt läge, från en annan sida). */
function policySnippet(facts: PageFacts, key: "returns" | "shipping", strict = false): string {
  const words = policyWords(key);
  const ranked = policySentences(facts.text, words)
    .map((entry, index) => ({ ...entry, index }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);
  if (ranked.length) {
    const joined = ranked
      .slice(0, 3)
      .sort((a, b) => a.index - b.index)
      .map((entry) => entry.text)
      .join(" ")
      .slice(0, 480)
      .trim();
    return stripPageTitle(joined, facts);
  }
  const paragraphs = facts.paragraphs.filter((paragraph) => words.test(paragraph) && usablePolicyText(paragraph));
  if (paragraphs.length) return paragraphs.slice(0, 2).join(" ").slice(0, 480).trim();
  if (strict) return "";
  return "";
}

function shopifyProductsFromJson(json: unknown, base: string): ExtractedProduct[] {
  if (!json || typeof json !== "object") return [];
  const products = (json as { products?: unknown }).products;
  if (!Array.isArray(products)) return [];
  const out: ExtractedProduct[] = [];
  for (const raw of products) {
    if (!raw || typeof raw !== "object") continue;
    const product = raw as Record<string, unknown>;
    const title = typeof product.title === "string" ? product.title.trim() : "";
    if (!title) continue;
    const variants = Array.isArray(product.variants) ? (product.variants as Record<string, unknown>[]) : [];
    const price = variants[0]?.price;
    const handle = typeof product.handle === "string" ? product.handle : "";
    const images = Array.isArray(product.images) ? (product.images as Record<string, unknown>[]) : [];
    const image = typeof images[0]?.src === "string" ? images[0].src : "";
    out.push({
      name: title.slice(0, 90),
      price: price !== undefined && price !== null && price !== "" ? `${String(price).replace(".", ",")}` : "",
      image,
      url: handle ? new URL(`/products/${handle}`, base).toString() : "",
      category: typeof product.product_type === "string" ? product.product_type : "",
      description: typeof product.body_html === "string" ? product.body_html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 240) : "",
    });
    if (out.length >= 16) break;
  }
  return out;
}

/**
 * Hämtar startsidan plus de viktigaste undersidorna och respekterar robots.txt.
 * Allt som hämtas är offentligt och används bara som referens under domänens ägare.
 */
export async function crawlSite(rawUrl: string): Promise<CrawledSite> {
  const start = normalizeInputUrl(rawUrl);
  const origin = new URL(start.origin);
  const resolve: ResolveCache = new Map();
  const notes: string[] = [];
  const deadline = Date.now() + CRAWL_BUDGET;

  let robots: RobotsRules = { allow: [], disallow: [] };
  try {
    const robotsResponse = await fetchText(new URL("/robots.txt", origin), { accept: "text/plain", maxBytes: 120_000, timeout: 5000 }, resolve);
    robots = parseRobots(robotsResponse.text);
  } catch {
    notes.push("robots_unavailable");
  }

  const homePath = `${start.pathname}${start.search}` || "/";
  if (!robotsAllows(homePath, robots)) throw new CrawlError("robots_blocked", 403);

  const homeResponse = await fetchText(start, { accept: "text/html,application/xhtml+xml" }, resolve);
  if (homeResponse.type && !/html|xml/i.test(homeResponse.type)) throw new CrawlError("not_html", 422);

  const homeUrl = homeResponse.finalUrl.toString();
  const stylesheets = collectStylesheets(homeResponse.text, homeUrl).slice(0, 3);
  let homeCss = "";
  for (const href of stylesheets) {
    if (Date.now() > deadline) break;
    try {
      const response = await fetchText(new URL(href), { accept: "text/css,*/*", maxBytes: 400_000 }, resolve);
      homeCss += `\n${response.text}`;
    } catch {
      /* stilmallen kunde inte läsas – analysen fortsätter utan den */
    }
  }

  const home = analyzePage(homeResponse.text, homeUrl, homeCss);
  const links = collectLinks(homeResponse.text, homeUrl);
  const taken = new Set<string>([homeUrl]);
  const picked = pickPage(links, origin, taken);

  const wanted: { role: DnaPageKey; url: string }[] = [];
  for (const role of ["collection", "product", "about", "contact"] as DnaPageKey[]) {
    const url = picked[role];
    if (!url) continue;
    wanted.push({ role, url });
    taken.add(url);
    if (wanted.length >= 4) break;
  }

  const fetchRole = async (role: DnaPageKey, url: string): Promise<CrawledPage | null> => {
    if (Date.now() > deadline) return null;
    const parsed = new URL(url);
    if (!sameSite(parsed, origin) || !robotsAllows(parsed.pathname, robots)) return null;
    try {
      const response = await fetchText(parsed, { accept: "text/html,application/xhtml+xml" }, resolve);
      if (response.type && !/html|xml/i.test(response.type)) return null;
      return { role, facts: analyzePage(response.text, response.finalUrl.toString()) };
    } catch {
      return null;
    }
  };

  const extraPages: CrawledPage[] = [];
  for (let index = 0; index < wanted.length; index += 3) {
    const batch = wanted.slice(index, index + 3);
    const results = await Promise.all(batch.map((entry) => fetchRole(entry.role, entry.url)));
    for (const result of results) if (result) extraPages.push(result);
  }

  const policyUrls = {
    returns: pickPolicy(links, origin, "returns"),
    shipping: pickPolicy(links, origin, "shipping"),
  };
  const policyPages: { key: "returns" | "shipping"; facts: PageFacts | null }[] = [];
  for (const key of ["returns", "shipping"] as const) {
    const url = policyUrls[key];
    const parsed = new URL(url);
    if (!sameSite(parsed, origin) || !robotsAllows(parsed.pathname, robots) || Date.now() > deadline) {
      policyPages.push({ key, facts: null });
      continue;
    }
    try {
      const response = await fetchText(parsed, { accept: "text/html,application/xhtml+xml", maxBytes: 600_000 }, resolve);
      policyPages.push({ key, facts: analyzePage(response.text, response.finalUrl.toString()) });
    } catch {
      policyPages.push({ key, facts: null });
    }
  }

  const pageCurrency =
    home.text.match(/"currency"\s*:\s*"([A-Z]{3})"/)?.[1] ??
    home.text.match(/\b(SEK|NOK|DKK|EUR|USD|GBP|CHF|CAD|AUD|PLN)\b/)?.[1] ??
    "";
  const symbol = pageCurrency ? "" : home.text.match(/[$€£¥]/)?.[0] ?? "";
  const currency = pageCurrency || (symbol === "$" ? "USD" : symbol === "€" ? "EUR" : symbol === "£" ? "GBP" : "");

  let shopifyProducts: ExtractedProduct[] = [];
  if (home.hasShopify || /shopify/i.test(homeResponse.text.slice(0, 200_000))) {
    const productsUrl = new URL("/products.json?limit=24", origin);
    if (robotsAllows(productsUrl.pathname, robots)) {
      try {
        const response = await fetchText(productsUrl, { accept: "application/json", maxBytes: 800_000 }, resolve);
        shopifyProducts = shopifyProductsFromJson(JSON.parse(response.text), origin.toString()).map((product) => ({
          ...product,
          // Shopify returnerar priser som siffror i butikens valuta.
          price: product.price && currency ? `${product.price} ${currency}` : product.price,
        }));
      } catch {
        notes.push("products_unavailable");
      }
    }
  }

  const manifestIcons: { url: string; sizes: string }[] = [];
  if (home.manifest) {
    try {
      const manifestUrl = new URL(home.manifest);
      if (sameSite(manifestUrl, origin)) {
        const response = await fetchText(manifestUrl, { accept: "application/manifest+json,application/json", maxBytes: 200_000 }, resolve);
        const parsed = JSON.parse(response.text) as { icons?: { src?: string; sizes?: string }[] };
        for (const icon of parsed.icons ?? []) {
          if (!icon.src) continue;
          manifestIcons.push({ url: new URL(icon.src, manifestUrl).toString(), sizes: icon.sizes ?? "" });
        }
      }
    } catch {
      notes.push("manifest_unavailable");
    }
  }

  const facts = [home, ...extraPages.map((page) => page.facts)];
  const returnsFacts = policyPages.find((page) => page.key === "returns")?.facts;
  const shippingFacts = policyPages.find((page) => page.key === "shipping")?.facts;
  // Saknas policysidan letar vi efter samma information på startsidan.
  const returnsText = (returnsFacts ? policySnippet(returnsFacts, "returns") : "") || policySnippet(home, "returns", true);
  const shippingText = (shippingFacts ? policySnippet(shippingFacts, "shipping") : "") || policySnippet(home, "shipping", true);

  return {
    url: start.toString(),
    origin: origin.toString(),
    host: origin.hostname,
    home,
    pages: extraPages,
    facts,
    shopifyProducts,
    currency,
    manifestIcons: manifestIcons.slice(0, 8),
    policies: {
      returns: returnsText,
      shipping: shippingText,
      returnsUrl: policyUrls.returns,
      shippingUrl: policyUrls.shipping,
    },
    notes,
  };
}

/**
 * Hämtar en enskild offentlig HTML-sida med samma skydd som crawlSite: bara
 * http(s), inga privata adresser (även efter DNS-uppslag och omdirigeringar),
 * begränsad storlek och tidsgräns. Används av den snabba varumärkesanalysen.
 */
export async function fetchPublicPage(
  rawUrl: string,
  options: { maxBytes?: number; accept?: string } = {},
): Promise<{ text: string; type: string; finalUrl: string }> {
  const url = normalizeInputUrl(rawUrl);
  const response = await fetchText(
    url,
    { accept: options.accept ?? "text/html,application/xhtml+xml", maxBytes: options.maxBytes },
    new Map(),
  );
  return { text: response.text, type: response.type, finalUrl: response.finalUrl.toString() };
}

export type { IconHit };
