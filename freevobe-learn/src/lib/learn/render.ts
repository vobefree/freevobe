/**
 * Ritandet av världen.
 *
 * Här finns inga spelregler – bara former och färger. Funktionen får ett tillstånd och en tid
 * och ritar samma bild varje gång för samma indata (bortsett från den lilla gungningen), vilket
 * gör den lätt att byta ut eller stänga av.
 */
import type { GameState, PlayableWorld, Point, Terrain } from './types';
import { biomeById, goalById, heroById, obstacleById, treasureById } from './lexicon';

/** En ruta i pixlar. Kartan ritas alltid i den här storleken och skalas sedan av CSS. */
export const TILE = 40;

export interface DrawOptions {
  world: PlayableWorld;
  state: GameState;
  /** Millisekunder sedan spelet startade. */
  timeMs: number;
  /** Stilla bild för den som föredrar det. */
  animate?: boolean;
}

function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const value = clean.length === 3 ? clean.split('').map((ch) => ch + ch).join('') : clean;
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function triangle(
  ctx: CanvasRenderingContext2D,
  points: [Point, Point, Point],
): void {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  ctx.lineTo(points[1].x, points[1].y);
  ctx.lineTo(points[2].x, points[2].y);
  ctx.closePath();
}

function drawFloor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  palette: { floor: string; floorAlt: string },
  even: boolean,
): void {
  ctx.fillStyle = even ? palette.floor : palette.floorAlt;
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.beginPath();
  ctx.arc(x + TILE / 2, y + TILE / 2, 1.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawWall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  palette: { wall: string; wallTop: string; ink: string },
  edge: boolean,
): void {
  ctx.fillStyle = palette.wall;
  roundedRect(ctx, x + 1, y + 1, TILE - 2, TILE - 2, 7);
  ctx.fill();
  ctx.fillStyle = palette.wallTop;
  roundedRect(ctx, x + 1, y + 1, TILE - 2, 7, 5);
  ctx.fill();
  if (edge) {
    ctx.strokeStyle = withAlpha(palette.ink, 0.45);
    ctx.lineWidth = 1;
    roundedRect(ctx, x + 1.5, y + 1.5, TILE - 3, TILE - 3, 7);
    ctx.stroke();
  }
}

function drawObstacle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  art: string,
  color: string,
  ink: string,
): void {
  const cx = x + TILE / 2;
  const cy = y + TILE / 2;
  ctx.save();
  ctx.strokeStyle = withAlpha(ink, 0.5);
  ctx.lineWidth = 1.5;
  ctx.fillStyle = color;

  switch (art) {
    case 'lava': {
      ctx.beginPath();
      ctx.ellipse(cx, y + TILE - 9, TILE / 2 - 3, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = withAlpha('#ffe08a', 0.8);
      ctx.beginPath();
      ctx.arc(cx - 5, y + TILE - 10, 2.4, 0, Math.PI * 2);
      ctx.arc(cx + 6, y + TILE - 12, 1.8, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'spikes':
    case 'thorns': {
      for (let i = 0; i < 3; i += 1) {
        const left = x + 6 + i * 10;
        triangle(ctx, [
          { x: left, y: y + TILE - 7 },
          { x: left + 5, y: y + 10 },
          { x: left + 10, y: y + TILE - 7 },
        ]);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }
    case 'bush': {
      ctx.beginPath();
      ctx.arc(cx - 6, cy + 4, 8, 0, Math.PI * 2);
      ctx.arc(cx + 6, cy + 4, 8, 0, Math.PI * 2);
      ctx.arc(cx, cy - 3, 9, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'crate': {
      ctx.fillRect(x + 8, y + 10, TILE - 16, TILE - 18);
      ctx.strokeRect(x + 8, y + 10, TILE - 16, TILE - 18);
      ctx.beginPath();
      ctx.moveTo(x + 8, y + 10);
      ctx.lineTo(x + TILE - 8, y + TILE - 8);
      ctx.moveTo(x + TILE - 8, y + 10);
      ctx.lineTo(x + 8, y + TILE - 8);
      ctx.stroke();
      break;
    }
    case 'cactus': {
      roundedRect(ctx, cx - 4, y + 8, 8, TILE - 16, 4);
      ctx.fill();
      roundedRect(ctx, cx - 12, cy - 2, 8, 6, 3);
      ctx.fill();
      roundedRect(ctx, cx + 4, cy + 2, 8, 6, 3);
      ctx.fill();
      break;
    }
    case 'ice': {
      ctx.fillStyle = withAlpha(color, 0.75);
      for (let i = 0; i < 3; i += 1) {
        const px = x + 9 + i * 9;
        triangle(ctx, [
          { x: px, y: y + TILE - 8 },
          { x: px + 5, y: y + 8 + i * 3 },
          { x: px + 10, y: y + TILE - 8 },
        ]);
        ctx.fill();
      }
      break;
    }
    case 'wave': {
      ctx.beginPath();
      for (let i = 0; i < 2; i += 1) {
        ctx.moveTo(x + 5, y + 16 + i * 12);
        ctx.quadraticCurveTo(cx, y + 8 + i * 12, x + TILE - 5, y + 16 + i * 12);
      }
      ctx.stroke();
      ctx.strokeStyle = withAlpha(color, 0.9);
      ctx.lineWidth = 3;
      ctx.stroke();
      break;
    }
    case 'car': {
      roundedRect(ctx, x + 6, y + 14, TILE - 12, TILE - 26, 5);
      ctx.fill();
      ctx.fillStyle = withAlpha(ink, 0.7);
      ctx.beginPath();
      ctx.arc(x + 12, y + TILE - 12, 3.5, 0, Math.PI * 2);
      ctx.arc(x + TILE - 12, y + TILE - 12, 3.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    default: {
      roundedRect(ctx, x + 9, y + 9, TILE - 18, TILE - 18, 6);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawTreasure(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  shape: string,
  color: string,
  ink: string,
  timeMs: number,
  animate: boolean,
): void {
  const bob = animate ? Math.sin(timeMs / 320) * 2 : 0;
  const cx = x + TILE / 2;
  const cy = y + TILE / 2 + bob;
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = withAlpha(ink, 0.45);
  ctx.lineWidth = 1.4;

  switch (shape) {
    case 'star': {
      ctx.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const angle = (Math.PI / 5) * i - Math.PI / 2;
        const radius = i % 2 === 0 ? 11 : 4.8;
        const px = cx + Math.cos(angle) * radius;
        const py = cy + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'coin': {
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = withAlpha(ink, 0.25);
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'berry': {
      ctx.beginPath();
      ctx.arc(cx, cy + 2, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#4ade80';
      triangle(ctx, [
        { x: cx, y: cy - 12 },
        { x: cx + 8, y: cy - 6 },
        { x: cx, y: cy - 4 },
      ]);
      ctx.fill();
      break;
    }
    case 'crystal': {
      ctx.beginPath();
      ctx.moveTo(cx, cy - 12);
      ctx.lineTo(cx + 8, cy - 2);
      ctx.lineTo(cx + 4, cy + 11);
      ctx.lineTo(cx - 4, cy + 11);
      ctx.lineTo(cx - 8, cy - 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'candy': {
      ctx.beginPath();
      ctx.arc(cx, cy, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = withAlpha('#ffffff', 0.75);
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0.6, 3.6);
      ctx.stroke();
      break;
    }
    case 'shell': {
      ctx.beginPath();
      ctx.arc(cx, cy + 2, 10, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = withAlpha(ink, 0.3);
      ctx.beginPath();
      ctx.moveTo(cx, cy - 8);
      ctx.lineTo(cx, cy + 2);
      ctx.moveTo(cx - 6, cy - 4);
      ctx.lineTo(cx - 2, cy + 2);
      ctx.moveTo(cx + 6, cy - 4);
      ctx.lineTo(cx + 2, cy + 2);
      ctx.stroke();
      break;
    }
    default: {
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = withAlpha(ink, 0.35);
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0.6, 2.4);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawGoal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  art: string,
  color: string,
  ink: string,
  locked: boolean,
  timeMs: number,
  animate: boolean,
): void {
  const cx = x + TILE / 2;
  const glow = animate ? 0.35 + Math.sin(timeMs / 500) * 0.12 : 0.4;
  ctx.save();
  ctx.fillStyle = withAlpha(color, glow);
  roundedRect(ctx, x + 2, y + 2, TILE - 4, TILE - 4, 8);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.strokeStyle = withAlpha(ink, 0.55);
  ctx.lineWidth = 1.5;

  switch (art) {
    case 'ship': {
      ctx.beginPath();
      ctx.moveTo(cx, y + 9);
      ctx.lineTo(cx + 8, y + TILE - 16);
      ctx.lineTo(cx - 8, y + TILE - 16);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillRect(cx - 6, y + TILE - 16, 12, 4);
      break;
    }
    case 'castle':
    case 'tower': {
      ctx.fillRect(cx - 9, y + 14, 18, TILE - 22);
      ctx.fillStyle = withAlpha(ink, 0.65);
      for (let i = 0; i < 3; i += 1) {
        ctx.fillRect(cx - 9 + i * 7, y + 9, 4, 6);
      }
      ctx.fillStyle = color;
      ctx.fillRect(cx - 3, y + TILE - 16, 6, 8);
      break;
    }
    case 'home': {
      triangle(ctx, [
        { x: cx - 11, y: y + 18 },
        { x: cx, y: y + 9 },
        { x: cx + 11, y: y + 18 },
      ]);
      ctx.fill();
      ctx.fillRect(cx - 8, y + 18, 16, TILE - 26);
      ctx.fillStyle = withAlpha(ink, 0.6);
      ctx.fillRect(cx - 2, y + TILE - 15, 5, 7);
      break;
    }
    case 'chest': {
      roundedRect(ctx, cx - 11, y + 14, 22, TILE - 22, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = withAlpha(ink, 0.6);
      ctx.fillRect(cx - 2, y + 20, 4, 6);
      break;
    }
    case 'hill': {
      triangle(ctx, [
        { x: cx - 12, y: y + TILE - 10 },
        { x: cx, y: y + 10 },
        { x: cx + 12, y: y + TILE - 10 },
      ]);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = withAlpha('#ffffff', 0.85);
      triangle(ctx, [
        { x: cx - 3.5, y: y + 16 },
        { x: cx, y: y + 10 },
        { x: cx + 3.5, y: y + 16 },
      ]);
      ctx.fill();
      break;
    }
    default: {
      ctx.beginPath();
      ctx.moveTo(cx - 9, y + TILE - 8);
      ctx.lineTo(cx - 9, y + 16);
      ctx.quadraticCurveTo(cx, y + 4, cx + 9, y + 16);
      ctx.lineTo(cx + 9, y + TILE - 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = withAlpha(ink, 0.7);
      ctx.beginPath();
      ctx.arc(cx + 4, y + TILE - 17, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (locked) {
    ctx.fillStyle = withAlpha(ink, 0.75);
    roundedRect(ctx, cx - 7, y + TILE - 13, 14, 11, 3);
    ctx.fill();
    ctx.strokeStyle = withAlpha('#ffffff', 0.8);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cx, y + TILE - 13, 4, Math.PI, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHero(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  hero: { color: string; ears: string },
  ink: string,
  timeMs: number,
  animate: boolean,
): void {
  const bob = animate ? Math.sin(timeMs / 260) * 1.5 : 0;
  const cx = x + TILE / 2;
  const base = y + TILE - 7 + bob;

  ctx.save();
  ctx.fillStyle = withAlpha(ink, 0.25);
  ctx.beginPath();
  ctx.ellipse(cx, base + 4, 11, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = hero.color;
  ctx.strokeStyle = withAlpha(ink, 0.6);
  ctx.lineWidth = 1.6;

  switch (hero.ears) {
    case 'pointy':
    case 'tufts': {
      triangle(ctx, [
        { x: cx - 11, y: base - 16 },
        { x: cx - 8, y: base - 27 },
        { x: cx - 3, y: base - 18 },
      ]);
      ctx.fill();
      ctx.stroke();
      triangle(ctx, [
        { x: cx + 3, y: base - 18 },
        { x: cx + 8, y: base - 27 },
        { x: cx + 11, y: base - 16 },
      ]);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'long': {
      for (const offset of [-5, 5]) {
        ctx.beginPath();
        ctx.ellipse(cx + offset, base - 27, 3.6, 10, offset > 0 ? 0.16 : -0.16, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }
    case 'floppy': {
      for (const offset of [-10, 10]) {
        ctx.beginPath();
        ctx.ellipse(cx + offset, base - 17, 4.5, 7, offset > 0 ? 0.5 : -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }
    case 'antenna': {
      ctx.beginPath();
      ctx.moveTo(cx, base - 22);
      ctx.lineTo(cx, base - 30);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, base - 31, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'horn': {
      triangle(ctx, [
        { x: cx - 3, y: base - 21 },
        { x: cx + 1, y: base - 31 },
        { x: cx + 4, y: base - 21 },
      ]);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'fin': {
      triangle(ctx, [
        { x: cx - 12, y: base - 14 },
        { x: cx - 18, y: base - 22 },
        { x: cx - 6, y: base - 20 },
      ]);
      ctx.fill();
      break;
    }
    default:
      break;
  }

  // Kroppen.
  roundedRect(ctx, cx - 10, base - 21, 20, 21, 8);
  ctx.fill();
  ctx.stroke();

  // Ögonen.
  ctx.fillStyle = withAlpha('#ffffff', 0.95);
  ctx.beginPath();
  ctx.arc(cx - 4.5, base - 14, 3.2, 0, Math.PI * 2);
  ctx.arc(cx + 4.5, base - 14, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.arc(cx - 4.1, base - 13.6, 1.5, 0, Math.PI * 2);
  ctx.arc(cx + 4.9, base - 13.6, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Fötterna.
  ctx.fillStyle = hero.color;
  ctx.strokeStyle = withAlpha(ink, 0.5);
  ctx.beginPath();
  ctx.ellipse(cx - 5, base + 1, 4, 2.4, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 5, base + 1, 4, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Ritar hela världen. Anropas från `requestAnimationFrame` i `WorldCanvas`. */
export function drawWorld(ctx: CanvasRenderingContext2D, options: DrawOptions): void {
  const { world, state, timeMs, animate = true } = options;
  const palette = biomeById(world.spec.biome).palette;
  const hero = heroById(world.spec.hero);
  const treasure = treasureById(world.spec.treasure);
  const obstacle = obstacleById(world.spec.obstacle);
  const goal = goalById(world.spec.goal);
  const width = world.cols * TILE;
  const height = world.rows * TILE;

  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = palette.sky;
  ctx.fillRect(0, 0, width, height);

  for (let row = 0; row < world.rows; row += 1) {
    for (let column = 0; column < world.cols; column += 1) {
      const index = row * world.cols + column;
      const tile: Terrain = world.terrain[index];
      const x = column * TILE;
      const y = row * TILE;
      const edge = row === 0 || column === 0 || row === world.rows - 1 || column === world.cols - 1;

      if (tile === 'wall') {
        drawWall(ctx, x, y, palette, edge);
        continue;
      }

      drawFloor(ctx, x, y, palette, (column + row) % 2 === 0);
      if (tile === 'hazard') {
        drawObstacle(ctx, x, y, obstacle.art, obstacle.color ?? palette.hazard, palette.ink);
      }
    }
  }

  const locked = state.collected.length < world.treasures.length;
  drawGoal(
    ctx,
    world.goal.x * TILE,
    world.goal.y * TILE,
    goal.art,
    palette.goal,
    palette.ink,
    locked,
    timeMs,
    animate,
  );

  world.treasures.forEach((point, index) => {
    if (state.collected.includes(index)) return;
    drawTreasure(
      ctx,
      point.x * TILE,
      point.y * TILE,
      treasure.shape,
      treasure.color,
      palette.ink,
      timeMs,
      animate,
    );
  });

  drawHero(ctx, state.hero.x * TILE, state.hero.y * TILE, hero, palette.ink, timeMs, animate);
  ctx.restore();
}

/** Kartans pixelstorlek, så att canvasen kan storleksanpassas utan att gissa. */
export function canvasSize(world: PlayableWorld): { width: number; height: number } {
  return { width: world.cols * TILE, height: world.rows * TILE };
}
