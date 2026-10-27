import { describe, expect, it } from 'vitest';
import { applyHunks, buildHunks, createFileDiff, diffLines, formatUnifiedDiff } from './engine.js';
import { ensureTrailingNewline, splitLines } from '../util/text.js';

const oldFile = `svep ett\nsvep två\nsvep tre\nsvep fyra\nsvep fem\n`;
const newFile = `svep ett\nsvep två\nsvep TVÅ OCH EN HALV\nsvep tre\nsvep fyra\nsvep fem\nsvep sex\n`;

function replayEdits(edits: ReturnType<typeof diffLines>, source: string[]): string[] {
  const out: string[] = [];
  let cursor = 0;
  for (const edit of edits) {
    if (edit.type === 'equal') {
      expect(source[cursor]).toBe(edit.line);
      out.push(edit.line);
      cursor += 1;
    } else if (edit.type === 'delete') {
      expect(source[cursor]).toBe(edit.line);
      cursor += 1;
    } else {
      out.push(edit.line);
    }
  }
  return out;
}

describe('diffLines', () => {
  it('spelar upp ett edit-script som exakt återskapar den nya filen', () => {
    const edits = diffLines(splitLines(oldFile), splitLines(newFile));
    expect(replayEdits(edits, splitLines(oldFile))).toEqual(splitLines(newFile));
    expect(edits.filter((edit) => edit.type === 'equal').length).toBeGreaterThan(2);
  });

  it('klarar identiska filer utan ändringar', () => {
    const edits = diffLines(['a', 'b'], ['a', 'b']);
    expect(edits.every((edit) => edit.type === 'equal')).toBe(true);
    expect(buildHunks(edits)).toEqual([]);
  });

  it('klarar insättning i tom fil', () => {
    const edits = diffLines([], ['x', 'y']);
    expect(replayEdits(edits, [])).toEqual(['x', 'y']);
  });

  it('klarar borttagning av allt innehåll', () => {
    const edits = diffLines(['x', 'y'], []);
    expect(replayEdits(edits, ['x', 'y'])).toEqual([]);
  });
});

describe('round-trip', () => {
  it('applicerar genererade hunkar tillbaka till nytt innehåll', () => {
    const diff = createFileDiff({
      path: 'src/svep.ts',
      absolutePath: '/tmp/proj/src/svep.ts',
      kind: 'update',
      oldContent: oldFile,
      newContent: newFile,
    });

    const applied = applyHunks(oldFile, diff.hunks);
    expect(ensureTrailingNewline(applied)).toBe(ensureTrailingNewline(newFile));
    expect(diff.additions).toBe(2);
    expect(diff.deletions).toBe(0);
  });

  it('applicerar hunkar för en helt ny fil', () => {
    const diff = createFileDiff({
      path: 'src/ny.ts',
      absolutePath: '/tmp/proj/src/ny.ts',
      kind: 'create',
      oldContent: '',
      newContent: 'rad ett\nrad två\n',
    });
    expect(applyHunks('', diff.hunks, 'create')).toBe('rad ett\nrad två');
    expect(diff.hunks[0]?.oldLines).toBe(0);
    expect(diff.additions).toBe(2);
  });

  it('kastar när kontexten inte stämmer i stället för att skriva fel fil', () => {
    const diff = createFileDiff({
      path: 'src/svep.ts',
      absolutePath: '/tmp/proj/src/svep.ts',
      kind: 'update',
      oldContent: oldFile,
      newContent: newFile,
    });
    expect(() => applyHunks('helt annat innehåll\n', diff.hunks)).toThrow(/Kontext stämmer inte/);
  });
});

describe('buildHunks', () => {
  it('slår ihop närliggande ändringar och separerar avlägsna', () => {
    const before = Array.from({ length: 40 }, (_, index) => `rad ${index}`).join('\n');
    const after = before
      .replace('rad 2', 'rad 2 ÄNDRAD')
      .replace('rad 39', 'rad 39 ÄNDRAD')
      .split('\n');
    const edits = diffLines(splitLines(before), after);
    const hunks = buildHunks(edits, 3);
    expect(hunks).toHaveLength(2);
    expect(hunks[0]?.lines.some((line) => line.startsWith('-rad 2'))).toBe(true);
    expect(hunks[1]?.lines.some((line) => line.startsWith('+rad 39 ÄNDRAD'))).toBe(true);
  });
});

describe('formatUnifiedDiff', () => {
  it('skriver standardhuvud och hunk-rubrik', () => {
    const diff = createFileDiff({
      path: 'src/svep.ts',
      absolutePath: '/tmp/proj/src/svep.ts',
      kind: 'update',
      oldContent: oldFile,
      newContent: newFile,
    });
    const text = formatUnifiedDiff(diff);
    expect(text).toContain('--- a/src/svep.ts');
    expect(text).toContain('+++ b/src/svep.ts');
    expect(text).toMatch(/@@ -\d+,\d+ \+\d+,\d+ @@/);
    expect(text).toContain('+svep sex');
  });
});
