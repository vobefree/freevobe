import type { Locale } from "@/lib/theme/types";

/**
 * Nya panelsträngar hålls i en egen modul så att de befintliga ordböckerna
 * (och därmed allt som redan fungerar) lämnas orörda.
 */
const GROUPS = [
  ["brandTitle", "brandSub", "urlLabel", "urlPlaceholder", "urlImport", "urlBusy", "logoLabel", "logoUpload", "paletteLabel", "paletteApply"],
  ["stylePremiumSkincare", "styleGaming", "styleKids", "styleNordic", "styleLuxury", "styleStreetwear", "presetsTitle"],
  ["tokensTitle", "roundness", "shadowLevel", "spaceScale", "typeScale", "buttonStyle", "btnSolid", "btnOutline", "btnSoft"],
  ["mediaTitle", "heroMedia", "aiImage", "aiImageBusy", "imagePrompt", "videoUrl", "focalHint", "removeBg", "smartCrop", "stockTitle", "stockOpen"],
  ["assetsTitle", "dlFavicon", "dlLogo", "dlOg"],
  ["convTitle", "stickyAtc", "dynamicCheckout", "freeShipping", "freeShippingThreshold", "trustBadges", "ugcBlock", "bundleBlock", "sizeGuideBlock", "completeLook", "recentlyViewed", "exitIntent", "gdpr", "abTitle", "abOff"],
  ["abHero", "abCta", "abLayout", "abColors", "abHint"],
  ["intTitle", "klaviyo", "klaviyoId", "reviewsLabel", "reviewsNone", "reviewsShopify", "reviewsJudge", "reviewsLoox", "appBlocks", "searchDiscovery", "markets", "flowLabel"],
  ["copyTitle", "targetHero", "targetProducts", "targetSeo", "targetCta", "targetCampaign", "copyGenerate", "copyApply"],
  ["historyTitle", "historyEmpty", "historySave", "historyRestore"],
  ["widthLabel", "widthNarrow", "widthBoxed", "widthWide", "widthFull", "premiumBtn"],
] as const;

type GroupKeys = (typeof GROUPS)[number];
export type ProKey = GroupKeys[number];

const SIZE = GROUPS.reduce((sum, group) => sum + group.length, 0);

