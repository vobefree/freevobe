import type { AdvancedCanvas, AdvancedNode, AdvancedSectionPreset, ThemeConfig } from "@/lib/theme/types";
import { createNode, nextZ } from "./canvas";

export type AdvancedCopy = {
  eyebrow: string;
  title: string;
  text: string;
  ctaLabel: string;
  badge: string;
  preset: AdvancedSectionPreset;
};

const CAMPAIGN = /black friday|blackfriday|rea\b|sale|kampanj|rabatt|erbjudande|deal|cyber monday|singles day|jul|christmas|sommar|summer|prime/i;
const PRODUCTS = /produkt|produkter|product|shoppa|shop|kollektion|collection|bästsäljare|bestseller|nyheter|new arrivals/i;
const FEATURES = /funktion|fördel|fordel|feature|varför|varfor|why|hållbar|hallbar|kvalitet|quality|trygg|trust/i;
const TESTIMONIAL = /recension|omdöme|omdome|review|kund|customer|testimonial|citat|quote/i;
const BANNER = /banner|band|fri frakt|free shipping|nyhetsbrev|newsletter|meddelande|announcement/i;

/**
 * Plockar ut ämnet ur en beställning ("skapa en hero för en kaffebutik" →
 * "kaffebutik"). Prompten används som källa till ämnet, aldrig som rubrik –
 * en instruktion ska inte hamna som text på canvasen.
 */
function topicOf(prompt: string): string {
  const match = prompt.match(/\b(?:f[öo]r|till|om|about|for)\s+(?:en|ett|v[åa]r|v[åa]rt|a|an)?\s*([a-zåäöéü0-9][a-zåäöéü0-9\s-]{2,40})/i);
  const raw = (match?.[1] ?? "").trim().replace(/[.,!?;:]+$/, "");
  if (!raw) return "";
  const cut = raw.split(/\b(som|med|och|but|with|that|where)\b/i)[0].trim();
  return cut.length >= 3 ? `${cut.charAt(0).toUpperCase()}${cut.slice(1)}` : "";
}

/**
 * Regelbaserad reserv när ingen AI-nyckel finns. Den bygger en tydlig
 * kampanjsektion i stället för att lämna ytan tom. Rubriken kommer från
 * butiken och ämnet i prompten – aldrig från instruktionen själv.
 */
export function localAdvancedCopy(prompt: string, config: ThemeConfig): AdvancedCopy {
  const query = prompt.trim().slice(0, 600);
  const campaign = CAMPAIGN.test(query);
  const products = !campaign && PRODUCTS.test(query);
  const features = !campaign && !products && FEATURES.test(query);
  const testimonial = !campaign && !products && !features && TESTIMONIAL.test(query);
  const banner = !campaign && !products && !features && !testimonial && BANNER.test(query);
  const topic = topicOf(query);

  let preset: AdvancedSectionPreset = "hero";
  if (campaign) preset = "campaign";
  else if (products) preset = "products";
  else if (features) preset = "features";
  else if (testimonial) preset = "testimonial";
  else if (banner) preset = "banner";

  if (campaign) {
    const blackFriday = /black ?friday|blackfriday/i.test(query);
    const label = blackFriday ? "Black Friday" : /jul|christmas/i.test(query) ? "Julkampanj" : /sommar|summer/i.test(query) ? "Sommarkampanj" : "Kampanj";
    return {
      eyebrow: label,
      title: blackFriday ? "Black Friday är här" : `${label} – passa på`,
      text: "Utvalda favoriter till kampanjpris så långt lagret räcker. Snabb leverans och enkla returer.",
      ctaLabel: "Shoppa kampanjen",
      badge: blackFriday ? "BLACK FRIDAY" : "REA",
      preset: "campaign",
    };
  }

  if (products) {
    return {
      eyebrow: "Utvalt",
      title: topic || "Utvalt just nu",
      text: `Favoriter från ${config.shop.name}, valda för att användas varje dag.`,
      ctaLabel: "Visa alla",
      badge: "",
      preset: "products",
    };
  }

  if (features) {
    return {
      eyebrow: "Därför oss",
      title: "Därför väljer kunderna oss",
      text: "Kvalitet, omsorg och service i varje steg – från material till leverans.",
      ctaLabel: "Läs mer",
      badge: "",
      preset: "features",
    };
  }

  if (testimonial) {
    return {
      eyebrow: "Kundröster",
      title: "Det här säger kunderna",
      text: "Riktiga omdömen från kunder som använder produkterna varje dag.",
      ctaLabel: "Se fler omdömen",
      badge: "",
      preset: "testimonial",
    };
  }

  if (banner) {
    return {
      eyebrow: "",
      title: `Fri frakt över ${config.conversion.freeShippingThreshold} kr`,
      text: config.footer.text || "Snabb leverans och enkla returer.",
      ctaLabel: "Shoppa nu",
      badge: "",
      preset: "banner",
    };
  }

  return {
    eyebrow: config.shop.tagline || (topic ? "Nyhet" : ""),
    title: topic ? `Välkommen till ${topic}` : config.shop.name || "Något nytt från oss",
    text: `Byggt för ${config.shop.name} med samma färger, typsnitt och känsla som resten av temat.`,
    ctaLabel: "Upptäck mer",
    badge: "",
    preset: "hero",
  };
}

/** Lägger AI-/prompttexten på rätt fält utan att röra geometrin. */
export function applyAdvancedCopy(node: AdvancedNode, copy: AdvancedCopy, z: number, canvas?: AdvancedCanvas): AdvancedNode {
  switch (node.type) {
    case "heading":
      return { ...node, text: copy.title || node.text };
    case "text":
      return { ...node, text: copy.text || node.text };
    case "button":
      return { ...node, ctaLabel: copy.ctaLabel || node.ctaLabel };
    case "section": {
      // En kampanj behöver plats för badge, rubrik, text och knapp. Om den
      // valda sektionen är en tunn banner växer den hellre än klipper texten.
      const h = copy.preset === "campaign" ? Math.max(node.h, 300) : node.h;
      const y = canvas ? Math.max(0, Math.min(node.y, canvas.height - h)) : node.y;
      return {
        ...node,
        preset: copy.preset,
        eyebrow: copy.eyebrow,
        title: copy.title,
        text: copy.text,
        ctaLabel: copy.ctaLabel,
        badge: copy.badge,
        y,
        h,
        fill: copy.preset === "campaign" || copy.preset === "banner" ? "accent" : node.fill,
        color: copy.preset === "campaign" || copy.preset === "banner" ? "text" : node.color,
        z: Math.max(node.z, z),
      };
    }
    case "image":
      return { ...node, alt: copy.title || node.alt };
    default:
      return node;
  }
}

/** Ny sektion från en prompt, placerad i mitten av canvasen. */
export function sectionFromCopy(config: ThemeConfig, copy: AdvancedCopy): AdvancedNode {
  const base = createNode("section", config);
  return {
    ...base,
    x: 100,
    y: 460,
    w: 1000,
    h: 380,
    z: nextZ(config.builder.canvas.nodes),
    preset: copy.preset,
    eyebrow: copy.eyebrow,
    title: copy.title,
    text: copy.text,
    ctaLabel: copy.ctaLabel,
    badge: copy.badge,
    fill: copy.preset === "campaign" || copy.preset === "banner" ? "accent" : "surface",
    color: "text",
    fontSize: 48,
    radius: config.tokens.cardRadius,
  };
}
