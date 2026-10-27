import type { LayoutRecipeId, Locale } from "@/lib/theme/types";

/**
 * Strängar för layoutmotorn. Egen modul så att de befintliga ordböckerna lämnas
 * orörda. Ordningen i GROUPS måste matcha raderna i VALUES.
 */
const GROUPS = [
  ["title", "sub", "recipe", "recipeHint", "density", "menuColumns", "variant", "variantHint", "columns", "ratio"],
  ["ratioSquare", "ratioPortrait", "ratioLandscape", "ratioWide", "span", "spanEven", "spanFeature", "spanMosaic", "gap", "sections"],
  ["marketTitle", "marketSub", "marketLabel", "marketLocale", "marketCurrency", "marketShipping", "marketReturns", "marketCampaign"],
  ["marketHero", "marketAdd", "marketRemove", "marketActive", "marketHint", "megaTitle", "megaEnable", "megaHint", "megaGroup", "megaAddGroup"],
] as const;

type GroupKeys = (typeof GROUPS)[number];
export type LayoutKey = GroupKeys[number];

const SIZE = GROUPS.reduce((sum, group) => sum + group.length, 0);

const VALUES: Record<Locale, string[][]> = {
  sv: [
    ["Layoutmotor", "Välj struktur och täthet. Receptet bygger om sektionerna men behåller text, produkter och Brand DNA.", "Recept", "Hela butikens struktur – från varumärkesbutik till kampanjdrivet varuhus.", "Täthet", "Menykolumner", "Layoutvariant", "Byt variant med ett klick. Alla varianter följer design tokens.", "Kolumner", "Bildformat"],
    ["Kvadrat", "Porträtt", "Landskap", "Bred", "Asymmetri", "Jämnt", "Framhävt", "Mosaik", "Inre luft", "Sektioner"],
    ["Marknader", "Språk, valuta, kampanj och frakt per marknad.", "Marknad", "Språk", "Valuta", "Frakt", "Returer", "Kampanjband"],
    ["Hero för marknaden", "Lägg till marknad", "Ta bort", "Aktiv", "Den aktiva marknaden styr förhandsvisningen. Ändra valutan och texterna per marknad.", "Mega-meny", "Visa mega-meny", "Gruppera kategorier i kolumner – för butiker med brett sortiment.", "Kategori", "Lägg till grupp"],
  ],
  nb: [
    ["Layoutmotor", "Velg struktur og tetthet. Oppskriften bygger om seksjonene, men beholder tekst, produkter og Brand DNA.", "Oppskrift", "Hele butikkens struktur – fra merkevarebutikk til kampanjestyrt varehus.", "Tetthet", "Menykolonner", "Layoutvariant", "Bytt variant med ett klikk. Alle varianter følger design tokens.", "Kolonner", "Bildeformat"],
    ["Kvadrat", "Portrett", "Landskap", "Bred", "Asymmetri", "Jevnt", "Fremhevet", "Mosaikk", "Indre luft", "Seksjoner"],
    ["Markeder", "Språk, valuta, kampanje og frakt per marked.", "Marked", "Språk", "Valuta", "Frakt", "Returer", "Kampanjebånd"],
    ["Hero for markedet", "Legg til marked", "Fjern", "Aktiv", "Det aktive markedet styrer forhåndsvisningen. Endre valuta og tekster per marked.", "Megameny", "Vis megameny", "Grupper kategorier i kolonner – for butikker med bredt sortiment.", "Kategori", "Legg til gruppe"],
  ],
  fi: [
    ["Layoutmoottori", "Valitse rakenne ja tiheys. Resepti rakentaa osiot uudelleen mutta säilyttää tekstit, tuotteet ja Brand DNA:n.", "Resepti", "Koko kaupan rakenne – brändikaupasta kampanjavetoiseen tavarataloon.", "Tiheys", "Valikon sarakkeet", "Layout-muunnelma", "Vaihda muunnelma yhdellä klikkauksella. Kaikki muunnelmat noudattavat design tokeneita.", "Sarakkeet", "Kuvan muoto"],
    ["Neliö", "Pysty", "Vaaka", "Leveä", "Epäsymmetria", "Tasainen", "Korostettu", "Mosaiikki", "Sisäinen tila", "Osiot"],
    ["Markkinat", "Kieli, valuutta, kampanja ja toimitus markkinoittain.", "Markkina", "Kieli", "Valuutta", "Toimitus", "Palautukset", "Kampanjapalkki"],
    ["Heron teksti markkinalle", "Lisää markkina", "Poista", "Aktiivinen", "Aktiivinen markkina ohjaa esikatselua. Muuta valuutta ja tekstit markkinoittain.", "Megavalikko", "Näytä megavalikko", "Ryhmittele kategoriat sarakkeisiin – laajan valikoiman kaupoille.", "Kategoria", "Lisää ryhmä"],
  ],
  da: [
    ["Layoutmotor", "Vælg struktur og tæthed. Opskriften genopbygger sektionerne men bevarer tekst, produkter og Brand DNA.", "Opskrift", "Hele butikkens struktur – fra brandbutik til kampagnedrevet varehus.", "Tæthed", "Menukolonner", "Layoutvariant", "Skift variant med ét klik. Alle varianter følger design tokens.", "Kolonner", "Billedformat"],
    ["Kvadrat", "Portræt", "Landskab", "Bred", "Asymmetri", "Jævnt", "Fremhævet", "Mosaik", "Indre luft", "Sektioner"],
    ["Markeder", "Sprog, valuta, kampagne og fragt per marked.", "Marked", "Sprog", "Valuta", "Fragt", "Returnering", "Kampagnebånd"],
    ["Hero til markedet", "Tilføj marked", "Fjern", "Aktiv", "Det aktive marked styrer forhåndsvisningen. Ret valuta og tekster per marked.", "Megamenu", "Vis megamenu", "Gruppér kategorier i kolonner – til butikker med bredt sortiment.", "Kategori", "Tilføj gruppe"],
  ],
  en: [
    ["Layout engine", "Pick a structure and density. The recipe rebuilds the sections but keeps your copy, products and Brand DNA.", "Recipe", "The whole store structure – from brand boutique to campaign-driven warehouse.", "Density", "Menu columns", "Layout variant", "Swap variant in one click. Every variant follows the design tokens.", "Columns", "Image ratio"],
    ["Square", "Portrait", "Landscape", "Wide", "Asymmetry", "Even", "Featured", "Mosaic", "Inner spacing", "Sections"],
    ["Markets", "Language, currency, campaign and shipping per market.", "Market", "Language", "Currency", "Shipping", "Returns", "Campaign bar"],
    ["Hero for the market", "Add market", "Remove", "Active", "The active market drives the preview. Change currency and copy per market.", "Mega menu", "Show mega menu", "Group categories in columns – for stores with a wide range.", "Category", "Add group"],
  ],
  fr: [
    ["Moteur de mise en page", "Choisissez une structure et une densité. La recette reconstruit les sections en conservant vos textes, produits et Brand DNA.", "Recette", "Toute la structure de la boutique – de la boutique de marque à l'hypermarché orienté campagne.", "Densité", "Colonnes du menu", "Variante de mise en page", "Changez de variante en un clic. Toutes les variantes suivent les design tokens.", "Colonnes", "Format d'image"],
    ["Carré", "Portrait", "Paysage", "Large", "Asymétrie", "Régulier", "Mis en avant", "Mosaïque", "Espacement interne", "Sections"],
    ["Marchés", "Langue, devise, campagne et livraison par marché.", "Marché", "Langue", "Devise", "Livraison", "Retours", "Bandeau de campagne"],
    ["Hero du marché", "Ajouter un marché", "Supprimer", "Actif", "Le marché actif pilote l'aperçu. Modifiez devise et textes par marché.", "Méga menu", "Afficher le méga menu", "Regroupez les catégories en colonnes – pour les boutiques à large gamme.", "Catégorie", "Ajouter un groupe"],
  ],
  de: [
    ["Layout-Engine", "Struktur und Dichte wählen. Das Rezept baut die Sektionen neu auf und behält Text, Produkte und Brand DNA.", "Rezept", "Die gesamte Shop-Struktur – von der Marken-Boutique bis zum kampagnengetriebenen Kaufhaus.", "Dichte", "Menüspalten", "Layout-Variante", "Variante per Klick wechseln. Alle Varianten folgen den Design Tokens.", "Spalten", "Bildformat"],
    ["Quadrat", "Hochformat", "Querformat", "Breit", "Asymmetrie", "Gleichmäßig", "Hervorgehoben", "Mosaik", "Innenabstand", "Sektionen"],
    ["Märkte", "Sprache, Währung, Kampagne und Versand pro Markt.", "Markt", "Sprache", "Währung", "Versand", "Rückgabe", "Kampagnenleiste"],
    ["Hero für den Markt", "Markt hinzufügen", "Entfernen", "Aktiv", "Der aktive Markt steuert die Vorschau. Währung und Texte pro Markt ändern.", "Mega-Menü", "Mega-Menü zeigen", "Kategorien in Spalten gruppieren – für Shops mit breitem Sortiment.", "Kategorie", "Gruppe hinzufügen"],
  ],
  es: [
    ["Motor de maquetación", "Elige estructura y densidad. La receta reconstruye las secciones pero conserva textos, productos y Brand DNA.", "Receta", "Toda la estructura de la tienda: de la boutique de marca al gran almacén orientado a campañas.", "Densidad", "Columnas del menú", "Variante de diseño", "Cambia de variante con un clic. Todas siguen los design tokens.", "Columnas", "Formato de imagen"],
    ["Cuadrado", "Retrato", "Apaisado", "Ancho", "Asimetría", "Uniforme", "Destacado", "Mosaico", "Espacio interno", "Secciones"],
    ["Mercados", "Idioma, moneda, campaña y envío por mercado.", "Mercado", "Idioma", "Moneda", "Envío", "Devoluciones", "Barra de campaña"],
    ["Hero del mercado", "Añadir mercado", "Eliminar", "Activo", "El mercado activo controla la vista previa. Cambia moneda y textos por mercado.", "Mega menú", "Mostrar mega menú", "Agrupa categorías en columnas, para tiendas con catálogo amplio.", "Categoría", "Añadir grupo"],
  ],
};

