import type { DesignMood } from "@/lib/advanced/design";
import type { Locale } from "@/lib/theme/types";

/**
 * Texter för Advanced-läget. De ligger i en egen modul eftersom läget är
 * valfritt och kan växa utan att röra de åtta grundordböckerna.
 */
export type AdvancedStrings = {
  badge: string;
  modeSwitch: string;
  modeSwitchHint: string;
  themeMode: string;
  advancedMode: string;
  add: {
    title: string;
    text: string;
    heading: string;
    image: string;
    button: string;
    product: string;
    section: string;
    shape: string;
    drawing: string;
    connector: string;
    logo: string;
    nav: string;
    search: string;
    cart: string;
  };
  tools: {
    select: string;
    draw: string;
    connect: string;
    selectHint: string;
    drawHint: string;
    connectHint: string;
    connectFirst: string;
    connectDone: string;
  };
  canvas: {
    title: string;
    pages: string;
    addHeight: string;
    height: string;
    heightHint: string;
    resizeHint: string;
    replaceDefault: string;
    replaceHint: string;
    layers: string;
    empty: string;
    background: string;
    properties: string;
    none: string;
    show: string;
    hide: string;
    lock: string;
    unlock: string;
    group: string;
    ungroup: string;
    magnetsOn: string;
    magnetsOff: string;
    magnetsHint: string;
    zoom: string;
    zoomReset: string;
    panHint: string;
    position: string;
    size: string;
    radius: string;
    rotation: string;
    opacity: string;
    layer: string;
    duplicate: string;
    delete: string;
    front: string;
    back: string;
    reset: string;
  };
  storefront: {
    title: string;
    hint: string;
  };
  chrome: {
    header: string;
    footer: string;
    logo: string;
    links: string;
    announcement: string;
    actionsPosition: string;
    left: string;
    center: string;
    right: string;
    showSearch: string;
    showCart: string;
    sticky: string;
    footerText: string;
    social: string;
    columns: string;
    columnTitle: string;
    columnLinks: string;
    headerHint: string;
    globalTitle: string;
    globalHint: string;
  };
  fields: {
    content: string;
    eyebrow: string;
    title: string;
    text: string;
    cta: string;
    href: string;
    src: string;
    alt: string;
    fit: string;
    color: string;
    fill: string;
    stroke: string;
    strokeWidth: string;
    fontSize: string;
    fontWeight: string;
    align: string;
    letterSpacing: string;
    lineHeight: string;
    product: string;
    preset: string;
    shape: string;
    menu: string;
    menuHint: string;
    cartCount: string;
    storefrontHint: string;
  };
  presets: Record<"hero" | "campaign" | "products" | "features" | "testimonial" | "banner", string>;
  prompt: {
    title: string;
    placeholder: string;
    cta: string;
    hint: string;
    working: string;
    applied: string;
    designApplied: string;
    localCopy: string;
    unclear: string;
    failed: string;
  };
  variants: {
    title: string;
    hint: string;
    apply: string;
    close: string;
    recommended: string;
    moods: Record<DesignMood, string>;
  };
  nano: {
    title: string;
    hint: string;
    placeholder: string;
    cta: string;
    remaining: string;
    local: string;
    added: string;
    notConfigured: string;
    empty: string;
    failed: string;
  };
  row: {
    selected: string;
    products: string;
    align: string;
    free: string;
    aligned: string;
    freeHint: string;
    snapOn: string;
    snapOff: string;
    snapHint: string;
  };
  fx: {
    title: string;
    hint: string;
    hover: string;
    reveal: string;
    hoverOptions: Record<"none" | "lift" | "grow" | "glow" | "dim" | "underline" | "tilt", string>;
    revealOptions: Record<"none" | "fade-up" | "zoom" | "slide-left" | "slide-right", string>;
  };
  canva: {
    title: string;
    hint: string;
    urlPlaceholder: string;
    add: string;
    export: string;
    copied: string;
    open: string;
    empty: string;
    added: string;
  };
  newThemeHint: string;
};

