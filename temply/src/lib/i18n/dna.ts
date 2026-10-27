import type { BrandIndustry, Locale } from "@/lib/theme/types";

/**
 * Strängar för Brand DNA-editorn. Egen modul så att de befintliga ordböckerna
 * lämnas orörda. Ordningen i GROUPS måste matcha raderna i VALUES.
 */
const GROUPS = [
  [
    "title",
    "sub",
    "urlLabel",
    "urlPlaceholder",
    "importBtn",
    "importing",
    "errUrl",
    "errFetch",
    "errRobots",
    "sourceNote",
  ],
  ["summary", "suggestedTag", "missingTag", "missingTitle", "missingHint", "suggestedHint", "applyTheme", "applied", "reimport", "clear"],
  ["identity", "brandName", "slogan", "favicon", "appIcon", "socialImage", "uploadLogo", "noLogo", "logo"],
  ["colors", "colPrimary", "colSecondary", "colAccent", "colBackground", "colText", "colButton"],
  ["typography", "headingFont", "bodyFont", "baseSize", "headingSize", "lineHeight", "headingWeight", "uppercase", "detected"],
  ["design", "radius", "buttonRadius", "cardRadius", "imageRadius", "spacing", "shadow", "density", "densCompact", "densCozy", "densAiry", "buttonStyle", "btnSolid", "btnOutline", "btnSoft"],
  ["imagery", "imageStyle", "imgPhotography", "imgIllustration", "img3d", "imgMixed", "productPhotos", "lifestyle", "keywords"],
  [
    "voice",
    "language",
    "formality",
    "formalityFormal",
    "formalityNeutral",
    "formalityCasual",
    "voiceFormal",
    "voiceFriendly",
    "voiceLuxury",
    "voiceYouthful",
    "voiceMinimal",
    "voicePlayful",
  ],
  ["audience", "industry", "segment"],
  ["products", "productAdd", "productName", "productPrice", "productRemove"],
  [
    "copy",
    "copySlogan",
    "copyHero",
    "copyHeroSub",
    "copyCta",
    "copySecondary",
    "copyAnnouncement",
    "copyCollection",
    "copyCollectionText",
    "copyProduct",
    "copyNewsletter",
    "copyNewsletterText",
    "copySeoTitle",
    "copySeoDesc",
  ],
  ["extra", "socials", "contact", "email", "phone", "address", "policies", "returns", "shipping", "headings", "phrases", "notes", "pages", "pageHome", "pageAbout", "pageProduct", "pageCollection", "pageContact", "pageFooter"],
] as const;

type GroupKeys = (typeof GROUPS)[number];
export type DnaKey = GroupKeys[number];

const SIZE = GROUPS.reduce((sum, group) => sum + group.length, 0);

