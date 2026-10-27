import type { FileChangeKind, FileDiff, FileDiffHunk } from '@vibeforge/protocol';
import { DIFF_CONTEXT_LINES } from '@vibeforge/protocol';
import { createId } from '../util/ids.js';
import { countLines, ensureTrailingNewline, splitLines } from '../util/text.js';

export interface Edit {
  type: 'equal' | 'insert' | 'delete';
  line: string;
}

/** Skyddsräcken: Myers-tabellen växer kvadratiskt, så stora filer diffas grovt i stället. */
const MAX_DIFF_LINES = 20_000;
const MAX_EDIT_DISTANCE = 3_000;

/**
 * Myers O(ND)-diff över rader. Returnerar en edit-script som, spelad framåt,
 * gör om `a` till `b`. Vid extremt stora eller väsensskilda filer faller vi tillbaka
 * på "byt ut allt", vilket alltid är korrekt men mindre läsbart.
 */
export function diffLines(a: string[], b: string[]): Edit[] {
  const n = a.length;
  const m = b.length;

  if (n === 0 && m === 0) return [];
  if (n + m > MAX_DIFF_LINES) return coarseDiff(a, b);

  const v = new Map<number, number>([[1, 0]]);
  const trace: Map<number, number>[] = [];
  let foundD = -1;
  const max = n + m;

  outer: for (let d = 0; d <= max; d += 1) {
    trace.push(new Map(v));
    for (let k = -d; k <= d; k += 2) {
      const down = v.get(k + 1);
      const right = v.get(k - 1);
      let x: number;
      if (
        k === -d ||
        (k !== d && (right ?? Number.NEGATIVE_INFINITY) < (down ?? Number.NEGATIVE_INFINITY))
      ) {
        x = down ?? 0;
      } else {
        x = (right ?? 0) + 1;
      }
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x += 1;
        y += 1;
      }
      v.set(k, x);
      if (x >= n && y >= m) {
        foundD = d;
        break outer;
      }
    }
    if (d >= MAX_EDIT_DISTANCE) break;
  }

  if (foundD < 0) return coarseDiff(a, b);

  const edits: Edit[] = [];
  let x = n;
  let y = m;

  for (let d = foundD; d > 0; d -= 1) {
    const previous = trace[d] as Map<number, number>;
    const k = x - y;
    const down = previous.get(k + 1);
    const right = previous.get(k - 1);
    const goDown =
      k === -d ||
      (k !== d && (right ?? Number.NEGATIVE_INFINITY) < (down ?? Number.NEGATIVE_INFINITY));
    const prevK = goDown ? k + 1 : k - 1;
    const prevX = previous.get(prevK) ?? 0;
    const prevY = prevX - prevK;

    while (x > prevX && y > prevY) {
      edits.push({ type: 'equal', line: a[x - 1] as string });
      x -= 1;
      y -= 1;
    }
    if (x === prevX) {
      edits.push({ type: 'insert', line: b[y - 1] as string });
      y -= 1;
    } else {
      edits.push({ type: 'delete', line: a[x - 1] as string });
      x -= 1;
    }
  }

  while (x > 0 && y > 0) {
    edits.push({ type: 'equal', line: a[x - 1] as string });
    x -= 1;
    y -= 1;
  }
  while (x > 0) {
    edits.push({ type: 'delete', line: a[x - 1] as string });
    x -= 1;
  }
  while (y > 0) {
    edits.push({ type: 'insert', line: b[y - 1] as string });
    y -= 1;
  }

  return edits.reverse();
}

function coarseDiff(a: string[], b: string[]): Edit[] {
  const edits: Edit[] = [];
  for (const line of a) edits.push({ type: 'delete', line });
  for (const line of b) edits.push({ type: 'insert', line });
  return edits;
}

/**
 * Bygger hunkar (sammanhängande ändringsblock med kontextrader) från ett edit-script.
 * Ändringsblock som ligger närmare varandra än 2× kontextrader slås ihop till en hunk,
 * precis som i en vanlig unified diff.
 */
