import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { analyzeHtml, extractHexes, paletteFromColors, parsePaletteText, toneFromPalette } from "@/lib/brand/kit";
import { CrawlError, fetchPublicPage } from "@/lib/brand/crawl";
import { styleFromText } from "@/lib/brand/styles";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { url?: string; colors?: string; text?: string } | null;

  if (body?.colors || body?.text) {
    const fromColors = body.colors ? parsePaletteText(body.colors) : [];
    const fromText = body.colors ? [] : extractHexes(body.text ?? "", 12);
    const parsed = fromColors.length ? fromColors : fromText;
    const palette = paletteFromColors(parsed.length ? parsed : ["#C2542D", "#1F4A3D", "#E9B44C"]);
    return NextResponse.json({
      palette,
      colors: parsed.length ? parsed : [palette.primary, palette.accent, palette.background],
      tone: toneFromPalette(palette),
      styleId: styleFromText(body.text ?? body.colors ?? "") ?? null,
      title: "",
      ogImage: "",
      fonts: [],
      source: body.colors ? "palette" : "text",
    });
  }

  const raw = (body?.url ?? "").trim();
  if (!raw) return NextResponse.json({ error: "url_required" }, { status: 400 });

  try {
    // Samma skydd som den fullständiga crawlningen: DNS-kontroll av varje hopp,
    // inga privata adresser och inga omdirigeringar till andra protokoll.
    const page = await fetchPublicPage(raw, { maxBytes: 900_000 });
    const finalUrl = new URL(page.finalUrl);
    const analysis = analyzeHtml(page.text, `${finalUrl.hostname} ${finalUrl.pathname}`);
    const instagram = /instagram\.com/i.test(finalUrl.hostname);
    return NextResponse.json({
      ...analysis,
      source: "url",
      note: instagram ? "instagram" : undefined,
    });
  } catch (error) {
    if (error instanceof CrawlError) return NextResponse.json({ error: error.code }, { status: error.status });
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  }
}