const FLAT_KEYS = GROUPS.flat() as readonly LayoutKey[];
const FLAT_VALUES: Record<Locale, string[]> = Object.fromEntries(
  Object.entries(VALUES).map(([locale, groups]) => {
    const flat = groups.flat();
    if (flat.length !== SIZE) throw new Error(`layout.ts: ${locale} har ${flat.length} strängar, förväntade ${SIZE}`);
    return [locale, flat];
  }),
) as Record<Locale, string[]>;

export type LayoutStrings = Record<LayoutKey, string>;

export function getLayoutStrings(locale: Locale): LayoutStrings {
  const list = FLAT_VALUES[locale] ?? FLAT_VALUES.en;
  const fallback = FLAT_VALUES.en;
  const out = {} as LayoutStrings;
  FLAT_KEYS.forEach((key, index) => {
    out[key] = list[index] ?? fallback[index] ?? key;
  });
  return out;
}

export const RECIPE_LABELS: Record<LayoutRecipeId, string> = {
  brand: "Brand",
  boutique: "Boutique",
  editorial: "Editorial",
  campaign: "Campaign",
  warehouse: "Warehouse",
  tech: "Tech",
};

export const RECIPE_DESCRIPTIONS: Record<Locale, Record<LayoutRecipeId, string>> = {
  sv: {
    brand: "Luftig enkelbutik med stora rubriker och få kolumner.",
    boutique: "Klassisk butik med kategorier, produktgrid och trygghetsrad.",
    editorial: "Redaktionell butik med lookbook, kampanjband och mosaik.",
    campaign: "Kampanjdriven butik med nedräkning och täta rabattgrid.",
    warehouse: "Stort varuhus: 5–6 kolumner, jämförelsetabell och mega-meny.",
    tech: "Teknikbutik med specifikationer, jämförelse och videoformat.",
  },
  nb: {
    brand: "Luftig enkeltbutikk med store overskrifter og få kolonner.",
    boutique: "Klassisk butikk med kategorier, produktgrid og trygghetsrad.",
    editorial: "Redaksjonell butikk med lookbook, kampanjebånd og mosaikk.",
    campaign: "Kampanjestyrt butikk med nedtelling og tette rabattgrid.",
    warehouse: "Stort varehus: 5–6 kolonner, sammenligningstabell og megameny.",
    tech: "Teknisk butikk med spesifikasjoner, sammenligning og videoformat.",
  },
  fi: {
    brand: "Väljä yhden tuotemerkin kauppa, suuret otsikot ja vähän sarakkeita.",
    boutique: "Klassinen kauppa kategorioilla, tuotegridillä ja luottamusrivillä.",
    editorial: "Toimituksellinen kauppa: lookbook, kampanjapalkki ja mosaiikki.",
    campaign: "Kampanjavetoinen kauppa ajastimella ja tiheillä alennusgrideillä.",
    warehouse: "Suuri tavaratalo: 5–6 saraketta, vertailutaulukko ja megavalikko.",
    tech: "Tekniikkakauppa: spesifikaatiot, vertailu ja videomuoto.",
  },
  da: {
    brand: "Luftig enkeltbutik med store overskrifter og få kolonner.",
    boutique: "Klassisk butik med kategorier, produktgrid og tryghedsrække.",
    editorial: "Redaktionel butik med lookbook, kampagnebånd og mosaik.",
    campaign: "Kampagnedrevet butik med nedtælling og tætte rabatgrids.",
    warehouse: "Stort varehus: 5–6 kolonner, sammenligningstabel og megamenu.",
    tech: "Teknikbutik med specifikationer, sammenligning og videoformat.",
  },
  en: {
    brand: "Airy single-brand store with large headlines and few columns.",
    boutique: "Classic store with categories, product grid and a trust row.",
    editorial: "Editorial store with lookbook, campaign bar and mosaic grids.",
    campaign: "Campaign-driven store with countdown and dense deal grids.",
    warehouse: "Large warehouse: 5–6 columns, comparison table and mega menu.",
    tech: "Tech store with specs, comparison and landscape media formats.",
  },
  fr: {
    brand: "Boutique aérée à marque unique, grands titres et peu de colonnes.",
    boutique: "Boutique classique avec catégories, grille produits et bandeau de confiance.",
    editorial: "Boutique éditoriale avec lookbook, bandeau campagne et mosaïque.",
    campaign: "Boutique orientée campagne avec compte à rebours et grilles denses.",
    warehouse: "Grand magasin : 5–6 colonnes, tableau comparatif et méga menu.",
    tech: "Boutique tech avec specs, comparatif et formats vidéo.",
  },
  de: {
    brand: "Luftiger Single-Brand-Shop mit großen Überschriften und wenigen Spalten.",
    boutique: "Klassischer Shop mit Kategorien, Produktgrid und Vertrauenszeile.",
    editorial: "Editorialer Shop mit Lookbook, Kampagnenleiste und Mosaik.",
    campaign: "Kampagnengetriebener Shop mit Countdown und dichten Deal-Grids.",
    warehouse: "Großes Kaufhaus: 5–6 Spalten, Vergleichstabelle und Mega-Menü.",
    tech: "Technik-Shop mit Specs, Vergleich und Querformat-Medien.",
  },
  es: {
    brand: "Tienda de marca única y aireada, titulares grandes y pocas columnas.",
    boutique: "Tienda clásica con categorías, cuadrícula de productos y fila de confianza.",
    editorial: "Tienda editorial con lookbook, barra de campaña y mosaico.",
    campaign: "Tienda orientada a campaña con cuenta atrás y cuadrículas densas.",
    warehouse: "Gran almacén: 5–6 columnas, tabla comparativa y mega menú.",
    tech: "Tienda de tecnología con especificaciones, comparativa y formatos anchos.",
  },
};