export function buildHunks(edits: Edit[], contextLines = DIFF_CONTEXT_LINES): FileDiffHunk[] {
  if (edits.length === 0) return [];

  // Radnummer (1-baserade) för varje edit-position, samt slutet av filen.
  const positions: { old: number; next: number }[] = [];
  let oldCursor = 1;
  let newCursor = 1;
  for (const edit of edits) {
    positions.push({ old: oldCursor, next: newCursor });
    if (edit.type !== 'insert') oldCursor += 1;
    if (edit.type !== 'delete') newCursor += 1;
  }

  const changed = edits
    .map((edit, index) => (edit.type === 'equal' ? -1 : index))
    .filter((index) => index >= 0);
  if (changed.length === 0) return [];

  const groups: Array<[number, number]> = [];
  let start = changed[0] as number;
  let end = changed[0] as number;
  for (const index of changed.slice(1)) {
    if (index - end <= contextLines * 2) {
      end = index;
    } else {
      groups.push([start, end]);
      start = index;
      end = index;
    }
  }
  groups.push([start, end]);

  return groups.map(([first, last]) => {
    const from = Math.max(0, first - contextLines);
    const to = Math.min(edits.length - 1, last + contextLines);
    const slice = edits.slice(from, to + 1);
    const anchor = positions[from] as { old: number; next: number };
    return {
      oldStart: anchor.old,
      oldLines: slice.filter((edit) => edit.type !== 'insert').length,
      newStart: anchor.next,
      newLines: slice.filter((edit) => edit.type !== 'delete').length,
      lines: slice.map(
        (edit) => `${edit.type === 'equal' ? ' ' : edit.type === 'insert' ? '+' : '-'}${edit.line}`,
      ),
    };
  });
}

export interface CreateFileDiffInput {
  path: string;
  absolutePath: string;
  kind: FileChangeKind;
  oldContent: string;
  newContent: string;
  contextLines?: number;
  id?: string;
}

export function createFileDiff(input: CreateFileDiffInput): FileDiff {
  // Hunkarna beräknas på innehåll som alltid avslutas med radbrytning, eftersom en radbaserad
  // diff inte kan uttrycka "filen saknar avslutande radbrytning". Fälten oldContent/newContent
  // behåller det rå innehållet – det är newContent som skrivs till disk.
  const oldLines = splitLines(ensureTrailingNewline(input.oldContent));
  const newLines = splitLines(ensureTrailingNewline(input.newContent));
  const edits = diffLines(oldLines, newLines);
  const hunks = buildHunks(edits, input.contextLines ?? DIFF_CONTEXT_LINES);

  let additions = 0;
  let deletions = 0;
  for (const edit of edits) {
    if (edit.type === 'insert') additions += 1;
    if (edit.type === 'delete') deletions += 1;
  }

  return {
    id: input.id ?? createId('diff'),
    path: input.path,
    absolutePath: input.absolutePath,
    kind: input.kind,
    hunks,
    oldContent: input.oldContent,
    newContent: input.newContent,
    additions,
    deletions,
    binary: false,
  };
}

/** Formaterar en diff som en standard unified diff-text. */
export function formatUnifiedDiff(diff: FileDiff): string {
  const header = [
    `--- ${diff.kind === 'create' ? '/dev/null' : `a/${diff.path}`}`,
    `+++ ${diff.kind === 'delete' ? '/dev/null' : `b/${diff.path}`}`,
  ];
  const body = diff.hunks.map((hunk) => {
    const head = `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`;
    return [head, ...hunk.lines].join('\n');
  });
  return [...header, ...body].join('\n');
}

/**
 * Applicerar hunkar på gammalt innehåll. Krävs för round-trip-verifiering (och för att kunna
 * applicera en granskad diff utan att lita på att agenten skickade hela filen).
 * Kastar om kontexten inte stämmer – hellre fel än en tyst felaktig fil.
 */
export function applyHunks(
  oldContent: string,
  hunks: FileDiffHunk[],
  kind: FileChangeKind = 'update',
): string {
  if (kind === 'create') {
    return hunks
      .flatMap((hunk) =>
        hunk.lines.filter((line) => line.startsWith('+')).map((line) => line.slice(1)),
      )
      .join('\n');
  }

  const oldLines = splitLines(oldContent);
  const result: string[] = [];
  let cursor = 0;

  for (const hunk of hunks) {
    const targetIndex = hunk.oldStart - 1;
    if (targetIndex < cursor) throw new Error(`Överlappande hunk vid rad ${hunk.oldStart}`);
    while (cursor < targetIndex && cursor < oldLines.length) {
      result.push(oldLines[cursor] as string);
      cursor += 1;
    }

    for (const line of hunk.lines) {
      const marker = line[0];
      const text = line.slice(1);
      if (marker === ' ') {
        if (oldLines[cursor] !== text) {
          throw new Error(`Kontext stämmer inte vid rad ${cursor + 1}: förväntade "${text}"`);
        }
        result.push(text);
        cursor += 1;
      } else if (marker === '-') {
        if (oldLines[cursor] !== text) {
          throw new Error(`Borttagen rad stämmer inte vid rad ${cursor + 1}: förväntade "${text}"`);
        }
        cursor += 1;
      } else if (marker === '+') {
        result.push(text);
      }
    }
  }

  while (cursor < oldLines.length) {
    result.push(oldLines[cursor] as string);
    cursor += 1;
  }

  return result.join('\n');
}

export function summarizeDiff(diff: FileDiff): string {
  return `${diff.kind === 'create' ? 'ny' : diff.kind === 'delete' ? 'borttagen' : 'ändrad'} fil ${diff.path} (+${diff.additions}/-${diff.deletions})`;
}

export { countLines };