const VALUES: Record<Locale, string[][]> = {
  sv: [
    ["Brand DNA", "Hämta hela varumärket från domänen och granska det innan det används.", "Domän", "dinshop.se", "Hämta Brand DNA", "Analyserar sajten…", "Ange en domän.", "Kunde inte läsa sajten. Kontrollera adressen.", "Sajten tillåter inte automatisk läsning (robots.txt).", "Endast offentligt material från domänen används, som referens. Logotyper, bilder och texter tillhör domänens ägare – byt ut dem om du inte äger dem."],
    ["{pages} sidor analyserade · {suggested} förslag", "Förslag", "Saknas", "Ofullständigt underlag", "Fälten nedan fylldes med branschförslag. Fyll i själv för ett vassare resultat.", "Dessa fält är ifyllda med förslag (bransch eller AI). Granska och ändra vid behov.", "Använd i temat", "Tillämpat", "Hämta igen", "Ta bort DNA"],
    ["Identitet", "Varumärkesnamn", "Slogan", "Favicon", "App-ikon", "Social bild", "Ladda upp logotyp", "Ingen logotyp hittades", "Logotyp"],
    ["Färger", "Primär", "Sekundär", "Accent", "Bakgrund", "Text", "Knapp"],
    ["Typografi", "Rubriktypsnitt", "Brödtext", "Grundstorlek", "Rubrikstorlek", "Radavstånd", "Rubrikvikt", "Versaler i rubriker", "Hittat på sajten"],
    ["Design", "Rundhet", "Knappradie", "Kortradie", "Bildradie", "Sektionsluft", "Skugga", "Täthet", "Kompakt", "Bekväm", "Luftig", "Knappstil", "Fylld", "Kontur", "Mjuk"],
    ["Bildstil", "Stil", "Foto", "Illustration", "3D", "Blandat", "Produktbilder", "Lifestyle-bilder", "Nyckelord"],
    ["Ton & språk", "Språk", "Formalitet", "Formell", "Neutral", "Ledig", "Formell", "Vänlig", "Lyxig", "Ungdomlig", "Minimal", "Lekfull"],
    ["Målgrupp", "Bransch", "Beskrivning"],
    ["Produkter", "Lägg till produkt", "Namn", "Pris", "Ta bort"],
    ["Textförslag", "Slogan", "Hero-rubrik", "Hero-underrubrik", "Hero-knapp", "Sekundär knapp", "Kampanjband", "Kollektionstitel", "Kollektionstext", "Produkttext", "Nyhetsbrevstitel", "Nyhetsbrevstext", "SEO-titel", "SEO-beskrivning"],
    ["Underlaget", "Sociala medier", "Kontakt", "E-post", "Telefon", "Adress", "Policy", "Returer", "Leverans", "Rubriker", "Fraser", "Anteckningar", "Sidor", "Startsida", "Om oss", "Produkt", "Kollektion", "Kontakt", "Footer"],
  ],
  nb: [
    ["Brand DNA", "Hent hele merkevaren fra domenet og vurder det før det brukes.", "Domene", "dinshop.no", "Hent Brand DNA", "Analyserer nettstedet…", "Oppgi et domene.", "Kunne ikke lese nettstedet. Sjekk adressen.", "Nettstedet tillater ikke automatisk lesing (robots.txt).", "Kun offentlig materiale fra domenet brukes, som referanse. Logoer, bilder og tekster tilhører domenets eier – bytt dem ut hvis du ikke eier dem."],
    ["{pages} sider analysert · {suggested} forslag", "Forslag", "Mangler", "Ufullstendig grunnlag", "Feltene under ble fylt med bransjeforslag. Fyll inn selv for et skarpere resultat.", "Disse feltene er fylt med forslag (bransje eller AI). Vurder og endre ved behov.", "Bruk i temaet", "Brukt", "Hent på nytt", "Fjern DNA"],
    ["Identitet", "Merkenavn", "Slogan", "Favicon", "App-ikon", "Sosialt bilde", "Last opp logo", "Ingen logo funnet", "Logo"],
    ["Farger", "Primær", "Sekundær", "Aksent", "Bakgrunn", "Tekst", "Knapp"],
    ["Typografi", "Overskrift-font", "Brødtekst-font", "Grunnstørrelse", "Overskriftsstørrelse", "Linjehøyde", "Overskriftsvekt", "Store bokstaver", "Funnet på nettstedet"],
    ["Design", "Rundhet", "Knapperadius", "Kortradius", "Bilderadius", "Seksjonsluft", "Skygge", "Tetthet", "Kompakt", "Behagelig", "Luftig", "Knappestil", "Fylt", "Kontur", "Myk"],
    ["Bildestil", "Stil", "Foto", "Illustrasjon", "3D", "Blandet", "Produktbilder", "Lifestyle-bilder", "Nøkkelord"],
    ["Tone & språk", "Språk", "Formalitet", "Formell", "Nøytral", "Uformell", "Formell", "Vennlig", "Luksuriøs", "Ungdommelig", "Minimal", "Leken"],
    ["Målgruppe", "Bransje", "Beskrivelse"],
    ["Produkter", "Legg til produkt", "Navn", "Pris", "Fjern"],
    ["Tekstforslag", "Slogan", "Hero-overskrift", "Hero-undertittel", "Hero-knapp", "Sekundær knapp", "Kampanjebanner", "Kolleksjonstittel", "Kolleksjonstekst", "Produkttekst", "Nyhetsbrevtittel", "Nyhetsbrevtekst", "SEO-tittel", "SEO-beskrivelse"],
    ["Grunnlaget", "Sosiale medier", "Kontakt", "E-post", "Telefon", "Adresse", "Retningslinjer", "Returer", "Levering", "Overskrifter", "Fraser", "Notater", "Sider", "Forside", "Om oss", "Produkt", "Kolleksjon", "Kontakt", "Footer"],
  ],
  fi: [
    ["Brand DNA", "Hae koko brändi verkkotunnuksesta ja tarkista se ennen käyttöä.", "Verkkotunnus", "kauppasi.fi", "Hae Brand DNA", "Analysoidaan sivustoa…", "Anna verkkotunnus.", "Sivustoa ei voitu lukea. Tarkista osoite.", "Sivusto ei salli automaattista lukemista (robots.txt).", "Vain julkista materiaalia verkkotunnuksesta käytetään viitteenä. Logot, kuvat ja tekstit kuuluvat verkkotunnuksen omistajalle – vaihda ne, jos et omista niitä."],
    ["{pages} sivua analysoitu · {suggested} ehdotusta", "Ehdotus", "Puuttuu", "Puutteellinen aineisto", "Alla olevat kentät täytettiin toimialan ehdotuksilla. Täytä itse tarkemman tuloksen saamiseksi.", "Nämä kentät on täytetty ehdotuksilla (toimiala tai AI). Tarkista ja muokkaa tarvittaessa.", "Käytä teemassa", "Käytössä", "Hae uudelleen", "Poista DNA"],
    ["Identiteetti", "Brändin nimi", "Slogan", "Favicon", "Sovelluskuvake", "Some-kuva", "Lataa logo", "Logoa ei löytynyt", "Logo"],
    ["Värit", "Ensisijainen", "Toissijainen", "Korostus", "Tausta", "Teksti", "Painike"],
    ["Typografia", "Otsikkofontti", "Leipätekstifontti", "Peruskoko", "Otsikkokoko", "Riviväli", "Otsikon paino", "Isot kirjaimet", "Löytyi sivustolta"],
    ["Design", "Pyöreys", "Painikkeen pyöreys", "Kortin pyöreys", "Kuvan pyöreys", "Osion tila", "Varjo", "Tiheys", "Kompakti", "Mukava", "Väljä", "Painiketyyli", "Täytetty", "Ääriviiva", "Pehmeä"],
    ["Kuvatyyli", "Tyyli", "Valokuva", "Kuvitus", "3D", "Sekoitus", "Tuotekuvat", "Lifestyle-kuvat", "Avainsanat"],
    ["Sävy & kieli", "Kieli", "Muodollisuus", "Muodollinen", "Neutraali", "Vapaa", "Muodollinen", "Ystävällinen", "Ylellinen", "Nuorekas", "Minimaalinen", "Leikkisä"],
    ["Kohdeyleisö", "Toimiala", "Kuvaus"],
    ["Tuotteet", "Lisää tuote", "Nimi", "Hinta", "Poista"],
    ["Tekstiehdotukset", "Slogan", "Heron otsikko", "Heron alaotsikko", "Heron painike", "Toissijainen painike", "Kampanjapalkki", "Kokoelman otsikko", "Kokoelman teksti", "Tuoteteksti", "Uutiskirjeen otsikko", "Uutiskirjeen teksti", "SEO-otsikko", "SEO-kuvaus"],
    ["Aineisto", "Sosiaalinen media", "Yhteystiedot", "Sähköposti", "Puhelin", "Osoite", "Käytännöt", "Palautukset", "Toimitus", "Otsikot", "Lauseet", "Muistiinpanot", "Sivut", "Etusivu", "Meistä", "Tuote", "Kokoelma", "Yhteys", "Footer"],
  ],
  da: [
    ["Brand DNA", "Hent hele brandet fra domænet og gennemgå det, før det bruges.", "Domæne", "dinshop.dk", "Hent Brand DNA", "Analyserer webstedet…", "Angiv et domæne.", "Kunne ikke læse webstedet. Tjek adressen.", "Webstedet tillader ikke automatisk læsning (robots.txt).", "Kun offentligt materiale fra domænet bruges, som reference. Logoer, billeder og tekster tilhører domænets ejer – udskift dem, hvis du ikke ejer dem."],
    ["{pages} sider analyseret · {suggested} forslag", "Forslag", "Mangler", "Ufuldstændigt grundlag", "Felterne nedenfor blev udfyldt med brancheforslag. Udfyld selv for et skarpere resultat.", "Disse felter er udfyldt med forslag (branche eller AI). Gennemgå og ret ved behov.", "Brug i temaet", "Anvendt", "Hent igen", "Fjern DNA"],
    ["Identitet", "Brandnavn", "Slogan", "Favicon", "App-ikon", "Socialt billede", "Upload logo", "Ingen logo fundet", "Logo"],
    ["Farver", "Primær", "Sekundær", "Accent", "Baggrund", "Tekst", "Knap"],
    ["Typografi", "Overskrift-font", "Brødtekst-font", "Grundstørrelse", "Overskriftsstørrelse", "Linjehøjde", "Overskriftsvægt", "Store bogstaver", "Fundet på webstedet"],
    ["Design", "Rundhed", "Knapradius", "Kortradius", "Billedradius", "Sektionsluft", "Skygge", "Tæthed", "Kompakt", "Behagelig", "Luftig", "Knapstil", "Fyldt", "Kontur", "Blød"],
    ["Billedstil", "Stil", "Foto", "Illustration", "3D", "Blandet", "Produktbilleder", "Lifestyle-billeder", "Nøgleord"],
    ["Tone & sprog", "Sprog", "Formalitet", "Formel", "Neutral", "Uformel", "Formel", "Venlig", "Luksuriøs", "Ungdommelig", "Minimal", "Legende"],
    ["Målgruppe", "Branche", "Beskrivelse"],
    ["Produkter", "Tilføj produkt", "Navn", "Pris", "Fjern"],
    ["Tekstforslag", "Slogan", "Hero-overskrift", "Hero-underoverskrift", "Hero-knap", "Sekundær knap", "Kampagnebånd", "Kollektionstitel", "Kollektionstekst", "Produkttekst", "Nyhedsbrevstitel", "Nyhedsbrevstekst", "SEO-titel", "SEO-beskrivelse"],
    ["Grundlaget", "Sociale medier", "Kontakt", "E-mail", "Telefon", "Adresse", "Politikker", "Returnering", "Levering", "Overskrifter", "Fraser", "Noter", "Sider", "Forside", "Om os", "Produkt", "Kollektion", "Kontakt", "Footer"],
  ],
  en: [
    ["Brand DNA", "Fetch the whole brand from the domain and review it before it is used.", "Domain", "yourshop.com", "Fetch Brand DNA", "Analysing the site…", "Enter a domain.", "Could not read the site. Check the address.", "The site does not allow automated reading (robots.txt).", "Only public material from the domain is used, as a reference. Logos, images and copy belong to the domain owner – replace them if you do not own them."],
    ["{pages} pages analysed · {suggested} suggestions", "Suggestion", "Missing", "Incomplete source", "The fields below were filled with industry suggestions. Fill them in yourself for a sharper result.", "These fields hold suggestions (industry or AI). Review and adjust as needed.", "Apply to theme", "Applied", "Fetch again", "Remove DNA"],
    ["Identity", "Brand name", "Slogan", "Favicon", "App icon", "Social image", "Upload logo", "No logo found", "Logo"],
    ["Colours", "Primary", "Secondary", "Accent", "Background", "Text", "Button"],
    ["Typography", "Heading font", "Body font", "Base size", "Heading size", "Line height", "Heading weight", "Uppercase headings", "Found on the site"],
    ["Design", "Roundness", "Button radius", "Card radius", "Image radius", "Section spacing", "Shadow", "Density", "Compact", "Cozy", "Airy", "Button style", "Solid", "Outline", "Soft"],
    ["Image style", "Style", "Photography", "Illustration", "3D", "Mixed", "Product shots", "Lifestyle photos", "Keywords"],
    ["Tone & language", "Language", "Formality", "Formal", "Neutral", "Casual", "Formal", "Friendly", "Luxury", "Youthful", "Minimal", "Playful"],
    ["Audience", "Industry", "Description"],
    ["Products", "Add product", "Name", "Price", "Remove"],
    ["Copy suggestions", "Slogan", "Hero headline", "Hero subheadline", "Hero button", "Secondary button", "Announcement bar", "Collection title", "Collection text", "Product copy", "Newsletter title", "Newsletter text", "SEO title", "SEO description"],
    ["Source material", "Social media", "Contact", "Email", "Phone", "Address", "Policies", "Returns", "Shipping", "Headlines", "Phrases", "Notes", "Pages", "Home", "About", "Product", "Collection", "Contact", "Footer"],
  ],
  fr: [
    ["Brand DNA", "Récupérez toute la marque depuis le domaine et validez-la avant utilisation.", "Domaine", "votresite.fr", "Importer le Brand DNA", "Analyse du site…", "Indiquez un domaine.", "Impossible de lire le site. Vérifiez l'adresse.", "Le site n'autorise pas la lecture automatique (robots.txt).", "Seul le contenu public du domaine est utilisé, à titre de référence. Les logos, images et textes appartiennent au propriétaire du domaine – remplacez-les si vous ne les possédez pas."],
    ["{pages} pages analysées · {suggested} suggestions", "Suggestion", "Manquant", "Source incomplète", "Les champs ci-dessous ont été remplis avec des suggestions sectorielles. Complétez-les pour un résultat plus précis.", "Ces champs contiennent des suggestions (secteur ou IA). Vérifiez et ajustez si besoin.", "Appliquer au thème", "Appliqué", "Réimporter", "Supprimer le DNA"],
    ["Identité", "Nom de marque", "Slogan", "Favicon", "Icône d'app", "Image sociale", "Importer un logo", "Aucun logo trouvé", "Logo"],
    ["Couleurs", "Primaire", "Secondaire", "Accent", "Arrière-plan", "Texte", "Bouton"],
    ["Typographie", "Police des titres", "Police du texte", "Taille de base", "Taille des titres", "Interligne", "Graisse des titres", "Titres en majuscules", "Trouvé sur le site"],
    ["Design", "Arrondi", "Rayon des boutons", "Rayon des cartes", "Rayon des images", "Espacement", "Ombre", "Densité", "Compact", "Confortable", "Aéré", "Style de bouton", "Plein", "Contour", "Doux"],
    ["Style d'image", "Style", "Photographie", "Illustration", "3D", "Mixte", "Photos produit", "Photos lifestyle", "Mots-clés"],
    ["Ton & langue", "Langue", "Formalité", "Formel", "Neutre", "Décontracté", "Formel", "Amical", "Luxe", "Jeune", "Minimal", "Ludique"],
    ["Audience", "Secteur", "Description"],
    ["Produits", "Ajouter un produit", "Nom", "Prix", "Supprimer"],
    ["Textes suggérés", "Slogan", "Titre du hero", "Sous-titre du hero", "Bouton principal", "Bouton secondaire", "Bandeau d'annonce", "Titre de collection", "Texte de collection", "Texte produit", "Titre newsletter", "Texte newsletter", "Titre SEO", "Description SEO"],
    ["Source", "Réseaux sociaux", "Contact", "E-mail", "Téléphone", "Adresse", "Politiques", "Retours", "Livraison", "Titres", "Phrases", "Notes", "Pages", "Accueil", "À propos", "Produit", "Collection", "Contact", "Footer"],
  ],
  de: [
    ["Brand DNA", "Die ganze Marke von der Domain laden und vor der Nutzung prüfen.", "Domain", "deinshop.de", "Brand DNA laden", "Website wird analysiert…", "Bitte eine Domain angeben.", "Website konnte nicht gelesen werden. Adresse prüfen.", "Die Website erlaubt kein automatisches Lesen (robots.txt).", "Nur öffentliches Material der Domain wird als Referenz genutzt. Logos, Bilder und Texte gehören dem Domaininhaber – ersetze sie, wenn du sie nicht besitzt."],
    ["{pages} Seiten analysiert · {suggested} Vorschläge", "Vorschlag", "Fehlt", "Unvollständige Grundlage", "Die Felder unten wurden mit Branchenvorschlägen gefüllt. Ergänze sie für ein besseres Ergebnis.", "Diese Felder enthalten Vorschläge (Branche oder KI). Prüfe und passe sie an.", "Im Theme anwenden", "Angewendet", "Neu laden", "DNA entfernen"],
    ["Identität", "Markenname", "Slogan", "Favicon", "App-Icon", "Social-Bild", "Logo hochladen", "Kein Logo gefunden", "Logo"],
    ["Farben", "Primär", "Sekundär", "Akzent", "Hintergrund", "Text", "Button"],
    ["Typografie", "Überschriften-Font", "Text-Font", "Grundgröße", "Überschriftengröße", "Zeilenhöhe", "Überschriftengewicht", "Großbuchstaben", "Auf der Website gefunden"],
    ["Design", "Rundheit", "Button-Radius", "Karten-Radius", "Bild-Radius", "Sektionsabstand", "Schatten", "Dichte", "Kompakt", "Gemütlich", "Luftig", "Button-Stil", "Gefüllt", "Kontur", "Weich"],
    ["Bildstil", "Stil", "Foto", "Illustration", "3D", "Gemischt", "Produktfotos", "Lifestyle-Fotos", "Schlagwörter"],
    ["Ton & Sprache", "Sprache", "Formalität", "Formell", "Neutral", "Locker", "Formell", "Freundlich", "Luxuriös", "Jung", "Minimal", "Verspielt"],
    ["Zielgruppe", "Branche", "Beschreibung"],
    ["Produkte", "Produkt hinzufügen", "Name", "Preis", "Entfernen"],
    ["Textvorschläge", "Slogan", "Hero-Überschrift", "Hero-Unterzeile", "Hero-Button", "Zweiter Button", "Ankündigungsleiste", "Kollektionstitel", "Kollektionstext", "Produkttext", "Newsletter-Titel", "Newsletter-Text", "SEO-Titel", "SEO-Beschreibung"],
    ["Grundlage", "Social Media", "Kontakt", "E-Mail", "Telefon", "Adresse", "Richtlinien", "Rückgabe", "Versand", "Überschriften", "Sätze", "Notizen", "Seiten", "Startseite", "Über uns", "Produkt", "Kollektion", "Kontakt", "Footer"],
  ],
  es: [
    ["Brand DNA", "Obtén toda la marca desde el dominio y revísala antes de usarla.", "Dominio", "tutienda.es", "Importar Brand DNA", "Analizando el sitio…", "Indica un dominio.", "No se pudo leer el sitio. Revisa la dirección.", "El sitio no permite lectura automática (robots.txt).", "Solo se usa material público del dominio, como referencia. Los logos, imágenes y textos pertenecen al propietario del dominio: sustitúyelos si no son tuyos."],
    ["{pages} páginas analizadas · {suggested} sugerencias", "Sugerencia", "Falta", "Base incompleta", "Los campos siguientes se rellenaron con sugerencias del sector. Complétalos para un resultado más preciso.", "Estos campos contienen sugerencias (sector o IA). Revísalos y ajústalos si hace falta.", "Aplicar al tema", "Aplicado", "Volver a cargar", "Eliminar DNA"],
    ["Identidad", "Nombre de marca", "Eslogan", "Favicon", "Icono de app", "Imagen social", "Subir logo", "No se encontró logo", "Logo"],
    ["Colores", "Primario", "Secundario", "Acento", "Fondo", "Texto", "Botón"],
    ["Tipografía", "Fuente de títulos", "Fuente de texto", "Tamaño base", "Tamaño de título", "Interlineado", "Grosor del título", "Mayúsculas", "Encontrado en el sitio"],
    ["Diseño", "Redondez", "Radio de botón", "Radio de tarjeta", "Radio de imagen", "Espaciado", "Sombra", "Densidad", "Compacto", "Cómodo", "Amplio", "Estilo de botón", "Relleno", "Contorno", "Suave"],
    ["Estilo de imagen", "Estilo", "Fotografía", "Ilustración", "3D", "Mixto", "Fotos de producto", "Fotos lifestyle", "Palabras clave"],
    ["Tono e idioma", "Idioma", "Formalidad", "Formal", "Neutral", "Informal", "Formal", "Cercano", "Lujo", "Juvenil", "Minimal", "Divertido"],
    ["Público", "Sector", "Descripción"],
    ["Productos", "Añadir producto", "Nombre", "Precio", "Eliminar"],
    ["Textos sugeridos", "Eslogan", "Titular del hero", "Subtítulo del hero", "Botón principal", "Botón secundario", "Barra de anuncio", "Título de colección", "Texto de colección", "Texto de producto", "Título de newsletter", "Texto de newsletter", "Título SEO", "Descripción SEO"],
    ["Base", "Redes sociales", "Contacto", "Correo", "Teléfono", "Dirección", "Políticas", "Devoluciones", "Envío", "Titulares", "Frases", "Notas", "Páginas", "Inicio", "Nosotros", "Producto", "Colección", "Contacto", "Footer"],
  ],
};

