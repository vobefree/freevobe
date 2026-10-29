import { describe, expect, it } from 'vitest';
import { diffSummary, diffWeight, renderDiff } from './diffRender';
import type { FileDiff } from '@freevobe/protocol';

const diff: Pick<FileDiff, 'hunks'> = {
  hunks: [
    {
      oldStart: 1,
      oldLines: 3,
      newStart: 1,
      newLines: 4,
      lines: [' const a = 1;', '-const b = 2;', '+const b = 3;', '+const c = 4;', ' export { a };'],
    },
  ],
};

describe('renderDiff', () => {
  it('märker rader som tillägg, borttagningar och kontext', () => {
    const rendered = renderDiff(diff);
    expect(rendered[0]).toEqual({
      kind: 'meta',
      text: '@@ -1,3 +1,4 @@',
      oldNumber: null,
      newNumber: null,
    });
    expect(rendered.slice(1).map((line) => line.kind)).toEqual([
      'context',
      'remove',
      'add',
      'add',
      'context',
    ]);
  });

  it('numrerar gamla och nya rader separat', () => {
    const rendered = renderDiff(diff).slice(1);
    expect(rendered[0]).toMatchObject({ oldNumber: 1, newNumber: 1 });
    expect(rendered[1]).toMatchObject({ kind: 'remove', oldNumber: 2, newNumber: null });
    expect(rendered[2]).toMatchObject({ kind: 'add', oldNumber: null, newNumber: 2 });
    expect(rendered[3]).toMatchObject({ kind: 'add', oldNumber: null, newNumber: 3 });
    expect(rendered[4]).toMatchObject({ kind: 'context', oldNumber: 3, newNumber: 4 });
  });

  it('tar bort markören från radtexten men behåller innehållet', () => {
    const rendered = renderDiff(diff).slice(1);
    expect(rendered.map((line) => line.text)).toEqual([
      'const a = 1;',
      'const b = 2;',
      'const b = 3;',
      'const c = 4;',
      'export { a };',
    ]);
  });

  it('klarar en tom diff utan att krascha', () => {
    expect(renderDiff({ hunks: [] })).toEqual([]);
  });
});

describe('diffSammanfattning', () => {
  it('visar antal tillagda och borttagna rader', () => {
    expect(diffSummary({ additions: 12, deletions: 3, path: 'src/agent/loop.ts' })).toBe(
      '+12 −3 · src/agent/loop.ts',
    );
  });

  it('klassar storleken så att användaren kan varna för stora diffar', () => {
    expect(diffWeight({ additions: 10, deletions: 5 })).toBe('small');
    expect(diffWeight({ additions: 200, deletions: 100 })).toBe('medium');
    expect(diffWeight({ additions: 900, deletions: 100 })).toBe('large');
  });
});
