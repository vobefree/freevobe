import type { BrandDna, BrandTone, Locale, StylePresetId } from "@/lib/theme/types";
import { freeText } from "./free-text";

export type CopyTarget = "hero" | "products" | "seo" | "cta" | "campaign";

export type CopyItem = { id: string; label: string; text: string };

export type CopyRequest = {
  locale: Locale;
  target: CopyTarget;
  shopName: string;
  tagline: string;
  styleId: StylePresetId;
  tone: BrandTone;
  keyword: string;
  products: string[];
  heroTitle: string;
  /** Brand DNA styr ton, fraser och färdiga textförslag när det finns. */
  dna?: BrandDna | null;
};

type Bank = {
  heroTitles: string[];
  heroSubs: string[];
  eyebrows: string[];
  ctas: string[];
  secondary: string;
  productIntro: string;
  productBenefit: string[];
  seoPattern: string;
  seoDescription: string;
  campaign: string[];
  marquee: string;
  newsletter: string;
};

const BANKS: Record<Locale, Bank> = {
  sv: {
    heroTitles: ["{shop} – form som håller i generationer.", "Upptäck {shop}: {keyword} för varje dag.", "Det lilla extra som gör vardagen vackrare."],
    heroSubs: ["Handplockat, hållbart och gjort för att användas. {tagline}", "Små serier, stor omsorg. Fri frakt över 799 kr.", "Tillverkat med omtanke – skickat inom 24 timmar."],
    eyebrows: ["Nytt hos {shop}", "Utvalt av oss", "Handplockat i Norden"],
    ctas: ["Utforska kollektionen", "Handla nu", "Se alla produkter"],
    secondary: "Läs vår historia",
    productIntro: "{name} – en favorit bland våra kunder.",
    productBenefit: ["Gjord för att hålla i många år.", "Små serier med stor omsorg.", "Skickas inom 24 timmar."],
    seoPattern: "{keyword} hos {shop} | Fri frakt över 799 kr",
    seoDescription: "Köp {keyword} hos {shop}. Handplockat sortiment, trygg betalning och leverans inom 1–3 dagar.",
    campaign: ["Kampanj: 15 % på hela kollektionen i helgen.", "Fri frakt på alla ordrar över 799 kr.", "Medlemskap: 10 % på ditt första köp."],
    marquee: "Fri frakt över 799 kr · 30 dagars öppet köp · Snabb leverans",
    newsletter: "Få nyheter, kampanjer och 10 % på ditt första köp.",
  },
  nb: {
    heroTitles: ["{shop} – form som varer i generasjoner.", "Oppdag {shop}: {keyword} for hverdagen.", "Det lille ekstra som gjør hverdagen vakrere."],
    heroSubs: ["Håndplukket, bærekraftig og laget for å brukes. {tagline}", "Små serier, stor omtanke. Fri frakt over 799 kr.", "Laget med omtanke – sendes innen 24 timer."],
    eyebrows: ["Nytt hos {shop}", "Utvalgt av oss", "Håndplukket i Norden"],
    ctas: ["Utforsk kolleksjonen", "Kjøp nå", "Se alle produkter"],
    secondary: "Les historien vår",
    productIntro: "{name} – en favoritt blant kundene våre.",
    productBenefit: ["Laget for å vare i mange år.", "Små serier med stor omtanke.", "Sendes innen 24 timer."],
    seoPattern: "{keyword} hos {shop} | Fri frakt over 799 kr",
    seoDescription: "Kjøp {keyword} hos {shop}. Håndplukket utvalg, trygg betaling og levering innen 1–3 dager.",
    campaign: ["Kampanje: 15 % på hele kolleksjonen i helgen.", "Fri frakt på alle ordrer over 799 kr.", "Medlemskap: 10 % på ditt første kjøp."],
    marquee: "Fri frakt over 799 kr · 30 dagers åpent kjøp · Rask levering",
    newsletter: "Få nyheter, kampanjer og 10 % på ditt første kjøp.",
  },
  fi: {
    heroTitles: ["{shop} – muotoa, joka kestää sukupolvia.", "Tutustu {shop}: {keyword} arkeen.", "Pieni lisä, joka tekee arjesta kauniimman."],
    heroSubs: ["Valikoitu, kestävä ja käyttöön tehty. {tagline}", "Pienet sarjat, suuri huolenpito. Ilmainen toimitus yli 79 €.", "Tehty huolella – lähetetään 24 tunnissa."],
    eyebrows: ["Uutta: {shop}", "Meidän valintamme", "Pohjoismaista käsityötä"],
    ctas: ["Tutustu mallistoon", "Osta nyt", "Katso kaikki tuotteet"],
    secondary: "Lue tarinamme",
    productIntro: "{name} – asiakkaidemme suosikki.",
    productBenefit: ["Suunniteltu kestämään vuosia.", "Pienet sarjat, suuri huolenpito.", "Lähetetään 24 tunnissa."],
    seoPattern: "{keyword} – {shop} | Ilmainen toimitus yli 79 €",
    seoDescription: "Osta {keyword} kaupasta {shop}. Valikoitu tuotevalikoima, turvallinen maksu ja toimitus 1–3 päivässä.",
    campaign: ["Kampanja: 15 % koko mallistosta viikonloppuna.", "Ilmainen toimitus yli 79 € tilauksiin.", "Jäsenyys: 10 % ensimmäisestä ostoksesta."],
    marquee: "Ilmainen toimitus yli 79 € · 30 päivän palautus · Nopea toimitus",
    newsletter: "Saat uutuudet, kampanjat ja 10 % ensimmäisestä ostoksesta.",
  },
  da: {
    heroTitles: ["{shop} – form der holder i generationer.", "Oplev {shop}: {keyword} til hverdagen.", "Det lille ekstra, der gør hverdagen smukkere."],
    heroSubs: ["Håndplukket, bæredygtigt og lavet til at blive brugt. {tagline}", "Små serier, stor omhu. Fri fragt over 799 kr.", "Lavet med omhu – sendes inden 24 timer."],
    eyebrows: ["Nyt hos {shop}", "Udvalgt af os", "Håndplukket i Norden"],
    ctas: ["Udforsk kollektionen", "Køb nu", "Se alle produkter"],
    secondary: "Læs vores historie",
    productIntro: "{name} – en favorit blandt vores kunder.",
    productBenefit: ["Lavet til at holde i mange år.", "Små serier med stor omhu.", "Sendes inden 24 timer."],
    seoPattern: "{keyword} hos {shop} | Fri fragt over 799 kr",
    seoDescription: "Køb {keyword} hos {shop}. Håndplukket sortiment, sikker betaling og levering inden 1–3 dage.",
    campaign: ["Kampagne: 15 % på hele kollektionen i weekenden.", "Fri fragt på alle ordrer over 799 kr.", "Medlemskab: 10 % på dit første køb."],
    marquee: "Fri fragt over 799 kr · 30 dages returret · Hurtig levering",
    newsletter: "Få nyheder, kampagner og 10 % på dit første køb.",
  },
  en: {
    heroTitles: ["{shop} – form that lasts for generations.", "Discover {shop}: {keyword} for every day.", "The small difference that makes everyday life beautiful."],
    heroSubs: ["Hand-picked, sustainable and made to be used. {tagline}", "Small batches, endless care. Free shipping over €79.", "Made with care – shipped within 24 hours."],
    eyebrows: ["New at {shop}", "Chosen by us", "Hand-picked in the Nordics"],
    ctas: ["Explore the collection", "Shop now", "See all products"],
    secondary: "Read our story",
    productIntro: "{name} – a favourite among our customers.",
    productBenefit: ["Built to last for years.", "Small batches, endless care.", "Shipped within 24 hours."],
    seoPattern: "{keyword} at {shop} | Free shipping over €79",
    seoDescription: "Buy {keyword} at {shop}. A hand-picked range, secure payment and delivery in 1–3 days.",
    campaign: ["Campaign: 15% off the whole collection this weekend.", "Free shipping on every order over €79.", "Membership: 10% off your first order."],
    marquee: "Free shipping over €79 · 30-day returns · Fast delivery",
    newsletter: "Get new drops, campaigns and 10% off your first order.",
  },
  fr: {
    heroTitles: ["{shop} – une forme qui traverse les générations.", "Découvrez {shop} : {keyword} au quotidien.", "Le détail qui rend le quotidien plus beau."],
    heroSubs: ["Sélectionné, durable et fait pour être utilisé. {tagline}", "Petites séries, grand soin. Livraison offerte dès 79 €.", "Fabriqué avec soin – expédié sous 24 heures."],
    eyebrows: ["Nouveau chez {shop}", "Choisi par nous", "Sélection nordique"],
    ctas: ["Découvrir la collection", "Acheter maintenant", "Voir tous les produits"],
    secondary: "Notre histoire",
    productIntro: "{name} – un favori de nos clients.",
    productBenefit: ["Conçu pour durer des années.", "Petites séries, grand soin.", "Expédié sous 24 heures."],
    seoPattern: "{keyword} chez {shop} | Livraison offerte dès 79 €",
    seoDescription: "Achetez {keyword} chez {shop}. Sélection soignée, paiement sécurisé et livraison en 1 à 3 jours.",
    campaign: ["Campagne : -15 % sur toute la collection ce week-end.", "Livraison offerte dès 79 € d'achat.", "Membres : -10 % sur votre première commande."],
    marquee: "Livraison offerte dès 79 € · Retours 30 jours · Livraison rapide",
    newsletter: "Recevez les nouveautés, les offres et -10 % sur votre première commande.",
  },
  de: {
    heroTitles: ["{shop} – Form, die Generationen hält.", "Entdecke {shop}: {keyword} für jeden Tag.", "Das kleine Extra, das den Alltag schöner macht."],
    heroSubs: ["Handverlesen, nachhaltig und zum Benutzen gemacht. {tagline}", "Kleine Serien, große Sorgfalt. Versandfrei ab 79 €.", "Mit Sorgfalt gefertigt – Versand in 24 Stunden."],
    eyebrows: ["Neu bei {shop}", "Von uns ausgewählt", "Handverlesen im Norden"],
    ctas: ["Kollektion entdecken", "Jetzt kaufen", "Alle Produkte ansehen"],
    secondary: "Unsere Geschichte",
    productIntro: "{name} – ein Favorit unserer Kundinnen und Kunden.",
    productBenefit: ["Gemacht, um Jahre zu halten.", "Kleine Serien, große Sorgfalt.", "Versand in 24 Stunden."],
    seoPattern: "{keyword} bei {shop} | Versandfrei ab 79 €",
    seoDescription: "Kaufe {keyword} bei {shop}. Handverlesenes Sortiment, sichere Zahlung und Lieferung in 1–3 Tagen.",
    campaign: ["Kampagne: 15 % auf die ganze Kollektion am Wochenende.", "Versandfrei ab 79 € Bestellwert.", "Mitgliedschaft: 10 % auf die erste Bestellung."],
    marquee: "Versandfrei ab 79 € · 30 Tage Rückgabe · Schneller Versand",
    newsletter: "Neuheiten, Aktionen und 10 % auf die erste Bestellung.",
  },
  es: {
    heroTitles: ["{shop} – una forma que dura generaciones.", "Descubre {shop}: {keyword} para cada día.", "El detalle que hace más bello lo cotidiano."],
    heroSubs: ["Seleccionado, sostenible y hecho para usarse. {tagline}", "Pequeñas series, gran cuidado. Envío gratis desde 79 €.", "Hecho con cuidado – enviado en 24 horas."],
    eyebrows: ["Nuevo en {shop}", "Elegido por nosotros", "Selección nórdica"],
    ctas: ["Explorar la colección", "Comprar ahora", "Ver todos los productos"],
    secondary: "Nuestra historia",
    productIntro: "{name} – un favorito de nuestros clientes.",
    productBenefit: ["Diseñado para durar años.", "Pequeñas series, gran cuidado.", "Enviado en 24 horas."],
    seoPattern: "{keyword} en {shop} | Envío gratis desde 79 €",
    seoDescription: "Compra {keyword} en {shop}. Selección cuidada, pago seguro y entrega en 1–3 días.",
    campaign: ["Campaña: 15 % en toda la colección este fin de semana.", "Envío gratis en pedidos desde 79 €.", "Membresía: 10 % en tu primer pedido."],
    marquee: "Envío gratis desde 79 € · Devoluciones 30 días · Entrega rápida",
    newsletter: "Recibe novedades, campañas y un 10 % en tu primer pedido.",
  },
};

