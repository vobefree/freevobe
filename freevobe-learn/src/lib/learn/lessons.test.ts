import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileWorld } from './compile';
import { LESSONS, lessonById } from './lessons';

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

const world = (() => {
  const result = compileWorld('En mörk skog med en katt och tre stjärnor');
  if (!result.ok) throw new Error('Lektionerna behöver en spelbar värld');
  return result.world;
})();

describe('lektionerna', () => {
  it('har unika id:n och egna titlar', () => {
    const ids = LESSONS.map((lesson) => lesson.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(LESSONS.length).toBeGreaterThanOrEqual(6);
  });

  it('citerar kod som fortfarande finns i källfilen', () => {
    for (const lesson of LESSONS) {
      const file = readFileSync(path.resolve(process.cwd(), lesson.source.file), 'utf8');
      expect(normalize(file), `${lesson.id} → ${lesson.source.file}`).toContain(
        normalize(lesson.code),
      );
    }
  });

  it('namnger en symbol som finns i filen', () => {
    for (const lesson of LESSONS) {
      const file = readFileSync(path.resolve(process.cwd(), lesson.source.file), 'utf8');
      expect(file, `${lesson.id} → ${lesson.source.symbol}`).toContain(lesson.source.symbol);
    }
  });

  it('har en förklaring, minst två steg och ett citat som inte är tomt', () => {
    for (const lesson of LESSONS) {
      expect(lesson.title.length, lesson.id).toBeGreaterThan(4);
      expect(lesson.idea.length, lesson.id).toBeGreaterThan(20);
      expect(lesson.points.length, lesson.id).toBeGreaterThanOrEqual(2);
      expect(lesson.code.split('\n').length, lesson.id).toBeGreaterThan(3);
      for (const point of lesson.points) {
        expect(point.length, lesson.id).toBeGreaterThan(10);
      }
    }
  });

  it('har en fråga med ett svar som finns bland alternativen', () => {
    for (const lesson of LESSONS) {
      const { quiz } = lesson;
      expect(quiz.options.length, lesson.id).toBeGreaterThanOrEqual(3);
      expect(quiz.answer, lesson.id).toBeGreaterThanOrEqual(0);
      expect(quiz.answer, lesson.id).toBeLessThan(quiz.options.length);
      expect(quiz.question.length, lesson.id).toBeGreaterThan(10);
      expect(quiz.explanation.length, lesson.id).toBeGreaterThan(20);
      expect(new Set(quiz.options).size, lesson.id).toBe(quiz.options.length);
    }
  });

  it('visar exempel ur barnets egen värld', () => {
    for (const lesson of LESSONS) {
      const example = lesson.example(world);
      expect(example.length, lesson.id).toBeGreaterThanOrEqual(2);
      expect(example.length, lesson.id).toBeLessThanOrEqual(5);
      for (const row of example) {
        expect(row.label.length, lesson.id).toBeGreaterThan(1);
        expect(row.value.length, lesson.id).toBeGreaterThan(0);
        expect(row.value, lesson.id).not.toContain('undefined');
        expect(row.value, lesson.id).not.toContain('NaN');
      }
    }
  });

  it('kan slås upp på id', () => {
    expect(lessonById('ord-blir-en-varld')?.title).toBe('Ord blir en värld');
    expect(lessonById('finns-inte')).toBeUndefined();
  });
});
