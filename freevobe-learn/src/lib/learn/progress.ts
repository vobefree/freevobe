/**
 * Rekord och avklarade lektioner – bara i webbläsaren.
 *
 * Inget konto, ingen server, ingen statistik som skickas vidare. Allt ligger i localStorage
 * under en egen nyckel, och en trasig eller gammal post tas bort i stället för att krascha sidan.
 */
import type { WorldSpec } from './types';

export const STORAGE_KEY = 'freevobe.learn.progress.v1';

export interface WorldRecord {
  steps: number;
  stumbles: number;
  /** ISO-datum för senaste gången världen klarades. */
  completedAt: string;
}

export interface LearnProgress {
  /** Nyckel = `worldKey(spec)`. Bästa antal steg per värld. */
  records: Record<string, WorldRecord>;
  /** Id:n för lektioner barnet har markerat som klara. */
  lessonsDone: string[];
}

export const EMPTY_PROGRESS: LearnProgress = { records: {}, lessonsDone: [] };

/** Minimal lagringsyta, så att funktionerna går att testa utan en webbläsare. */
export type ProgressStorage = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * Nyckeln beskriver världen, inte texten: samma karta ger samma rekord även om barnet byter
 * en bokstav som inte påverkar världen.
 */
export function worldKey(spec: WorldSpec): string {
  return [spec.biome, spec.seed, spec.target, `${spec.cols}x${spec.rows}`, spec.mood].join('-');
}

function sanitizeRecord(value: unknown): WorldRecord | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<WorldRecord>;
  if (
    typeof candidate.steps !== 'number' ||
    !Number.isFinite(candidate.steps) ||
    candidate.steps < 0 ||
    typeof candidate.stumbles !== 'number' ||
    !Number.isFinite(candidate.stumbles) ||
    candidate.stumbles < 0 ||
    typeof candidate.completedAt !== 'string'
  ) {
    return null;
  }
  return {
    steps: Math.floor(candidate.steps),
    stumbles: Math.floor(candidate.stumbles),
    completedAt: candidate.completedAt,
  };
}

/** Läser lagringen. Saknad, trasig eller gammal data blir en tom progress i stället för ett fel. */
export function readProgress(storage: ProgressStorage | null | undefined): LearnProgress {
  if (!storage) return { records: {}, lessonsDone: [] };
  let raw: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { records: {}, lessonsDone: [] };
  }
  if (!raw) return { records: {}, lessonsDone: [] };

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return { records: {}, lessonsDone: [] };
    const data = parsed as { records?: unknown; lessonsDone?: unknown };
    const records: Record<string, WorldRecord> = {};
    if (data.records && typeof data.records === 'object') {
      for (const [key, value] of Object.entries(data.records as Record<string, unknown>)) {
        const record = sanitizeRecord(value);
        if (record) records[key] = record;
      }
    }
    const lessonsDone = Array.isArray(data.lessonsDone)
      ? data.lessonsDone.filter((id): id is string => typeof id === 'string').slice(0, 50)
      : [];
    return { records, lessonsDone: [...new Set(lessonsDone)] };
  } catch {
    return { records: {}, lessonsDone: [] };
  }
}

/** Sparar. Returnerar false när webbläsaren säger nej (privat läge, fullt, avstängt). */
export function writeProgress(
  storage: ProgressStorage | null | undefined,
  progress: LearnProgress,
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

/**
 * Sparar en klarad värld. Bara den bästa rundan behålls per värld: minst antal steg, och vid
 * lika många steg den med färst snubblingar.
 */
export function recordWin(
  progress: LearnProgress,
  key: string,
  result: { steps: number; stumbles: number },
  completedAt = new Date().toISOString(),
): LearnProgress {
  const previous = progress.records[key];
  const better =
    !previous ||
    result.steps < previous.steps ||
    (result.steps === previous.steps && result.stumbles < previous.stumbles);
  if (!better) return progress;
  return {
    ...progress,
    records: {
      ...progress.records,
      [key]: {
        steps: Math.max(0, Math.floor(result.steps)),
        stumbles: Math.max(0, Math.floor(result.stumbles)),
        completedAt,
      },
    },
  };
}

export function markLessonDone(progress: LearnProgress, lessonId: string): LearnProgress {
  if (progress.lessonsDone.includes(lessonId)) return progress;
  return { ...progress, lessonsDone: [...progress.lessonsDone, lessonId] };
}

export function bestRecord(progress: LearnProgress, key: string): WorldRecord | null {
  return progress.records[key] ?? null;
}
