import path from 'node:path';
import type { ProjectRepoMapEntry } from '@vibeforge/protocol';
import { truncate } from '../util/text.js';
import { walkFiles, isBinaryPath } from '../util/walk.js';
import fs from 'node:fs/promises';

const MAX_FILE_BYTES = 400_000;

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'go',
  '.rb': 'ruby',
  '.java': 'java',
  '.cs': 'csharp',
  '.php': 'php',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.hpp': 'cpp',
  '.css': 'css',
  '.scss': 'scss',
  '.html': 'html',
  '.md': 'markdown',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.sh': 'shell',
  '.sql': 'sql',
};

export function detectLanguage(filePath: string): string {
  return LANGUAGE_BY_EXTENSION[path.extname(filePath).toLowerCase()] ?? 'unknown';
}

const SYMBOL_PATTERNS: Array<{ regex: RegExp; group: number }> = [
  { regex: /^\s*export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm, group: 1 },
  { regex: /^\s*export\s+(?:default\s+)?class\s+([A-Za-z_$][\w$]*)/gm, group: 1 },
  { regex: /^\s*export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm, group: 1 },
  { regex: /^\s*export\s+(?:type|interface|enum)\s+([A-Za-z_$][\w$]*)/gm, group: 1 },
  { regex: /^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm, group: 1 },
  { regex: /^\s*class\s+([A-Za-z_$][\w$]*)/gm, group: 1 },
  { regex: /^\s*def\s+([A-Za-z_][\w]*)/gm, group: 1 },
  { regex: /^\s*class\s+([A-Za-z_][\w]*)\s*[:(]/gm, group: 1 },
  { regex: /^\s*(?:pub\s+)?fn\s+([A-Za-z_][\w]*)/gm, group: 1 },
  { regex: /^\s*func\s+(?:\([^)]*\)\s*)?([A-Za-z_][\w]*)/gm, group: 1 },
  {
    regex: /^\s*(?:CREATE\s+TABLE|CREATE\s+VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z_"[\].]+)/gim,
    group: 1,
  },
];

const IMPORT_PATTERNS: RegExp[] = [
  /^\s*import\s+[^'"]*from\s+['"]([^'"]+)['"]/gm,
  /^\s*import\s+['"]([^'"]+)['"]/gm,
  /^\s*from\s+([\w.]+)\s+import\s+/gm,
  /^\s*(?:const|let|var)\s+[\w{},\s*]+\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)/gm,
  /^\s*#include\s+[<"]([^>"]+)[>"]/gm,
  /^\s*use\s+([\w:\\]+)/gm,
];

/** Plockar ut exporterade/importerade symboler med regex – snabbt och språkoberoende nog för en repo map. */
export function extractSymbols(content: string, limit = 40): string[] {
  const symbols = new Set<string>();
  for (const pattern of SYMBOL_PATTERNS) {
    pattern.regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.regex.exec(content)) !== null) {
      const value = match[pattern.group];
      if (value) symbols.add(value.replace(/["`[\]]/g, ''));
      if (symbols.size >= limit) return [...symbols];
    }
  }
  return [...symbols];
}

export function extractImports(content: string, limit = 40): string[] {
  const imports = new Set<string>();
  for (const regex of IMPORT_PATTERNS) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const value = match[1];
      if (value && !value.startsWith('.')) imports.add(value);
      else if (value) imports.add(value);
      if (imports.size >= limit) return [...imports];
    }
  }
  return [...imports];
}

export interface RepoMapOptions {
  maxFiles?: number;
  onProgress?: (done: number, total: number) => void;
}

/** Bygger en repo map: fil, språk, storlek, symboler och importer. */
export async function buildRepoMap(
  root: string,
  options: RepoMapOptions = {},
): Promise<ProjectRepoMapEntry[]> {
  const entries: ProjectRepoMapEntry[] = [];
  let scanned = 0;

  for await (const file of walkFiles({ root, maxFiles: options.maxFiles ?? 4_000 })) {
    if (file.size > MAX_FILE_BYTES) continue;
    scanned += 1;
    if (scanned % 100 === 0) options.onProgress?.(scanned, 0);

    let content = '';
    try {
      const buffer = await fs.readFile(file.absolute);
      content = buffer.toString('utf8');
      if (isBinaryPath(file.relative)) continue;
    } catch {
      continue;
    }

    entries.push({
      path: file.relative,
      size: file.size,
      lines: content === '' ? 0 : content.split('\n').length,
      language: detectLanguage(file.relative),
      symbols: extractSymbols(content),
      imports: extractImports(content),
    });
  }

  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

/** Kompakt textversion av repo mapen för systemprompten. */
export function formatRepoMap(entries: ProjectRepoMapEntry[], maxChars = 8_000): string {
  const lines = entries.map((entry) => {
    const symbols = entry.symbols.slice(0, 6).join(', ');
    return `${entry.path} (${entry.language}, ${entry.lines} rader)${symbols ? ` – ${symbols}` : ''}`;
  });
  return truncate(lines.join('\n'), maxChars).text;
}