const en: AdvancedStrings = {
  badge: "Advanced",
  modeSwitch: "Builder",
  modeSwitchHint: "Keep the theme-driven builder, or open the free canvas. You can switch back at any time.",
  themeMode: "Theme-driven",
  advancedMode: "Advanced",
  add: {
    title: "Add element",
    text: "Text",
    heading: "Heading",
    image: "Image",
    button: "Button",
    product: "Product",
    section: "Section",
    shape: "Shape",
    drawing: "Draw",
    connector: "Connect",
    logo: "Logo",
    nav: "Menu",
    search: "Search",
    cart: "Cart",
  },
  tools: {
    select: "Select",
    draw: "Draw",
    connect: "Connect",
    selectHint: "Drag to move · Shift-click to select several and line them up · hold Alt for free placement",
    drawHint: "Draw freehand on the canvas. Release to finish.",
    connectHint: "Click the first element, then the second.",
    connectFirst: "Now click the element to connect to.",
    connectDone: "Elements connected.",
  },
  canvas: {
    title: "Canvas",
    pages: "Pages",
    addHeight: "Add height",
    height: "Page height",
    heightHint: "The page grows downwards. Drag the bottom edge to make the page longer, or drop elements below the edge.",
    resizeHint: "Drag to make the page longer",
    replaceDefault: "Replace the standard page",
    replaceHint: "On subpages the canvas is placed above the standard page. Turn this on to let the free canvas be the whole page.",
    layers: "Layers",
    empty: "The canvas is empty. Add an element or ask AI to build a section.",
    background: "Background",
    properties: "Properties",
    none: "Select an element on the canvas.",
    show: "Show",
    hide: "Hide",
    lock: "Lock",
    unlock: "Unlock",
    group: "Group",
    ungroup: "Ungroup",
    magnetsOn: "Magnets on",
    magnetsOff: "Magnets off",
    magnetsHint: "Snaps edges and centres to nearby elements. Hold Alt for free placement.",
    zoom: "Zoom",
    zoomReset: "Reset zoom to 100%",
    panHint: "Hold Space or the middle mouse button to pan the canvas.",
    position: "Position",
    size: "Size",
    radius: "Corner radius",
    rotation: "Rotation",
    opacity: "Opacity",
    layer: "Layer",
    duplicate: "Duplicate",
    delete: "Delete",
    front: "Bring forward",
    back: "Send backward",
    reset: "Reset position",
  },
  storefront: {
    title: "Storefront",
    hint: "Logo, menu, search and cart become real Shopify links (routes, menus and cart count). Drag and resize them anywhere, on any page.",
  },
  chrome: {
    header: "Header",
    footer: "Footer",
    logo: "Logo text",
    links: "Menu links (one per line)",
    announcement: "Announcement bar",
    actionsPosition: "Search & cart position",
    left: "Left",
    center: "Center",
    right: "Right",
    showSearch: "Show search",
    showCart: "Show cart",
    sticky: "Sticky header",
    footerText: "Footer text",
    social: "Social links (one per line)",
    columns: "Footer columns",
    columnTitle: "Column title",
    columnLinks: "Links (one per line)",
    headerHint: "Edit the logo, menu and announcement here. Move search and cart with the placement below.",
    globalTitle: "Header & cart",
    globalHint: "This layer replaces the standard header and lies over every page. Drag the logo, menu, search and cart exactly where you want them. Leave it empty to keep the normal header.",
  },
  fields: {
    content: "Content",
    eyebrow: "Eyebrow",
    title: "Title",
    text: "Text",
    cta: "Button label",
    href: "Link",
    src: "Image URL",
    alt: "Alt text",
    fit: "Fit",
    color: "Text colour",
    fill: "Fill",
    stroke: "Stroke",
    strokeWidth: "Stroke width",
    fontSize: "Font size",
    fontWeight: "Weight",
    align: "Alignment",
    letterSpacing: "Letter spacing",
    lineHeight: "Line height",
    product: "Product",
    preset: "Section type",
    shape: "Shape",
    menu: "Shopify menu",
    menuHint: "Links come from the Shopify menu with this handle. Edit the menu under Navigation in Shopify.",
    cartCount: "Cart badge",
    storefrontHint: "The cart links to routes.cart_url and shows cart.item_count. Search links to routes.search_url.",
  },
  presets: {
    hero: "Hero",
    campaign: "Campaign",
    products: "Products",
    features: "Features",
    testimonial: "Testimonial",
    banner: "Banner",
  },
  prompt: {
    title: "AI section",
    placeholder: "Make the page feel more premium… or describe a section",
    cta: "Build with AI",
    hint: "Describe a style (“make the page more premium”, “more air”) or content (“a Black Friday hero”). A style instruction restyles the canvas — it never adds text.",
    working: "Building…",
    applied: "The section was rebuilt.",
    designApplied: "The canvas was restyled — nothing was added as text.",
    localCopy: "No free AI answered — the built-in engine wrote the copy. Check Admin → Keys to see which free providers are active.",
    unclear: "Describe a style, or what the section should say.",
    failed: "The prompt could not be applied.",
  },
  variants: {
    title: "Three variants",
    hint: "Same content, three styles. Nothing changes until you choose.",
    apply: "Use",
    close: "Cancel",
    recommended: "Closest to your prompt",
    moods: {
      premium: "Premium",
      modern: "Modern",
      minimal: "Minimal",
      warm: "Warm",
      bold: "Bold",
      playful: "Playful",
      editorial: "Editorial",
      tech: "Technical",
      airy: "Airy",
      compact: "Compact",
      dark: "Dark",
    },
  },
  nano: {
    title: "Image generator · free",
    hint: "Creates a unique graphic in your brand colours locally — no API key, no cost, works offline.",
    placeholder: "A warm product scene on a linen table…",
    cta: "Generate image",
    remaining: "Unlimited images on the free plan",
    local: "A graphic in your brand colours was added to the canvas.",
    added: "Image added to the canvas.",
    notConfigured: "No key needed — images are generated locally.",
    empty: "The prompt is too short.",
    failed: "The image could not be generated.",
  },
  row: {
    selected: "{count} selected",
    products: "{count} products on this page",
    align: "Line up in a row",
    free: "Free placement",
    aligned: "The elements now share one row with equal spacing.",
    freeHint: "Free placement is on – row guides are off. Turn them back on in the toolbar whenever you want.",
    snapOn: "Row guide on",
    snapOff: "Row guide off",
    snapHint: "When a product is dragged near another, the tops snap to the same row. Hold Alt to place freely.",
  },
  fx: {
    title: "Interaction",
    hint: "Pure CSS effects that follow into the export. The entrance plays when the page loads.",
    hover: "Hover",
    reveal: "Entrance",
    hoverOptions: {
      none: "None",
      lift: "Lift",
      grow: "Grow",
      glow: "Glow",
      dim: "Dim",
      underline: "Underline",
      tilt: "Tilt",
    },
    revealOptions: {
      none: "None",
      "fade-up": "Fade up",
      zoom: "Zoom in",
      "slide-left": "Slide from left",
      "slide-right": "Slide from right",
    },
  },
  canva: {
    title: "Canva",
    hint: "Import an image from Canva, or copy a brand brief to create matching artwork.",
    urlPlaceholder: "https://… image or Canva export",
    add: "Add image",
    export: "Copy Canva brief",
    copied: "Canva brief copied.",
    open: "Open Canva",
    empty: "No saved Canva designs yet. Add them under Integrations → Canva.",
    added: "Image added from Canva.",
  },
  newThemeHint: "Choose theme-driven for the fastest result, or Advanced for a free canvas. You can switch later.",
};