const VALUES: Record<Locale, string[][]> = {
  sv: [
    ["Varumärke", "Klistra in en adress, ladda upp en logotyp eller klistra in dina färger. ThemeFold gör resten.", "Webbadress", "dinshop.se eller instagram.com/dinshop", "Hämta varumärke", "Läser av…", "Logotyp", "Ladda upp logotyp", "Färger", "Använd färger"],
    ["Premium hudvård", "Gaming", "Barnkläder", "Nordisk minimalism", "Lyx", "Streetwear", "Stilpresets"],
    ["Design tokens", "Rundhet", "Skugga", "Luft", "Textstorlek", "Knappstil", "Fylld", "Kontur", "Mjuk"],
    ["Bilder & media", "Hero & kampanj", "Skapa bild", "Skapar bild…", "Beskriv bilden", "Videoadress (hero)", "Dra punkten dit motivet ska centreras.", "Ta bort bakgrund", "Smart beskärning", "Stockbilder", "Öppna bibliotek"],
    ["Varumärkesfiler", "Favicon", "Logotyp", "OG-bild"],
    ["Konvertering", "Sticky köpknapp", "Köp nu-knapp", "Fri frakt-bar", "Fri frakt över", "Trygghetsmärken", "UGC & kundbilder", "Mängdrabatt", "Storleksguide", "Complete the look", "Nyligen visade", "Exit intent-popup", "GDPR-samtycke", "A/B-test", "Av"],
    ["Hero-rubrik", "CTA-text", "Sektionslayout", "Färger", "Testas automatiskt: hälften av besökarna ser variant B."],
    ["Appar & integrationer", "Klaviyo", "Klaviyo company-id", "Recensioner", "Inga", "Shopify Reviews", "Judge.me", "Loox", "App blocks", "Search & Discovery", "Shopify Markets", "Shopify Flow"],
    ["AI-copy", "Hero", "Produkter", "SEO", "CTA", "Kampanj", "Skriv text", "Använd texten"],
    ["Historik", "Inga versioner ännu.", "Spara version", "Återställ"],
    ["Bredd", "Smal", "Boxad", "Bred", "Full", "Gör mer premium"],
  ],
  nb: [
    ["Merkevare", "Lim inn en adresse, last opp en logo eller lim inn fargene dine. ThemeFold gjør resten.", "Nettadresse", "dinshop.no eller instagram.com/dinshop", "Hent merkevare", "Leser av…", "Logo", "Last opp logo", "Farger", "Bruk farger"],
    ["Premium hudpleie", "Gaming", "Barneklær", "Nordisk minimalisme", "Luksus", "Streetwear", "Stilpresets"],
    ["Design tokens", "Rundhet", "Skygge", "Luft", "Tekststørrelse", "Knappestil", "Fylt", "Kontur", "Myk"],
    ["Bilder & media", "Hero & kampanje", "Lag bilde", "Lager bilde…", "Beskriv bildet", "Videoadresse (hero)", "Dra punktet dit motivet skal sentreres.", "Fjern bakgrunn", "Smart beskjæring", "Stockbilder", "Åpne bibliotek"],
    ["Merkevarefiler", "Favicon", "Logo", "OG-bilde"],
    ["Konvertering", "Sticky kjøpsknapp", "Kjøp nå-knapp", "Fri frakt-bar", "Fri frakt over", "Trygghetsmerker", "UGC & kundebilder", "Mengderabatt", "Størrelsesguide", "Complete the look", "Nylig vist", "Exit intent-popup", "GDPR-samtykke", "A/B-test", "Av"],
    ["Hero-rubrikk", "CTA-tekst", "Seksjonslayout", "Farger", "Testes automatisk: halvparten av besøkende ser variant B."],
    ["Apper & integrasjoner", "Klaviyo", "Klaviyo company-id", "Anmeldelser", "Ingen", "Shopify Reviews", "Judge.me", "Loox", "App blocks", "Search & Discovery", "Shopify Markets", "Shopify Flow"],
    ["AI-copy", "Hero", "Produkter", "SEO", "CTA", "Kampanje", "Skriv tekst", "Bruk teksten"],
    ["Historikk", "Ingen versjoner ennå.", "Lagre versjon", "Gjenopprett"],
    ["Bredde", "Smal", "Boks", "Bred", "Full", "Gjør mer premium"],
  ],
  fi: [
    ["Brändi", "Liitä osoite, lataa logo tai liitä värisi. ThemeFold hoitaa loput.", "Verkko-osoite", "kauppasi.fi tai instagram.com/kauppasi", "Hae brändi", "Luetaan…", "Logo", "Lataa logo", "Värit", "Käytä värejä"],
    ["Premium ihonhoito", "Pelaaminen", "Lastenvaatteet", "Nordic minimalism", "Luksus", "Streetwear", "Tyylipresetit"],
    ["Design-tokenit", "Pyöreys", "Varjo", "Ilma", "Tekstikoko", "Painiketyyli", "Täytetty", "Ääriviiva", "Pehmeä"],
    ["Kuvat & media", "Hero & kampanja", "Luo kuva", "Luodaan kuvaa…", "Kuvaile kuva", "Video-osoite (hero)", "Vedä piste kohtaan, johon kohde keskitetään.", "Poista tausta", "Älykäs rajaus", "Stockkuvat", "Avaa kirjasto"],
    ["Bränditiedostot", "Favicon", "Logo", "OG-kuva"],
    ["Konversio", "Sticky ostopainike", "Osta heti -painike", "Ilmainen toimitus -palkki", "Ilmainen toimitus yli", "Luottamusmerkit", "UGC & asiakaskuvat", "Määräalennus", "Kokotaulukko", "Complete the look", "Äskettäin katsotut", "Exit intent -popup", "GDPR-suostumus", "A/B-testi", "Pois"],
    ["Hero-otsikko", "CTA-teksti", "Osion asettelu", "Värit", "Testataan automaattisesti: puolet kävijöistä näkee version B."],
    ["Sovellukset & integraatiot", "Klaviyo", "Klaviyo company-id", "Arvostelut", "Ei mitään", "Shopify Reviews", "Judge.me", "Loox", "App blocks", "Search & Discovery", "Shopify Markets", "Shopify Flow"],
    ["AI-teksti", "Hero", "Tuotteet", "SEO", "CTA", "Kampanja", "Kirjoita teksti", "Käytä tekstiä"],
    ["Historia", "Ei vielä versioita.", "Tallenna versio", "Palauta"],
    ["Leveys", "Kapea", "Laatikko", "Leveä", "Täysi", "Tee premiumimpi"],
  ],
  da: [
    ["Brand", "Indsæt en adresse, upload et logo eller indsæt dine farver. ThemeFold klarer resten.", "Webadresse", "dinshop.dk eller instagram.com/dinshop", "Hent brand", "Læser…", "Logo", "Upload logo", "Farver", "Brug farver"],
    ["Premium hudpleje", "Gaming", "Børnetøj", "Nordisk minimalisme", "Luksus", "Streetwear", "Stilpresets"],
    ["Design tokens", "Rundhed", "Skygge", "Luft", "Tekststørrelse", "Knapstil", "Fyldt", "Kontur", "Blød"],
    ["Billeder & media", "Hero & kampagne", "Opret billede", "Opretter billede…", "Beskriv billedet", "Videoadresse (hero)", "Træk punktet derhen, hvor motivet skal centreres.", "Fjern baggrund", "Smart beskæring", "Stockbilleder", "Åbn bibliotek"],
    ["Brandfiler", "Favicon", "Logo", "OG-billede"],
    ["Konvertering", "Sticky køb-knap", "Køb nu-knap", "Fri fragt-bar", "Fri fragt over", "Tryghedsmærker", "UGC & kundebilleder", "Mængderabat", "Størrelsesguide", "Complete the look", "Senest vist", "Exit intent-popup", "GDPR-samtykke", "A/B-test", "Fra"],
    ["Hero-overskrift", "CTA-tekst", "Sektionslayout", "Farver", "Testes automatisk: halvdelen af besøgende ser variant B."],
    ["Apps & integrationer", "Klaviyo", "Klaviyo company-id", "Anmeldelser", "Ingen", "Shopify Reviews", "Judge.me", "Loox", "App blocks", "Search & Discovery", "Shopify Markets", "Shopify Flow"],
    ["AI-copy", "Hero", "Produkter", "SEO", "CTA", "Kampagne", "Skriv tekst", "Brug teksten"],
    ["Historik", "Ingen versioner endnu.", "Gem version", "Gendan"],
    ["Bredde", "Smal", "Boks", "Bred", "Fuld", "Gør mere premium"],
  ],
  en: [
    ["Brand", "Paste a website, upload a logo or paste your colours. ThemeFold does the rest.", "Website", "yourshop.com or instagram.com/yourshop", "Fetch brand", "Reading…", "Logo", "Upload logo", "Colours", "Use colours"],
    ["Premium skincare", "Gaming", "Kids clothing", "Nordic minimalism", "Luxury", "Streetwear", "Style presets"],
    ["Design tokens", "Roundness", "Shadow", "Spacing", "Type size", "Button style", "Solid", "Outline", "Soft"],
    ["Images & media", "Hero & campaign", "Generate image", "Generating…", "Describe the image", "Video URL (hero)", "Drag the dot where the subject should be centred.", "Remove background", "Smart crop", "Stock photos", "Open library"],
    ["Brand assets", "Favicon", "Logo", "OG image"],
    ["Conversion", "Sticky add to cart", "Buy now button", "Free shipping bar", "Free shipping over", "Trust badges", "UGC & customer photos", "Volume discount", "Size guide", "Complete the look", "Recently viewed", "Exit intent popup", "GDPR consent", "A/B test", "Off"],
    ["Hero headline", "CTA text", "Section layout", "Colours", "Tested automatically: half of visitors see variant B."],
    ["Apps & integrations", "Klaviyo", "Klaviyo company id", "Reviews", "None", "Shopify Reviews", "Judge.me", "Loox", "App blocks", "Search & Discovery", "Shopify Markets", "Shopify Flow"],
    ["AI copy", "Hero", "Products", "SEO", "CTA", "Campaign", "Write copy", "Use this copy"],
    ["History", "No versions yet.", "Save version", "Restore"],
    ["Width", "Narrow", "Boxed", "Wide", "Full", "Make it more premium"],
  ],
  fr: [
    ["Marque", "Collez une adresse, importez un logo ou vos couleurs. ThemeFold fait le reste.", "Adresse web", "votresite.fr ou instagram.com/votresite", "Importer la marque", "Lecture…", "Logo", "Importer un logo", "Couleurs", "Utiliser les couleurs"],
    ["Soin premium", "Gaming", "Vêtements enfants", "Minimalisme nordique", "Luxe", "Streetwear", "Presets de style"],
    ["Design tokens", "Arrondi", "Ombre", "Espacement", "Taille du texte", "Style de bouton", "Plein", "Contour", "Doux"],
    ["Images & médias", "Hero & campagne", "Générer une image", "Génération…", "Décrivez l'image", "URL vidéo (hero)", "Glissez le point là où le sujet doit être centré.", "Supprimer l'arrière-plan", "Recadrage intelligent", "Photos libres", "Ouvrir la bibliothèque"],
    ["Fichiers de marque", "Favicon", "Logo", "Image OG"],
    ["Conversion", "Ajout au panier fixe", "Bouton acheter", "Barre livraison offerte", "Livraison offerte dès", "Badges de confiance", "UGC & photos clients", "Remise quantité", "Guide des tailles", "Complete the look", "Vus récemment", "Popup exit intent", "Consentement RGPD", "Test A/B", "Désactivé"],
    ["Titre du hero", "Texte du CTA", "Mise en page", "Couleurs", "Testé automatiquement : la moitié des visiteurs voit la variante B."],
    ["Apps & intégrations", "Klaviyo", "Identifiant Klaviyo", "Avis", "Aucun", "Shopify Reviews", "Judge.me", "Loox", "App blocks", "Search & Discovery", "Shopify Markets", "Shopify Flow"],
    ["Texte IA", "Hero", "Produits", "SEO", "CTA", "Campagne", "Rédiger", "Utiliser ce texte"],
    ["Historique", "Aucune version.", "Enregistrer une version", "Restaurer"],
    ["Largeur", "Étroit", "Encadré", "Large", "Plein", "Rendre plus premium"],
  ],
  de: [
    ["Marke", "Adresse einfügen, Logo hochladen oder Farben einfügen. ThemeFold macht den Rest.", "Webadresse", "deinshop.de oder instagram.com/deinshop", "Marke laden", "Lese…", "Logo", "Logo hochladen", "Farben", "Farben übernehmen"],
    ["Premium-Pflege", "Gaming", "Kinderkleidung", "Nordischer Minimalismus", "Luxus", "Streetwear", "Stil-Presets"],
    ["Design-Tokens", "Rundheit", "Schatten", "Abstand", "Textgröße", "Button-Stil", "Gefüllt", "Kontur", "Weich"],
    ["Bilder & Medien", "Hero & Kampagne", "Bild erzeugen", "Erzeuge Bild…", "Beschreibe das Bild", "Video-URL (Hero)", "Ziehe den Punkt dorthin, wo das Motiv zentriert sein soll.", "Hintergrund entfernen", "Smartes Zuschneiden", "Stockfotos", "Bibliothek öffnen"],
    ["Markendateien", "Favicon", "Logo", "OG-Bild"],
    ["Conversion", "Sticky Warenkorb-Button", "Jetzt kaufen", "Versandkostenfrei-Leiste", "Versandfrei ab", "Vertrauens-Badges", "UGC & Kundenfotos", "Mengenrabatt", "Größentabelle", "Complete the look", "Zuletzt gesehen", "Exit-Intent-Popup", "DSGVO-Einwilligung", "A/B-Test", "Aus"],
    ["Hero-Überschrift", "CTA-Text", "Sektionslayout", "Farben", "Wird automatisch getestet: die Hälfte sieht Variante B."],
    ["Apps & Integrationen", "Klaviyo", "Klaviyo Company-ID", "Bewertungen", "Keine", "Shopify Reviews", "Judge.me", "Loox", "App blocks", "Search & Discovery", "Shopify Markets", "Shopify Flow"],
    ["KI-Texte", "Hero", "Produkte", "SEO", "CTA", "Kampagne", "Text schreiben", "Text übernehmen"],
    ["Verlauf", "Noch keine Versionen.", "Version speichern", "Wiederherstellen"],
    ["Breite", "Schmal", "Boxed", "Breit", "Voll", "Premium-Optimieren"],
  ],
  es: [
    ["Marca", "Pega una dirección, sube un logo o tus colores. ThemeFold hace el resto.", "Sitio web", "tutienda.es o instagram.com/tutienda", "Importar marca", "Leyendo…", "Logo", "Subir logo", "Colores", "Usar colores"],
    ["Cuidado premium", "Gaming", "Ropa infantil", "Minimalismo nórdico", "Lujo", "Streetwear", "Presets de estilo"],
    ["Design tokens", "Redondez", "Sombra", "Espaciado", "Tamaño de texto", "Estilo de botón", "Relleno", "Contorno", "Suave"],
    ["Imágenes y medios", "Hero y campaña", "Generar imagen", "Generando…", "Describe la imagen", "URL de vídeo (hero)", "Arrastra el punto donde quieres centrar el motivo.", "Quitar fondo", "Recorte inteligente", "Fotos de stock", "Abrir biblioteca"],
    ["Archivos de marca", "Favicon", "Logo", "Imagen OG"],
    ["Conversión", "Añadir al carrito fijo", "Botón comprar ya", "Barra de envío gratis", "Envío gratis desde", "Sellos de confianza", "UGC y fotos de clientes", "Descuento por cantidad", "Guía de tallas", "Complete the look", "Vistos recientemente", "Popup exit intent", "Consentimiento RGPD", "Test A/B", "Desactivado"],
    ["Titular del hero", "Texto del CTA", "Diseño de sección", "Colores", "Se prueba automáticamente: la mitad ve la variante B."],
    ["Apps e integraciones", "Klaviyo", "ID de compañía Klaviyo", "Reseñas", "Ninguna", "Shopify Reviews", "Judge.me", "Loox", "App blocks", "Search & Discovery", "Shopify Markets", "Shopify Flow"],
    ["Textos IA", "Hero", "Productos", "SEO", "CTA", "Campaña", "Escribir texto", "Usar este texto"],
    ["Historial", "Todavía no hay versiones.", "Guardar versión", "Restaurar"],
    ["Ancho", "Estrecho", "En caja", "Ancho", "Completo", "Hacerlo más premium"],
  ],
};

const FLAT_KEYS = GROUPS.flat() as readonly ProKey[];
const FLAT_VALUES: Record<Locale, string[]> = Object.fromEntries(
  Object.entries(VALUES).map(([locale, groups]) => {
    const flat = groups.flat();
    if (flat.length !== SIZE) {
      throw new Error(`pro.ts: ${locale} har ${flat.length} strängar, förväntade ${SIZE}`);
    }
    return [locale, flat];
  }),
) as Record<Locale, string[]>;

export type ProStrings = Record<ProKey, string>;

export function getPro(locale: Locale): ProStrings {
  const list = FLAT_VALUES[locale] ?? FLAT_VALUES.en;
  const fallback = FLAT_VALUES.en;
  const out = {} as ProStrings;
  FLAT_KEYS.forEach((key, index) => {
    out[key] = list[index] ?? fallback[index] ?? key;
  });
  return out;
}
