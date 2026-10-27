import { envValue } from "@/lib/settings";
import type { PsiMetrics } from "./types";

/**
 * PageSpeed Insights (Lighthouse) för butikens publika adress. Fungerar utan
 * nyckel med lägre kvot; PAGESPEED_API_KEY höjer gränsen. Fel sväljs medvetet –
 * health-rapporten faller då tillbaka på temats egna mätvärden.
 */
export async function fetchPsi(url: string, timeoutMs = 18_000): Promise<PsiMetrics | null> {
  const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("strategy", "mobile");
  for (const category of ["performance", "seo", "accessibility"]) endpoint.searchParams.append("category", category);
  const psiKey = envValue("PAGESPEED_API_KEY");
  if (psiKey) endpoint.searchParams.set("key", psiKey);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      lighthouseResult?: {
        categories?: Record<string, { score?: number }>;
        audits?: Record<string, { numericValue?: number; details?: { items?: { totalBytes?: number }[]; totalByteWeight?: number } }>;
      };
    };
    const lh = json.lighthouseResult;
    if (!lh?.categories) return null;
    const audit = (key: string) => lh.audits?.[key];
    const bytes =
      audit("total-byte-weight")?.numericValue ??
      audit("total-byte-weight")?.details?.items?.reduce((sum, item) => sum + (item.totalBytes ?? 0), 0) ??
      null;
    const score = (key: string) => {
      const value = lh.categories?.[key]?.score;
      return typeof value === "number" ? Math.round(value * 100) : null;
    };
    return {
      performance: score("performance"),
      seo: score("seo"),
      accessibility: score("accessibility"),
      lcpMs: audit("largest-contentful-paint")?.numericValue ?? null,
      cls: audit("cumulative-layout-shift")?.numericValue ?? null,
      tbtMs: audit("total-blocking-time")?.numericValue ?? null,
      pageWeightKb: bytes === null ? null : Math.round(bytes / 1024),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
