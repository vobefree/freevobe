import type { ContextFile } from '@freevobe/protocol';
import { truncate } from '../util/text.js';
import { cosineSimilarity, embed } from './embedding.js';
import type { IndexedFile } from './indexer.js';

export interface SelectionInput {
  prompt: string;
  entries: IndexedFile[];
  /** Filer användaren fäst – alltid med, först i listan. */
  pinned?: string[];
  /** Filer som nyligen rörts (diff, terminalfel, öppna flikar). */
  recentFiles?: string[];
  /** Filer som modellen uttryckligen bett om. */
  explicitFiles?: string[];
  budgetChars: number;
  /** Ungefärligt antal tecken per rad när filstorleken är okänd. */
  charsPerLine?: number;
}

export interface SelectionResult {
  files: ContextFile[];
  chars: number;
  dropped: number;
}

const PINNED_WEIGHT = 1_000;
const EXPLICIT_WEIGHT = 900;
const RECENT_WEIGHT = 600;
const IMPORT_NEIGHBOUR_WEIGHT = 120;

interface Candidate {
  path: string;
  reason: ContextFile['reason'];
  score: number;
  chars: number;
}

/**
 * Väljer vilka filer som får plats i kontexten. Prioriteringen är fast och förutsägbar:
 * pinnade filer, filer modellen bett om, nyligen rörda filer, därefter nyckelords- och
 * vektorlikhet, och sist importgrannar till de filerna. Budgeten hålls alltid.
 */
export function selectContext(input: SelectionInput): SelectionResult {
  const charsPerLine = input.charsPerLine ?? 40;
  const byPath = new Map(input.entries.map((entry) => [entry.path, entry]));
  const candidates = new Map<string, Candidate>();
  const queryVector = embed(input.prompt);
  const keywords = new Set(
    (input.prompt.toLowerCase().match(/[a-z0-9åäö_$.-]{3,}/g) ?? []).filter(
      (word) => !word.startsWith('the'),
    ),
  );

  const push = (path: string, reason: ContextFile['reason'], score: number) => {
    const existing = candidates.get(path);
    if (!existing || existing.score < score) {
      const entry = byPath.get(path);
      if (!entry) return;
      candidates.set(path, { path, reason, score, chars: estimateChars(entry, charsPerLine) });
    }
  };

  for (const path of input.pinned ?? []) push(path, 'pinned', PINNED_WEIGHT);
  for (const path of input.explicitFiles ?? []) push(path, 'explicit', EXPLICIT_WEIGHT);
  for (const path of input.recentFiles ?? []) push(path, 'recent-diff', RECENT_WEIGHT);

  for (const entry of input.entries) {
    if (candidates.has(entry.path)) continue;
    const haystack = `${entry.path} ${entry.symbols.join(' ')}`;
    let hits = 0;
    for (const keyword of keywords) {
      if (haystack.toLowerCase().includes(keyword)) hits += 1;
    }
    const vectorScore = cosineSimilarity(queryVector, entry.vector);
    if (hits === 0 && vectorScore < 0.08) continue;
    push(entry.path, hits > 0 ? 'keyword' : 'embedding', hits > 0 ? hits * 6 : vectorScore * 10);
  }

  // Importgrannar till de redan valda filerna hjälper modellen förstå kopplingar.
  const selectedPaths = [...candidates.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((candidate) => candidate.path);
  for (const path of selectedPaths) {
    const entry = byPath.get(path);
    for (const imported of entry?.imports ?? []) {
      for (const candidatePath of resolveImport(imported, path, byPath)) {
        if (!candidates.has(candidatePath))
          push(candidatePath, 'import-neighbour', IMPORT_NEIGHBOUR_WEIGHT);
      }
    }
  }

  const ordered = [...candidates.values()].sort((a, b) => b.score - a.score);
  const files: ContextFile[] = [];
  let used = 0;
  let dropped = 0;

  for (const candidate of ordered) {
    if (used + candidate.chars > input.budgetChars) {
      // Pinnade filer är ett medvetet val av användaren: korta dem hellre än att hoppa över.
      if (candidate.reason === 'pinned' && used < input.budgetChars) {
        const room = Math.max(500, input.budgetChars - used);
        files.push({
          path: candidate.path,
          reason: candidate.reason,
          chars: room,
          truncated: true,
        });
        used += room;
      }
      dropped += 1;
      continue;
    }
    files.push({
      path: candidate.path,
      reason: candidate.reason,
      chars: candidate.chars,
      truncated: false,
    });
    used += candidate.chars;
  }

  return { files, chars: used, dropped };
}

function estimateChars(entry: IndexedFile, charsPerLine: number): number {
  return entry.lines === 0 ? entry.bytes : Math.min(entry.bytes, entry.lines * charsPerLine);
}

/** Löser en import till faktiska filer i indexet (relativ eller paketnamn). */
function resolveImport(
  imported: string,
  fromPath: string,
  byPath: Map<string, IndexedFile>,
): string[] {
  if (!imported.startsWith('.')) return [];
  const baseDirectory = fromPath.includes('/') ? fromPath.slice(0, fromPath.lastIndexOf('/')) : '';
  const withoutExtension = stripExtension(imported);
  const segments = `${baseDirectory}/${withoutExtension}`.split('/');
  const normalized: string[] = [];
  for (const segment of segments) {
    if (segment === '.' || segment === '') continue;
    if (segment === '..') normalized.pop();
    else normalized.push(segment);
  }
  const stem = normalized.join('/');

  const candidates = [
    stem,
    `${stem}.ts`,
    `${stem}.tsx`,
    `${stem}.js`,
    `${stem}.jsx`,
    `${stem}.py`,
    `${stem}/index.ts`,
    `${stem}/index.tsx`,
    `${stem}/index.js`,
  ];
  return candidates.filter((candidate) => byPath.has(candidate));
}

function stripExtension(value: string): string {
  return value.replace(/\.(ts|tsx|js|jsx|mjs|cjs|py|json|vue|svelte)$/, '');
}

/** Läser filinnehåll för de valda filerna och klipper vid budgeten. */
export async function buildContextBlock(
  root: string,
  files: ContextFile[],
  options: { readFile: (absolutePath: string) => Promise<string>; maxChars?: number },
): Promise<string> {
  const blocks: string[] = [];
  let remaining = options.maxChars ?? 120_000;

  for (const file of files) {
    if (remaining <= 0) break;
    let content: string;
    try {
      content = await options.readFile(`${root}/${file.path}`.replace(/\\/g, '/'));
    } catch {
      continue;
    }
    const slice = Math.min(file.chars, remaining);
    const { text, truncated } = truncate(content, slice);
    remaining -= text.length;
    blocks.push(
      `--- ${file.path} (${truncated || file.truncated ? 'nedkortad' : 'hel'}) ---\n${text}`,
    );
  }

  return blocks.join('\n\n');
}
