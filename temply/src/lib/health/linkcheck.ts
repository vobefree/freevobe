/**
 * Kontrollerar riktiga länkar i den anslutna butiken. Hämtar startsidan, plockar
 * ut interna länkar och HEAD:ar dem. Begränsat antal sidor och tidsgräns så att
 * en Theme Health-körning aldrig hänger.
 */
export type LinkCheck = { checked: number; broken: { url: string; status: number }[] };

const SKIP =
  /\/(cart|checkout|account|login|signin|signup|search|password|apps|cdn|feed|policies|collections\/all\/products)\b/i;

function extractLinks(html: string, base: string): string[] {
  const seen = new Set<string>();
  const pattern = /<a\b[^>]*href=["']([^"'#]+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    try {
      const url = new URL(match[1], base);
      if (url.origin !== new URL(base).origin) continue;
      if (SKIP.test(url.pathname)) continue;
      if (/\.(jpg|jpeg|png|webp|avif|svg|pdf|css|js|xml|zip)$/i.test(url.pathname)) continue;
      url.hash = "";
      seen.add(url.toString());
    } catch {
      /* ignorera trasiga href-värden – de fångas av temats egna kontroller */
    }
  }
  return [...seen];
}

async function head(url: string): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "ThemeFold-Health/1.0" },
      cache: "no-store",
    });
    return res.status;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** `shop` är butikens myshopify-domän. */
export async function checkStoreLinks(shop: string, limit = 12): Promise<LinkCheck> {
  const base = `https://${shop}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  let html = "";
  try {
    const res = await fetch(base, {
      signal: controller.signal,
      headers: { "User-Agent": "ThemeFold-Health/1.0" },
      cache: "no-store",
    });
    if (!res.ok) return { checked: 0, broken: [] };
    html = await res.text();
  } catch {
    return { checked: 0, broken: [] };
  } finally {
    clearTimeout(timer);
  }

  const links = extractLinks(html, base).slice(0, limit);
  const broken: { url: string; status: number }[] = [];
  const results = await Promise.all(links.map(async (url) => ({ url, status: await head(url) })));
  for (const result of results) {
    if (result.status === 404 || result.status === 410) broken.push({ url: result.url, status: result.status });
  }
  return { checked: links.length, broken };
}
