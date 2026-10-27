import { luminance, saturation } from "./kit";

function toHex(r: number, g: number, b: number): string {
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
  return `#${[r, g, b].map((value) => clamp(value).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

/**
 * Kvantiserar RGBA-pixlar till de vanligaste färgerna.
 * Rena funktioner (ingen canvas) så att de går att testa direkt.
 */
export function quantizeColors(data: Uint8ClampedArray, max = 5): string[] {
  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
  for (let i = 0; i + 3 < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha < 200) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
    const entry = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    entry.count += 1;
    entry.r += r;
    entry.g += g;
    entry.b += b;
    buckets.set(key, entry);
  }
  const ranked = [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .map((entry) => toHex(entry.r / entry.count, entry.g / entry.count, entry.b / entry.count));
  const picked: string[] = [];
  for (const hex of ranked) {
    const l = luminance(hex);
    if (l > 0.94 || l < 0.06) continue;
    const tooClose = picked.some((existing) => {
      const a = parseInt(existing.slice(1, 3), 16);
      const b = parseInt(hex.slice(1, 3), 16);
      const c = parseInt(existing.slice(3, 5), 16);
      const d = parseInt(hex.slice(3, 5), 16);
      const e = parseInt(existing.slice(5, 7), 16);
      const f = parseInt(hex.slice(5, 7), 16);
      return Math.abs(a - b) + Math.abs(c - d) + Math.abs(e - f) < 60;
    });
    if (tooClose) continue;
    picked.push(hex);
    if (picked.length >= max) break;
  }
  return picked.length ? picked : ranked.slice(0, max);
}

export function cornerColor(data: Uint8ClampedArray, width: number, height: number): { r: number; g: number; b: number } | null {
  if (width < 2 || height < 2) return null;
  const samples = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (const [x, y] of samples) {
    const index = (y * width + x) * 4;
    if (index + 3 >= data.length || data[index + 3] < 200) continue;
    r += data[index];
    g += data[index + 1];
    b += data[index + 2];
    count += 1;
  }
  if (!count) return null;
  return { r: r / count, g: g / count, b: b / count };
}

/**
 * Tar bort enfärgade bakgrunder (produktbilder fotade mot vitt, grått eller en
 * jämn studiofärg) genom att göra närliggande pixlar transparenta.
 */
export function chromaKey(data: Uint8ClampedArray, width: number, height: number, tolerance = 58): Uint8ClampedArray {
  const corner = cornerColor(data, width, height);
  if (!corner) return data;
  const out = new Uint8ClampedArray(data);
  for (let i = 0; i + 3 < out.length; i += 4) {
    if (out[i + 3] < 200) continue;
    const distance = Math.abs(out[i] - corner.r) + Math.abs(out[i + 1] - corner.g) + Math.abs(out[i + 2] - corner.b);
    if (distance < tolerance) out[i + 3] = 0;
    else if (distance < tolerance * 1.7) out[i + 3] = Math.round(255 * ((distance - tolerance) / (tolerance * 0.7)));
  }
  return out;
}

/** Smart beskärning: hittar motivets tyngdpunkt så att den kan användas som fokuspunkt. */
export function subjectFocus(data: Uint8ClampedArray, width: number, height: number, background?: { r: number; g: number; b: number } | null): { x: number; y: number } {
  const corner = background ?? cornerColor(data, width, height);
  if (!corner || width < 2 || height < 2) return { x: 50, y: 50 };
  let sumX = 0;
  let sumY = 0;
  let weight = 0;
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const index = (y * width + x) * 4;
      if (index + 3 >= data.length) continue;
      if (data[index + 3] < 200) continue;
      const distance = Math.abs(data[index] - corner.r) + Math.abs(data[index + 1] - corner.g) + Math.abs(data[index + 2] - corner.b);
      if (distance < 90) continue;
      const w = distance * (1 + saturation(toHex(data[index], data[index + 1], data[index + 2])));
      sumX += x * w;
      sumY += y * w;
      weight += w;
    }
  }
  if (!weight) return { x: 50, y: 50 };
  return {
    x: Math.round((sumX / weight / width) * 100),
    y: Math.round((sumY / weight / height) * 100),
  };
}
