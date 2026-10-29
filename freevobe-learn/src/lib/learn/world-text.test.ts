import { describe, expect, it } from 'vitest';
import { buildWorld } from './compile';
import { describeWorld } from './describe';
import { worldToText, WORLD_TEXT_LEGEND } from './world-text';

const world = (() => {
  const result = buildWorld(describeWorld('en skog med en katt och tre stjärnor').spec);
  if (!result.ok) throw new Error('Testet behöver en spelbar karta');
  return result.world;
})();

describe('worldToText', () => {
  it('har en rad per rad och en kolumn per ruta', () => {
    const lines = worldToText(world).split('\n');
    expect(lines).toHaveLength(world.rows);
    for (const line of lines) {
      expect([...line]).toHaveLength(world.cols);
    }
  });

  it('märker ut start, mål och alla skatter', () => {
    const text = worldToText(world);
    expect(text.split('S')).toHaveLength(2);
    expect(text.split('M')).toHaveLength(2);
    expect(text.split('*')).toHaveLength(world.treasures.length + 1);
  });

  it('sätter start och mål på rätt plats', () => {
    const lines = worldToText(world).split('\n').map((line) => [...line]);
    expect(lines[world.start.y][world.start.x]).toBe('S');
    expect(lines[world.goal.y][world.goal.x]).toBe('M');
    for (const treasure of world.treasures) {
      expect(lines[treasure.y][treasure.x]).toBe('*');
    }
  });

  it('använder bara tecken som finns i förklaringen', () => {
    const allowed = new Set(WORLD_TEXT_LEGEND.map((entry) => entry.symbol));
    for (const line of worldToText(world).split('\n')) {
      for (const symbol of line) {
        expect(allowed.has(symbol as never)).toBe(true);
      }
    }
  });

  it('har en förklaring till varje tecken', () => {
    expect(WORLD_TEXT_LEGEND).toHaveLength(6);
    for (const entry of WORLD_TEXT_LEGEND) {
      expect(entry.meaning.length).toBeGreaterThan(2);
    }
  });
});