const sv: AdvancedStrings = {
  ...en,
  badge: "Advanced",
  modeSwitch: "Byggläge",
  modeSwitchHint: "Behåll det temastyrda bygget eller öppna den fria canvasen. Du kan byta tillbaka när som helst.",
  themeMode: "Tema-styrd",
  advancedMode: "Advanced",
  add: {
    title: "Lägg till element",
    text: "Text",
    heading: "Rubrik",
    image: "Bild",
    button: "Knapp",
    product: "Produkt",
    section: "Sektion",
    shape: "Form",
    drawing: "Rita",
    connector: "Koppla",
    logo: "Logotyp",
    nav: "Meny",
    search: "Sök",
    cart: "Varukorg",
  },
  tools: {
    select: "Markera",
    draw: "Rita",
    connect: "Koppla",
    selectHint: "Dra för att flytta · Shift-klicka för att markera flera och lägga dem på rad · håll Alt för fri placering",
    drawHint: "Rita fritt på canvasen. Släpp för att avsluta.",
    connectHint: "Klicka på första elementet och sedan på det andra.",
    connectFirst: "Klicka nu på elementet du vill koppla till.",
    connectDone: "Elementen är kopplade.",
  },
  canvas: {
    title: "Canvas",
    pages: "Sidor",
    addHeight: "Lägg till höjd",
    height: "Sidhöjd",
    heightHint: "Sidan växer nedåt. Dra i nederkanten för att göra sidan längre, eller släpp element nedanför kanten.",
    resizeHint: "Dra för att göra sidan längre",
    replaceDefault: "Ersätt standardsidan",
    replaceHint: "På undersidor läggs canvasen ovanför standardsidan. Slå på detta för att låta den fria ytan vara hela sidan.",
    layers: "Lager",
    empty: "Canvasen är tom. Lägg till ett element eller låt AI bygga en sektion.",
    background: "Bakgrund",
    properties: "Egenskaper",
    none: "Markera ett element på canvasen.",
    show: "Visa",
    hide: "Dölj",
    lock: "Lås",
    unlock: "Lås upp",
    group: "Gruppera",
    ungroup: "Dela upp grupp",
    magnetsOn: "Magneter på",
    magnetsOff: "Magneter av",
    magnetsHint: "Snappar kanter och mittpunkter mot närliggande element. Håll Alt för fri placering.",
    zoom: "Zoom",
    zoomReset: "Återställ zoom till 100 %",
    panHint: "Håll Space eller mittenmusknappen för att panorera canvasen.",
    position: "Position",
    size: "Storlek",
    radius: "Rundning",
    rotation: "Rotation",
    opacity: "Opacitet",
    layer: "Lager",
    duplicate: "Duplicera",
    delete: "Radera",
    front: "Flytta fram",
    back: "Flytta bak",
    reset: "Återställ position",
  },
  storefront: {
    title: "Butiksdelar",
    hint: "Logotyp, meny, sök och varukorg blir riktiga Shopify-länkar (routes, menyer och antal i varukorgen). Dra och ändra storlek fritt, på vilken sida som helst.",
  },
  chrome: {
    header: "Header",
    footer: "Footer",
    logo: "Logotypstext",
    links: "Menylänkar (en per rad)",
    announcement: "Kampanjrad",
    actionsPosition: "Sök & varukorgens placering",
    left: "Vänster",
    center: "Mitten",
    right: "Höger",
    showSearch: "Visa sök",
    showCart: "Visa varukorg",
    sticky: "Fäst header",
    footerText: "Footertext",
    social: "Sociala länkar (en per rad)",
    columns: "Footer-kolumner",
    columnTitle: "Kolumnrubrik",
    columnLinks: "Länkar (en per rad)",
    headerHint: "Redigera logotyp, meny och kampanjrad här. Flytta sök och varukorg med placeringen nedan.",
    globalTitle: "Sidhuvud & varukorg",
    globalHint: "Det här lagret ersätter den vanliga headern och ligger över alla sidor. Dra logotyp, meny, sök och varukorg exakt dit du vill. Lämna det tomt för att behålla den vanliga headern.",
  },
  fields: {
    content: "Innehåll",
    eyebrow: "Överrad",
    title: "Rubrik",
    text: "Text",
    cta: "Knapptext",
    href: "Länk",
    src: "Bildadress",
    alt: "Alternativ text",
    fit: "Anpassning",
    color: "Textfärg",
    fill: "Fyllning",
    stroke: "Kontur",
    strokeWidth: "Konturtjocklek",
    fontSize: "Textstorlek",
    fontWeight: "Vikt",
    align: "Justering",
    letterSpacing: "Teckenavstånd",
    lineHeight: "Radhöjd",
    product: "Produkt",
    preset: "Sektionstyp",
    shape: "Form",
    menu: "Shopify-meny",
    menuHint: "Länkarna hämtas från Shopify-menyn med detta handtag. Menyns innehåll redigeras i Shopify under Navigering.",
    cartCount: "Räknarens färg",
    storefrontHint: "Varukorgen länkar till routes.cart_url och visar cart.item_count. Sök länkar till routes.search_url.",
  },
  presets: {
    hero: "Hero",
    campaign: "Kampanj",
    products: "Produkter",
    features: "Fördelar",
    testimonial: "Omdöme",
    banner: "Banner",
  },
  prompt: {
    title: "AI-sektion",
    placeholder: "Gör sidan mer premium… eller beskriv en sektion",
    cta: "Bygg med AI",
    hint: "Beskriv en stil (”gör sidan mer premium”, ”mer luft”) eller innehåll (”en Black Friday-hero”). En stilinstruktion bygger om ytan – den lägger aldrig till text.",
    working: "Bygger…",
    applied: "Sektionen är ombyggd.",
    designApplied: "Ytan byggdes om – ingen text lades till.",
    localCopy: "Ingen gratis AI svarade – den inbyggda motorn skrev texten. Se Admin → Nycklar för vilka gratistjänster som är aktiva.",
    unclear: "Beskriv en stil, eller vad sektionen ska säga.",
    failed: "Prompten kunde inte användas.",
  },
  variants: {
    title: "Tre varianter",
    hint: "Samma innehåll, tre stilar. Inget ändras förrän du väljer.",
    apply: "Använd",
    close: "Avbryt",
    recommended: "Närmast din prompt",
    moods: {
      premium: "Premium",
      modern: "Modern",
      minimal: "Minimal",
      warm: "Varm",
      bold: "Djärv",
      playful: "Lekfull",
      editorial: "Redaktionell",
      tech: "Teknisk",
      airy: "Luftig",
      compact: "Kompakt",
      dark: "Mörk",
    },
  },
  nano: {
    title: "Bildgenerator · gratis",
    hint: "Skapar en unik bild i varumärkets färger lokalt – ingen API-nyckel, ingen kostnad och fungerar offline.",
    placeholder: "En varm produktbild på ett linnesbord…",
    cta: "Skapa bild",
    remaining: "Obegränsat antal bilder på gratispieln",
    local: "En bild i varumärkets färger lades till på canvasen.",
    added: "Bilden lades till på canvasen.",
    notConfigured: "Ingen nyckel behövs – bilden skapas lokalt.",
    empty: "Prompten är för kort.",
    failed: "Bilden kunde inte skapas.",
  },
  row: {
    selected: "{count} markerade",
    products: "{count} produkter på sidan",
    align: "Lägg på rad",
    free: "Fri placering",
    aligned: "Elementen ligger nu på samma rad med jämna mellanrum.",
    freeHint: "Fri placering är på – radhjälpen är avstängd. Slå på den igen i verktygsraden när du vill.",
    snapOn: "Radhjälp på",
    snapOff: "Radhjälp av",
    snapHint: "När en produkt dras nära en annan snappar överkanterna till samma rad. Håll Alt för fri placering.",
  },
  fx: {
    title: "Interaktion",
    hint: "Effekterna är ren CSS och följer med i exporten. Entréeffekten spelas upp när sidan laddas.",
    hover: "Hover",
    reveal: "Entré",
    hoverOptions: {
      none: "Ingen",
      lift: "Lyft",
      grow: "Väx",
      glow: "Glöd",
      dim: "Dämpa",
      underline: "Understrykning",
      tilt: "Lutning",
    },
    revealOptions: {
      none: "Ingen",
      "fade-up": "Tona in uppåt",
      zoom: "Zooma in",
      "slide-left": "Glid från vänster",
      "slide-right": "Glid från höger",
    },
  },
  canva: {
    title: "Canva",
    hint: "Importera en bild från Canva eller kopiera en varumärkesbrief för att skapa matchande grafik.",
    urlPlaceholder: "https://… bild eller Canva-export",
    add: "Lägg till bild",
    export: "Kopiera Canva-brief",
    copied: "Canva-briefen kopierades.",
    open: "Öppna Canva",
    empty: "Inga sparade Canva-designer än. Lägg till dem under Integrationer → Canva.",
    added: "Bilden lades till från Canva.",
  },
  newThemeHint: "Välj Tema-styrd för snabbaste resultat eller Advanced för en fri canvas. Du kan byta senare.",
};

