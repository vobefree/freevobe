/**
 * Kontrollen som en värld måste klara innan den får spelas.
 *
 * Reglerna är skrivna som meningar till barnet, inte som felkoder: varje problem säger vad som
 * är fel och vad man kan skriva i stället. Kontrollen tittar på kartan *efter* att den byggdes,
 * så den fångar också fel som generatorn inte kände till.
 */
import { GRID_LIMITS } from './generate';
import { BIOMES, GOALS, HEROES, OBSTACLES, TREASURES } from './lexicon';
import type { GeneratedWorld, PlayableWorld, ValidationIssue, WorldSpec } from './types';

/** Värden som beskrivningen måste hålla sig inom. */
export const WORLD_LIMITS = {
  nameLength: 40,
  labelLength: 40,
  targetMin: 1,
  targetMax: 8,
} as const;

const KNOWN_BIOMES = new Set(BIOMES.map((biome) => biome.id));
const KNOWN_HEROES = new Set(HEROES.map((hero) => hero.id));
const KNOWN_TREASURES = new Set(TREASURES.map((treasure) => treasure.id));
const KNOWN_OBSTACLES = new Set(OBSTACLES.map((obstacle) => obstacle.id));
const KNOWN_GOALS = new Set(GOALS.map((goal) => goal.id));

function issue(
  code: string,
  level: ValidationIssue['level'],
  message: string,
  fix: string,
  field?: ValidationIssue['field'],
): ValidationIssue {
  return { code, level, message, fix, field };
}

/** Kontrollerar beskrivningen – det barnet skrev, innan någon karta har byggts. */
export function validateSpec(spec: WorldSpec): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const name = spec.name.trim();

  if (!name) {
    issues.push(
      issue(
        'name-missing',
        'error',
        'Världen har inget namn.',
        'Skriv ett namn, till exempel "Månen".',
        'name',
      ),
    );
  } else if (name.length > WORLD_LIMITS.nameLength) {
    issues.push(
      issue(
        'name-too-long',
        'error',
        `Namnet är ${name.length} tecken. Det får vara högst ${WORLD_LIMITS.nameLength}.`,
        'Korta namnet lite.',
        'name',
      ),
    );
  }

  for (const [field, value] of [
    ['hero', spec.hero],
    ['treasure', spec.treasure],
    ['obstacle', spec.obstacle],
    ['goal', spec.goal],
  ] as const) {
    const label = value.trim();
    if (!label) {
      issues.push(
        issue(
          `${field}-missing`,
          'error',
          `Världen saknar ${field === 'hero' ? 'en hjälte' : 'ett namn på en sak i världen'}.`,
          'Skriv vem som ska gå i världen och vad som finns där.',
          field,
        ),
      );
    } else if (label.length > WORLD_LIMITS.labelLength) {
      issues.push(
        issue(
          `${field}-too-long`,
          'error',
          'Ett namn i världen är för långt.',
          `Håll varje namn under ${WORLD_LIMITS.labelLength} tecken.`,
          field,
        ),
      );
    }
  }

  if (spec.hero && spec.hero === spec.treasure) {
    issues.push(
      issue(
        'hero-is-treasure',
        'error',
        'Hjälten och skatten är samma sak.',
        'Välj en skatt som hjälten kan plocka upp.',
        'treasure',
      ),
    );
  }

  if (!KNOWN_BIOMES.has(spec.biome)) {
    issues.push(
      issue('unknown-biome', 'error', 'Jag vet inte vilken sorts värld det är.', 'Välj en plats.', 'biome'),
    );
  }
  if (!KNOWN_HEROES.has(spec.hero)) {
    issues.push(issue('unknown-hero', 'error', 'Jag vet inte vem som ska gå i världen.', 'Välj en hjälte.', 'hero'));
  }
  if (!KNOWN_TREASURES.has(spec.treasure)) {
    issues.push(issue('unknown-treasure', 'error', 'Jag vet inte vad som ska samlas.', 'Välj en skatt.', 'treasure'));
  }
  if (!KNOWN_OBSTACLES.has(spec.obstacle)) {
    issues.push(issue('unknown-obstacle', 'error', 'Jag vet inte vad som är i vägen.', 'Välj ett hinder.', 'obstacle'));
  }
  if (!KNOWN_GOALS.has(spec.goal)) {
    issues.push(issue('unknown-goal', 'error', 'Jag vet inte vart man ska gå.', 'Välj ett mål.', 'goal'));
  }

  if (
    !Number.isInteger(spec.target) ||
    spec.target < WORLD_LIMITS.targetMin ||
    spec.target > WORLD_LIMITS.targetMax
  ) {
    issues.push(
      issue(
        'target-out-of-range',
        'error',
        `Man kan samla mellan ${WORLD_LIMITS.targetMin} och ${WORLD_LIMITS.targetMax} saker.`,
        'Skriv en siffra mellan 1 och 8.',
        'target',
      ),
    );
  }

  if (
    !Number.isInteger(spec.cols) ||
    !Number.isInteger(spec.rows) ||
    spec.cols < GRID_LIMITS.minCols ||
    spec.cols > GRID_LIMITS.maxCols ||
    spec.rows < GRID_LIMITS.minRows ||
    spec.rows > GRID_LIMITS.maxRows
  ) {
    issues.push(
      issue(
        'size-out-of-range',
        'error',
        `Kartan kan vara mellan ${GRID_LIMITS.minCols} och ${GRID_LIMITS.maxCols} rutor bred och ${GRID_LIMITS.minRows} till ${GRID_LIMITS.maxRows} rutor hög.`,
        'Prova en mindre eller större värld.',
        'grid',
      ),
    );
  }

  return issues;
}

