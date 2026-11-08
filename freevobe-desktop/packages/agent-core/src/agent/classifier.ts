import type { OutputType } from '@freevobe/protocol';

/**
 * Klassning av vad användaren ber om. Den avgör vilken sorts provider som behövs innan något
 * skickas till en modell: en beställning på en bild ska aldrig hamna hos en textmodell.
 *
 * Klassaren är medvetet enkel och lokal – inga modellanrop, ingen latens och ingenting som kan
 * kosta pengar. Den tittar på verb och substantiv på svenska och engelska och är hellre försiktig
 * än träffsäker: hellre `text` (som alltid fungerar lokalt) än en felaktig medieroute.
 */
export interface TaskClassification {
  outputType: OutputType;
  /** 0–1. Låg siffra betyder att klassningen är en gissning. */
  confidence: number;
  /** Orden som avgjorde saken. Tom när inget matchade. */
  matched: string[];
}

export type MediaOutputType = Extract<OutputType, 'image' | 'video' | 'audio'>;

const MEDIA_NOUNS: Record<MediaOutputType, string[]> = {
  image: [
    'bild',
    'image',
    'illustration',
    'logotyp',
    'logo',
    'ikon',
    'foto',
    'hero-bild',
    'hero image',
    'konstverk',
    'artwork',
  ],
  video: ['video', 'film', 'klipp', 'animation', 'clip', 'trailer'],
  audio: [
    'musik',
    'music',
    'låt',
    'sång',
    'song',
    'ljud',
    'audio',
    'soundtrack',
    'röst',
    'jingel',
    'jingle',
  ],
};

const MEDIA_VERBS = [
  'generera',
  'skapa',
  'skapar',
  'gör',
  'göra',
  'rita',
  'framställ',
  'producera',
  'komponera',
  'generate',
  'create',
  'make',
  'produce',
  'draw',
  'compose',
  'design',
];

/**
 * Signaler som betyder kod. Filer, funktioner och kommandon väger tyngre än ett medieord: "lägg
 * in hero-bilden i koden" är en koduppgift, inte en bildbeställning.
 */
const CODE_NOUNS = [
  'kod',
  'code',
  'fil',
  'function',
  'funktion',
  'komponent',
  'component',
  'endpoint',
  'api',
  'bugg',
  'bug',
  'test',
  'repo',
  'branchen',
  'branch',
  'commit',
  'databas',
  'database',
  'css',
  'html',
  'sql',
];

const CODE_VERBS = [
  'implementera',
  'refaktorera',
  'fixa',
  'rätta',
  'debugga',
  'bygg',
  'skriv om',
  'installera',
  'deploya',
  'testa',
];

/** En filsökväg i prompten är den starkaste kodsignalen som finns. */
const FILE_PATTERN =
  /[\w-]+\.(?:ts|tsx|js|jsx|json|css|html|md|txt|py|rs|go|java|sql|yml|yaml|toml|svg)\b/i;

/**
 * Hittar ett ord även som sammansättning och i svensk böjning: "produktvideo", "pianomusik",
 * "hero-bilden" och "komponenten" ska matcha `video`, `musik`, `hero-bild` och `komponent`.
 * Returnerar ordets position så att den tidigaste mediesorten kan vinna.
 */
function findWord(text: string, word: string): { word: string; index: number } | undefined {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `(?:^|[^\\p{L}])[\\p{L}-]*${escaped}(?:en|er|ar|et|n|s|or|orna)?(?![\\p{L}])`,
    'u',
  );
  const match = pattern.exec(text);
  return match ? { word, index: match.index } : undefined;
}

export function classifyTask(prompt: string): TaskClassification {
  const text = prompt.toLowerCase();

  const fileSignal = FILE_PATTERN.exec(text)?.[0];
  const codeMatches = [
    ...CODE_NOUNS.map((noun) => findWord(text, noun)),
    ...CODE_VERBS.map((verb) => findWord(text, verb)),
  ].filter((match): match is { word: string; index: number } => match !== undefined);

  const codeSignals = [
    ...(fileSignal ? [fileSignal] : []),
    ...codeMatches.sort((a, b) => a.index - b.index).map((match) => match.word),
  ];

  // Den tidigaste mediesorten vinner: "komponera musik till videon" är ljud, inte video.
  const media = (['image', 'video', 'audio'] as const)
    .map((kind) => {
      const noun = MEDIA_NOUNS[kind]
        .map((candidate) => findWord(text, candidate))
        .filter((match): match is { word: string; index: number } => match !== undefined)
        .sort((a, b) => a.index - b.index)[0];
      const verb = MEDIA_VERBS.map((candidate) => findWord(text, candidate)).find(Boolean);
      return noun && verb ? { kind, noun, verb } : null;
    })
    .filter(
      (
        entry,
      ): entry is {
        kind: MediaOutputType;
        noun: { word: string; index: number };
        verb: { word: string; index: number };
      } => entry !== null,
    )
    .sort((a, b) => a.noun.index - b.noun.index)[0];

  // Utan både verb och substantiv är det ingen beställning. Finns en kodsignal är uppgiften kod –
  // "lägg in bilden i komponenten" ska inte generera en ny bild.
  if (media && codeSignals.length === 0) {
    return {
      outputType: media.kind,
      confidence: 0.9,
      matched: [media.verb.word, media.noun.word],
    };
  }

  if (codeSignals.length > 0) {
    return { outputType: 'code', confidence: 0.75, matched: codeSignals };
  }

  return { outputType: 'text', confidence: 0.5, matched: [] };
}

/** Sant när klassningen pekar på bild, video eller ljud. */
export function isMediaOutputType(type: OutputType): type is MediaOutputType {
  return type === 'image' || type === 'video' || type === 'audio';
}
