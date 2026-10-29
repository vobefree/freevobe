import { describe, expect, it } from 'vitest';
import { describeWorld } from './describe';
import {
  EMPTY_PROGRESS,
  STORAGE_KEY,
  bestRecord,
  markLessonDone,
  readProgress,
  recordWin,
  worldKey,
  writeProgress,
  type ProgressStorage,
} from './progress';

class MemoryStorage implements ProgressStorage {
  private data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  raw(key: string): string | null {
    return this.data.get(key) ?? null;
  }
}

const failingStorage: ProgressStorage = {
  getItem() {
    throw new Error('Privat läge');
  },
  setItem() {
    throw new Error('Fullt');
  },
};

describe('worldKey', () => {
  it('är samma för samma värld och olika för olika världar', () => {
    const a = describeWorld('en skog med en katt').spec;
    const b = describeWorld('en skog med en katt').spec;
    const c = describeWorld('en skog med en hund').spec;
    expect(worldKey(a)).toBe(worldKey(b));
    expect(worldKey(a)).not.toBe(worldKey(c));
    expect(worldKey(a)).toContain('forest');
  });
});

describe('readProgress och writeProgress', () => {
  it('börjar tomt när inget finns sparat', () => {
    expect(readProgress(new MemoryStorage())).toEqual(EMPTY_PROGRESS);
  });

  it('läser tillbaka det som sparades', () => {
    const storage = new MemoryStorage();
    const progress = { records: {}, lessonsDone: ['ord-blir-en-varld'] };
    expect(writeProgress(storage, progress)).toBe(true);
    expect(readProgress(storage)).toEqual(progress);
  });

  it('ignorerar trasig json och gamla poster', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, '{inte json');
    expect(readProgress(storage)).toEqual(EMPTY_PROGRESS);

    storage.setItem(STORAGE_KEY, JSON.stringify({ records: 'fel', lessonsDone: [1, 'ok'] }));
    expect(readProgress(storage)).toEqual({ records: {}, lessonsDone: ['ok'] });

    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        records: {
          bra: { steps: 12, stumbles: 1, completedAt: '2026-10-29T10:00:00.000Z' },
          trasig: { steps: -4 },
          ocksaTrasig: null,
        },
        lessonsDone: ['a', 'a', 'b'],
      }),
    );
    const progress = readProgress(storage);
    expect(Object.keys(progress.records)).toEqual(['bra']);
    expect(progress.lessonsDone).toEqual(['a', 'b']);
  });

  it('kraschar inte när webbläsaren säger nej', () => {
    expect(readProgress(failingStorage)).toEqual(EMPTY_PROGRESS);
    expect(writeProgress(failingStorage, EMPTY_PROGRESS)).toBe(false);
    expect(readProgress(null)).toEqual(EMPTY_PROGRESS);
    expect(writeProgress(undefined, EMPTY_PROGRESS)).toBe(false);
  });
});

describe('recordWin', () => {
  it('sparar den första rundan', () => {
    const progress = recordWin(EMPTY_PROGRESS, 'skog-1-3', { steps: 40, stumbles: 2 });
    expect(bestRecord(progress, 'skog-1-3')).toEqual({
      steps: 40,
      stumbles: 2,
      completedAt: expect.any(String),
    });
  });

  it('behåller bara den bästa rundan', () => {
    const first = recordWin(EMPTY_PROGRESS, 'skog', { steps: 40, stumbles: 2 });
    const worse = recordWin(first, 'skog', { steps: 55, stumbles: 0 });
    expect(bestRecord(worse, 'skog')?.steps).toBe(40);
    expect(bestRecord(worse, 'skog')?.stumbles).toBe(2);

    const better = recordWin(worse, 'skog', { steps: 31, stumbles: 1 }, '2026-10-30T09:00:00.000Z');
    expect(bestRecord(better, 'skog')).toEqual({
      steps: 31,
      stumbles: 1,
      completedAt: '2026-10-30T09:00:00.000Z',
    });
  });

  it('byter vid lika många steg bara om rundan har färre snubblingar', () => {
    const first = recordWin(EMPTY_PROGRESS, 'skog', { steps: 20, stumbles: 3 });
    const sameSteps = recordWin(first, 'skog', { steps: 20, stumbles: 4 });
    expect(bestRecord(sameSteps, 'skog')?.stumbles).toBe(3);

    const cleaner = recordWin(sameSteps, 'skog', { steps: 20, stumbles: 1 });
    expect(bestRecord(cleaner, 'skog')?.stumbles).toBe(1);
  });

  it('ändrar inte objektet den får in', () => {
    const before = { ...EMPTY_PROGRESS };
    recordWin(before, 'skog', { steps: 10, stumbles: 0 });
    expect(before).toEqual(EMPTY_PROGRESS);
  });
});

describe('markLessonDone', () => {
  it('lägger till en lektion en gång', () => {
    const once = markLessonDone(EMPTY_PROGRESS, 'kartan');
    const twice = markLessonDone(once, 'kartan');
    expect(twice.lessonsDone).toEqual(['kartan']);
    expect(twice).toBe(once);
  });
});