const nb: AdvancedStrings = {
  ...en,
  modeSwitch: "Byggemåte",
  modeSwitchHint: "Behold det temastyrte bygget, eller åpne det frie lerretet. Du kan bytte tilbake når som helst.",
  themeMode: "Temastyrt",
  advancedMode: "Advanced",
  add: { ...en.add, title: "Legg til element", text: "Tekst", heading: "Overskrift", image: "Bilde", button: "Knapp", product: "Produkt", section: "Seksjon", shape: "Form", drawing: "Tegn", connector: "Koble" },
  tools: { ...en.tools, select: "Velg", draw: "Tegn", connect: "Koble", selectHint: "Dra for å flytte · dra i et håndtak for størrelse · dobbeltklikk for å skrive", drawHint: "Tegn fritt på lerretet. Slipp for å avslutte.", connectHint: "Klikk på det første elementet, deretter det andre.", connectFirst: "Klikk på elementet du vil koble til.", connectDone: "Elementene er koblet." },
  canvas: { ...en.canvas, title: "Lerret", layers: "Lag", empty: "Lerretet er tomt. Legg til et element eller la AI bygge en seksjon.", background: "Bakgrunn", properties: "Egenskaper", none: "Velg et element på lerretet." },
  prompt: { ...en.prompt, title: "AI-seksjon", placeholder: "Gjør denne seksjonen til en Black Friday-kampanje…", cta: "Bygg med AI", working: "Bygger…", applied: "Seksjonen er bygget på nytt." },
  nano: { ...en.nano, title: "Bildegenerator · gratis", cta: "Lag bilde", added: "Bildet ble lagt til på lerretet." },
  canva: { ...en.canva, title: "Canva", add: "Legg til bilde", export: "Kopier Canva-brief", copied: "Canva-briefen ble kopiert.", open: "Åpne Canva" },
  newThemeHint: "Velg Temastyrt for raskeste resultat eller Advanced for et fritt lerret. Du kan bytte senere.",
};

