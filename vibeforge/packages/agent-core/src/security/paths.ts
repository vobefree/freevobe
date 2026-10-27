import fs from 'node:fs';
import path from 'node:path';
import { normalizeSlashes } from '../util/text.js';

/** Sökvägar som verktygen aldrig får skriva till, även om de ligger i projektet. */
const PROTECTED_SEGMENTS = ['.git/', 'node_modules/', '.vibeforge/workspace/'];

export interface PathResolution {
  ok: boolean;
  absolute: string;
  relative: string;
  reason?: string;
}

export function normalizeRoot(root: string): string {
  const resolved = path.resolve(root);
  try {
    return fs.realpathSync.native(resolved);
  } catch {
    return resolved;
  }
}

/** Sant när `target` ligger i eller under `root`. Faller tillbaka på skiftlägesokänsligt på Windows. */
export function isInside(root: string, target: string): boolean {
  const base = normalizeRoot(root);
  const resolved = path.resolve(target);
  const relative = path.relative(base, resolved);
  if (relative === '') return true;
  const caseInsensitive = process.platform === 'win32' || process.platform === 'darwin';
  const comparable = caseInsensitive ? relative.toLowerCase() : relative;
  return !comparable.startsWith('..') && !path.isAbsolute(relative);
}

/** Följer symlänkar så långt de finns, så att en länk ut ur projektet upptäcks. */
function realpathOfNearestExisting(target: string): string {
  let current = path.resolve(target);
  const missing: string[] = [];
  for (;;) {
    try {
      const real = fs.realpathSync.native(current);
      return missing.length > 0 ? path.join(real, ...missing.reverse()) : real;
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return path.resolve(target);
      missing.push(path.basename(current));
      current = parent;
    }
  }
}

/**
 * Löser en projektrelativ (eller absolut) sökväg och vägrar allt som pekar utanför
 * projektroten – inklusive `..`-utbrytning och symlänkar ut ur trädet.
 */
export function resolveProjectPath(root: string, candidate: string): PathResolution {
  if (typeof candidate !== 'string' || candidate.trim() === '') {
    return { ok: false, absolute: '', relative: '', reason: 'Tom sökväg.' };
  }
  if (candidate.includes('\0')) {
    return { ok: false, absolute: '', relative: '', reason: 'Sökvägen innehåller en nollbyte.' };
  }

  const base = normalizeRoot(root);
  const absolute = path.resolve(base, candidate);
  const real = realpathOfNearestExisting(absolute);

  if (!isInside(base, absolute) || !isInside(base, real)) {
    return {
      ok: false,
      absolute,
      relative: normalizeSlashes(candidate),
      reason: `Sökvägen ligger utanför projektroten: ${candidate}`,
    };
  }

  return { ok: true, absolute, relative: normalizeSlashes(path.relative(base, absolute)) };
}

export function isProtectedPath(relativePath: string): boolean {
  const normalized = normalizeSlashes(relativePath);
  return PROTECTED_SEGMENTS.some(
    (segment) => normalized.startsWith(segment) || normalized === segment.replace(/\/$/, ''),
  );
}

export function assertWritable(root: string, candidate: string): PathResolution {
  const resolved = resolveProjectPath(root, candidate);
  if (!resolved.ok) return resolved;
  if (isProtectedPath(resolved.relative)) {
    return {
      ...resolved,
      ok: false,
      reason: `Skrivning till skyddade sökvägar är blockerad: ${resolved.relative}`,
    };
  }
  return resolved;
}
