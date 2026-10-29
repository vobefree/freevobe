import { describe, expect, it } from 'vitest';
import { describeWorld } from './describe';
import {
  DIRECTIONS,
  isWalkable,
  move,
  remainingTreasures,
  startGame,
  summary,
  tileAt,
  treasureIndexAt,
  treasuresLeft,
} from './game';
import type { GameState, PlayableWorld, Point } from './types';

/**
 * En liten karta att spela på i testerna:
 *
 *   #######
 *   #.....#   start (1,1), mål (5,1), skatt (3,1) och (4,3)
 *   #x##..#
 *   #.....#
 *   #######
 */
const ROWS = ['#######', '#.....#', '#x##..#', '#.....#', '#######'];

function makeWorld(
  start: Point = { x: 1, y: 1 },
  goal: Point = { x: 5, y: 1 },
  treasures: Point[] = [
    { x: 3, y: 1 },
    { x: 4, y: 3 },
  ],
): PlayableWorld {
  const cols = ROWS[0].length;
  const terrain = ROWS.flatMap((row) =>
    [...row].map((cell) => (cell === '#' ? 'wall' : cell === 'x' ? 'hazard' : 'floor')),
  );
  return {
    playable: true,
    cols,
    rows: ROWS.length,
    terrain,
    start,
    goal,
    treasures,
    route: [start, goal],
    spec: {
      ...describeWorld('en liten skog med en katt').spec,
      cols,
      rows: ROWS.length,
      target: treasures.length,
    },
  };
}

function walk(state: GameState, directions: ('up' | 'down' | 'left' | 'right')[]): GameState {
  return directions.reduce((current, direction) => move(current, direction).state, state);
}

/** Går hela vägen till målet: samlar skatten vid (3,1), hämtar (4,3) och går in i målet. */
const WINNING_PATH = [
  'right',
  'right',
  'right',
  'right',
  'down',
  'down',
  'right',
  'left',
  'up',
  'up',
] as const;

function playToWin(): GameState {
  return move(walk(startGame(makeWorld()), [...WINNING_PATH]), 'right').state;
}

describe('startGame', () => {
  it('börjar på startrutan utan skatter och steg', () => {
    const state = startGame(makeWorld());
    expect(state.hero).toEqual({ x: 1, y: 1 });
    expect(state.collected).toEqual([]);
    expect(state.steps).toBe(0);
    expect(state.stumbles).toBe(0);
    expect(state.status).toBe('playing');
    expect(treasuresLeft(state)).toBe(2);
  });

  it('delar inte startpunkten med kartan', () => {
    const world = makeWorld();
    const state = startGame(world);
    state.hero.x = 4;
    expect(world.start).toEqual({ x: 1, y: 1 });
  });
});

describe('tileAt och isWalkable', () => {
  it('känner igen golv, vägg, hinder och utanför kartan', () => {
    const world = makeWorld();
    expect(tileAt(world, { x: 2, y: 1 })).toBe('floor');
    expect(tileAt(world, { x: 0, y: 1 })).toBe('wall');
    expect(tileAt(world, { x: 1, y: 2 })).toBe('hazard');
    expect(tileAt(world, { x: -1, y: 1 })).toBe('outside');
    expect(isWalkable(world, { x: 2, y: 1 })).toBe(true);
    expect(isWalkable(world, { x: 1, y: 2 })).toBe(false);
  });
});

describe('move', () => {
  it('går ett steg på golv och räknar steget', () => {
    const result = move(startGame(makeWorld()), 'right');
    expect(result.state.hero).toEqual({ x: 2, y: 1 });
    expect(result.state.steps).toBe(1);
    expect(result.events).toEqual([]);
  });

  it('stannar vid en vägg och räknar inget steg', () => {
    const result = move(startGame(makeWorld()), 'left');
    expect(result.state.hero).toEqual({ x: 1, y: 1 });
    expect(result.state.steps).toBe(0);
    expect(result.events).toEqual(['blocked']);
  });

  it('stannar vid ett hinder och räknar en snubbling', () => {
    const result = move(startGame(makeWorld()), 'down');
    expect(result.state.hero).toEqual({ x: 1, y: 1 });
    expect(result.state.steps).toBe(0);
    expect(result.state.stumbles).toBe(1);
    expect(result.events).toEqual(['blocked']);
  });

  it('plockar upp en skatt och minns vilken', () => {
    const state = walk(startGame(makeWorld()), ['right', 'right']);
    expect(state.hero).toEqual({ x: 3, y: 1 });
    expect(state.collected).toEqual([0]);
    expect(treasuresLeft(state)).toBe(1);
    expect(remainingTreasures(state)).toEqual([{ x: 4, y: 3 }]);
    expect(treasureIndexAt(state.world, { x: 3, y: 1 })).toBe(0);
    expect(treasureIndexAt(state.world, { x: 2, y: 1 })).toBe(-1);
  });

  it('plockar inte samma skatt två gånger', () => {
    const once = walk(startGame(makeWorld()), ['right', 'right']);
    const twice = walk(once, ['left', 'right']);
    expect(twice.collected).toEqual([0]);
    expect(twice.steps).toBe(4);
  });

  it('säger till när målet är låst', () => {
    const state = walk(startGame(makeWorld()), ['right', 'right', 'right', 'right']);
    expect(state.hero).toEqual({ x: 5, y: 1 });
    expect(state.status).toBe('playing');
    expect(treasuresLeft(state)).toBe(1);
  });

  it('öppnar målet först när alla skatter är hämtade', () => {
    const beforeGoal = walk(startGame(makeWorld()), [...WINNING_PATH]);
    expect(beforeGoal.status).toBe('playing');

    const result = move(beforeGoal, 'right');
    expect(result.events).toContain('won');
    expect(result.state.status).toBe('won');
    expect(result.state.collected).toHaveLength(2);
  });

  it('låter bli att flytta efter att världen är klar', () => {
    const won = playToWin();
    expect(won.status).toBe('won');
    const finished = move(won, 'left');
    expect(finished.state).toEqual(won);
    expect(finished.events).toEqual([]);
  });

  it('ändrar inte det gamla tillståndet', () => {
    const before = startGame(makeWorld());
    const snapshot = { ...before };
    move(before, 'right');
    expect(before).toEqual(snapshot);
    expect(before.hero).toEqual({ x: 1, y: 1 });
  });

  it('går inte utanför kartan', () => {
    const world = makeWorld({ x: 1, y: 3 }, { x: 5, y: 1 }, [{ x: 2, y: 3 }]);
    const state = walk(startGame(world), ['down']);
    expect(state.hero).toEqual({ x: 1, y: 3 });
    expect(state.stumbles).toBe(0);
  });

  it('har en etikett för varje riktning', () => {
    expect(Object.keys(DIRECTIONS).sort()).toEqual(['down', 'left', 'right', 'up']);
    for (const direction of Object.values(DIRECTIONS)) {
      expect(Math.abs(direction.dx) + Math.abs(direction.dy)).toBe(1);
      expect(direction.label.length).toBeGreaterThan(2);
    }
  });
});

describe('summary', () => {
  it('räknar ihop steg, snubblingar och skatter', () => {
    const state = walk(startGame(makeWorld()), ['down', 'right', 'right']);
    expect(summary(state)).toEqual({ steps: 2, stumbles: 1, treasures: 1 });
  });
});