const da: AdvancedStrings = {
  ...en,
  modeSwitch: "Byggemetode",
  modeSwitchHint: "Behold det temastyrede byggeri, eller åbn det frie lærred. Du kan skifte tilbage når som helst.",
  themeMode: "Temastyret",
  advancedMode: "Advanced",
  add: { ...en.add, title: "Tilføj element", text: "Tekst", heading: "Overskrift", image: "Billede", button: "Knap", product: "Produkt", section: "Sektion", shape: "Form", drawing: "Tegn", connector: "Forbind" },
  tools: { ...en.tools, select: "Vælg", draw: "Tegn", connect: "Forbind", selectHint: "Træk for at flytte · træk i et håndtag for størrelse · dobbeltklik for at skrive", drawHint: "Tegn frit på lærredet. Slip for at afslutte.", connectHint: "Klik på det første element og derefter det andet.", connectFirst: "Klik nu på elementet, du vil forbinde til.", connectDone: "Elementerne er forbundet." },
  canvas: { ...en.canvas, title: "Lærred", layers: "Lag", empty: "Lærredet er tomt. Tilføj et element, eller lad AI bygge en sektion.", background: "Baggrund", properties: "Egenskaber", none: "Vælg et element på lærredet." },
  prompt: { ...en.prompt, title: "AI-sektion", placeholder: "Gør denne sektion til en Black Friday-kampagne…", cta: "Byg med AI", working: "Bygger…", applied: "Sektionen er genopbygget." },
  nano: { ...en.nano, title: "Billedgenerator · gratis", cta: "Skab billede", added: "Billedet blev tilføjet til lærredet." },
  canva: { ...en.canva, add: "Tilføj billede", export: "Kopiér Canva-brief", copied: "Canva-briefen er kopieret.", open: "Åbn Canva" },
  newThemeHint: "Vælg Temastyret for det hurtigste resultat eller Advanced for et frit lærred. Du kan skifte senere.",
};