/** Etiketter som visas i panelen, översatta per språk. */
const LABELS: Record<Locale, Record<string, string>> = {
  sv: { eyebrow: "Ingress", title: "Rubrik", subtitle: "Underrubrik", cta: "Knapp", secondary: "Andra knappen", newsletter: "Nyhetsbrev", product: "Produkttext", benefit: "Fördel", seoTitle: "SEO-titel", seoDesc: "SEO-beskrivning", usp: "USP-rad", campaign: "Kampanj" },
  nb: { eyebrow: "Ingress", title: "Rubrikk", subtitle: "Underrubrikk", cta: "Knapp", secondary: "Andre knappen", newsletter: "Nyhetsbrev", product: "Produkttekst", benefit: "Fordel", seoTitle: "SEO-tittel", seoDesc: "SEO-beskrivelse", usp: "USP-linje", campaign: "Kampanje" },
  fi: { eyebrow: "Ingressi", title: "Otsikko", subtitle: "Alaotsikko", cta: "Painike", secondary: "Toinen painike", newsletter: "Uutiskirje", product: "Tuoteteksti", benefit: "Hyöty", seoTitle: "SEO-otsikko", seoDesc: "SEO-kuvaus", usp: "USP-rivi", campaign: "Kampanja" },
  da: { eyebrow: "Indledning", title: "Overskrift", subtitle: "Underoverskrift", cta: "Knap", secondary: "Anden knap", newsletter: "Nyhedsbrev", product: "Produkttekst", benefit: "Fordel", seoTitle: "SEO-titel", seoDesc: "SEO-beskrivelse", usp: "USP-linje", campaign: "Kampagne" },
  en: { eyebrow: "Kicker", title: "Headline", subtitle: "Subheadline", cta: "Button", secondary: "Second button", newsletter: "Newsletter", product: "Product copy", benefit: "Benefit", seoTitle: "SEO title", seoDesc: "SEO description", usp: "USP line", campaign: "Campaign" },
  fr: { eyebrow: "Accroche", title: "Titre", subtitle: "Sous-titre", cta: "Bouton", secondary: "Second bouton", newsletter: "Newsletter", product: "Texte produit", benefit: "Bénéfice", seoTitle: "Titre SEO", seoDesc: "Description SEO", usp: "Ligne USP", campaign: "Campagne" },
  de: { eyebrow: "Kicker", title: "Überschrift", subtitle: "Unterzeile", cta: "Button", secondary: "Zweiter Button", newsletter: "Newsletter", product: "Produkttext", benefit: "Vorteil", seoTitle: "SEO-Titel", seoDesc: "SEO-Beschreibung", usp: "USP-Zeile", campaign: "Kampagne" },
  es: { eyebrow: "Antetítulo", title: "Titular", subtitle: "Subtítulo", cta: "Botón", secondary: "Segundo botón", newsletter: "Newsletter", product: "Texto de producto", benefit: "Beneficio", seoTitle: "Título SEO", seoDesc: "Descripción SEO", usp: "Línea USP", campaign: "Campaña" },
};

