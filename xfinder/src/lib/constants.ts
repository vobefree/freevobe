/**
 * Svensk vokabulär för hela plattformen. Slugarna (t.ex. "fika") är de som
 * sparas i databasen i arrayer som activities och desired_activities, medan
 * labeln är det användaren ser.
 */

export type Option = { slug: string; label: string };

/** Platoniska aktiviteter som kan bokas. */
export const ACTIVITIES = [
  { slug: "fika", label: "Fika" },
  { slug: "promenad", label: "Promenad" },
  { slug: "lunch", label: "Lunch" },
  { slug: "middag", label: "Middag" },
  { slug: "konsert", label: "Konsert" },
  { slug: "museum", label: "Museum eller utställning" },
  { slug: "bio", label: "Bio" },
  { slug: "spel", label: "Spelkväll" },
  { slug: "traning", label: "Träna tillsammans" },
  { slug: "utomhus", label: "Utomhus: skog, sjö eller skidspår" },
  { slug: "evenemang", label: "Evenemang eller mässa" },
  { slug: "studier", label: "Plugga eller jobba sida vid sida" },
  { slug: "hundpromenad", label: "Hundpromenad" },
  { slug: "marknad", label: "Marknad eller loppis" },
] as const satisfies readonly Option[];

export type ActivitySlug = (typeof ACTIVITIES)[number]["slug"];

export const ACTIVITY_SLUGS = ACTIVITIES.map((a) => a.slug) as string[];

export function activityLabel(slug: string): string {
  return ACTIVITIES.find((a) => a.slug === slug)?.label ?? slug;
}

/** Intressen för matchning och profil. */
export const INTERESTS = [
  { slug: "musik", label: "Musik" },
  { slug: "film", label: "Film och serier" },
  { slug: "bocker", label: "Böcker" },
  { slug: "natur", label: "Natur och friluftsliv" },
  { slug: "sport", label: "Sport" },
  { slug: "konst", label: "Konst och form" },
  { slug: "mat", label: "Mat och bakning" },
  { slug: "teknik", label: "Teknik och programmering" },
  { slug: "spel", label: "Brädspel och spel" },
  { slug: "djur", label: "Djur" },
  { slug: "resor", label: "Resor" },
  { slug: "tradgard", label: "Trädgård" },
  { slug: "hantverk", label: "Hantverk" },
  { slug: "historia", label: "Historia" },
  { slug: "samhalle", label: "Samhälle och samtal" },
] as const satisfies readonly Option[];

export function interestLabel(slug: string): string {
  return INTERESTS.find((i) => i.slug === slug)?.label ?? slug;
}

/** Språk som kompanjörer kan erbjuda. */
export const LANGUAGES = [
  { slug: "sv", label: "Svenska" },
  { slug: "en", label: "Engelska" },
  { slug: "fi", label: "Finska" },
  { slug: "ar", label: "Arabiska" },
  { slug: "fa", label: "Persiska" },
  { slug: "so", label: "Somaliska" },
  { slug: "es", label: "Spanska" },
  { slug: "fr", label: "Franska" },
  { slug: "de", label: "Tyska" },
  { slug: "teckensprak", label: "Teckenspråk" },
] as const satisfies readonly Option[];

export function languageLabel(slug: string): string {
  return LANGUAGES.find((l) => l.slug === slug)?.label ?? slug;
}

/**
 * Komfortnivå 1–5. Används både för att filtrera kompanjörer och för att
 * AI-coachen ska kunna föreslå steg som känns rimliga.
 */
export const COMFORT_LEVELS = [
  { value: 1, label: "Mest skriva", description: "Jag vill helst börja med text och små steg." },
  { value: 2, label: "Kort möte utomhus", description: "En kort promenad eller fika i lugn miljö kan kännas okej." },
  { value: 3, label: "Fika eller lunch", description: "Jag klarar ett möte på en timme i en offentlig miljö." },
  { value: 4, label: "Aktivitet tillsammans", description: "Museum, konsert eller spelkväll känns genomförbart." },
  { value: 5, label: "Hela kvällen", description: "Middag eller evenemang tillsammans känns okej." },
] as const;

export function comfortLabel(value: number): string {
  return COMFORT_LEVELS.find((c) => c.value === value)?.label ?? "Okänd";
}

/** De största städerna, plus fritext så att ingen blir utelåst. */
export const CITIES = [
  "Stockholm", "Göteborg", "Malmö", "Uppsala", "Västerås", "Örebro", "Linköping",
  "Helsingborg", "Jönköping", "Norrköping", "Lund", "Umeå", "Gävle", "Borås",
  "Södertälje", "Eskilstuna", "Halmstad", "Växjö", "Karlstad", "Sundsvall",
  "Östersund", "Trollhättan", "Luleå", "Kalmar", "Falun", "Skövde", "Karlskrona",
  "Kristianstad", "Uddevalla", "Motala", "Visby", "Kiruna",
] as const;

