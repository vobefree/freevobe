import type { Locale } from "@/lib/theme/types";

export type AgencyStrings = {
  nav: string;
  teaserEyebrow: string;
  teaserTitle: string;
  teaserText: string;
  teaserCta: string;

  heroEyebrow: string;
  heroTitle: string;
  heroAccent: string;
  heroSub: string;
  ctaPrimary: string;
  ctaSecondary: string;
  heroNote: string;
  stat1: string;
  stat2: string;
  stat3: string;

  mockTitle: string;
  mockProject: string;
  mockLibrary: string;
  mockReview: string;
  mockApproved: string;
  mockComment: string;
  mockBrand: string;
  mockTeam: string;
  mockUsage: string;
  mockWhite: string;
  mockStore: string;

  painEyebrow: string;
  painTitle: string;
  painSub: string;
  pain1t: string;
  pain1d: string;
  pain2t: string;
  pain2d: string;
  pain3t: string;
  pain3d: string;

  flowEyebrow: string;
  flowTitle: string;
  flowSub: string;
  flow1t: string;
  flow1d: string;
  flow2t: string;
  flow2d: string;
  flow3t: string;
  flow3d: string;
  flow4t: string;
  flow4d: string;

  featEyebrow: string;
  featTitle: string;
  featSub: string;
  f1t: string;
  f1d: string;
  f2t: string;
  f2d: string;
  f3t: string;
  f3d: string;
  f4t: string;
  f4d: string;
  f5t: string;
  f5d: string;
  f6t: string;
  f6d: string;

  libEyebrow: string;
  libTitle: string;
  libSub: string;
  libTheme: string;
  libSection: string;
  libConversion: string;
  libBrand: string;
  libTokens: string;
  libNone: string;

  reviewEyebrow: string;
  reviewTitle: string;
  reviewSub: string;
  reviewPending: string;
  reviewApproved: string;
  reviewChanges: string;

  aiEyebrow: string;
  aiTitle: string;
  aiSub: string;

  plansEyebrow: string;
  plansTitle: string;
  plansSub: string;
  plansCta: string;

  faqTitle: string;
  faq1q: string;
  faq1a: string;
  faq2q: string;
  faq2a: string;
  faq3q: string;
  faq3a: string;
  faq4q: string;
  faq4a: string;

  finalTitle: string;
  finalSub: string;
  finalCta: string;
  finalFine: string;

  priceEyebrow: string;
  priceTitle: string;
  priceSub: string;
  perMonth: string;
  forWho: string;
  included: string;
  choose: string;
  currentNote: string;
  aiHeading: string;
  aiCopy: string;
  aiImages: string;
  aiFair: string;
  aiFairValue: string;
  fairNote: string;
  compareTitle: string;
  compareSub: string;
  ctaStart: string;
  ctaContact: string;
  priceFaq1q: string;
  priceFaq1a: string;
  priceFaq2q: string;
  priceFaq2a: string;
  priceFaq3q: string;
  priceFaq3a: string;
  back: string;

  wsTitle: string;
  wsSub: string;
  tabOverview: string;
  tabProjects: string;
  tabLibrary: string;
  tabTeam: string;
  tabReviews: string;
  tabSettings: string;
  newProject: string;
  clientLabel: string;
  projectLabel: string;
  shopLabel: string;
  promptLabel: string;
  moodLabel: string;
  createProject: string;
  cancel: string;
  projectLimit: string;
  aiLimit: string;
  emptyProjects: string;
  openStudio: string;
  saveBase: string;
  saved: string;
  applied: string;
  copyLink: string;
  copied: string;
  requestReview: string;
  reviewLocked: string;
  download: string;
  delivered: string;
  delete: string;
  libraryTitle: string;
  librarySub: string;
  libraryEmpty: string;
  saveTheme: string;
  saveBrand: string;
  saveTokens: string;
  saveConversion: string;
  apply: string;
  applyTo: string;
  teamTitle: string;
  teamSub: string;
  email: string;
  name: string;
  role: string;
  invite: string;
  invited: string;
  ownerRole: string;
  adminRole: string;
  designerRole: string;
  reviewerRole: string;
  seats: string;
  reviewsTitle: string;
  reviewsSub: string;
  reviewsEmpty: string;
  reviewOpen: string;
  statusDraft: string;
  statusReview: string;
  statusApproved: string;
  statusChanges: string;
  settingsTitle: string;
  settingsSub: string;
  agencyName: string;
  brandName: string;
  brandColor: string;
  planLabel: string;
  whiteLabel: string;
  whiteLabelHint: string;
  saveSettings: string;
  usageTitle: string;
  usageCopy: string;
  usageImages: string;
  usageOf: string;
  planDemo: string;
  quotaWarning: string;
  commentCount: string;
  clientPreview: string;
};