function fill(template: string, request: CopyRequest, name?: string): string {
  return template
    .replace(/\{shop\}/g, request.shopName || "Butiken")
    .replace(/\{tagline\}/g, request.tagline || "")
    .replace(/\{name\}/g, name || request.keyword || "Produkten")
    .replace(/\{product\}/g, name || request.keyword || "Produkten")
    .replace(/\{keyword\}/g, request.keyword || request.tagline || request.shopName)
    .trim();
}

const TONE_INDEX: Record<BrandTone, number> = { calm: 0, warm: 1, premium: 1, bold: 1, playful: 2, technical: 2 };

/** Offline copy-motor: fungerar utan API-nyckel och skriver på valt språk. */
export function localCopy(request: CopyRequest): CopyItem[] {
  const bank = BANKS[request.locale] ?? BANKS.en;
  const label = LABELS[request.locale] ?? LABELS.en;
  const index = TONE_INDEX[request.tone] ?? 0;
  const dna = request.dna ?? null;
  const prefer = (value: string, template: string, name?: string) => (value && value.trim() ? fill(value, request, name) : fill(template, request, name));

  switch (request.target) {
    case "hero":
      return [
        { id: "hero.eyebrow", label: label.eyebrow, text: prefer(dna?.copy.slogan ?? "", bank.eyebrows[index % bank.eyebrows.length]) },
        { id: "hero.title", label: label.title, text: prefer(dna?.copy.heroTitle ?? "", bank.heroTitles[index % bank.heroTitles.length]) },
        { id: "hero.subtitle", label: label.subtitle, text: prefer(dna?.copy.heroSubtitle ?? "", bank.heroSubs[index % bank.heroSubs.length]) },
      ];
    case "cta":
      return [
        { id: "cta.primary", label: label.cta, text: prefer(dna?.copy.heroCta ?? "", bank.ctas[index % bank.ctas.length]) },
        { id: "cta.secondary", label: label.secondary, text: prefer(dna?.copy.heroSecondary ?? "", bank.secondary) },
        { id: "cta.newsletter", label: label.newsletter, text: prefer(dna?.copy.newsletterCta ?? "", bank.newsletter) },
      ];
    case "products": {
      const names = request.products.length ? request.products.slice(0, 6) : [request.keyword || "Produkt"];
      return names.flatMap((name, i) => [
        { id: `product.${i}.description`, label: `${label.product} · ${name}`, text: prefer(dna?.copy.productIntro ?? "", bank.productIntro, name) },
        { id: `product.${i}.benefit`, label: `${label.benefit} · ${name}`, text: dna?.copy.slogan?.trim() ? dna.copy.slogan : bank.productBenefit[i % bank.productBenefit.length] },
      ]);
    }
    case "seo":
      return [
        { id: "seo.title", label: label.seoTitle, text: prefer(dna?.copy.seoTitle ?? "", bank.seoPattern).slice(0, 70) },
        { id: "seo.description", label: label.seoDesc, text: prefer(dna?.copy.seoDescription ?? "", bank.seoDescription).slice(0, 160) },
        { id: "seo.marquee", label: label.usp, text: prefer(dna?.copy.announcement ?? "", bank.marquee) },
      ];
    case "campaign":
      if (dna) {
        return [
          { id: "campaign.0", label: `${label.campaign} 1`, text: prefer(dna.copy.announcement, bank.campaign[0]) },
          { id: "campaign.1", label: `${label.campaign} 2`, text: prefer(dna.copy.newsletterText, bank.campaign[1]) },
          { id: "campaign.2", label: `${label.campaign} 3`, text: prefer(dna.copy.collectionText, bank.campaign[2]) },
        ];
      }
      return bank.campaign.map((text, i) => ({ id: `campaign.${i}`, label: `${label.campaign} ${i + 1}`, text: fill(text, request) }));
  }
}

