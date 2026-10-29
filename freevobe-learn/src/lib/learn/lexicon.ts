/**
 * Ordlistan för Learn How to Vobe.
 *
 * Världen byggs av det barnet skriver, utan att texten lämnar webbläsaren. Därför finns orden
 * här: vanliga svenska ord, böjningsformer och engelska synonymer, och för varje ord vad det
 * blir i världen. Ordlistan är avsiktligt liten och läsbar – den går att peka på i lektionerna.
 *
 * Matchningen letar efter ordstammar inuti texten, så att sammansatta ord som "skogsglänta"
 * också hittas. Mycket korta stammar (tre tecken eller färre) kräver ordgräns, annars skulle
 * "is" dyka upp inuti "vis".
 */
import type { Biome, Mood } from './types';

export interface Palette {
  /** Golvets två schackrutor. */
  floor: string;
  floorAlt: string;
  wall: string;
  wallTop: string;
  hazard: string;
  goal: string;
  /** Kontur och text i kartan. */
  ink: string;
  sky: string;
}

export interface BiomeDefinition {
  id: Biome;
  /** Bestämd form, används i löpande text: "skogen". */
  label: string;
  /** Versal, används i världens namn: "Skogen med katten". */
  title: string;
  stems: readonly string[];
  palette: Palette;
}

export const BIOMES: readonly BiomeDefinition[] = [
  {
    id: 'forest',
    label: 'skogen',
    title: 'Skogen',
    stems: ['skog', 'skogs', 'forest', 'träd', 'woods', 'glänta', 'mossa'],
    palette: {
      floor: '#3f7d52',
      floorAlt: '#39744b',
      wall: '#1c4433',
      wallTop: '#2a5c43',
      hazard: '#c2553f',
      goal: '#f4d06f',
      ink: '#0c2118',
      sky: '#14301f',
    },
  },
  {
    id: 'space',
    label: 'rymden',
    title: 'Rymden',
    stems: ['rymd', 'rymden', 'space', 'planet', 'måne', 'raket', 'galax', 'astronaut', 'stjärnhim'],
    palette: {
      floor: '#2f2e5c',
      floorAlt: '#2a2954',
      wall: '#14142e',
      wallTop: '#232347',
      hazard: '#ef476f',
      goal: '#ffd166',
      ink: '#06061a',
      sky: '#0b0b22',
    },
  },
  {
    id: 'ocean',
    label: 'havet',
    title: 'Havet',
    stems: ['hav', 'havet', 'ocean', 'korall', 'strand', 'sjö', 'våg', 'undervattens'],
    palette: {
      floor: '#2a7f9e',
      floorAlt: '#26819f',
      wall: '#10506b',
      wallTop: '#1a647f',
      hazard: '#ff7b54',
      goal: '#ffe08a',
      ink: '#04202c',
      sky: '#06293a',
    },
  },
  {
    id: 'desert',
    label: 'öknen',
    title: 'Öknen',
    stems: ['öknen', 'öken', 'desert', 'sand', 'dyn', 'oas'],
    palette: {
      floor: '#e0b972',
      floorAlt: '#dcb267',
      wall: '#9a7440',
      wallTop: '#b38a51',
      hazard: '#c1553b',
      goal: '#3f8fc4',
      ink: '#3a2a12',
      sky: '#f3dcae',
    },
  },
  {
    id: 'snow',
    label: 'snölandet',
    title: 'Snölandet',
    stems: ['snö', 'snow', 'vinter', 'frost', 'pol', 'snögubbe', 'fjäll'],
    palette: {
      floor: '#dfe9f2',
      floorAlt: '#d5e2ee',
      wall: '#93a9bf',
      wallTop: '#aec2d4',
      hazard: '#4d7ec7',
      goal: '#ff9f1c',
      ink: '#1b2a38',
      sky: '#f4f9fd',
    },
  },
  {
    id: 'city',
    label: 'staden',
    title: 'Staden',
    stems: ['stad', 'staden', 'city', 'gata', 'tunnelbana', 'kvarter'],
    palette: {
      floor: '#5b5f6b',
      floorAlt: '#545863',
      wall: '#2f323a',
      wallTop: '#3d4048',
      hazard: '#f2b134',
      goal: '#59d0a8',
      ink: '#14161b',
      sky: '#22252d',
    },
  },
  {
    id: 'candy',
    label: 'godislandet',
    title: 'Godislandet',
    stems: ['godis', 'candy', 'socker', 'tårta', 'glass', 'karamell'],
    palette: {
      floor: '#f4a7bd',
      floorAlt: '#f19cb4',
      wall: '#c4537c',
      wallTop: '#d76b90',
      hazard: '#7d3f9c',
      goal: '#61d095',
      ink: '#4a1730',
      sky: '#ffe3ec',
    },
  },
  {
    id: 'volcano',
    label: 'vulkanen',
    title: 'Vulkanen',
    stems: ['vulkan', 'volcano', 'lava', 'magma'],
    palette: {
      floor: '#5a3b3b',
      floorAlt: '#553636',
      wall: '#33201f',
      wallTop: '#452a29',
      hazard: '#f25c1f',
      goal: '#ffd23f',
      ink: '#180a09',
      sky: '#2a1210',
    },
  },
  {
    id: 'jungle',
    label: 'djungeln',
    title: 'Djungeln',
    stems: ['djungel', 'jungle', 'regnskog', 'lian', 'safari'],
    palette: {
      floor: '#2f7a4f',
      floorAlt: '#2b7149',
      wall: '#123b26',
      wallTop: '#1c4d33',
      hazard: '#e0a12f',
      goal: '#8ee36b',
      ink: '#071d12',
      sky: '#0f2b1b',
    },
  },
  {
    id: 'mountain',
    label: 'berget',
    title: 'Berget',
    stems: ['berg', 'mountain', 'klippa', 'topp', 'kulle', 'grott'],
    palette: {
      floor: '#6d7583',
      floorAlt: '#666e7b',
      wall: '#3a4049',
      wallTop: '#4b525d',
      hazard: '#b23a3a',
      goal: '#ffcf5c',
      ink: '#171a1f',
      sky: '#242832',
    },
  },
] as const;