/** AI-coachens övningar. Slugarna matchar enumet ai_exercise i databasen. */
export const AI_EXERCISES = [
  {
    slug: "fritt",
    label: "Fritt samtal",
    description: "Prata om vad som helst och få hjälp att hitta ett litet nästa steg.",
    persona: "coach",
    opening: "Hej! Vad skulle du vilja prata om idag? Vi tar en fråga i taget.",
  },
  {
    slug: "smalltalk",
    label: "Småprat",
    description: "Träna på att hålla en enkel konversation igång utan att det blir prestation.",
    persona: "van",
    opening: "Hej! Jag sitter på en busshållplats och du står bredvid. Jag säger: \"Vilket väder idag, va?\" Vad svarar du?",
  },
  {
    slug: "forsta_mote",
    label: "Första mötet",
    description: "Förbered en första träff med någon du ska fika med.",
    persona: "van",
    opening: "Vi har stämt träff på ett kafé. Jag kom först och vinkar när du kommer in. Vad gör du?",
  },
  {
    slug: "jobb_fest",
    label: "Jobbfest",
    description: "Öva på mingel med kollegor du inte känner så väl.",
    persona: "kollega",
    opening: "Hej! Vi jobbar på samma företag men olika avdelningar. Jag tror inte att vi har pratat förut – vad jobbar du med?",
  },
  {
    slug: "brollop",
    label: "Bröllop",
    description: "Öva på att klara en fest där du inte känner någon.",
    persona: "eventgast",
    opening: "Vilken fin fest! Jag känner bara brudparet, du då? Hur känner du dem?",
  },
  {
    slug: "konflikt",
    label: "Konflikt",
    description: "Träna på att säga ifrån och reda ut en missförståelse.",
    persona: "kollega",
    opening: "Jag hörde att du är irriterad på mig för att jag inte svarade på ditt meddelande. Stämmer det?",
  },
  {
    slug: "granssattning",
    label: "Gränssättning",
    description: "Träna på att tacka nej och sätta gränser utan att bli hård.",
    persona: "van",
    opening: "Kan du inte bara följa med på festen ikväll? Du måste ju inte stanna länge. Snälla?",
  },
] as const;

export type AiExerciseSlug = (typeof AI_EXERCISES)[number]["slug"];

export function exercise(slug: string) {
  return AI_EXERCISES.find((e) => e.slug === slug) ?? AI_EXERCISES[0];
}

/** Roller som AI:n kan spela i ett rollspel. Matchar enumet ai_persona. */
export const AI_PERSONAS = [
  { slug: "coach", label: "Coach" },
  { slug: "van", label: "Vän" },
  { slug: "kollega", label: "Kollega" },
  { slug: "eventgast", label: "Eventgäst" },
] as const;

/** Anmälningskategorier. Matchar enumet report_category i databasen. */
export const REPORT_CATEGORIES = [
  { slug: "sexuell_tjanst", label: "Försök att köpa eller sälja sexuell tjänst" },
  { slug: "romantik_eller_intimitet", label: "Romantik eller fysisk intimitet" },
  { slug: "trakasserier", label: "Trakasserier eller kränkningar" },
  { slug: "no_show", label: "Dök inte upp" },
  { slug: "oroande_beteende", label: "Oroande beteende" },
  { slug: "falsk_profil", label: "Falsk profil eller falska bilder" },
  { slug: "utanfor_plattformen", label: "Ville flytta betalningen utanför plattformen" },
  { slug: "annat", label: "Annat" },
] as const;

export type ReportCategorySlug = (typeof REPORT_CATEGORIES)[number]["slug"];

export const BLOCKING_CATEGORIES: ReportCategorySlug[] = [
  "sexuell_tjanst",
  "romantik_eller_intimitet",
  "trakasserier",
  "oroande_beteende",
  "falsk_profil",
];

/** Säkerhetstexten som alltid visas på bokningssidan och i annonsen. */
export const SAFETY_RULES = [
  "Första träffen sker på en offentlig plats, till exempel ett kafé eller en park.",
  "Berätta för någon var du ska vara och när du räknar med att vara hemma.",
  "Ingen sexuell tjänst, romantik eller fysisk intimitet ingår – aldrig.",
  "Du bestämmer själv över din kropp och dina gränser. Tacka nej när som helst.",
  "All betalning sker här i plattformen. Betala aldrig utanför den.",
  "Skriv till oss direkt om något känns fel – vi stänger av konton som bryter mot reglerna.",
] as const;

/** Positioneringen, ordagrant, på flera ställen i gränssnittet. */
export const POSITIONING = {
  is: "Platoniskt sällskap och social träning",
  isNot: ["Ingen dejtingapp", "Ingen escorttjänst", "Ingen sexuell tjänst"],
  pillar1: {
    title: "Öva med AI",
    description:
      "En social coach som pratar svenska, tar en fråga i taget och hjälper dig hitta ett litet, verkligt nästa steg.",
  },
  pillar2: {
    title: "Hitta kompanjon",
    description:
      "Boka en verifierad person för fika, promenad, konsert eller middag. Tydliga gränser, alltid platoniskt.",
  },
} as const;