const en: AgencyStrings = {
  nav: "Agency",
  teaserEyebrow: "Psst. Agency?",
  teaserTitle: "Building themes for other people?",
  teaserText: "Get your own control room: client projects, reusable themes, client review and white-label. Without rebuilding the same hero five times.",
  teaserCta: "Peek at Partner",

  heroEyebrow: "ThemeFold Partner",
  heroTitle: "More clients.",
  heroAccent: "Same calm.",
  heroSub: "A control room for agencies and Shopify partners: client projects, theme library, Brand DNA, review and delivery — without losing design control.",
  ctaPrimary: "Start Partner Starter",
  ctaSecondary: "See pricing & AI limits",
  heroNote: "$99/mo · 3 client projects included · cancel anytime",
  stat1: "client projects",
  stat2: "source of truth",
  stat3: "approval before launch",

  mockTitle: "Agency control room",
  mockProject: "Client projects",
  mockLibrary: "Theme library",
  mockReview: "Client review",
  mockApproved: "Approved",
  mockComment: "“Can we try the warm green?”",
  mockBrand: "Brand DNA",
  mockTeam: "Team",
  mockUsage: "AI this month",
  mockWhite: "White-label",
  mockStore: "Shopify store",

  painEyebrow: "Reality before Partner",
  painTitle: "Five clients. Four tabs. Three versions of the same hero.",
  painSub: "The work is creative. The admin is not. Partner removes the copy-paste between clients.",
  pain1t: "Same base, five times",
  pain1d: "Rebuild the hero, redo the tokens, re-explain the same choices to every new client.",
  pain2t: "Feedback in email and screenshots",
  pain2d: "Comments live in six threads. Nobody knows which version was approved.",
  pain3t: "Whose store is this?",
  pain3d: "Different shops, different logins, and a zip file sent on Friday night.",

  flowEyebrow: "The workflow",
  flowTitle: "From brief to approved theme",
  flowSub: "Four moves. The client stays in the loop, you stay in control.",
  flow1t: "Collect the client",
  flow1d: "Create the project, attach the shop and start from one of your own base themes.",
  flow2t: "Reuse the base",
  flow2d: "Drop in sections, conversion blocks, Brand DNA and tokens. Every reuse is a version.",
  flow3t: "Let the client review",
  flow3d: "Send one link. Comments, changes and approval land in the same place.",
  flow4t: "Deliver the theme",
  flow4d: "Approved means downloadable, installable and ready for the client’s Shopify store.",

  featEyebrow: "Everything in one place",
  featTitle: "Built for the way agencies actually work",
  featSub: "Fewer handoffs. More shipped themes. Same design language across every client.",
  f1t: "Client projects",
  f1d: "A pipeline for every customer, with status, shop, versions and owner.",
  f2t: "Theme library",
  f2d: "Save complete themes, single sections, conversion blocks and tokens as reusable assets.",
  f3t: "Brand DNA & tokens",
  f3d: "One profile per client: colours, type, logo and design tokens. Apply in a click.",
  f4t: "Client review",
  f4d: "Shareable preview links with comments and a clear approve or request-changes step.",
  f5t: "White-label",
  f5d: "Your name, your colour, your link. The client never needs to see the machinery.",
  f6t: "Roles & stores",
  f6d: "Admins, designers and reviewers. Multiple Shopify stores per workspace.",

  libEyebrow: "The library",
  libTitle: "Build once. Reuse every time.",
  libSub: "Your best work becomes the starting point instead of a folder you dig through.",
  libTheme: "Base themes",
  libSection: "Sections",
  libConversion: "Conversion blocks",
  libBrand: "Brand DNA",
  libTokens: "Tokens",
  libNone: "Start from a mood",

  reviewEyebrow: "Client review",
  reviewTitle: "The client says yes. You say shipped.",
  reviewSub: "No more “which file is latest?”. One link, one thread, one decision.",
  reviewPending: "Waiting for client",
  reviewApproved: "Approved",
  reviewChanges: "Changes requested",

  aiEyebrow: "AI with a seatbelt",
  aiTitle: "Generous AI. Clear limits.",
  aiSub: "Agencies generate far more than solo stores. Every plan has a monthly fair-use budget for copy and images, visible in the workspace.",

  plansEyebrow: "Partner plans",
  plansTitle: "Priced for agency reality",
  plansSub: "Start with three clients. Scale to unlimited projects, white-label and API.",
  plansCta: "See all plans and AI limits",

  faqTitle: "Questions agencies ask",
  faq1q: "Can I use my own base themes?",
  faq1a: "Yes. Save any project as a base theme, then start every new client from it. Sections, Brand DNA, tokens and conversion blocks can be reused separately.",
  faq2q: "Does the client need an account?",
  faq2a: "No. The review link is shareable and password-free. The client comments and approves in the browser.",
  faq3q: "Can I white-label the workspace?",
  faq3a: "On Partner Pro and Unlimited the client sees your agency name and colour on the review page, not ThemeFold.",
  faq4q: "What happens if I hit the AI limit?",
  faq4a: "The workspace shows usage all month. When the budget is used, AI actions pause until next month or until you upgrade — nothing else stops working.",

  finalTitle: "Your next ten client themes start here.",
  finalSub: "Bring the base themes you already trust. We’ll handle the handoffs.",
  finalCta: "Open the agency workspace",
  finalFine: "99 USD/mo · 3 projects · 2 seats · cancel anytime",

  priceEyebrow: "Agency & Partner pricing",
  priceTitle: "One workspace. Every client.",
  priceSub: "Partner plans are separate from the solo studio plan and include the agency workspace, library and client review.",
  perMonth: "/month",
  forWho: "For whom",
  included: "Included",
  choose: "Choose plan",
  currentNote: "USD, billed monthly. Prices exclude VAT.",
  aiHeading: "AI fair-use, in plain numbers",
  aiCopy: "AI copy generations / month",
  aiImages: "AI images / month",
  aiFair: "Fair-use",
  aiFairValue: "High, with a fair-use policy",
  fairNote: "AI budgets reset on the first of each month. Unused generations do not roll over.",
  compareTitle: "Compare the details",
  compareSub: "Everything that changes between the three plans.",
  ctaStart: "Start with Partner",
  ctaContact: "Talk to us about Unlimited",
  priceFaq1q: "Can I move between plans?",
  priceFaq1a: "Yes. Upgrades apply immediately, downgrades at the next billing period. Your projects and library stay intact.",
  priceFaq2q: "What counts as an AI generation?",
  priceFaq2a: "One prompt that produces copy or a design direction. Reusing a saved base theme or library item costs nothing.",
  priceFaq3q: "Do you offer Shopify Partner terms?",
  priceFaq3a: "Unlimited includes API access, priority support and terms for partners with a steady client volume. Talk to us.",
  back: "Back to ThemeFold",

  wsTitle: "Agency workspace",
  wsSub: "Client projects, library, team and approvals.",
  tabOverview: "Overview",
  tabProjects: "Projects",
  tabLibrary: "Library",
  tabTeam: "Team",
  tabReviews: "Reviews",
  tabSettings: "Settings",
  newProject: "New client project",
  clientLabel: "Client",
  projectLabel: "Project name",
  shopLabel: "Shopify store",
  promptLabel: "Describe the brand (optional)",
  moodLabel: "Starting mood",
  createProject: "Create project",
  cancel: "Cancel",
  projectLimit: "Project limit reached for this plan.",
  aiLimit: "AI budget for this month is used up.",
  emptyProjects: "No client projects yet. Create the first one.",
  openStudio: "Open studio",
  saveBase: "Save to library",
  saved: "Saved to library",
  applied: "Applied to the project",
  copyLink: "Copy review link",
  copied: "Copied",
  requestReview: "Create review link",
  reviewLocked: "Client review is available on Partner Pro and Unlimited.",
  download: "Download theme",
  delivered: "Delivered",
  delete: "Delete",
  libraryTitle: "Theme library",
  librarySub: "Reusable themes, sections, Brand DNA, tokens and conversion blocks.",
  libraryEmpty: "Empty for now. Save something from a project.",
  saveTheme: "Save as base theme",
  saveBrand: "Save Brand DNA",
  saveTokens: "Save tokens",
  saveConversion: "Save conversion block",
  apply: "Use",
  applyTo: "Apply to project",
  teamTitle: "Team",
  teamSub: "Invite the people who build with you. Roles control what they can do.",
  email: "Email",
  name: "Name",
  role: "Role",
  invite: "Invite",
  invited: "Invited",
  ownerRole: "Owner",
  adminRole: "Admin",
  designerRole: "Designer",
  reviewerRole: "Reviewer",
  seats: "seats used",
  reviewsTitle: "Client reviews",
  reviewsSub: "One link per project. Comments and approval in one place.",
  reviewsEmpty: "No review links yet.",
  reviewOpen: "Open review",
  statusDraft: "Draft",
  statusReview: "In review",
  statusApproved: "Approved",
  statusChanges: "Changes requested",
  settingsTitle: "Agency settings",
  settingsSub: "White-label, plan and AI budget.",
  agencyName: "Agency name",
  brandName: "Client-facing brand",
  brandColor: "Brand colour",
  planLabel: "Plan",
  whiteLabel: "White-label review pages",
  whiteLabelHint: "Requires Partner Pro or Unlimited.",
  saveSettings: "Save settings",
  usageTitle: "AI usage this month",
  usageCopy: "Copy",
  usageImages: "Images",
  usageOf: "of",
  planDemo: "Plan changes are in preview mode until agency billing is connected.",
  quotaWarning: "You are close to the monthly AI budget.",
  commentCount: "comments",
  clientPreview: "Client preview",
};