export type Ears = 'pointy' | 'round' | 'long' | 'floppy' | 'tufts' | 'antenna' | 'horn' | 'fin' | 'none';

export interface HeroDefinition {
  id: string;
  /** Bestämd form: "katten". */
  label: string;
  stems: readonly string[];
  color: string;
  ears: Ears;
}

export const HEROES: readonly HeroDefinition[] = [
  {
    id: 'katt',
    label: 'katten',
    stems: ['katt', 'cat', 'kissen', 'mis'],
    color: '#f2b544',
    ears: 'pointy',
  },
  {
    id: 'drake',
    label: 'draken',
    stems: ['drake', 'dragon', 'dinosaurie', 'dino'],
    color: '#63d471',
    ears: 'horn',
  },
  {
    id: 'robot',
    label: 'roboten',
    stems: ['robot', 'android', 'bot'],
    color: '#8fb8ff',
    ears: 'antenna',
  },
  {
    id: 'kanin',
    label: 'kaninen',
    stems: ['kanin', 'rabbit', 'hare', 'bunny'],
    color: '#f7d6e0',
    ears: 'long',
  },
  {
    id: 'hund',
    label: 'hunden',
    stems: ['hund', 'dog', 'valp', 'puppy'],
    color: '#c98b4b',
    ears: 'floppy',
  },
  {
    id: 'rav',
    label: 'räven',
    stems: ['räv', 'fox'],
    color: '#e8703a',
    ears: 'pointy',
  },
  {
    id: 'uggla',
    label: 'ugglan',
    stems: ['uggla', 'owl'],
    color: '#a8896c',
    ears: 'tufts',
  },
  {
    id: 'groda',
    label: 'grodan',
    stems: ['groda', 'frog', 'padda'],
    color: '#7ed957',
    ears: 'none',
  },
  {
    id: 'pingvin',
    label: 'pingvinen',
    stems: ['pingvin', 'penguin'],
    color: '#3d5a80',
    ears: 'none',
  },
  {
    id: 'enhorning',
    label: 'enhörningen',
    stems: ['enhörning', 'unicorn'],
    color: '#e6d5ff',
    ears: 'horn',
  },
  {
    id: 'spoke',
    label: 'spöket',
    stems: ['spöke', 'ghost', 'ande'],
    color: '#e8f1ff',
    ears: 'none',
  },
  {
    id: 'fisk',
    label: 'fisken',
    stems: ['fisk', 'fish'],
    color: '#61c9d6',
    ears: 'fin',
  },
] as const;