/** Alla golv som går att nå från start, med hinder som väggar. */
export function reachableTiles(world: GeneratedWorld): Set<number> {
  const { cols, rows, terrain, start } = world;
  const reachable = new Set<number>();
  const queue: number[] = [];

  const startIndex = start.y * cols + start.x;
  const startInside = start.x >= 0 && start.x < cols && start.y >= 0 && start.y < rows;
  if (!startInside || terrain[startIndex] !== 'floor') return reachable;

  reachable.add(startIndex);
  queue.push(startIndex);

  while (queue.length > 0) {
    const current = queue.shift() as number;
    const x = current % cols;
    const y = Math.floor(current / cols);
    const neighbours = [
      { x: x + 1, y },
      { x: x - 1, y },
      { x, y: y + 1 },
      { x, y: y - 1 },
    ];
    for (const neighbour of neighbours) {
      if (neighbour.x < 0 || neighbour.y < 0 || neighbour.x >= cols || neighbour.y >= rows) continue;
      const index = neighbour.y * cols + neighbour.x;
      if (reachable.has(index)) continue;
      if (terrain[index] !== 'floor') continue;
      reachable.add(index);
      queue.push(index);
    }
  }

  return reachable;
}

function key(point: { x: number; y: number }): string {
  return `${point.x},${point.y}`;
}

function isAdjacent(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
}

