/**
 * Från barnets mening till en världsbeskrivning.
 *
 * Det här är steget som "förstår" texten. Det gör inga gissningar i hemlighet: varje val sparas
 * som en rad i `notes`, så att barnet kan se exakt vilka ord som blev vad. Ord som inte betydde
 * något hamnar i `ignored` i stället för att tystas bort.
 *
 * Allt sker lokalt i webbläsaren. Ingen text skickas till en modell eller en server, och samma
 * text ger alltid samma värld – fröet räknas fram ur texten.
 */
import type { Biome, Interpretation, Mood, WorldSpec } from './types';
import {
  BIOMES,
  DEFAULTS,
  GOALS,
  GOAL_FOR_BIOME,
  HEROES,
  MOOD_STEMS,
  NUMBER_WORDS,
  OBSTACLES,
  OBSTACLE_FOR_BIOME,
  SIZE_STEMS,
  TREASURES,
  biomeById,
  goalById,
  heroById,
  obstacleById,
  treasureById,
} from './lexicon';

/** Längsta text vi tolkar. Längre text klipps, och det sägs rakt ut i gränssnittet. */
export const MAX_INPUT_LENGTH = 600;

/** Hjälte som passar världen när barnet inte skrev någon. */
export const HERO_FOR_BIOME: Readonly<Record<Biome, string>> = {
  forest: 'rav',
  space: 'robot',
  ocean: 'fisk',
  desert: 'rav',
  snow: 'pingvin',
  city: 'hund',
  candy: 'kanin',
  volcano: 'drake',
  jungle: 'groda',
  mountain: 'uggla',
};

const STOPWORDS = new Set([
  'en',
  'ett',
  'och',
  'med',
  'som',
  'i',
  'på',
  'där',
  'den',
  'det',
  'kan',
  'vill',
  'ska',
  'heter',
  'min',
  'mitt',
  'mina',
  'alla',
  'av',
  'till',
  'för',
  'är',
  'rolig',
  'roligt',
  'lek',
  'leka',
  'spela',
  'spel',
  'värld',
  'världen',
  'jag',
  'du',
  'vi',
  'att',
  'man',
  'sig',
  'sin',
  'sitt',
  'the',
  'a',
  'and',
  'with',
  'of',
  'in',
  'to',
  'my',
  'world',
  'game',
  'play',
]);

const WORD_CHAR = /[\p{L}\p{N}]/u;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

/** Tar bort kontrolltecken och extra mellanslag. Texten kapas till `MAX_INPUT_LENGTH`. */
export function sanitizeText(input: string): string {
  return input.normalize('NFC').replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim();
}

export interface StemMatch {
  stem: string;
  index: number;
  length: number;
}

/**
 * Hittar den starkaste ordstammen i texten. Längst stam vinner, därefter tidigast förekomst –
 * så att "stjärnhimlen" blir rymden och inte en skatt, och "skogsglänta" blir skog.
 */
export function matchStem(text: string, stems: readonly string[]): StemMatch | null {
  let best: StemMatch | null = null;
  for (const stem of stems) {
    // Korta stammar får bara matcha i början av ett ord; längre får sitta var som helst.
    const needsWordStart = stem.length <= 3;
    let index = text.indexOf(stem);
    while (index >= 0) {
      const before = index === 0 ? '' : text[index - 1];
      const startsWord = !needsWordStart || !WORD_CHAR.test(before);
      if (startsWord) {
        if (
          !best ||
          stem.length > best.length ||
          (stem.length === best.length && index < best.index)
        ) {
          best = { stem, index, length: stem.length };
        }
        break;
      }
      index = text.indexOf(stem, index + 1);
    }
  }
  return best;
}