export type TreasureShape = 'star' | 'coin' | 'berry' | 'crystal' | 'candy' | 'shell' | 'ball';

export interface TreasureDefinition {
  id: string;
  /** Bestämd form plural, används i meningar: "stjärnorna". */
  label: string;
  /** Obestämd plural, används vid räkning: "3 stjärnor". */
  plural: string;
  one: string;
  stems: readonly string[];
  shape: TreasureShape;
  color: string;
}

export const TREASURES: readonly TreasureDefinition[] = [
  {
    id: 'stjarna',
    label: 'stjärnorna',
    plural: 'stjärnor',
    one: 'stjärna',
    stems: ['stjärn', 'star'],
    shape: 'star',
    color: '#ffd34d',
  },
  {
    id: 'mynt',
    label: 'mynten',
    plural: 'mynt',
    one: 'mynt',
    stems: ['mynt', 'coin', 'guldpengar'],
    shape: 'coin',
    color: '#f6c453',
  },
  {
    id: 'bar',
    label: 'bären',
    plural: 'bär',
    one: 'bär',
    stems: ['bär', 'berry', 'blåbär', 'hallon', 'jordgubbe'],
    shape: 'berry',
    color: '#ef476f',
  },
  {
    id: 'kristall',
    label: 'kristallerna',
    plural: 'kristaller',
    one: 'kristall',
    stems: ['kristall', 'crystal', 'diamant', 'ädelsten'],
    shape: 'crystal',
    color: '#7fd7ff',
  },
  {
    id: 'godis',
    label: 'godisbitarna',
    plural: 'godisbitar',
    one: 'godisbit',
    stems: ['godis', 'candy', 'karamell', 'klubba'],
    shape: 'candy',
    color: '#ff8fbe',
  },
  {
    id: 'snacka',
    label: 'snäckorna',
    plural: 'snäckor',
    one: 'snäcka',
    stems: ['snäcka', 'snäck', 'shell', 'pärla'],
    shape: 'shell',
    color: '#ffc6a8',
  },
  {
    id: 'boll',
    label: 'bollarna',
    plural: 'bollar',
    one: 'boll',
    stems: ['boll', 'ball', 'fotboll'],
    shape: 'ball',
    color: '#ff6b6b',
  },
] as const;

export type ObstacleArt = 'spikes' | 'lava' | 'bush' | 'crate' | 'cactus' | 'ice' | 'wave' | 'car' | 'thorns';

export interface ObstacleDefinition {
  id: string;
  /** Bestämd form plural: "spikarna". */
  label: string;
  stems: readonly string[];
  art: ObstacleArt;
  color?: string;
}

export const OBSTACLES: readonly ObstacleDefinition[] = [
  { id: 'spikar', label: 'spikarna', stems: ['spik', 'spike', 'fälla'], art: 'spikes' },
  { id: 'lava', label: 'lavan', stems: ['lava', 'magma', 'glöd'], art: 'lava', color: '#f25c1f' },
  { id: 'stubbar', label: 'stubbarna', stems: ['stubb', 'stock'], art: 'bush' },
  { id: 'lador', label: 'lådorna', stems: ['låd', 'crate', 'back'], art: 'crate' },
  { id: 'kaktusar', label: 'kaktusarna', stems: ['kaktus', 'cactus'], art: 'cactus' },
  { id: 'isblock', label: 'isblocken', stems: ['isblock', 'isflak', 'istapp'], art: 'ice' },
  { id: 'vagor', label: 'vågorna', stems: ['våg', 'wave', 'ström'], art: 'wave' },
  { id: 'bilar', label: 'bilarna', stems: ['bil', 'car', 'trafik'], art: 'car' },
  { id: 'torn', label: 'törnen', stems: ['törne', 'thorn', 'buske'], art: 'thorns' },
] as const;

