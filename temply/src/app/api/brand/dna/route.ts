import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isLocale, type Locale } from "@/lib/theme/types";
import { CrawlError, crawlSite } from "@/lib/brand/crawl";
import { buildDna } from "@/lib/brand/dna";
import { aiDna } from "@/lib/brand/ai-dna";

export const runtime = "nodejs";

/**
 * Bygger ett komplett Brand DNA från en domän.
 *
 * Hämtar bara offentligt material från den adress användaren själv anger,
 * respekterar robots.txt och märker allt som är förslag i svaret.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { url?: string; locale?: string } | null;
  const url = (body?.url ?? "").trim();
  if (!url) return NextResponse.json({ error: "url_required" }, { status: 400 });
  const locale: Locale = isLocale(body?.locale) ? body.locale : isLocale(user.locale) ? user.locale : "sv";

  try {
    const site = await crawlSite(url);
    let dna = buildDna(site, locale);
    const enriched = await aiDna({ dna, sampleText: site.facts.map((page) => page.text).join(" ") });
    if (enriched) dna = enriched;
    return NextResponse.json({ dna });
  } catch (error) {
    if (error instanceof CrawlError) return NextResponse.json({ error: error.code }, { status: error.status });
    return NextResponse.json({ error: "crawl_failed" }, { status: 502 });
  }
}
