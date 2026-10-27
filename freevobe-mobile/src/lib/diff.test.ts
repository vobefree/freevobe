import { describe, expect, it } from 'vitest';
import type { FileDiff } from '@/api/types';
import { buildDiffRows, diffStats, formatStats, totalStats } from './diff';

const diff: FileDiff = {
  id: 'diff.1',
  path: 'src/pricing/calculate.ts',
  kind: 'update',
  hunks: [
    {
      oldStart: 1,
      oldLines: 3,
      newStart: 1,
      newLines: 4,
      lines: [
        ' export function total(items) {',
        '-  return items.reduce((sum, item) => sum + item.price, 0);',
        '+  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);',
        '+  // antal räknas nu med',
        ' }',
      ],
    },
  ],
  oldContent: '',
  newContent: '',
  additions: 2,
  deletions: 1,
};

describe('buildDiffRows', () => {
  it('ger varje rad rätt typ och radnummer', () => {
    const rows = buildDiffRows(diff);
    expect(rows.map((row) => row.kind)).toEqual(['meta', 'context', 'remove', 'add', 'add', 'context']);

    const meta = rows[0];
    expect(meta?.text).toBe('@@ -1,3 +1,4 @@');

    const context = rows[1];
    expect(context?.oldLine).toBe(1);
    expect(context?.newLine).toBe(1);

    const removed = rows[2];
    expect(removed?.oldLine).toBe(2);
    expect(removed?.newLine).toBeNull();

    const added = rows[3];
    expect(added?.oldLine).toBeNull();
    expect(added?.newLine).toBe(2);

    // Det gamla radnumret fortsätter efter den borttagna raden.
    expect(rows[5]?.oldLine).toBe(3);
    expect(rows[5]?.newLine).toBe(4);
  });

  it('tar bort markören från radtexten', () => {
    const rows = buildDiffRows(diff);
    expect(rows[2]?.text).toBe('  return items.reduce((sum, item) => sum + item.price, 0);');
  });
});

describe('diffStats', () => {
  it('använder serverns siffror när de finns', () => {
    expect(diffStats(diff)).toEqual({ additions: 2, deletions: 1 });
  });

  it('räknar rader själv när servern inte skickade några siffror', () => {
    expect(diffStats({ ...diff, additions: 0, deletions: 0 })).toEqual({ additions: 2, deletions: 1 });
  });
});

describe('formatStats', () => {
  it('skriver ut tillägg och borttagningar', () => {
    expect(formatStats({ additions: 12, deletions: 3 })).toBe('+12 −3');
  });
});

describe('totalStats', () => {
  it('summerar flera filer', () => {
    expect(
      totalStats([
        { path: 'a.ts', kind: 'update', additions: 2, deletions: 1 },
        { path: 'b.ts', kind: 'create', additions: 5, deletions: 0 },
      ]),
    ).toEqual({ additions: 7, deletions: 1 });
  });
});