const fi: AdvancedStrings = {
  ...en,
  modeSwitch: "Rakennustapa",
  modeSwitchHint: "Pidä teemapohjainen rakentaja tai avaa vapaa kanvaasi. Voit vaihtaa takaisin milloin tahansa.",
  themeMode: "Teemapohjainen",
  advancedMode: "Advanced",
  add: { ...en.add, title: "Lisää elementti", text: "Teksti", heading: "Otsikko", image: "Kuva", button: "Painike", product: "Tuote", section: "Osio", shape: "Muoto", drawing: "Piirrä", connector: "Yhdistä" },
  tools: { ...en.tools, select: "Valitse", draw: "Piirrä", connect: "Yhdistä", selectHint: "Vedä siirtääksesi · vedä kahvasta koon muuttamiseen · kaksoisklikkaa kirjoittaaksesi", drawHint: "Piirrä vapaasti kanvaasille. Vapauta lopettaaksesi.", connectHint: "Napsauta ensin ensimmäistä elementtiä ja sitten toista.", connectFirst: "Napsauta nyt elementtiä, johon haluat yhdistää.", connectDone: "Elementit yhdistetty." },
  canvas: { ...en.canvas, title: "Kanvaasi", layers: "Tasot", empty: "Kanvaasi on tyhjä. Lisää elementti tai anna AI:n rakentaa osio.", background: "Tausta", properties: "Ominaisuudet", none: "Valitse elementti kanvaasilta." },
  prompt: { ...en.prompt, title: "AI-osio", placeholder: "Tee tästä osiosta Black Friday -kampanja…", cta: "Rakenna AI:lla", working: "Rakennetaan…", applied: "Osio on rakennettu uudelleen." },
  nano: { ...en.nano, title: "Kuvageneraattori · ilmainen", cta: "Luo kuva", added: "Kuva lisättiin kanvaasille." },
  canva: { ...en.canva, add: "Lisää kuva", export: "Kopioi Canva-brief", copied: "Canva-brief kopioitu.", open: "Avaa Canva" },
  newThemeHint: "Valitse teemapohjainen nopeimpaan tulokseen tai Advanced vapaaseen kanvaasiin. Voit vaihtaa myöhemmin.",
};