export function copySystemPrompt(locale: Locale, target: CopyTarget): string {
  return `You write Shopify store copy in the language with ISO code "${locale}" for the target "${target}". Return JSON only as {"items":[{"id":"...","label":"...","text":"..."}]}. Keep headlines under 60 characters, CTA labels under 4 words, SEO titles under 60 and SEO descriptions under 155 characters. No emojis, no quotes around the text.`;
}

export async function aiCopy(request: CopyRequest): Promise<CopyItem[] | null> {
  try {
    const content = await freeText({
      system: `${copySystemPrompt(request.locale, request.target)}${request.dna ? " Use brandDna.voice, brandDna.voiceKeywords and brandDna.referenceCopy to match the brand tone and language exactly." : ""}`,
      prompt: JSON.stringify({
        shop: request.shopName,
        tagline: request.tagline,
        style: request.styleId,
        tone: request.tone,
        keyword: request.keyword,
        hero: request.heroTitle,
        products: request.products.slice(0, 6),
        brandDna: request.dna
          ? {
              domain: request.dna.domain,
              industry: request.dna.audience.industry,
              audience: request.dna.audience.segment,
              voice: request.dna.voice.primary,
              voiceKeywords: request.dna.voice.keywords,
              phrases: request.dna.phrases.slice(0, 8),
              referenceCopy: request.dna.copy,
            }
          : undefined,
      }),
      json: true,
      temperature: 0.8,
      maxTokens: 1800,
      timeoutMs: 28_000,
    });
    const parsed = JSON.parse(content.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim()) as { items?: CopyItem[] };
    const items = (parsed.items ?? []).filter((item) => item && typeof item.text === "string" && item.text.trim());
    return items.length ? items : null;
  } catch {
    return null;
  }
}