/** FNV-1a. Ger ett stabilt frö ur texten, så att samma mening alltid ger samma karta. */
export function seedFromText(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function pick<T extends { id: string }>(
  text: string,
  entries: readonly T[],
  stemsOf: (entry: T) => readonly string[],
): { entry: T; match: StemMatch } | null {
  let best: { entry: T; match: StemMatch } | null = null;
  for (const entry of entries) {
    const match = matchStem(text, stemsOf(entry));
    if (!match) continue;
    if (
      !best ||
      match.length > best.match.length ||
      (match.length === best.match.length && match.index < best.match.index)
    ) {
      best = { entry, match };
    }
  }
  return best;
}

function readName(text: string): string | null {
  const quoted = /["“”']([^"“”']{2,40})["“”']/.exec(text);
  const afterHeter = /som heter\s+([^.,!?;]{2,40})/i.exec(text);
  const raw = quoted?.[1] ?? afterHeter?.[1];
  if (!raw) return null;
  // Namnet slutar där nästa beskrivning börjar: "Månen med en katt" heter "Månen".
  const value = raw
    .split(/\s+(?:med|och|där|som|i|på)\s+/i)[0]
    .replace(/^["“”'\s]+|["“”'\s]+$/g, '')
    .replace(/\s+/g, ' ');
  return value ? value.slice(0, 40) : null;
}

/**
 * Läser antalet skatter. Siffror och räkneord samlas in, och den som står närmast före skatten
 * vinner – annars skulle "en skog med en katt och tre stjärnor" bli 1. "En" och "ett" hoppas
 * över eftersom de oftast är artiklar.
 */
function readTarget(
  text: string,
  treasureStems: readonly string[],
): { value: number; source: string } | null {
  const candidates: { value: number; source: string; index: number }[] = [];

  for (const match of text.matchAll(/\b([1-9])\b/g)) {
    candidates.push({ value: Number(match[1]), source: match[1], index: match.index ?? 0 });
  }
  for (const [word, value] of Object.entries(NUMBER_WORDS)) {
    if (value === 1) continue;
    for (const match of text.matchAll(new RegExp(`\\b${word}\\b`, 'gu'))) {
      candidates.push({ value, source: word, index: match.index ?? 0 });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.index - b.index);

  const treasureAt = matchStem(text, treasureStems);
  if (treasureAt) {
    const nearby = candidates.filter(
      (candidate) =>
        candidate.index < treasureAt.index && treasureAt.index - candidate.index <= 24,
    );
    if (nearby.length > 0) {
      const closest = nearby[nearby.length - 1];
      return { value: Math.min(8, closest.value), source: closest.source };
    }
  }

  const first = candidates[0];
  return { value: Math.min(8, first.value), source: first.source };
}

function readSize(text: string): { cols: number; rows: number; source: string; key: string } | null {
  const large = matchStem(text, SIZE_STEMS.large);
  const small = matchStem(text, SIZE_STEMS.small);
  if (large && (!small || large.length >= small.length)) {
    return { cols: 19, rows: 13, source: large.stem, key: 'large' };
  }
  if (small) return { cols: 11, rows: 9, source: small.stem, key: 'small' };
  return null;
}

function readMood(text: string): { mood: Mood; source: string } | null {
  const wild = matchStem(text, MOOD_STEMS.wild);
  const calm = matchStem(text, MOOD_STEMS.calm);
  if (wild && (!calm || wild.index <= calm.index)) return { mood: 'wild', source: wild.stem };
  if (calm) return { mood: 'calm', source: calm.stem };
  return null;
}

/** Plockar ut de ord vi inte kände igen, så att de kan nämnas i stället för att försvinna. */
function collectIgnored(text: string, covered: readonly StemMatch[]): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const isCovered = (word: string): boolean => {
    for (const match of covered) {
      if (word.includes(match.stem)) return true;
    }
    return false;
  };

  const ignored: string[] = [];
  for (const word of words) {
    if (word.length < 4 || STOPWORDS.has(word) || isCovered(word)) continue;
    if (!ignored.includes(word)) ignored.push(word);
    if (ignored.length >= 8) break;
  }
  return ignored;
}

/**
 * Tolkar en mening som en värld. Tom eller obegriplig text ger en fungerande standardvärld –
 * men `notes` säger då rakt ut att det blev en skog för att inget annat kändes igen.
 */
export function describeWorld(input: string, options: { seed?: number } = {}): Interpretation {
  const text = sanitizeText(input.slice(0, MAX_INPUT_LENGTH));
  const lowered = text.toLowerCase();

  const biomeHit = pick(lowered, BIOMES, (biome) => biome.stems);
  const biome = biomeHit?.entry ?? biomeById(DEFAULTS.biome);

  const heroHit = pick(lowered, HEROES, (hero) => hero.stems);
  const hero = heroHit?.entry ?? heroById(HERO_FOR_BIOME[biome.id]);

  const treasureHit = pick(lowered, TREASURES, (treasure) => treasure.stems);
  const treasure = treasureHit?.entry ?? DEFAULTS.treasure;

  const obstacleHit = pick(lowered, OBSTACLES, (obstacle) => obstacle.stems);
  const obstacle = obstacleHit?.entry ?? obstacleById(OBSTACLE_FOR_BIOME[biome.id]);

  const goalHit = pick(lowered, GOALS, (goal) => goal.stems);
  const goal = goalHit?.entry ?? goalById(GOAL_FOR_BIOME[biome.id]);

  const target = readTarget(lowered, treasure.stems);
  const size = readSize(lowered);
  const mood = readMood(lowered);
  const explicitName = readName(text);

  const spec: WorldSpec = {
    name: explicitName ?? `${biome.title} med ${hero.label}`,
    seed: options.seed ?? seedFromText(text || biome.id),
    biome: biome.id,
    hero: hero.id,
    treasure: treasure.id,
    obstacle: obstacle.id,
    goal: goal.id,
    target: target?.value ?? DEFAULTS.target,
    cols: size?.cols ?? 15,
    rows: size?.rows ?? 11,
    mood: mood?.mood ?? DEFAULTS.mood,
  };

  const notes: string[] = [
    biomeHit ? `"${biomeHit.match.stem}" → ${biome.label}` : `inget ord om en plats → ${biome.label} (standard)`,
    heroHit ? `"${heroHit.match.stem}" → ${hero.label}` : `ingen hjälte nämnd → ${hero.label}`,
    treasureHit
      ? `"${treasureHit.match.stem}" → ${treasure.label}`
      : `ingen skatt nämnd → ${treasure.label}`,
    obstacleHit
      ? `"${obstacleHit.match.stem}" → ${obstacle.label}`
      : `inget hinder nämnt → ${obstacle.label}`,
    goalHit ? `"${goalHit.match.stem}" → ${goal.label}` : `inget mål nämnt → ${goal.label}`,
    target
      ? `"${target.source}" → ${target.value} ${target.value === 1 ? treasure.one : treasure.plural}`
      : `ingen siffra → ${spec.target} ${treasure.plural}`,
    size ? `"${size.source}" → ${spec.cols} × ${spec.rows} rutor` : `ingen storlek → ${spec.cols} × ${spec.rows} rutor`,
    mood ? `"${mood.source}" → ${mood.mood === 'wild' ? 'vild' : 'lugn'} värld` : 'varken vild eller lugn → lugn värld',
  ];
  if (explicitName) notes.push(`namnet kommer från texten → ${spec.name}`);

  const covered: StemMatch[] = [];
  for (const hit of [biomeHit, heroHit, treasureHit, obstacleHit, goalHit]) {
    if (hit?.match) covered.push(hit.match);
  }
  const ignored = collectIgnored(text, covered);

  return { spec, notes, ignored };
}

/** Människovänlig sammanfattning av en värld, använd i gränssnitt och lektioner. */
export function describeInWords(spec: WorldSpec): string {
  const biome = biomeById(spec.biome);
  const hero = heroById(spec.hero);
  const treasure = treasureById(spec.treasure);
  const obstacle = obstacleById(spec.obstacle);
  const goal = goalById(spec.goal);
  const count = spec.target === 1 ? treasure.one : treasure.plural;
  return `${hero.label} ska hämta ${spec.target} ${count} i ${biome.label}, undvika ${obstacle.label} och till sist nå ${goal.label}.`;
}
