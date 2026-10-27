import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { envValue } from "./settings";

export function shopifyScopes(): string {
  return envValue("SHOPIFY_SCOPES") || "read_themes,write_themes,read_reports";
}

export const SHOPIFY_SCOPES = "read_themes,write_themes,read_reports";

function apiVersion(): string {
  return envValue("SHOPIFY_API_VERSION") || "2026-07";
}

export function shopifyConfigured(): boolean {
  return Boolean(envValue("SHOPIFY_API_KEY") && envValue("SHOPIFY_API_SECRET"));
}

export function normalizeShop(raw: string): string | null {
  const value = raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  if (!value) return null;
  const withDomain = value.endsWith(".myshopify.com") ? value : `${value}.myshopify.com`;
  return /^[a-z0-9][a-z0-9-]{1,58}\.myshopify\.com$/.test(withDomain) ? withDomain : null;
}

export function appUrl(): string {
  return (envValue("APP_URL") || "http://localhost:3100").replace(/\/$/, "");
}

export function newState(): string {
  return randomBytes(24).toString("hex");
}

export function installUrl(shop: string, state: string): string {
  const params = new URLSearchParams({
    client_id: envValue("SHOPIFY_API_KEY"),
    scope: shopifyScopes(),
    redirect_uri: `${appUrl()}/api/shopify/callback`,
    state,
  });
  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

export function verifyOAuthHmac(searchParams: URLSearchParams): boolean {
  const secret = envValue("SHOPIFY_API_SECRET");
  const hmac = searchParams.get("hmac");
  if (!secret || !hmac) return false;
  const pairs: string[] = [];
  const sorted = [...searchParams.entries()].filter(([key]) => key !== "hmac" && key !== "signature").sort(([a], [b]) => a.localeCompare(b));
  for (const [key, value] of sorted) pairs.push(`${key}=${value}`);
  const digest = createHmac("sha256", secret).update(pairs.join("&")).digest("hex");
  const a = Buffer.from(digest);
  const b = Buffer.from(hmac);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function exchangeCode(shop: string, code: string): Promise<{ accessToken: string; scope: string }> {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: envValue("SHOPIFY_API_KEY"),
      client_secret: envValue("SHOPIFY_API_SECRET"),
      code,
    }),
    cache: "no-store",
  });
  const json = (await res.json()) as { access_token?: string; scope?: string; error_description?: string };
  if (!res.ok || !json.access_token) throw new Error(json.error_description || "Could not exchange Shopify authorization code");
  return { accessToken: json.access_token, scope: json.scope || shopifyScopes() };
}

export class ShopifyError extends Error {}

async function graphql<T>(shop: string, token: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://${shop}/admin/api/${apiVersion()}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (!res.ok || json.errors?.length) {
    throw new ShopifyError(json.errors?.map((e) => e.message).join("; ") || `Shopify API ${res.status}`);
  }
  if (!json.data) throw new ShopifyError("Empty response from Shopify");
  return json.data;
}

/** Admin GraphQL för egna frågor (t.ex. ShopifyQL i statistikpanelen). */
export const shopifyGraphql = graphql;

export type ShopifyTheme = { id: string; name: string; role: string };

export async function listThemes(shop: string, token: string): Promise<ShopifyTheme[]> {
  const data = await graphql<{ themes: { nodes: ShopifyTheme[] } }>(
    shop,
    token,
    `query Themes { themes(first: 50) { nodes { id name role } } }`,
  );
  return data.themes.nodes;
}

export async function duplicateTheme(shop: string, token: string, sourceId: string): Promise<ShopifyTheme> {
  const data = await graphql<{
    themeDuplicate: { newTheme: ShopifyTheme | null; userErrors: { message: string }[] };
  }>(
    shop,
    token,
    `mutation Duplicate($id: ID!) {
      themeDuplicate(id: $id) {
        newTheme { id name role }
        userErrors { field message }
      }
    }`,
    { id: sourceId },
  );
  if (data.themeDuplicate.userErrors.length) throw new ShopifyError(data.themeDuplicate.userErrors.map((e) => e.message).join("; "));
  if (!data.themeDuplicate.newTheme) throw new ShopifyError("Shopify did not return a duplicated theme");
  return data.themeDuplicate.newTheme;
}

export async function publishTheme(shop: string, token: string, themeId: string): Promise<void> {
  const data = await graphql<{ themePublish: { theme: ShopifyTheme | null; userErrors: { message: string }[] } }>(
    shop,
    token,
    `mutation Publish($id: ID!) {
      themePublish(id: $id) {
        theme { id name role }
        userErrors { field message }
      }
    }`,
    { id: themeId },
  );
  if (data.themePublish.userErrors.length) throw new ShopifyError(data.themePublish.userErrors.map((e) => e.message).join("; "));
}

export type ThemeUploadResult = { uploaded: number; errors: string[] };

export async function uploadThemeFiles(shop: string, token: string, themeId: string, files: Record<string, string>): Promise<ThemeUploadResult> {
  const entries = Object.entries(files);
  const errors: string[] = [];
  let uploaded = 0;
  const chunkSize = 15;
  for (let i = 0; i < entries.length; i += chunkSize) {
    const chunk = entries.slice(i, i + chunkSize);
    const data = await graphql<{
      themeFilesUpsert: { upsertedThemeFiles: { filename: string }[] | null; userErrors: { field: string[]; message: string }[] };
    }>(
      shop,
      token,
      `mutation Upsert($themeId: ID!, $files: [ThemeFilesUpsertInput!]!) {
        themeFilesUpsert(themeId: $themeId, files: $files) {
          upsertedThemeFiles { filename }
          userErrors { field message }
        }
      }`,
      {
        themeId,
        files: chunk.map(([filename, content]) => ({ filename, body: { type: "TEXT", value: content } })),
      },
    );
    uploaded += chunk.length;
    for (const error of data.themeFilesUpsert.userErrors) errors.push(`${error.field?.join(".") ?? "file"}: ${error.message}`);
  }
  return { uploaded, errors };
}

export async function publishFilesToShopify(input: {
  shop: string;
  token: string;
  files: Record<string, string>;
  targetThemeId?: string;
  publish: boolean;
}): Promise<{ themeId: string; themeName: string; uploaded: number; errors: string[]; adminUrl: string }> {
  const themes = await listThemes(input.shop, input.token);
  let target: ShopifyTheme | null = null;

  if (input.targetThemeId) {
    target = themes.find((theme) => theme.id === input.targetThemeId) ?? null;
    if (!target) throw new ShopifyError("The selected theme was not found in the store");
  } else {
    const main = themes.find((theme) => theme.role === "main") ?? themes[0];
    if (!main) throw new ShopifyError("No theme found in the store to copy");
    target = await duplicateTheme(input.shop, input.token, main.id);
  }

  const result = await uploadThemeFiles(input.shop, input.token, target.id, input.files);
  if (input.publish) await publishTheme(input.shop, input.token, target.id);

  const numericId = target.id.split("/").pop();
  const storeHandle = input.shop.replace(".myshopify.com", "");
  return {
    themeId: target.id,
    themeName: target.name,
    uploaded: result.uploaded,
    errors: result.errors,
    adminUrl: `https://admin.shopify.com/store/${storeHandle}/themes/${numericId}`,
  };
}