const fr: AdvancedStrings = {
  ...en,
  modeSwitch: "Mode de création",
  modeSwitchHint: "Gardez le constructeur guidé par le thème ou ouvrez le canevas libre. Vous pouvez revenir à tout moment.",
  themeMode: "Guidé par le thème",
  advancedMode: "Advanced",
  add: { ...en.add, title: "Ajouter un élément", text: "Texte", heading: "Titre", image: "Image", button: "Bouton", product: "Produit", section: "Section", shape: "Forme", drawing: "Dessiner", connector: "Relier" },
  tools: { ...en.tools, select: "Sélectionner", draw: "Dessiner", connect: "Relier", selectHint: "Glissez pour déplacer · tirez une poignée pour redimensionner · double-cliquez pour écrire", drawHint: "Dessinez à main levée. Relâchez pour terminer.", connectHint: "Cliquez sur le premier élément, puis sur le second.", connectFirst: "Cliquez maintenant sur l'élément à relier.", connectDone: "Éléments reliés." },
  canvas: { ...en.canvas, title: "Canevas", layers: "Calques", empty: "Le canevas est vide. Ajoutez un élément ou laissez l'IA créer une section.", background: "Fond", properties: "Propriétés", none: "Sélectionnez un élément sur le canevas." },
  prompt: { ...en.prompt, title: "Section IA", placeholder: "Transformez cette section en campagne Black Friday…", cta: "Créer avec l'IA", working: "Création…", applied: "La section a été reconstruite." },
  nano: { ...en.nano, title: "Générateur d'images · gratuit", cta: "Générer l'image", added: "Image ajoutée au canevas." },
  canva: { ...en.canva, add: "Ajouter l'image", export: "Copier le brief Canva", copied: "Brief Canva copié.", open: "Ouvrir Canva" },
  newThemeHint: "Choisissez Guidé par le thème pour aller vite, ou Advanced pour un canevas libre. Vous pourrez changer plus tard.",
};

