/**
 * Spelmotorn. Rena funktioner: ingen canvas, ingen webbläsare, ingen tid.
 *
 * Hjälten flyttar sig en ruta i taget. Väggar och hinder stoppar, golv släpper igenom, skatter
 * plockas upp och målet öppnas först när alla skatter är hämtade. Eftersom allt är rena
 * funktioner går varje regel att testa utan att rita något.
 */
import type {
  Direction,
  GameState,
  MoveEvent,
  MoveResult,
  PlayableWorld,
  Point,
  Terrain,
} from './types';

export const DIRECTIONS: Readonly<Record<Direction, { dx: number; dy: number; label: string }>> = {
  up: { dx: 0, dy: -1, label: 'upp' },
  down: { dx: 0, dy: 1, label: 'ner' },
  left: { dx: -1, dy: 0, label: 'vänster' },
  right: { dx: 1, dy: 0, label: 'höger' },
};

export function insideWorld(world: PlayableWorld, point: Point): boolean {
  return point.x >= 0 && point.y >= 0 && point.x < world.cols && point.y < world.rows;
}

export function tileAt(world: PlayableWorld, point: Point): Terrain | 'outside' {
  if (!insideWorld(world, point)) return 'outside';
  return world.terrain[point.y * world.cols + point.x];
}

/** Bara golv går att stå på. Hinder och väggar är i vägen. */
export function isWalkable(world: PlayableWorld, point: Point): boolean {
  return tileAt(world, point) === 'floor';
}

export function treasureIndexAt(world: PlayableWorld, point: Point): number {
  return world.treasures.findIndex(
    (treasure) => treasure.x === point.x && treasure.y === point.y,
  );
}

export function startGame(world: PlayableWorld): GameState {
  return {
    world,
    hero: { ...world.start },
    collected: [],
    steps: 0,
    stumbles: 0,
    status: 'playing',
  };
}

export function treasuresLeft(state: GameState): number {
  return state.world.treasures.length - state.collected.length;
}

/** De skatter som barnet inte har tagit än, i kartans ordning. */
export function remainingTreasures(state: GameState): Point[] {
  return state.world.treasures.filter((_, index) => !state.collected.includes(index));
}

/**
 * Ett steg. Hjälten stannar när något är i vägen, och ett hinder räknas som en snubbling –
 * det är spelets enda straff, det finns inga liv och ingen game over.
 */
export function move(state: GameState, direction: Direction): MoveResult {
  if (state.status === 'won') return { state, events: [] };

  const step = DIRECTIONS[direction];
  const target: Point = { x: state.hero.x + step.dx, y: state.hero.y + step.dy };
  const tile = tileAt(state.world, target);

  if (tile === 'wall' || tile === 'outside') {
    return { state, events: ['blocked'] };
  }

  if (tile === 'hazard') {
    return {
      state: { ...state, stumbles: state.stumbles + 1 },
      events: ['blocked'],
    };
  }

  const events: MoveEvent[] = [];
  const treasureIndex = treasureIndexAt(state.world, target);
  let collected = state.collected;
  if (treasureIndex >= 0 && !collected.includes(treasureIndex)) {
    collected = [...collected, treasureIndex];
    events.push('treasure');
  }

  const reachedGoal = target.x === state.world.goal.x && target.y === state.world.goal.y;
  const allCollected = collected.length >= state.world.treasures.length;

  if (reachedGoal && !allCollected) events.push('goal-locked');
  if (reachedGoal && allCollected) events.push('won');

  return {
    state: {
      ...state,
      hero: target,
      collected,
      steps: state.steps + 1,
      status: reachedGoal && allCollected ? 'won' : 'playing',
    },
    events,
  };
}

/** Klarade barnet världen, och hur många steg tog det? */
export function summary(state: GameState): { steps: number; stumbles: number; treasures: number } {
  return {
    steps: state.steps,
    stumbles: state.stumbles,
    treasures: state.collected.length,
  };
}
