/**
 * Freevobe Gives Back – den frivilliga välgörenhetsplatsen.
 *
 * Reklamplatsen är borta. I stället kan appen, om användaren själv väljer det, visa en liten
 * påminnelse om att stötta ett välgörenhetsändamål. Tre saker gäller alltid:
 *
 *  1. Platsen är frivillig och av som standard. Den slås på i onboarding eller i inställningarna.
 *  2. Inga pengar går genom Freevobe. Appen har ingen betalningsfunktion, inget konto och ingen
 *     koppling till organisationernas system. Länken öppnar organisationens egen sida.
 *  3. Ingen data om dig eller ditt projekt lämnar datorn. Det användaren själv registrerar
 *     ("jag gav") sparas bara lokalt och är alltid märkt som egen rapportering.
 *
 * Katalogen nedan är redaktionell. Länkarna pekar medvetet på organisationernas startsidor i
 * stället för på djuplänkar till kassor, så att en ändrad betalningsväg inte blir en trasig länk.
 */

export type GivesBackFocus = 'health' | 'children' | 'climate' | 'knowledge' | 'livelihoods';

export interface GivesBackCause {
  id: string;
  name: string;
  /** En rad i platsen i chatten. */
  tagline: string;
  /** Längre beskrivning i panelen. */
  description: string;
  /** Organisationens egen sida. Appen öppnar den i webbläsaren – den tar aldrig emot pengar. */
  url: string;
  focus: GivesBackFocus;
  /** När länken och beskrivningen senast granskades av en människa. */
  verifiedAt: string;
}

export const GIVES_BACK_CAUSES: readonly GivesBackCause[] = [
  {
    id: 'lakare-utan-granser',
    name: 'Läkare Utan Gränser',
    tagline: 'Sjukvård där behovet är störst, oavsett var du föds.',
    description:
      'Medicinsk hjälp i krig, katastrofer och områden utan fungerande sjukvård. Oberoende av stater och parter i konflikter.',
    url: 'https://lakareutangranser.se',
    focus: 'health',
    verifiedAt: '2026-10-29',
  },
  {
    id: 'radda-barnen',
    name: 'Rädda Barnen',
    tagline: 'Barns rätt till skydd, skola och en trygg uppväxt.',
    description:
      'Arbetar med barns rättigheter i Sverige och internationellt: skydd mot våld, utbildning och stöd efter katastrofer.',
    url: 'https://www.raddabarnen.se',
    focus: 'children',
    verifiedAt: '2026-10-29',
  },
  {
    id: 'unicef',
    name: 'UNICEF',
    tagline: 'Rent vatten, vaccin och skola till barn i hela världen.',
    description:
      'FN:s barnfond arbetar med vaccin, nutrition, rent vatten och skolgång i fler än 190 länder.',
    url: 'https://unicef.se',
    focus: 'children',
    verifiedAt: '2026-10-29',
  },
  {
    id: 'wwf',
    name: 'WWF',
    tagline: 'Skogar, hav och arter som behöver finnas kvar.',
    description:
      'Bevarar naturområden, skyddar hotade arter och arbetar för att minska klimatpåverkan.',
    url: 'https://www.wwf.se',
    focus: 'climate',
    verifiedAt: '2026-10-29',
  },
  {
    id: 'wikimedia',
    name: 'Wikimedia Foundation',
    tagline: 'Öppen kunskap som alla kan läsa och bygga vidare på.',
    description:
      'Driver Wikipedia och de fria kunskapsprojekten. Innehållet skrivs av frivilliga och får läsas av alla utan kostnad.',
    url: 'https://donate.wikimedia.org',
    focus: 'knowledge',
    verifiedAt: '2026-10-29',
  },
  {
    id: 'kiva',
    name: 'Kiva',
    tagline: 'Små lån som gör att människor kan bygga eget.',
    description:
      'Förmedlar mikrolån till entreprenörer som annars inte får banklån. Lånen betalas tillbaka och kan lånas ut igen.',
    url: 'https://www.kiva.org',
    focus: 'livelihoods',
    verifiedAt: '2026-10-29',
  },
] as const;

/** Standard: påminnelsen visas högst var tionde prompt, precis som den gamla annonsplatsen. */
export const GIVES_BACK_INTERVAL_PROMPTS = 10;

export const MAX_CONTRIBUTION_SEK = 1_000_000;
export const MAX_CONTRIBUTION_NOTE_CHARS = 200;

export interface GivesBackConfig {
  /** Av som standard. Användaren slår på platsen själv. */
  enabled: boolean;
  /** Aldrig oftare än var N:te prompt (minst 1). */
  everyNPrompts: number;
  /** Vilka ändamål som får visas. Tom lista = alla i katalogen. */
  causeIds: string[];
  consentedAt?: number;
}

/**
 * En post i användarens egen påverkanslogg.
 *
 * `amountSek` är det belopp användaren själv uppger att den gett, inte ett belopp appen har
 * tagit emot. Ingen transaktion, inget kvitto och ingen verifiering finns – därför `source`.
 */
export interface Contribution {
  id: string;
  causeId: string;
  amountSek: number;
  note?: string;
  createdAt: number;
  source: 'self-reported';
}

export interface GivesBackSummary {
  /** Antal registrerade tillfällen. */
  count: number;
  /** Summan av användarens egna uppgifter, i kronor. */
  totalSek: number;
  /** Antal unika ändamål som fått stöd. */
  causeCount: number;
  lastAt?: number;
}

export interface GivesBackPayload {
  entries: Contribution[];
  summary: GivesBackSummary;
}

export function findCause(id: string): GivesBackCause | undefined {
  return GIVES_BACK_CAUSES.find((cause) => cause.id === id);
}

/** Ändamålen användaren valt, i katalogens ordning. Tomt urval betyder hela katalogen. */
export function resolveCauses(ids: readonly string[]): GivesBackCause[] {
  const selected = new Set(ids);
  if (selected.size === 0) return [...GIVES_BACK_CAUSES];
  return GIVES_BACK_CAUSES.filter((cause) => selected.has(cause.id));
}

/**
 * Väljer vilket ändamål som visas vid en given prompt. Roterar genom urvalet så att samma
 * organisation inte visas varje gång, men deterministiskt – samma prompt ger samma ändamål.
 */
export function causeForPrompt(promptIndex: number, ids: readonly string[]): GivesBackCause {
  const causes = resolveCauses(ids);
  const index = Math.abs(Math.floor(promptIndex)) % causes.length;
  return causes[index] as GivesBackCause;
}

export function summarizeContributions(entries: readonly Contribution[]): GivesBackSummary {
  let totalSek = 0;
  let lastAt: number | undefined;
  const causes = new Set<string>();
  for (const entry of entries) {
    totalSek += entry.amountSek;
    causes.add(entry.causeId);
    if (lastAt === undefined || entry.createdAt > lastAt) lastAt = entry.createdAt;
  }
  return {
    count: entries.length,
    totalSek,
    causeCount: causes.size,
    ...(lastAt === undefined ? {} : { lastAt }),
  };
}

/** "1 250 kr" – svensk gruppering, inga ören. */
export function formatSek(amount: number): string {
  const rounded = Math.round(amount);
  return `${new Intl.NumberFormat('sv-SE').format(rounded)} kr`;
}

/** Sant om beloppet är ett heltal i kronor inom det tillåtna intervallet. */
export function isValidAmountSek(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_CONTRIBUTION_SEK
  );
}
