import { describe, expect, it } from 'vitest';
import { buildWorld } from './compile';
import { describeWorld } from './describe';
import { generateWorld } from './generate';
import type { GeneratedWorld, Terrain, ValidationIssue } from './types';
import {
  WORLD_LIMITS,
  asPlayableWorld,
  hasErrors,
  reachableTiles,
  validateSpec,
  validateWorld,
} from './validate';

const specFor = (text: string) => describeWorld(text).spec;

function validWorld(text = 'en skog med en katt och tre stjärnor'): GeneratedWorld {
  const result = buildWorld(specFor(text));
  if (!result.ok) throw new Error('Testet behöver en spelbar karta');
  return result.world;
}

function codes(issues: readonly ValidationIssue[]): string[] {
  return issues.map((issue) => issue.code);
}

function wallPoint(world: GeneratedWorld) {
  for (let y = 1; y < world.rows - 1; y += 1) {
    for (let x = 1; x < world.cols - 1; x += 1) {
      if (world.terrain[y * world.cols + x] === 'wall') return { x, y };
    }
  }
  throw new Error('Kartan saknar vägg');
}

describe('validateSpec', () => {
  const base = specFor('en skog med en katt');

  it('godkänner en vanlig beskrivning', () => {
    expect(hasErrors(validateSpec(base))).toBe(false);
  });

  it('kräver ett namn och säger hur man löser det', () => {
    const issues = validateSpec({ ...base, name: '   ' });
    expect(codes(issues)).toContain('name-missing');
    expect(issues[0].message).toMatch(/namn/i);
    expect(issues[0].fix.length).toBeGreaterThan(10);
  });

  it('stoppar namn som är för långa', () => {
    const issues = validateSpec({ ...base, name: 'a'.repeat(WORLD_LIMITS.nameLength + 1) });
    expect(codes(issues)).toContain('name-too-long');
  });

  it('stoppar antal utanför 1–8', () => {
    expect(codes(validateSpec({ ...base, target: 0 }))).toContain('target-out-of-range');
    expect(codes(validateSpec({ ...base, target: 9 }))).toContain('target-out-of-range');
    expect(codes(validateSpec({ ...base, target: 1.5 }))).toContain('target-out-of-range');
  });

  it('stoppar kartor utanför rutnätets gränser', () => {
    expect(codes(validateSpec({ ...base, cols: 4, rows: 4 }))).toContain('size-out-of-range');
    expect(codes(validateSpec({ ...base, cols: 40, rows: 4 }))).toContain('size-out-of-range');
  });

  it('stoppar okända saker i världen', () => {
    const issues = validateSpec({
      ...base,
      biome: 'månen' as never,
      hero: 'zombie',
      treasure: 'inget',
      obstacle: 'inget',
      goal: 'inget',
    });
    expect(codes(issues)).toEqual(
      expect.arrayContaining([
        'unknown-biome',
        'unknown-hero',
        'unknown-treasure',
        'unknown-obstacle',
        'unknown-goal',
      ]),
    );
  });
});

