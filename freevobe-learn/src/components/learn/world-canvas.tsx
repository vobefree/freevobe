'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DIRECTIONS, move, startGame, summary } from '@/lib/learn/game';
import { heroById, goalById, treasureById } from '@/lib/learn/lexicon';
import { TILE, drawWorld } from '@/lib/learn/render';
import type { Direction, GameState, MoveEvent, PlayableWorld } from '@/lib/learn/types';

export interface WorldCanvasProps {
  world: PlayableWorld;
  /** Bästa rundan för den här världen, om det finns någon. */
  best: { steps: number; stumbles: number } | null;
  onWin: (result: { steps: number; stumbles: number }) => void;
}

const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  W: 'up',
  s: 'down',
  S: 'down',
  a: 'left',
  A: 'left',
  d: 'right',
  D: 'right',
};

function messageFor(state: GameState, events: MoveEvent[], previousStumbles: number): string {
  const treasure = treasureById(state.world.spec.treasure);
  if (events.includes('won')) return `Du klarade världen på ${state.steps} steg!`;
  if (events.includes('treasure')) {
    return `Du hittade en ${treasure.one}! ${state.collected.length} av ${state.world.treasures.length} hämtade.`;
  }
  if (events.includes('goal-locked')) {
    const left = state.world.treasures.length - state.collected.length;
    return `Målet är låst. Du behöver ${left} ${left === 1 ? treasure.one : treasure.plural} till.`;
  }
  if (state.stumbles > previousStumbles) return 'Aj, där var ett hinder. Hjälten stannade.';
  return 'Där är det stopp. Prova en annan väg.';
}

export function WorldCanvas({ world, best, onWin }: WorldCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<GameState>(startGame(world));
  const finishedRef = useRef(false);

  const [state, setState] = useState<GameState>(gameRef.current);
  const [message, setMessage] = useState<string | null>(null);
  const [visible, setVisible] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);

  const hero = heroById(world.spec.hero);
  const treasure = treasureById(world.spec.treasure);
  const goal = goalById(world.spec.goal);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const element = sectionRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => setVisible(entries.some((entry) => entry.isIntersecting)),
      { threshold: 0.35 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const step = useCallback(
    (direction: Direction) => {
      if (finishedRef.current) return;
      const before = gameRef.current;
      const result = move(before, direction);
      gameRef.current = result.state;
      setState(result.state);

      if (result.events.length > 0) {
        setMessage(messageFor(result.state, result.events, before.stumbles));
      }
      if (result.events.includes('won') && !finishedRef.current) {
        finishedRef.current = true;
        onWin(summary(result.state));
      }
    },
    [onWin],
  );

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'TEXTAREA' ||
          target.tagName === 'INPUT' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      const direction = KEY_DIRECTIONS[event.key];
      if (!direction) return;
      event.preventDefault();
      step(direction);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [step, visible]);

  // Rita kartan. Gungningen stängs av när användaren ber om stilla bild.
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = world.cols * TILE * ratio;
    canvas.height = world.rows * TILE * ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    if (reduceMotion) {
      drawWorld(context, { world, state: gameRef.current, timeMs: 0, animate: false });
      return;
    }

    const startedAt = performance.now();
    let frame = 0;
    const paint = () => {
      drawWorld(context, {
        world,
        state: gameRef.current,
        timeMs: performance.now() - startedAt,
        animate: true,
      });
      frame = requestAnimationFrame(paint);
    };
    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [world, reduceMotion]);

  // Utan animation behöver bilden ritas om varje gång hjälten flyttar sig.
  useEffect(() => {
    if (!reduceMotion) return;
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    drawWorld(context, { world, state, timeMs: 0, animate: false });
  }, [reduceMotion, state, world]);

  const restart = () => {
    gameRef.current = startGame(world);
    finishedRef.current = false;
    setState(gameRef.current);
    setMessage('Ny runda. Samla alla skatter först, sedan målet.');
  };

  const collected = state.collected.length;
  const total = world.treasures.length;
  const won = state.status === 'won';

  return (
    <div ref={sectionRef} className="learn-panel learn-grid-bg relative overflow-hidden p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 px-1">
        <p className="font-mono text-[11px] tracking-[0.08em] text-[color:var(--learn-muted)]">
          {hero.label} · {goal.label}
        </p>
        <p className="text-sm font-semibold" data-testid="learn-hud-treasures">
          {treasure.label}: {collected} / {total}
        </p>
        <p className="text-sm text-[color:var(--learn-muted)]" data-testid="learn-hud-steps">
          Steg: {state.steps}
        </p>
        <p className="text-sm text-[color:var(--learn-muted)]">Snubblingar: {state.stumbles}</p>
        {best ? (
          <p className="text-sm text-[color:var(--learn-muted)]">
            Rekord: {best.steps} steg
          </p>
        ) : null}
        <button type="button" onClick={restart} className="learn-button learn-button-secondary ml-auto !px-3 !py-1.5 !text-[12.5px]">
          Börja om
        </button>
      </div>

      <div className="relative mx-auto" style={{ maxWidth: `${world.cols * TILE}px` }}>
        <canvas
          ref={canvasRef}
          tabIndex={0}
          role="img"
          aria-label={`Karta över ${world.spec.name}: ${world.cols} gånger ${world.rows} rutor. ${hero.label} ska hämta ${total} ${total === 1 ? treasure.one : treasure.plural} och sedan nå ${goal.label}.`}
          className="block h-auto w-full rounded-lg border-2 border-[color:var(--learn-line-strong)]"
          style={{ aspectRatio: `${world.cols} / ${world.rows}` }}
        />

        {won ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[color:rgba(4,16,11,0.72)] p-4">
            <div className="learn-panel max-w-sm p-5 text-center shadow-[6px_6px_0_var(--learn-shadow)]">
              <p className="font-mono text-[11px] tracking-[0.1em] text-[color:var(--learn-gold)]">
                Klar!
              </p>
              <h3 className="mt-1 text-2xl font-extrabold tracking-tight">Du klarade världen</h3>
              <p className="mt-2 text-sm text-[color:var(--learn-muted)]">
                {state.steps} steg och {state.stumbles} snubblingar.
                {best && best.steps === state.steps ? ' Det är ditt bästa!' : ''}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={restart} className="learn-button learn-button-primary">
                  Spela igen
                </button>
                <a href="#lektioner" className="learn-button learn-button-secondary">
                  Läs koden
                </a>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
        <div className="min-h-[2.5rem] text-sm" aria-live="polite">
          {message ? (
            <p className="rounded-lg border border-[color:var(--learn-line)] bg-[color:var(--learn-panel-strong)] px-3 py-2">
              {message}
            </p>
          ) : (
            <p className="px-1 text-[color:var(--learn-muted)]">
              Styr med piltangenterna, WASD eller knapparna.
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-1.5 self-center sm:self-auto" aria-label="Styrknappar">
          <span />
          <button
            type="button"
            className="learn-nav-key"
            aria-label={`Gå ${DIRECTIONS.up.label}`}
            onClick={() => step('up')}
          >
            ↑
          </button>
          <span />
          <button
            type="button"
            className="learn-nav-key"
            aria-label={`Gå ${DIRECTIONS.left.label}`}
            onClick={() => step('left')}
          >
            ←
          </button>
          <button
            type="button"
            className="learn-nav-key"
            aria-label={`Gå ${DIRECTIONS.down.label}`}
            onClick={() => step('down')}
          >
            ↓
          </button>
          <button
            type="button"
            className="learn-nav-key"
            aria-label={`Gå ${DIRECTIONS.right.label}`}
            onClick={() => step('right')}
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
