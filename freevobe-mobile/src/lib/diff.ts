import type { FileChange, FileDiff } from '@/api/types';

/**
 * Diffs som rader. Skrivbordet skickar hunks med git-liknande rader ("-" bort, "+" till, " " kvar);
 * mobilvyn behöver dem med radnummer och en typ per rad. Ren funktion, därför testad.
 */

export type DiffRowKind = 'add' | 'remove' | 'context' | 'meta';

export interface DiffRow {
  kind: DiffRowKind;
  text: string;
  /** Radnummer i filen före ändringen (null för tillagda rader och rubriker). */
  oldLine: number | null;
  /** Radnummer i filen efter ändringen (null för borttagna rader och rubriker). */
  newLine: number | null;
}

export function hunkHeader(hunk: FileDiff['hunks'][number]): string {
  return `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`;
}

export function buildDiffRows(diff: FileDiff): DiffRow[] {
  const rows: DiffRow[] = [];

  for (const hunk of diff.hunks) {
    rows.push({ kind: 'meta', text: hunkHeader(hunk), oldLine: null, newLine: null });

    let oldLine = hunk.oldStart;
    let newLine = hunk.newStart;

    for (const line of hunk.lines) {
      const marker = line.charAt(0);
      if (marker === '+') {
        rows.push({ kind: 'add', text: line.slice(1), oldLine: null, newLine: newLine++ });
      } else if (marker === '-') {
        rows.push({ kind: 'remove', text: line.slice(1), oldLine: oldLine++, newLine: null });
      } else {
        const text = marker === ' ' ? line.slice(1) : line;
        rows.push({ kind: 'context', text, oldLine: oldLine++, newLine: newLine++ });
      }
    }
  }

  return rows;
}

export interface DiffStats {
  additions: number;
  deletions: number;
}

/** Summerar en diff. Faller tillbaka på att räkna rader om servern inte skickade siffror. */
export function diffStats(diff: FileDiff): DiffStats {
  if (diff.additions > 0 || diff.deletions > 0) {
    return { additions: diff.additions, deletions: diff.deletions };
  }
  const rows = buildDiffRows(diff);
  return {
    additions: rows.filter((row) => row.kind === 'add').length,
    deletions: rows.filter((row) => row.kind === 'remove').length,
  };
}

export function totalStats(files: FileChange[]): DiffStats {
  return files.reduce<DiffStats>(
    (sum, file) => ({
      additions: sum.additions + file.additions,
      deletions: sum.deletions + file.deletions,
    }),
    { additions: 0, deletions: 0 },
  );
}

/** "+12 −3" som en enda sträng, används i listor och kort. */
export function formatStats(stats: DiffStats): string {
  return `+${stats.additions} −${stats.deletions}`;
}