/** Kontrollerar den färdiga kartan. Bara `error` stoppar spelet; `warning` visas men spelar vidare. */
export function validateWorld(world: GeneratedWorld): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { cols, rows, terrain, start, goal, treasures, route } = world;
  const inside = (point: { x: number; y: number }) =>
    Number.isInteger(point.x) &&
    Number.isInteger(point.y) &&
    point.x >= 0 &&
    point.y >= 0 &&
    point.x < cols &&
    point.y < rows;
  const tileAt = (point: { x: number; y: number }) => terrain[point.y * cols + point.x];

  if (world.cols !== world.spec.cols || world.rows !== world.spec.rows) {
    issues.push(
      issue(
        'size-mismatch',
        'error',
        'Kartan är inte lika stor som beskrivningen.',
        'Bygg kartan igen.',
        'grid',
      ),
    );
  }

  if (terrain.length !== cols * rows) {
    return [
      ...issues,
      issue(
        'terrain-length',
        'error',
        `Kartan har ${terrain.length} rutor men borde ha ${cols * rows}.`,
        'Bygg kartan igen.',
        'grid',
      ),
    ];
  }

  if (terrain.some((tile) => tile !== 'floor' && tile !== 'wall' && tile !== 'hazard')) {
    issues.push(issue('terrain-invalid', 'error', 'Kartan innehåller en ruta som inte finns.', 'Bygg kartan igen.', 'grid'));
  }

  if (!inside(start)) {
    issues.push(issue('start-outside', 'error', 'Hjälten står utanför kartan.', 'Bygg kartan igen.', 'grid'));
  } else if (tileAt(start) !== 'floor') {
    issues.push(
      issue('start-blocked', 'error', 'Hjälten står inuti en vägg.', 'Flytta startplatsen till en ledig ruta.', 'grid'),
    );
  }

  if (!inside(goal)) {
    issues.push(issue('goal-outside', 'error', 'Målet ligger utanför kartan.', 'Bygg kartan igen.', 'goal'));
  } else if (tileAt(goal) !== 'floor') {
    issues.push(
      issue('goal-blocked', 'error', 'Målet ligger inuti en vägg, så ingen kan komma dit.', 'Flytta målet till en ledig ruta.', 'goal'),
    );
  }

  if (key(start) === key(goal)) {
    issues.push(issue('start-is-goal', 'error', 'Hjälten börjar redan på målet.', 'Flytta målet.', 'goal'));
  }

  if (treasures.length !== world.spec.target) {
    issues.push(
      issue(
        'treasure-count',
        'error',
        `Kartan har ${treasures.length} skatter men beskrivningen säger ${world.spec.target}.`,
        'Bygg kartan igen.',
        'target',
      ),
    );
  }

  const seenTreasures = new Set<string>();
  for (const treasure of treasures) {
    if (!inside(treasure)) {
      issues.push(issue('treasure-outside', 'error', 'En skatt ligger utanför kartan.', 'Bygg kartan igen.', 'target'));
      continue;
    }
    if (tileAt(treasure) !== 'floor') {
      issues.push(
        issue('treasure-blocked', 'error', 'En skatt ligger inuti en vägg, så ingen kan hämta den.', 'Flytta skatten till en ledig ruta.', 'target'),
      );
    }
    if (key(treasure) === key(start)) {
      issues.push(issue('treasure-on-start', 'error', 'En skatt ligger på startplatsen.', 'Flytta skatten.', 'target'));
    }
    if (key(treasure) === key(goal)) {
      issues.push(issue('treasure-on-goal', 'error', 'En skatt ligger på målet.', 'Flytta skatten.', 'target'));
    }
    if (seenTreasures.has(key(treasure))) {
      issues.push(issue('treasure-duplicate', 'error', 'Två skatter ligger på samma ruta.', 'Flytta den ena skatten.', 'target'));
    }
    seenTreasures.add(key(treasure));
  }

  // Gången ska hänga ihop och gå på golv – annars är det ingen väg.
  if (route.length < 2) {
    issues.push(issue('route-missing', 'error', 'Det finns ingen väg mellan start och mål.', 'Bygg kartan igen.', 'grid'));
  } else {
    if (key(route[0]) !== key(start) || key(route[route.length - 1]) !== key(goal)) {
      issues.push(
        issue('route-endpoints', 'error', 'Vägen börjar eller slutar inte där den ska.', 'Bygg kartan igen.', 'grid'),
      );
    }
    for (let i = 1; i < route.length; i += 1) {
      if (!isAdjacent(route[i - 1], route[i])) {
        issues.push(issue('route-broken', 'error', 'Vägen hoppar över en ruta.', 'Bygg kartan igen.', 'grid'));
        break;
      }
    }
    if (route.some((point) => !inside(point) || tileAt(point) !== 'floor')) {
      issues.push(
        issue('route-not-floor', 'error', 'Vägen går rakt igenom en vägg.', 'Bygg kartan igen.', 'grid'),
      );
    }
  }

  const reachable = reachableTiles(world);
  if (inside(goal) && tileAt(goal) === 'floor' && !reachable.has(goal.y * cols + goal.x)) {
    issues.push(
      issue(
        'goal-unreachable',
        'error',
        'Det finns ingen väg från hjälten fram till målet.',
        'Prova en annan mening, eller be om en mindre värld. Jag kan också bygga en ny karta.',
        'goal',
      ),
    );
  }

  const unreachableTreasures = treasures.filter(
    (treasure) => inside(treasure) && !reachable.has(treasure.y * cols + treasure.x),
  ).length;
  if (unreachableTreasures > 0) {
    issues.push(
      issue(
        'treasure-unreachable',
        'error',
        `${unreachableTreasures} ${unreachableTreasures === 1 ? 'skatt går' : 'skatter går'} inte att nå från starten.`,
        'Prova en annan mening, eller be om en mindre värld.',
        'target',
      ),
    );
  }

  if (route.some((point) => inside(point) && tileAt(point) === 'hazard')) {
    issues.push(
      issue('hazard-on-route', 'error', 'Ett hinder står mitt på vägen till målet.', 'Flytta hindret.', 'obstacle'),
    );
  }
  if (treasures.some((treasure) => inside(treasure) && tileAt(treasure) === 'hazard')) {
    issues.push(
      issue('hazard-on-treasure', 'error', 'Ett hinder står på en skatt.', 'Flytta hindret.', 'obstacle'),
    );
  }

  return issues;
}

export function hasErrors(issues: readonly ValidationIssue[]): boolean {
  return issues.some((candidate) => candidate.level === 'error');
}

/** Gör om en godkänd karta till den typ spelmotorn kräver. */
export function asPlayableWorld(
  world: GeneratedWorld,
  issues: readonly ValidationIssue[] = validateWorld(world),
): PlayableWorld | null {
  if (hasErrors(issues)) return null;
  // Märket sätts på riktigt, inte bara i typen: spelmotorn kan kontrollera det i efterhand.
  return { ...world, playable: true };
}