const FLAT_KEYS = GROUPS.flat() as readonly DnaKey[];
const FLAT_VALUES: Record<Locale, string[]> = Object.fromEntries(
  Object.entries(VALUES).map(([locale, groups]) => {
    const flat = groups.flat();
    if (flat.length !== SIZE) throw new Error(`dna.ts: ${locale} har ${flat.length} strängar, förväntade ${SIZE}`);
    return [locale, flat];
  }),
) as Record<Locale, string[]>;

export type DnaStrings = Record<DnaKey, string>;

export function getDnaStrings(locale: Locale): DnaStrings {
  const list = FLAT_VALUES[locale] ?? FLAT_VALUES.en;
  const fallback = FLAT_VALUES.en;
  const out = {} as DnaStrings;
  FLAT_KEYS.forEach((key, index) => {
    out[key] = list[index] ?? fallback[index] ?? key;
  });
  return out;
}

/**
 * Mappar en markerad DNA-sökväg ("missing"/"suggested") till en läsbar etikett,
 * så att editorn kan visa exakt vad som saknas i stället för en siffra.
 */
const FIELD_KEYS: Record<string, DnaKey> = {
  logo: "logo",
  favicon: "favicon",
  appIcon: "appIcon",
  socialImage: "socialImage",
  socials: "socials",
  products: "products",
  headings: "headings",
  "palette.primary": "colPrimary",
  "palette.secondary": "colSecondary",
  "palette.accent": "colAccent",
  "palette.background": "colBackground",
  "palette.text": "colText",
  "palette.button": "colButton",
  "typography.heading": "headingFont",
  "typography.body": "bodyFont",
  "typography.baseSize": "baseSize",
  "design.radius": "radius",
  "design.buttonRadius": "buttonRadius",
  "design.cardRadius": "cardRadius",
  "design.imageRadius": "imageRadius",
  "design.sectionSpacing": "spacing",
  "design.shadow": "shadow",
  "imagery.style": "imageStyle",
  "voice.primary": "voice",
  "audience.industry": "industry",
  "contact.email": "email",
  "contact.phone": "phone",
  "contact.address": "address",
  "policies.returns": "returns",
  "policies.shipping": "shipping",
  "copy.slogan": "copySlogan",
  "copy.heroTitle": "copyHero",
  "copy.heroSubtitle": "copyHeroSub",
  "copy.heroCta": "copyCta",
  "copy.heroSecondary": "copySecondary",
  "copy.announcement": "copyAnnouncement",
  "copy.collectionTitle": "copyCollection",
  "copy.collectionText": "copyCollectionText",
  "copy.productIntro": "copyProduct",
  "copy.newsletterTitle": "copyNewsletter",
  "copy.newsletterText": "copyNewsletterText",
  "copy.seoTitle": "copySeoTitle",
  "copy.seoDescription": "copySeoDesc",
};