const sv: AgencyStrings = {
  nav: "Byrå",
  teaserEyebrow: "Psst. Byrå?",
  teaserTitle: "Bygger du teman åt andra?",
  teaserText: "Få ett eget kontrollrum: kundprojekt, återanvändbara teman, kundgranskning och white-label. Utan att bygga samma hero fem gånger.",
  teaserCta: "Kika in på Partner",

  heroEyebrow: "ThemeFold Partner",
  heroTitle: "Fler kunder.",
  heroAccent: "Samma lugn.",
  heroSub: "Ett kontrollrum för byråer och Shopify-partners: kundprojekt, temabibliotek, Brand DNA, granskning och leverans – utan att tappa designkontrollen.",
  ctaPrimary: "Starta Partner Starter",
  ctaSecondary: "Se priser & AI-gränser",
  heroNote: "99 USD/mån · 3 kundprojekt ingår · avbryt när du vill",
  stat1: "kundprojekt",
  stat2: "källa till sanning",
  stat3: "godkännande före lansering",

  mockTitle: "Byråns kontrollrum",
  mockProject: "Kundprojekt",
  mockLibrary: "Temabibliotek",
  mockReview: "Kundgranskning",
  mockApproved: "Godkänt",
  mockComment: "”Kan vi testa den varma gröna?”",
  mockBrand: "Brand DNA",
  mockTeam: "Team",
  mockUsage: "AI denna månad",
  mockWhite: "White-label",
  mockStore: "Shopify-butik",

  painEyebrow: "Verkligheten före Partner",
  painTitle: "Fem kunder. Fyra flikar. Tre versioner av samma hero.",
  painSub: "Arbetet är kreativt. Administrationen är det inte. Partner tar bort kopierandet mellan kunder.",
  pain1t: "Samma bas, fem gånger",
  pain1d: "Bygg om heron, gör om tokens, förklara samma val för varje ny kund.",
  pain2t: "Feedback i mejl och skärmdumpar",
  pain2d: "Kommentarerna ligger i sex trådar. Ingen vet vilken version som blev godkänd.",
  pain3t: "Vems butik är det här?",
  pain3d: "Olika butiker, olika inloggningar och en zip-fil skickad sent på fredag.",

  flowEyebrow: "Arbetsflödet",
  flowTitle: "Från brief till godkänt tema",
  flowSub: "Fyra drag. Kunden är med hela vägen, du behåller kontrollen.",
  flow1t: "Samla kunden",
  flow1d: "Skapa projektet, koppla butiken och utgå från ett av dina egna basteman.",
  flow2t: "Återanvänd basen",
  flow2d: "Släpp in sektioner, konverteringsblock, Brand DNA och tokens. Varje återanvändning blir en version.",
  flow3t: "Låt kunden granska",
  flow3d: "Skicka en länk. Kommentarer, ändringar och godkännande landar på samma ställe.",
  flow4t: "Leverera temat",
  flow4d: "Godkänt betyder nedladdningsbart, installeringsbart och redo för kundens Shopify-butik.",

  featEyebrow: "Allt på ett ställe",
  featTitle: "Byggt för hur byråer faktiskt jobbar",
  featSub: "Färre överlämningar. Fler färdiga teman. Samma designspråk hos varje kund.",
  f1t: "Kundprojekt",
  f1d: "En pipeline för varje kund, med status, butik, versioner och ansvarig.",
  f2t: "Temabibliotek",
  f2d: "Spara hela teman, enskilda sektioner, konverteringsblock och tokens som återanvändbara tillgångar.",
  f3t: "Brand DNA & tokens",
  f3d: "En profil per kund: färger, typografi, logga och designtokens. Applicera med ett klick.",
  f4t: "Kundgranskning",
  f4d: "Delbara preview-länkar med kommentarer och ett tydligt godkänn eller begär ändring.",
  f5t: "White-label",
  f5d: "Ditt namn, din färg, din länk. Kunden behöver aldrig se maskineriet.",
  f6t: "Roller & butiker",
  f6d: "Admins, designers och granskare. Flera Shopify-butiker per arbetsyta.",

  libEyebrow: "Biblioteket",
  libTitle: "Bygg en gång. Återanvänd varje gång.",
  libSub: "Ditt bästa arbete blir startpunkten i stället för en mapp du gräver i.",
  libTheme: "Basteman",
  libSection: "Sektioner",
  libConversion: "Konverteringsblock",
  libBrand: "Brand DNA",
  libTokens: "Tokens",
  libNone: "Utgå från en känsla",

  reviewEyebrow: "Kundgranskning",
  reviewTitle: "Kunden säger ja. Du säger klart.",
  reviewSub: "Slut på ”vilken fil är senast?”. En länk, en tråd, ett beslut.",
  reviewPending: "Väntar på kund",
  reviewApproved: "Godkänt",
  reviewChanges: "Ändringar begärda",

  aiEyebrow: "AI med säkerhetsbälte",
  aiTitle: "Generöst med AI. Tydliga gränser.",
  aiSub: "Byråer genererar mycket mer än enskilda butiker. Varje plan har en månadsbudget för copy och bilder, synlig i arbetsytan.",

  plansEyebrow: "Partnerplaner",
  plansTitle: "Prissatt för byråns verklighet",
  plansSub: "Börja med tre kunder. Skala till obegränsade projekt, white-label och API.",
  plansCta: "Se alla planer och AI-gränser",

  faqTitle: "Frågor byråer ställer",
  faq1q: "Kan jag använda mina egna basteman?",
  faq1a: "Ja. Spara vilket projekt som helst som bastema och starta varje ny kund därifrån. Sektioner, Brand DNA, tokens och konverteringsblock kan återanvändas separat.",
  faq2q: "Behöver kunden ett konto?",
  faq2a: "Nej. Granskningslänken är delbar och lösenordsfri. Kunden kommenterar och godkänner direkt i webbläsaren.",
  faq3q: "Kan jag white-labela arbetsytan?",
  faq3a: "På Partner Pro och Unlimited ser kunden din byrås namn och färg på granskningssidan, inte ThemeFold.",
  faq4q: "Vad händer om jag når AI-gränsen?",
  faq4a: "Arbetsytan visar användningen hela månaden. När budgeten är slut pausas AI-åtgärderna till nästa månad eller till du uppgraderar – allt annat fungerar.",

  finalTitle: "Dina nästa tio kundteman börjar här.",
  finalSub: "Ta med bastemana du redan litar på. Vi tar hand om överlämningarna.",
  finalCta: "Öppna byråarbetsytan",
  finalFine: "99 USD/mån · 3 projekt · 2 platser · avbryt när du vill",

  priceEyebrow: "Priser för byrå & partner",
  priceTitle: "En arbetsyta. Alla kunder.",
  priceSub: "Partnerplanerna är separata från solo-planen och inkluderar byråarbetsyta, bibliotek och kundgranskning.",
  perMonth: "/månad",
  forWho: "För vem",
  included: "Ingår",
  choose: "Välj plan",
  currentNote: "USD, faktureras månadsvis. Priser exklusive moms.",
  aiHeading: "AI fair-use, i klara siffror",
  aiCopy: "AI-copy-genereringar / månad",
  aiImages: "AI-bilder / månad",
  aiFair: "Fair-use",
  aiFairValue: "Hög användning, med fair-use-policy",
  fairNote: "AI-budgeten nollställs den första varje månad. Oanvända genereringar sparas inte.",
  compareTitle: "Jämför detaljerna",
  compareSub: "Allt som skiljer de tre planerna.",
  ctaStart: "Börja med Partner",
  ctaContact: "Prata med oss om Unlimited",
  priceFaq1q: "Kan jag byta plan?",
  priceFaq1a: "Ja. Uppgraderingar gäller direkt, nedgraderingar vid nästa fakturaperiod. Projekt och bibliotek ligger kvar.",
  priceFaq2q: "Vad räknas som en AI-generering?",
  priceFaq2a: "En prompt som ger copy eller en designriktning. Att återanvända ett sparat bastema eller biblioteksobjekt kostar inget.",
  priceFaq3q: "Har ni villkor för Shopify Partners?",
  priceFaq3a: "Unlimited innehåller API, prioriterad support och villkor för partners med jämn kundvolym. Hör av dig.",
  back: "Tillbaka till ThemeFold",

  wsTitle: "Byråarbetsyta",
  wsSub: "Kundprojekt, bibliotek, team och godkännanden.",
  tabOverview: "Översikt",
  tabProjects: "Projekt",
  tabLibrary: "Bibliotek",
  tabTeam: "Team",
  tabReviews: "Granskningar",
  tabSettings: "Inställningar",
  newProject: "Nytt kundprojekt",
  clientLabel: "Kund",
  projectLabel: "Projektnamn",
  shopLabel: "Shopify-butik",
  promptLabel: "Beskriv varumärket (valfritt)",
  moodLabel: "Startkänsla",
  createProject: "Skapa projekt",
  cancel: "Avbryt",
  projectLimit: "Projektgränsen för planen är nådd.",
  aiLimit: "AI-budgeten för månaden är slut.",
  emptyProjects: "Inga kundprojekt ännu. Skapa det första.",
  openStudio: "Öppna studion",
  saveBase: "Spara i biblioteket",
  saved: "Sparat i biblioteket",
  applied: "Applicerat på projektet",
  copyLink: "Kopiera granskningslänk",
  copied: "Kopierad",
  requestReview: "Skapa granskningslänk",
  reviewLocked: "Kundgranskning ingår i Partner Pro och Unlimited.",
  download: "Ladda ner temat",
  delivered: "Levererad",
  delete: "Radera",
  libraryTitle: "Temabibliotek",
  librarySub: "Återanvändbara teman, sektioner, Brand DNA, tokens och konverteringsblock.",
  libraryEmpty: "Tomt än så länge. Spara något från ett projekt.",
  saveTheme: "Spara som bastema",
  saveBrand: "Spara Brand DNA",
  saveTokens: "Spara tokens",
  saveConversion: "Spara konverteringsblock",
  apply: "Använd",
  applyTo: "Applicera på projekt",
  teamTitle: "Team",
  teamSub: "Bjud in de som bygger med dig. Rollerna styr vad de får göra.",
  email: "E-post",
  name: "Namn",
  role: "Roll",
  invite: "Bjud in",
  invited: "Inbjuden",
  ownerRole: "Ägare",
  adminRole: "Admin",
  designerRole: "Designer",
  reviewerRole: "Granskare",
  seats: "platser använda",
  reviewsTitle: "Kundgranskningar",
  reviewsSub: "En länk per projekt. Kommentarer och godkännande på ett ställe.",
  reviewsEmpty: "Inga granskningslänkar ännu.",
  reviewOpen: "Öppna granskning",
  statusDraft: "Utkast",
  statusReview: "Granskas",
  statusApproved: "Godkänt",
  statusChanges: "Ändringar begärda",
  settingsTitle: "Byråinställningar",
  settingsSub: "White-label, plan och AI-budget.",
  agencyName: "Byråns namn",
  brandName: "Kundvänd varumärkesnamn",
  brandColor: "Varumärkesfärg",
  planLabel: "Plan",
  whiteLabel: "White-label på granskningssidor",
  whiteLabelHint: "Kräver Partner Pro eller Unlimited.",
  saveSettings: "Spara inställningar",
  usageTitle: "AI-användning denna månad",
  usageCopy: "Copy",
  usageImages: "Bilder",
  usageOf: "av",
  planDemo: "Planbyten är i förhandsläge tills byråfaktureringen är kopplad.",
  quotaWarning: "Du närmar dig månadens AI-budget.",
  commentCount: "kommentarer",
  clientPreview: "Kundförhandsvisning",
};

const DICTS: Record<Locale, AgencyStrings> = {
  sv,
  en,
  nb: en,
  da: en,
  fi: en,
  fr: en,
  de: en,
  es: en,
};

export function getAgencyStrings(locale: Locale): AgencyStrings {
  return DICTS[locale] ?? en;
}

export function agencyNavLabel(locale: Locale): string {
  return getAgencyStrings(locale).nav;
}
