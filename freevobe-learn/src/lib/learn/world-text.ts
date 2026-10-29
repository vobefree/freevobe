/**
 * Kartan som text.
 *
 * Samma karta som ritas på canvas, men som tecken. Den finns för att kartan *är* data: barnet kan
 * se rutnätet, och den som vill kontrollera spelet kan läsa av det utan att titta på färger.
 */
import type { GeneratedWorld } from './types';

const WALL = '#';
const FLOOR = '·';
const HAZARD = '^';
const TREASURE = '*';
const GOAL = 'M';
const START = 'S';

/** Radvis textkarta: `#` vägg, `·` golv, `^` hinder, `*` skatt, `S` start, `M` mål. */
export function worldToText(world: GeneratedWorld): string {
  const rows: string[][] = [];
  for (let y = 0; y < world.rows; y += 1) {
    const row: string[] = [];
    for (let x = 0; x < world.cols; x += 1) {
      const tile = world.terrain[y * world.cols + x];
      row.push(tile === 'wall' ? WALL : tile === 'hazard' ? HAZARD : FLOOR);
    }
    rows.push(row);
  }

  for (const treasure of world.treasures) {
    rows[treasure.y][treasure.x] = TREASURE;
  }
  rows[world.goal.y][world.goal.x] = GOAL;
  rows[world.start.y][world.start.x] = START;

  return rows.map((row) => row.join('')).join('\n');
}

/** Teckenförklaring till textkartan, i samma ordning som den ritas. */
export const WORLD_TEXT_LEGEND = [
  { symbol: START, meaning: 'start' },
  { symbol: GOAL, meaning: 'mål' },
  { symbol: TREASURE, meaning: 'skatt' },
  { symbol: HAZARD, meaning: 'hinder' },
  { symbol: WALL, meaning: 'vägg' },
  { symbol: FLOOR, meaning: 'golv' },
] as const;
