import type { FileDiff } from '@vibeforge/protocol';

export type DiffLineKind = 'add' | 'remove' | 'context' | 'meta';

export interface RenderedDiffLine {
  kind: DiffLineKind;
  text: string;
  oldNumber: number | null;
  newNumber: number | null;
}

/**
 * Gör om en FileDiff till rader som går att rendera. Ren funktion, så den kan testas utan DOM.
 * Hunk-huvuden blir egna rader av typen "meta" så att användaren ser var i filen ändringen sker.
 */
export function renderDiff(diff: Pick<FileDiff, 'hunks'>): RenderedDiffLine[] {
  const lines: RenderedDiffLine[] = [];
  for (const hunk of diff.hunks) {
    lines.push({
      kind: 'meta',
      text: `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`,
      oldNumber: null,
      newNumber: null,
    });
    let oldNumber = hunk.oldStart;
    let newNumber = hunk.newStart;
    for (const raw of hunk.lines) {
      const marker = raw.startsWith('+') || raw.startsWith('-') ? raw[0] : ' ';
      const text =
        raw.length > 0 && (raw[0] === '+' || raw[0] === '-' || raw[0] === ' ') ? raw.slice(1) : raw;
      if (marker === '+') {
        lines.push({ kind: 'add', text, oldNumber: null, newNumber: newNumber++ });
      } else if (marker === '-') {
        lines.push({ kind: 'remove', text, oldNumber: oldNumber++, newNumber: null });
      } else {
        lines.push({ kind: 'context', text, oldNumber: oldNumber++, newNumber: newNumber++ });
      }
    }
  }
  return lines;
}

/** Sammanfattande etikett, t.ex. "+12 −3 i src/agent/loop.ts". */
export function diffSummary(diff: Pick<FileDiff, 'additions' | 'deletions' | 'path'>): string {
  return `+${diff.additions} −${diff.deletions} · ${diff.path}`;
}

/** Ungefärlig läsbar storlek på ändringen, används för att varna om stora diffar. */
export function diffWeight(
  diff: Pick<FileDiff, 'additions' | 'deletions'>,
): 'liten' | 'medel' | 'stor' {
  const total = diff.additions + diff.deletions;
  if (total <= 40) return 'liten';
  if (total <= 400) return 'medel';
  return 'stor';
}
