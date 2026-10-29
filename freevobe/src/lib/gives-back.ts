/**
 * Freevobe Gives Back – webbplatsens kopia av katalogen.
 *
 * Samma ändamål och samma id:n som i skrivbordsappen (`packages/protocol/src/gives-back.ts`).
 * Webbplatsen och appen är separata paket, så listan finns på båda ställena; id:na hålls
 * identiska så att dokumentationen kan prata om ett ändamål utan att mena två.
 */
export interface GivesBackCause {
  id: string;
  name: string;
  tagline: string;
  description: string;
  url: string;
  focus: 'health' | 'children' | 'climate' | 'knowledge' | 'livelihoods';
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
    tagline: 'Smålån som gör att människor kan bygga eget.',
    description:
      'Förmedlar mikrolån till entreprenörer som annars inte får banklån. Lånen betalas tillbaka och kan lånas ut igen.',
    url: 'https://www.kiva.org',
    focus: 'livelihoods',
    verifiedAt: '2026-10-29',
  },
] as const;

/**
 * Det webbplatsen lovar. Varje punkt går att kontrollera i den öppna källkoden – det är hela
 * poängen med att skriva ut dem.
 */
export const GIVES_BACK_PRINCIPLES = [
  {
    title: 'No advertising',
    body: 'Freevobe ships without ad slots, ad scripts and ad networks. Nothing in the app is for sale.',
  },
  {
    title: 'No money through Freevobe',
    body: 'The app has no checkout, no account and no payment provider. Every link opens the organisation’s own page.',
  },
  {
    title: 'Off by default',
    body: 'The reminder in the chat is opt-in, appears in its own block and never touches the agent’s context.',
  },
  {
    title: 'Your log stays local',
    body: 'If you record a contribution, it is marked as self-reported and stored only in your local database.',
  },
] as const;
