/**
 * Från världsbeskrivning till karta.
 *
 * Generatorn ritar en gång mellan start och mål, hänger skatter i återvändsgränder och lägger
 * hinder bara på golv som ingen behöver gå på. Därför går kartan alltid att spela – och
 * `validateWorld` kontrollerar det en gång till, oberoende av hur kartan byggdes.
 *
 * Allt styrs av ett frö. Samma beskrivning ger samma karta, varje gång.
 */
import type { GeneratedWorld, Point, Terrain, WorldSpec } from './types';

export const GRID_LIMITS = {
  minCols: 9,
  maxCols: 25,
  minRows: 7,
  maxRows: 19,
} as const;

/** mulberry32 – liten, snabb och reproducerbar slumptalsgenerator. */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const NEIGHBOURS: readonly { dx: number; dy: number }[] = [
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
];

export interface GenerateOptions {
  /** Försök nummer N ger en annan karta ur samma beskrivning. */
  attempt?: number;
}

/**
 * Bygger kartan. Rutnätet har alltid en yttervägg, så hjälten kan aldrig gå ut ur världen.
 */
export function generateWorld(spec: WorldSpec, options: GenerateOptions = {}): GeneratedWorld {
  const attempt = options.attempt ?? 0;
  const cols = clamp(Math.round(spec.cols), GRID_LIMITS.minCols, GRID_LIMITS.maxCols);
  const rows = clamp(Math.round(spec.rows), GRID_LIMITS.minRows, GRID_LIMITS.maxRows);
  const rng = createRng((spec.seed + attempt * 0x9e3779b1) >>> 0);

  const terrain: Terrain[] = Array.from({ length: cols * rows }, () => 'wall');
  const idx = (x: number, y: number) => y * cols + x;
  const inside = (x: number, y: number) => x >= 1 && y >= 1 && x <= cols - 2 && y <= rows - 2;

  const carve = (point: Point) => {
    if (inside(point.x, point.y)) terrain[idx(point.x, point.y)] = 'floor';
  };

  // ---- 1. Gången från start till mål. Monoton åt höger, så den kan aldrig gå vilse.
  const start: Point = { x: 1, y: 1 + Math.floor(rng() * (rows - 2)) };
  const goal: Point = { x: cols - 2, y: 1 + Math.floor(rng() * (rows - 2)) };

  const route: Point[] = [start];
  carve(start);
  let cursor = { ...start };
  let guard = 0;

  while ((cursor.x !== goal.x || cursor.y !== goal.y) && guard < cols * rows * 4) {
    guard += 1;
    const roll = rng();
    if (cursor.x !== goal.x && roll > 0.32) {
      cursor = { x: cursor.x + 1, y: cursor.y };
    } else if (cursor.y < goal.y) {
      cursor = { x: cursor.x, y: cursor.y + 1 };
    } else if (cursor.y > goal.y) {
      cursor = { x: cursor.x, y: cursor.y - 1 };
    } else {
      cursor = { x: cursor.x + 1, y: cursor.y };
    }
    carve(cursor);
    route.push(cursor);
  }
  if (route[route.length - 1].x !== goal.x || route[route.length - 1].y !== goal.y) {
    route.push(goal);
    carve(goal);
  }

  // Gången blir lite bredare ibland, så att kartan inte bara är en linje.
  for (const point of [...route]) {
    if (rng() < 0.2) {
      const neighbour = NEIGHBOURS[Math.floor(rng() * NEIGHBOURS.length)];
      carve({ x: point.x + neighbour.dx, y: point.y + neighbour.dy });
    }
  }

  // ---- 2. Skrymslen med skatter. Skattens väg skyddas, så att inget hinder kan stänga in den.
  const protectedTiles = new Set<number>(route.map((point) => idx(point.x, point.y)));
  const treasures: Point[] = [];
  const treasureTiles = new Set<number>();

  const carveBranch = (): Point[] | null => {
    for (let tries = 0; tries < 40; tries += 1) {
      const origin = route[Math.floor(rng() * route.length)];
      const direction = NEIGHBOURS[Math.floor(rng() * NEIGHBOURS.length)];
      const length = 3 + Math.floor(rng() * 4);
      const path: Point[] = [];
      let x = origin.x;
      let y = origin.y;

      for (let step = 0; step < length; step += 1) {
        const nextX = x + direction.dx;
        const nextY = y + direction.dy;
        if (!inside(nextX, nextY)) break;
        if (terrain[idx(nextX, nextY)] === 'floor') break;
        x = nextX;
        y = nextY;
        carve({ x, y });
        path.push({ x, y });
      }

      for (const point of path) protectedTiles.add(idx(point.x, point.y));
      if (path.length >= 2) return path;
    }
    return null;
  };

  const wanted = clamp(Math.round(spec.target), 1, 8);
  let attempts = 0;
  while (treasures.length < wanted && attempts < wanted * 16 + 24) {
    attempts += 1;
    const branch = carveBranch();
    if (!branch) continue;
    const tip = branch[branch.length - 1];
    const tipIndex = idx(tip.x, tip.y);
    if (treasureTiles.has(tipIndex)) continue;
    treasureTiles.add(tipIndex);
    treasures.push(tip);
  }

  // Om skrymslena inte räckte: lägg resten på lediga golv, en bit från start och mål. Alla golv
  // hänger ihop med gången, så skatten går att nå även här.
  if (treasures.length < wanted) {
    for (let y = 1; y <= rows - 2 && treasures.length < wanted; y += 1) {
      for (let x = 1; x <= cols - 2 && treasures.length < wanted; x += 1) {
        const index = idx(x, y);
        if (terrain[index] !== 'floor' || treasureTiles.has(index)) continue;
        const fromStart = Math.abs(x - start.x) + Math.abs(y - start.y);
        const fromGoal = Math.abs(x - goal.x) + Math.abs(y - goal.y);
        if (fromStart < 1 || fromGoal < 1) continue;
        treasureTiles.add(index);
        treasures.push({ x, y });
      }
    }
  }

  // ---- 3. Genvägar, så att kartan får val i stället för en enda lång korridor.
  const links = 1 + Math.floor(rng() * 2);
  for (let link = 0; link < links; link += 1) {
    const a = route[Math.floor(rng() * route.length)];
    const b = route[Math.floor(rng() * route.length)];
    if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) < 4) continue;
    let x = a.x;
    let y = a.y;
    while (x !== b.x) {
      x += Math.sign(b.x - x);
      carve({ x, y });
      protectedTiles.add(idx(x, y));
    }
    while (y !== b.y) {
      y += Math.sign(b.y - y);
      carve({ x, y });
      protectedTiles.add(idx(x, y));
    }
  }

  // ---- 4. Hinder. Bara på golv som ingen behöver gå på, aldrig på gången eller vid en skatt.
  const openTiles: number[] = [];
  for (let index = 0; index < terrain.length; index += 1) {
    if (terrain[index] !== 'floor') continue;
    if (protectedTiles.has(index) || treasureTiles.has(index)) continue;
    openTiles.push(index);
  }
  for (let i = openTiles.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [openTiles[i], openTiles[j]] = [openTiles[j], openTiles[i]];
  }

  const density = spec.mood === 'wild' ? 0.22 : 0.1;
  const hazardCount = Math.min(openTiles.length, Math.round(openTiles.length * density));
  for (let i = 0; i < hazardCount; i += 1) {
    terrain[openTiles[i]] = 'hazard';
  }

  return {
    spec,
    cols,
    rows,
    terrain,
    start,
    goal,
    treasures,
    route,
  };
}