describe('validateWorld', () => {
  it('godkänner en karta som generatorn byggde', () => {
    const world = validWorld();
    const issues = validateWorld(world);
    expect(hasErrors(issues)).toBe(false);
    expect(asPlayableWorld(world, issues)).not.toBeNull();
  });

  it('säger att målet är inbyggt när det ligger i en vägg', () => {
    const world = validWorld();
    const broken: GeneratedWorld = {
      ...world,
      terrain: world.terrain.map((tile, index) =>
        index === world.goal.y * world.cols + world.goal.x ? 'wall' : tile,
      ),
    };
    const issues = validateWorld(broken);
    expect(codes(issues)).toContain('goal-blocked');
    expect(issues.find((issue) => issue.code === 'goal-blocked')?.message).toMatch(/vägg/);
  });

  it('säger att det inte finns någon väg när målet är inringat', () => {
    const world = validWorld();
    const terrain = [...world.terrain];
    const neighbours = [
      { x: world.goal.x + 1, y: world.goal.y },
      { x: world.goal.x - 1, y: world.goal.y },
      { x: world.goal.x, y: world.goal.y + 1 },
      { x: world.goal.x, y: world.goal.y - 1 },
    ];
    for (const neighbour of neighbours) {
      if (neighbour.x < 0 || neighbour.y < 0 || neighbour.x >= world.cols || neighbour.y >= world.rows) {
        continue;
      }
      terrain[neighbour.y * world.cols + neighbour.x] = 'wall';
    }
    const issues = validateWorld({ ...world, terrain });
    expect(codes(issues)).toContain('goal-unreachable');
    expect(issues.find((issue) => issue.code === 'goal-unreachable')?.message).toMatch(/ingen väg/);
    expect(hasErrors(issues)).toBe(true);
  });

  it('säger att hjälten står i en vägg', () => {
    const world = validWorld();
    const issues = validateWorld({ ...world, start: wallPoint(world) });
    expect(codes(issues)).toContain('start-blocked');
  });

  it('säger att hjälten redan står på målet', () => {
    const world = validWorld();
    const issues = validateWorld({ ...world, start: world.goal });
    expect(codes(issues)).toContain('start-is-goal');
  });

  it('räknar skatter mot beskrivningen', () => {
    const world = validWorld();
    const issues = validateWorld({ ...world, treasures: world.treasures.slice(1) });
    expect(codes(issues)).toContain('treasure-count');
  });

  it('hittar två skatter på samma ruta', () => {
    const world = validWorld();
    const duplicated = [world.treasures[0], world.treasures[0], world.treasures[1]];
    const issues = validateWorld({ ...world, treasures: duplicated });
    expect(codes(issues)).toContain('treasure-duplicate');
  });

  it('stoppar skatter som ligger i en vägg eller utanför kartan', () => {
    const world = validWorld();
    const blocked = validateWorld({
      ...world,
      treasures: [wallPoint(world), world.treasures[1], world.treasures[2]],
    });
    expect(codes(blocked)).toContain('treasure-blocked');

    const outside = validateWorld({
      ...world,
      treasures: [{ x: -1, y: 0 }, world.treasures[1], world.treasures[2]],
    });
    expect(codes(outside)).toContain('treasure-outside');
  });

  it('hittar hinder mitt på vägen', () => {
    const world = validWorld();
    const onRoute = world.route[1];
    const terrain = [...world.terrain];
    terrain[onRoute.y * world.cols + onRoute.x] = 'hazard';
    const issues = validateWorld({ ...world, terrain });
    expect(codes(issues)).toContain('hazard-on-route');
  });

  it('upptäcker att vägen hoppar över en ruta', () => {
    const world = validWorld();
    const route = [...world.route];
    route.splice(2, 1);
    const issues = validateWorld({ ...world, route });
    expect(codes(issues)).toContain('route-broken');
  });

  it('upptäcker att kartan inte är lika stor som beskrivningen', () => {
    const world = validWorld();
    const issues = validateWorld({ ...world, spec: { ...world.spec, cols: world.cols + 2 } });
    expect(codes(issues)).toContain('size-mismatch');
  });

  it('varnar men stoppar inte spelet när något bara är en varning', () => {
    const world = validWorld();
    const warning: ValidationIssue = {
      code: 'exempel',
      level: 'warning',
      message: 'Bara en varning.',
      fix: 'Inget att göra.',
    };
    expect(hasErrors([warning])).toBe(false);
    expect(asPlayableWorld(world, [warning])).not.toBeNull();
  });
});

describe('reachableTiles', () => {
  it('når inte genom väggar', () => {
    const world = generateWorld(specFor('en skog med en katt'));
    const terrain: Terrain[] = world.terrain.map(() => 'wall');
    terrain[world.start.y * world.cols + world.start.x] = 'floor';
    const reachable = reachableTiles({ ...world, terrain });
    expect(reachable.size).toBe(1);
  });

  it('når alla golv som hänger ihop med starten', () => {
    const world = validWorld();
    const reachable = reachableTiles(world);
    expect(reachable.size).toBeGreaterThan(1);
    expect(reachable.has(world.goal.y * world.cols + world.goal.x)).toBe(true);
  });
});
