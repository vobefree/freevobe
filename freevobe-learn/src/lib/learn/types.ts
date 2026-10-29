/**
 * Learn How to Vobe – typerna för en värld.
 *
 * En värld beskrivs i två steg. Först som en *beskrivning* (`WorldSpec`) – det barnet menade,
 * uttryckt i siffror och namn. Sedan som en *karta* (`GeneratedWorld`), där beskrivningen har
 * blivit rutor. Bara kartor som klarar `validateWorld` får spelas, och det markeras i typen
 * med `PlayableWorld`.
 *
 * Modulen är ren TypeScript utan DOM-beroenden: den körs lika bra i webbläsaren som i testerna.
 */

/** Världens sort. Styr färger, dekoration och vilka ord som känns igen. */
export type Biome =
  | 'forest'
  | 'space'
  | 'ocean'
  | 'desert'
  | 'snow'
  | 'city'
  | 'candy'
  | 'volcano'
  | 'jungle'
  | 'mountain';

/** Hur vild världen är. Påverkar hur många hinder kartan får. */
export type Mood = 'calm' | 'wild';

/** Det barnet beskrev, efter tolkning. Allt är vanliga strängar – inget skickas någonstans. */
export interface WorldSpec {
  /** Världens namn, t.ex. "Skogen med katten". */
  name: string;
  /** Fröet som kartan byggs från. Samma frö ger alltid samma karta. */
  seed: number;
  biome: Biome;
  /** Hjälten, t.ex. "katten". */
  hero: string;
  /** Det som ska samlas, t.ex. "stjärnor". */
  treasure: string;
  /** Det som är i vägen, t.ex. "lavan". */
  obstacle: string;
  /** Målet, t.ex. "porten". */
  goal: string;
  /** Hur många skatter kartan innehåller. Alla måste samlas. */
  target: number;
  /** Kartans bredd och höjd i rutor. */
  cols: number;
  rows: number;
  mood: Mood;
}

/** En ruta på kartan. Skatter, hjälte och mål är saker som står *på* en ruta, inte rutor. */
export type Terrain = 'floor' | 'wall' | 'hazard';

export interface Point {
  x: number;
  y: number;
}

/** Kartan som genererades från en beskrivning. */
export interface GeneratedWorld {
  spec: WorldSpec;
  cols: number;
  rows: number;
  /** Radvis, `cols * rows` rutor. Index = y * cols + x. */
  terrain: Terrain[];
  start: Point;
  goal: Point;
  treasures: Point[];
  /** Gången från start till mål. Används för att kontrollera att kartan hänger ihop. */
  route: Point[];
}

/**
 * En karta som har gått igenom valideringen. Typen går inte att skapa på eget bevåg, så
 * spelmotorn kan aldrig få en trasig karta.
 */
export type PlayableWorld = GeneratedWorld & { readonly playable: true };

export type IssueLevel = 'error' | 'warning';

/** Ett problem med världen, skrivet så att ett barn kan åtgärda det. */
export interface ValidationIssue {
  code: string;
  level: IssueLevel;
  /** Vad som är fel, i jag-form. */
  message: string;
  /** Vad barnet kan skriva för att lösa det. */
  fix: string;
  field?: keyof WorldSpec | 'grid';
}

/** Vad texten blev, och vilka ord som kändes igen. */
export interface Interpretation {
  spec: WorldSpec;
  /** Korta rader som visar hur orden blev en värld, t.ex. "skog → skog". */
  notes: string[];
  /** Ord som inte betydde något särskilt – de tas upp, inte tystas. */
  ignored: string[];
}

export type CompileResult =
  | {
      ok: true;
      /** Beskrivningen som barnet fick se och godkänna. */
      interpretation: Interpretation;
      world: PlayableWorld;
      issues: ValidationIssue[];
    }
  | {
      ok: false;
      interpretation: Interpretation;
      issues: ValidationIssue[];
    };

/** Riktning för ett steg. */
export type Direction = 'up' | 'down' | 'left' | 'right';

export type MoveEvent =
  | 'blocked'
  | 'treasure'
  | 'goal-locked'
  | 'won';

export interface GameState {
  world: PlayableWorld;
  hero: Point;
  /** Index i `world.treasures` för de skatter som plockats upp. */
  collected: number[];
  steps: number;
  stumbles: number;
  status: 'playing' | 'won';
}

export interface MoveResult {
  state: GameState;
  events: MoveEvent[];
}