const de: AdvancedStrings = {
  ...en,
  modeSwitch: "Baumodus",
  modeSwitchHint: "Behalte den theme-gesteuerten Builder oder öffne die freie Leinwand. Du kannst jederzeit zurückwechseln.",
  themeMode: "Theme-gesteuert",
  advancedMode: "Advanced",
  add: { ...en.add, title: "Element hinzufügen", text: "Text", heading: "Überschrift", image: "Bild", button: "Button", product: "Produkt", section: "Sektion", shape: "Form", drawing: "Zeichnen", connector: "Verbinden" },
  tools: { ...en.tools, select: "Auswählen", draw: "Zeichnen", connect: "Verbinden", selectHint: "Ziehen zum Verschieben · Griff ziehen zum Größe ändern · Doppelklick zum Tippen", drawHint: "Zeichne frei auf der Leinwand. Loslassen zum Beenden.", connectHint: "Klicke zuerst auf das erste Element, dann auf das zweite.", connectFirst: "Klicke jetzt auf das Element, mit dem du verbinden willst.", connectDone: "Elemente verbunden." },
  canvas: { ...en.canvas, title: "Leinwand", layers: "Ebenen", empty: "Die Leinwand ist leer. Füge ein Element hinzu oder lass die KI eine Sektion bauen.", background: "Hintergrund", properties: "Eigenschaften", none: "Wähle ein Element auf der Leinwand." },
  prompt: { ...en.prompt, title: "KI-Sektion", placeholder: "Mach diese Sektion zu einer Black-Friday-Kampagne…", cta: "Mit KI bauen", working: "Baue…", applied: "Die Sektion wurde neu gebaut." },
  nano: { ...en.nano, title: "Bildgenerator · kostenlos", cta: "Bild erzeugen", added: "Bild zur Leinwand hinzugefügt." },
  canva: { ...en.canva, add: "Bild hinzufügen", export: "Canva-Brief kopieren", copied: "Canva-Brief kopiert.", open: "Canva öffnen" },
  newThemeHint: "Wähle Theme-gesteuert für das schnellste Ergebnis oder Advanced für eine freie Leinwand. Du kannst später wechseln.",
};

const es: AdvancedStrings = {
  ...en,
  modeSwitch: "Modo de creación",
  modeSwitchHint: "Mantén el constructor guiado por el tema o abre el lienzo libre. Puedes volver cuando quieras.",
  themeMode: "Guiado por el tema",
  advancedMode: "Advanced",
  add: { ...en.add, title: "Añadir elemento", text: "Texto", heading: "Título", image: "Imagen", button: "Botón", product: "Producto", section: "Sección", shape: "Forma", drawing: "Dibujar", connector: "Conectar" },
  tools: { ...en.tools, select: "Seleccionar", draw: "Dibujar", connect: "Conectar", selectHint: "Arrastra para mover · tira de un tirador para redimensionar · doble clic para escribir", drawHint: "Dibuja a mano alzada. Suelta para terminar.", connectHint: "Haz clic en el primer elemento y luego en el segundo.", connectFirst: "Ahora haz clic en el elemento al que quieres conectar.", connectDone: "Elementos conectados." },
  canvas: { ...en.canvas, title: "Lienzo", layers: "Capas", empty: "El lienzo está vacío. Añade un elemento o deja que la IA cree una sección.", background: "Fondo", properties: "Propiedades", none: "Selecciona un elemento del lienzo." },
  prompt: { ...en.prompt, title: "Sección IA", placeholder: "Convierte esta sección en una campaña de Black Friday…", cta: "Crear con IA", working: "Creando…", applied: "La sección se ha reconstruido." },
  nano: { ...en.nano, title: "Generador de imágenes · gratis", cta: "Generar imagen", added: "Imagen añadida al lienzo." },
  canva: { ...en.canva, add: "Añadir imagen", export: "Copiar brief de Canva", copied: "Brief de Canva copiado.", open: "Abrir Canva" },
  newThemeHint: "Elige Guiado por el tema para el resultado más rápido o Advanced para un lienzo libre. Puedes cambiar después.",
};

const STRINGS: Record<Locale, AdvancedStrings> = { sv, nb, fi, da, en, fr, de, es };

export function getAdvanced(locale: Locale): AdvancedStrings {
  return STRINGS[locale] ?? en;
}