export function dnaFieldLabel(path: string, strings: DnaStrings): string {
  const key = FIELD_KEYS[path];
  return key ? strings[key] : path;
}

export const INDUSTRY_LABELS: Record<Locale, Record<BrandIndustry, string>> = {
  sv: { fashion: "Mode", jewelry: "Smycken", beauty: "Skönhet", home: "Hem & inredning", food: "Mat & dryck", kids: "Barn", electronics: "Elektronik", sport: "Sport", pets: "Djur", art: "Konst", flowers: "Blommor", services: "Tjänster", other: "Övrigt" },
  nb: { fashion: "Mote", jewelry: "Smykker", beauty: "Skjønnhet", home: "Hjem & interiør", food: "Mat & drikke", kids: "Barn", electronics: "Elektronikk", sport: "Sport", pets: "Dyr", art: "Kunst", flowers: "Blomster", services: "Tjenester", other: "Annet" },
  fi: { fashion: "Muoti", jewelry: "Korut", beauty: "Kauneus", home: "Koti & sisustus", food: "Ruoka & juoma", kids: "Lapset", electronics: "Elektroniikka", sport: "Urheilu", pets: "Lemmikit", art: "Taide", flowers: "Kukat", services: "Palvelut", other: "Muu" },
  da: { fashion: "Mode", jewelry: "Smykker", beauty: "Skønhed", home: "Hjem & interiør", food: "Mad & drikke", kids: "Børn", electronics: "Elektronik", sport: "Sport", pets: "Kæledyr", art: "Kunst", flowers: "Blomster", services: "Ydelser", other: "Andet" },
  en: { fashion: "Fashion", jewelry: "Jewellery", beauty: "Beauty", home: "Home & interior", food: "Food & drink", kids: "Kids", electronics: "Electronics", sport: "Sport", pets: "Pets", art: "Art", flowers: "Flowers", services: "Services", other: "Other" },
  fr: { fashion: "Mode", jewelry: "Bijoux", beauty: "Beauté", home: "Maison & déco", food: "Alimentation", kids: "Enfants", electronics: "Électronique", sport: "Sport", pets: "Animaux", art: "Art", flowers: "Fleurs", services: "Services", other: "Autre" },
  de: { fashion: "Mode", jewelry: "Schmuck", beauty: "Beauty", home: "Wohnen & Interior", food: "Essen & Trinken", kids: "Kinder", electronics: "Elektronik", sport: "Sport", pets: "Tiere", art: "Kunst", flowers: "Blumen", services: "Dienstleistungen", other: "Sonstiges" },
  es: { fashion: "Moda", jewelry: "Joyería", beauty: "Belleza", home: "Hogar & interior", food: "Comida y bebida", kids: "Niños", electronics: "Electrónica", sport: "Deporte", pets: "Mascotas", art: "Arte", flowers: "Flores", services: "Servicios", other: "Otros" },
};

export function interpolateDna(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => (key in values ? String(values[key]) : `{${key}}`));
}
