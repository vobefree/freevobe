import type { BrandDna, BrandTone, BrandVoice, DnaImagery } from "@/lib/theme/types";
import { freeText } from "@/lib/ai/free-text";

/**
 * Valfri AI-förfining av Brand DNA.
 *
 * AI:n får bara fylla i det sajten saknade (allt den hittar själv vinner) och
 * resultatet behåller markeringen "förslag" så att användaren kan granska det.
 */
type AiDna = {
  brandName?: string;
  slogan?: string;
  tone?: string;
  audience?: string;
  imageStyle?: string;
  imageKeywords?: string[];
  voiceKeywords?: string[];
  heroTitle?: string;
  heroSubtitle?: string;
  heroCta?: string;
  collectionTitle?: string;
  collectionText?: string;
  newsletterTitle?: string;
  newsletterText?: string;
  newsletterCta?: string;
  seoTitle?: string;
  seoDescription?: string;
  productIdeas?: string[];
};

const VOICES: BrandVoice[] = ["formal", "friendly", "luxury", "youthful", "minimal", "playful"];
const IMAGE_STYLES: DnaImagery["style"][] = ["photography", "illustration", "3d", "mixed"];

export function dnaSystemPrompt(): string {
  return [
    "You are a Shopify brand strategist. You receive facts scraped from a public website and describe the brand.",
    "Reply with JSON only using these keys: brandName, slogan, tone, audience, imageStyle, imageKeywords, voiceKeywords, heroTitle, heroSubtitle, heroCta, collectionTitle, collectionText, newsletterTitle, newsletterText, newsletterCta, seoTitle, seoDescription, productIdeas.",
    'tone is one of "formal","friendly","luxury","youthful","minimal","playful". imageStyle is one of "photography","illustration","3d","mixed".',
    "Write all text in the same language as the website. Never invent awards, certifications or claims the site does not support.",
    "Keep seoTitle under 60 characters and seoDescription under 155 characters.",
  ].join(" ");
}

export function dnaUserPrompt(dna: BrandDna, sampleText: string): string {
  return JSON.stringify({
    domain: dna.domain,
    brandName: dna.brandName,
    title: dna.copy.seoTitle,
    description: dna.copy.seoDescription,
    headings: dna.headings.slice(0, 10),
    phrases: dna.phrases.slice(0, 10),
    products: dna.products.slice(0, 8).map((product) => product.name),
    palette: [dna.palette.primary, dna.palette.accent, dna.palette.background],
    detectedVoice: dna.voice.primary,
    missing: dna.missing,
    sampleText: sampleText.slice(0, 4000),
  });
}

export async function aiDna(input: { dna: BrandDna; sampleText: string }): Promise<BrandDna | null> {
  try {
    const content = await freeText({
      system: dnaSystemPrompt(),
      prompt: dnaUserPrompt(input.dna, input.sampleText),
      json: true,
      temperature: 0.5,
      maxTokens: 1600,
      timeoutMs: 24_000,
    });
    const cleaned = content.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    return mergeAiDna(input.dna, JSON.parse(cleaned) as AiDna);
  } catch {
    return null;
  }
}

/** Fyller bara i fält som saknades på sajten; allt hämtat material behålls. */
export function mergeAiDna(dna: BrandDna, ai: AiDna): BrandDna {
  const suggested = new Set(dna.suggested);
  const missing = new Set(dna.missing);
  const next: BrandDna = structuredClone(dna);
  const isFree = (path: string) => suggested.has(path);

  const setCopy = (key: keyof BrandDna["copy"], path: string, value?: string) => {
    const clean = typeof value === "string" ? value.trim() : "";
    if (!clean || !isFree(path)) return;
    next.copy[key] = clean.slice(0, key === "seoDescription" ? 155 : key === "seoTitle" ? 60 : 220);
    missing.delete(path);
  };

  setCopy("heroTitle", "copy.heroTitle", ai.heroTitle);
  setCopy("heroSubtitle", "copy.heroSubtitle", ai.heroSubtitle);
  setCopy("heroCta", "copy.heroCta", ai.heroCta);
  setCopy("collectionTitle", "copy.collectionTitle", ai.collectionTitle);
  setCopy("collectionText", "copy.collectionText", ai.collectionText);
  setCopy("newsletterTitle", "copy.newsletterTitle", ai.newsletterTitle);
  setCopy("newsletterText", "copy.newsletterText", ai.newsletterText);
  setCopy("newsletterCta", "copy.newsletterCta", ai.newsletterCta);
  setCopy("seoTitle", "copy.seoTitle", ai.seoTitle);
  setCopy("seoDescription", "copy.seoDescription", ai.seoDescription);
  setCopy("slogan", "copy.slogan", ai.slogan);

  if (ai.brandName?.trim() && isFree("logo") && /^(www\.)?[a-z0-9-]+\.[a-z]{2,}$/i.test(dna.brandName)) {
    next.brandName = ai.brandName.trim().slice(0, 60);
  }
  if (ai.audience?.trim() && isFree("audience.industry")) {
    next.audience = { ...next.audience, segment: ai.audience.trim().slice(0, 200) };
  }
  const voice = VOICES.find((entry) => entry === (ai.tone ?? "").toLowerCase());
  if (voice && isFree("voice.primary")) {
    next.voice = {
      ...next.voice,
      primary: voice,
      tone: ({ formal: "premium", friendly: "warm", luxury: "premium", youthful: "bold", minimal: "calm", playful: "playful" } as Record<BrandVoice, BrandTone>)[voice],
      keywords: (ai.voiceKeywords ?? next.voice.keywords).slice(0, 8),
    };
  }
  const imageStyle = IMAGE_STYLES.find((entry) => entry === (ai.imageStyle ?? "").toLowerCase());
  if (imageStyle && isFree("imagery.style")) {
    next.imagery = { ...next.imagery, style: imageStyle, keywords: (ai.imageKeywords ?? next.imagery.keywords).slice(0, 8) };
  }
  if (ai.productIdeas?.length && isFree("products")) {
    next.products = ai.productIdeas
      .map((name, index) => ({
        id: dna.products[index]?.id ?? `dna-${index + 1}`,
        name: String(name).slice(0, 90),
        price: dna.products[index]?.price ?? "",
        category: dna.products[index]?.category ?? "",
        image: dna.products[index]?.image ?? "",
        url: dna.products[index]?.url ?? "",
        source: dna.products[index]?.source ?? ("suggested" as const),
      }))
      .filter((product) => product.name.length > 1)
      .slice(0, 12);
  }

  next.missing = [...missing];
  next.suggested = [...suggested];
  next.notes = [...new Set([...next.notes, "ai_assisted"])];
  return next;
}