export type GoalArt = 'door' | 'ship' | 'castle' | 'home' | 'chest' | 'hill' | 'tower';

export interface GoalDefinition {
  id: string;
  label: string;
  stems: readonly string[];
  art: GoalArt;
}

export const GOALS: readonly GoalDefinition[] = [
  { id: 'porten', label: 'porten', stems: ['port', 'dörr', 'gate', 'utgång'], art: 'door' },
  { id: 'rymdskeppet', label: 'rymdskeppet', stems: ['rymdskepp', 'skepp', 'ship', 'raket'], art: 'ship' },
  { id: 'slottet', label: 'slottet', stems: ['slott', 'borg', 'castle'], art: 'castle' },
  { id: 'hemmet', label: 'hemmet', stems: ['hem', 'stuga', 'home'], art: 'home' },
  { id: 'skattkistan', label: 'skattkistan', stems: ['kista', 'chest'], art: 'chest' },
  { id: 'toppen', label: 'toppen', stems: ['topp', 'bergstopp', 'hill'], art: 'hill' },
  { id: 'tornet', label: 'tornet', stems: ['torn', 'tower'], art: 'tower' },
] as const;

/** Ord som gör världen vild respektive lugn. */
export const MOOD_STEMS: Record<Mood, readonly string[]> = {
  wild: ['farlig', 'läskig', 'vild', 'spännande', 'svår', 'mörk'],
  calm: ['lugn', 'mysig', 'snäll', 'fredlig', 'trygg', 'försiktig'],
};

/** Ord som anger storlek. */
export const SIZE_STEMS = {
  large: ['jättestor', 'jättelik', 'enorm', 'huge', 'giant', 'large', 'big', 'stor'],
  small: ['liten', 'mini', 'pytte', 'tiny', 'small', 'little', 'kort'],
} as const;

/** Siffror som ord. */
export const NUMBER_WORDS: Readonly<Record<string, number>> = {
  en: 1,
  ett: 1,
  två: 2,
  tva: 2,
  tre: 3,
  fyra: 4,
  fem: 5,
  sex: 6,
  sju: 7,
  åtta: 8,
  atta: 8,
};

/** Standard när barnet inte har skrivit något som pekar på en viss värld. */
export const DEFAULTS = {
  biome: 'forest' as Biome,
  hero: HEROES[0],
  treasure: TREASURES[0],
  obstacle: OBSTACLES[0],
  goal: GOALS[0],
  target: 3,
  mood: 'calm' as Mood,
} as const;

/** Hinder som passar en viss värld bättre än spikar, om barnet inte nämnde något hinder. */
export const OBSTACLE_FOR_BIOME: Readonly<Record<Biome, string>> = {
  forest: 'stubbar',
  space: 'spikar',
  ocean: 'vagor',
  desert: 'kaktusar',
  snow: 'isblock',
  city: 'bilar',
  candy: 'lador',
  volcano: 'lava',
  jungle: 'torn',
  mountain: 'spikar',
};

/** Målet om barnet inte nämnde något mål. */
export const GOAL_FOR_BIOME: Readonly<Record<Biome, string>> = {
  forest: 'hemmet',
  space: 'rymdskeppet',
  ocean: 'skattkistan',
  desert: 'porten',
  snow: 'hemmet',
  city: 'porten',
  candy: 'slottet',
  volcano: 'toppen',
  jungle: 'tornet',
  mountain: 'toppen',
};

export function biomeById(id: Biome): BiomeDefinition {
  const found = BIOMES.find((biome) => biome.id === id);
  if (!found) throw new Error(`Okänd värld: ${id}`);
  return found;
}

export function heroById(id: string): HeroDefinition {
  return HEROES.find((hero) => hero.id === id) ?? DEFAULTS.hero;
}

export function treasureById(id: string): TreasureDefinition {
  return TREASURES.find((treasure) => treasure.id === id) ?? DEFAULTS.treasure;
}

export function obstacleById(id: string): ObstacleDefinition {
  return OBSTACLES.find((obstacle) => obstacle.id === id) ?? DEFAULTS.obstacle;
}

export function goalById(id: string): GoalDefinition {
  return GOALS.find((goal) => goal.id === id) ?? DEFAULTS.goal;
}
