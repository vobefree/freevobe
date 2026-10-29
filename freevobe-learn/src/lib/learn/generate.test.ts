import { describe, expect, it } from 'vitest';
import { describeWorld } from './describe';
import { GRID_LIMITS, createRng, generateWorld } from './generate';
import { reachableTiles } from './validate';
import type { GeneratedWorld, Point } from './types';

const specFor = (text: string) => describeWorld(text).spec;

function indexOf(world: GeneratedWorld, point: Point): number {
  return point.y * world.cols + point.x;
}

describe('createRng', () => {
  it('ger samma följd för samma frö', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('ger tal mellan 0 och 1', () => {
    const rng = createRng(7);
    for (let i = 0; i < 50; i += 1) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('generateWorld', () => {
  it('ger samma karta för samma beskrivning och en annan karta för ett nytt försök', () => {
    const spec = specFor('en skog med en katt och tre stjärnor');
    expect(generateWorld(spec)).toEqual(generateWorld(spec));
    expect(generateWorld(spec, { attempt: 1 }).terrain).not.toEqual(generateWorld(spec).terrain);
  });

  it('sätter hjälte och mål på golv inuti kartan', () => {
    const world = generateWorld(specFor('rymden med en robot'));
    for (const point of [world.start, world.goal]) {
      expect(point.x).toBeGreaterThanOrEqual(1);
      expect(point.y).toBeGreaterThanOrEqual(1);
      expect(point.x).toBeLessThanOrEqual(world.cols - 2);
      expect(point.y).toBeLessThanOrEqual(world.rows - 2);
      expect(world.terrain[indexOf(world, point)]).toBe('floor');
    }
    expect(world.start).not.toEqual(world.goal);
  });

  it('har alltid en yttervägg runt hela kartan', () => {
    const world = generateWorld(specFor('en liten stad med en hund'));
    for (let x = 0; x < world.cols; x += 1) {
      expect(world.terrain[x]).not.toBe('floor');
      expect(world.terrain[(world.rows - 1) * world.cols + x]).not.toBe('floor');
    }
    for (let y = 0; y < world.rows; y += 1) {
      expect(world.terrain[y * world.cols]).not.toBe('floor');
      expect(world.terrain[y * world.cols + world.cols - 1]).not.toBe('floor');
    }
  });

  it('ritar en gång som hänger ihop från start till mål', () => {
    const world = generateWorld(specFor('en farlig vulkan med en drake'));
    expect(world.route[0]).toEqual(world.start);
    expect(world.route[world.route.length - 1]).toEqual(world.goal);
    for (let i = 1; i < world.route.length; i += 1) {
      const step =
        Math.abs(world.route[i].x - world.route[i - 1].x) +
        Math.abs(world.route[i].y - world.route[i - 1].y);
      expect(step).toBe(1);
      expect(world.terrain[indexOf(world, world.route[i])]).toBe('floor');
    }
  });

  it('lägger alla skatter på golv och aldrig på start eller mål', () => {
    const world = generateWorld(specFor('en skog med en katt och fem bär'));
    expect(world.treasures).toHaveLength(5);
    for (const treasure of world.treasures) {
      expect(world.terrain[indexOf(world, treasure)]).toBe('floor');
      expect(treasure).not.toEqual(world.start);
      expect(treasure).not.toEqual(world.goal);
    }
    expect(new Set(world.treasures.map((treasure) => `${treasure.x},${treasure.y}`)).size).toBe(5);
  });

  it('lägger hinder bara där ingen behöver gå', () => {
    const world = generateWorld(specFor('en farlig djungel med en groda och fyra kristaller'));
    const routeTiles = new Set(world.route.map((point) => indexOf(world, point)));
    for (let index = 0; index < world.terrain.length; index += 1) {
      if (world.terrain[index] !== 'hazard') continue;
      expect(routeTiles.has(index)).toBe(false);
      expect(world.treasures.map((treasure) => indexOf(world, treasure))).not.toContain(index);
    }
  });

  it('gör alla skatter och målet nåbara', () => {
    const world = generateWorld(specFor('en jättestor farlig rymd med en robot och 8 mynt'));
    const reachable = reachableTiles(world);
    expect(reachable.has(indexOf(world, world.goal))).toBe(true);
    for (const treasure of world.treasures) {
      expect(reachable.has(indexOf(world, treasure))).toBe(true);
    }
  });

  it('håller kartan inom rutnätets gränser även när beskrivningen är extrem', () => {
    const spec = { ...specFor('en skog med en katt'), cols: 400, rows: 2 };
    const world = generateWorld(spec);
    expect(world.cols).toBe(GRID_LIMITS.maxCols);
    expect(world.rows).toBe(GRID_LIMITS.minRows);
  });

  it('kan alltid lägga ut det antal skatter som efterfrågades, även på en liten karta', () => {
    const spec = { ...specFor('en liten skog med en katt'), cols: 9, rows: 7, target: 8 };
    const world = generateWorld(spec);
    expect(world.treasures).toHaveLength(8);
    const reachable = reachableTiles(world);
    for (const treasure of world.treasures) {
      expect(reachable.has(indexOf(world, treasure))).toBe(true);
    }
  });
});
