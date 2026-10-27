import fs from 'node:fs/promises';
import type { Dirent, Stats } from 'node:fs';
import path from 'node:path';
import { matchesGlob, normalizeSlashes } from './text.js';

/** Mappar som aldrig indexeras, oavsett vad .gitignore säger. */
export const DEFAULT_IGNORED_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.svelte-kit',
  'coverage',
  'target',
  '.venv',
  'venv',
  '__pycache__',
  '.mypy_cache',
  '.pytest_cache',
  '.cache',
  '.turbo',
  '.idea',
  '.vscode',
  '.vibeforge/workspace',
  '.vibeforge/cache',
];

export const BINARY_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.icns',
  '.pdf',
  '.zip',
  '.gz',
  '.tgz',
  '.tar',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.mp3',
  '.mp4',
  '.mov',
  '.wasm',
  '.dll',
  '.so',
  '.dylib',
  '.exe',
  '.sqlite',
  '.db',
  '.bin',
  '.jar',
  '.class',
  '.pyc',
];

export function isBinaryPath(filePath: string): boolean {
  const extension = path.extname(filePath).toLowerCase();
  return BINARY_EXTENSIONS.includes(extension);
}

/** Tolkar en .gitignore till globbar. Stödjer kommentarer, negation, mappmönster och `**`. */
export function parseGitignore(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
    .map((line) => normalizeSlashes(line.replace(/\/+$/, '')));
}

export function isIgnored(relativePath: string, isDirectory: boolean, patterns: string[]): boolean {
  const candidate = normalizeSlashes(relativePath);
  const segments = candidate.split('/');
  if (segments.some((segment) => DEFAULT_IGNORED_DIRS.includes(segment))) return true;

  let ignored = false;
  for (const pattern of patterns) {
    const negated = pattern.startsWith('!');
    const body = negated ? pattern.slice(1) : pattern;
    if (matchesPattern(candidate, isDirectory, body)) ignored = !negated;
  }
  return ignored;
}

function matchesPattern(candidate: string, isDirectory: boolean, pattern: string): boolean {
  if (pattern === '') return false;
  const hasSlash = pattern.includes('/');
  if (!hasSlash) {
    return candidate.split('/').some((segment) => matchesGlob(segment, pattern));
  }
  // Mönster med snedstreck är rot- eller mapprelativa.
  if (candidate.startsWith(`${pattern}/`)) return true;
  if (isDirectory && candidate === pattern) return true;
  if (matchesGlob(candidate, pattern)) return true;
  return matchesGlob(candidate, `**/${pattern}`);
}

export interface WalkEntry {
  relative: string;
  absolute: string;
  size: number;
  mtimeMs: number;
}

export interface WalkOptions {
  root: string;
  patterns?: string[];
  maxFiles?: number;
  maxDepth?: number;
  includeBinary?: boolean;
}

/** Går igenom projektet och ger textfiler (eller alla filer om includeBinary). */
export async function* walkFiles(options: WalkOptions): AsyncGenerator<WalkEntry> {
  const root = path.resolve(options.root);
  const patterns = options.patterns ?? (await loadIgnorePatterns(root));
  const maxFiles = options.maxFiles ?? 5_000;
  const maxDepth = options.maxDepth ?? 12;
  let emitted = 0;

  const stack: Array<{ dir: string; depth: number }> = [{ dir: root, depth: 0 }];

  while (stack.length > 0) {
    const current = stack.pop() as { dir: string; depth: number };
    let entries: Dirent[];
    try {
      entries = await fs.readdir(current.dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const absolute = path.join(current.dir, entry.name);
      const relative = normalizeSlashes(path.relative(root, absolute));

      if (entry.isDirectory()) {
        if (current.depth >= maxDepth) continue;
        if (isIgnored(relative, true, patterns)) continue;
        stack.push({ dir: absolute, depth: current.depth + 1 });
        continue;
      }

      if (!entry.isFile()) continue;
      if (isIgnored(relative, false, patterns)) continue;
      if (!options.includeBinary && isBinaryPath(relative)) continue;

      let stats: Stats;
      try {
        stats = await fs.stat(absolute);
      } catch {
        continue;
      }

      yield { relative, absolute, size: stats.size, mtimeMs: stats.mtimeMs };
      emitted += 1;
      if (emitted >= maxFiles) return;
    }
  }
}

/** Läser ignoreringsmönster från .gitignore och .vibeforge/ignore (om de finns). */
export async function loadIgnorePatterns(root: string): Promise<string[]> {
  const files = ['.gitignore', '.vibeforge/ignore'];
  const patterns: string[] = [];
  for (const file of files) {
    try {
      patterns.push(...parseGitignore(await fs.readFile(path.join(root, file), 'utf8')));
    } catch {
      // Filen saknas – inget att läsa.
    }
  }
  return patterns;
}

export async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function isDirectory(target: string): Promise<boolean> {
  try {
    const stats = await fs.stat(target);
    return stats.isDirectory();
  } catch {
    return false;
  }
}
