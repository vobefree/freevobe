import fs from 'node:fs/promises';
import type { ProjectRepoMapEntry } from '@vibeforge/protocol';
import { shortHash } from '../util/ids.js';
import { walkFiles } from '../util/walk.js';
import { cosineSimilarity, embed } from './embedding.js';
import { detectLanguage, extractImports, extractSymbols } from './repoMap.js';

export interface IndexedFile {
  path: string;
  hash: string;
  bytes: number;
  lines: number;
  language: string;
  symbols: string[];
  imports: string[];
  vector: number[];
  updatedAt: number;
}

export interface IndexStore {
  all(): IndexedFile[] | Promise<IndexedFile[]>;
  putMany(files: IndexedFile[]): void | Promise<void>;
  remove(paths: string[]): void | Promise<void>;
}

/** Enkelt minneslager. SQLite-implementationen finns i `store/` och används av servern. */
export class MemoryIndexStore implements IndexStore {
  private readonly files = new Map<string, IndexedFile>();

  all(): IndexedFile[] {
    return [...this.files.values()];
  }

  putMany(files: IndexedFile[]): void {
    for (const file of files) this.files.set(file.path, file);
  }

  remove(paths: string[]): void {
    for (const path of paths) this.files.delete(path);
  }
}

export interface IndexProgress {
  scanned: number;
  indexed: number;
  unchanged: number;
  totalFiles: number;
}

export interface IndexResult {
  indexed: number;
  unchanged: number;
  removed: number;
  durationMs: number;
  entries: IndexedFile[];
}

const MAX_INDEX_BYTES = 400_000;
const MAX_VECTOR_CHARS = 20_000;

export class ProjectIndexer {
  private readonly store: IndexStore;
  private readonly maxFiles: number;

  constructor(store: IndexStore, options: { maxFiles?: number } = {}) {
    this.store = store;
    this.maxFiles = options.maxFiles ?? 4_000;
  }

  /**
   * Indexerar projektet. Oförändrade filer (samma hash) hoppas över, så en omkörning är billig.
   * Returnerar dessutom alla poster, vilket gör att anroparen slipper läsa lagret igen.
   */
  async index(
    root: string,
    options: { onProgress?: (progress: IndexProgress) => void } = {},
  ): Promise<IndexResult> {
    const started = Date.now();
    const existing = new Map((await this.store.all()).map((file) => [file.path, file]));
    const seen = new Set<string>();
    const changed: IndexedFile[] = [];
    let unchanged = 0;
    let scanned = 0;

    for await (const file of walkFiles({ root, maxFiles: this.maxFiles })) {
      if (file.size > MAX_INDEX_BYTES) continue;
      scanned += 1;
      seen.add(file.relative);

      let content: string;
      try {
        content = await fs.readFile(file.absolute, 'utf8');
      } catch {
        continue;
      }

      const hash = shortHash(content, 16);
      const previous = existing.get(file.relative);
      if (previous && previous.hash === hash) {
        unchanged += 1;
        continue;
      }

      changed.push({
        path: file.relative,
        hash,
        bytes: file.size,
        lines: content === '' ? 0 : content.split('\n').length,
        language: detectLanguage(file.relative),
        symbols: extractSymbols(content),
        imports: extractImports(content),
        vector: embed(`${file.relative}\n${content.slice(0, MAX_VECTOR_CHARS)}`),
        updatedAt: Date.now(),
      });

      if (scanned % 50 === 0) {
        options.onProgress?.({ scanned, indexed: changed.length, unchanged, totalFiles: 0 });
      }
    }

    const removedPaths = [...existing.keys()].filter((path) => !seen.has(path));
    await this.store.putMany(changed);
    if (removedPaths.length > 0) await this.store.remove(removedPaths);

    const entries = await this.store.all();
    return {
      indexed: changed.length,
      unchanged,
      removed: removedPaths.length,
      durationMs: Date.now() - started,
      entries,
    };
  }

  /** Alla indexerade filer. Används av agent-loopen för att välja kontext. */
  async all(): Promise<IndexedFile[]> {
    return this.store.all();
  }

  /** Rankar filer mot en fritextfråga med vektorsimilaritet. */
  async search(
    query: string,
    limit = 12,
    entries?: IndexedFile[],
  ): Promise<Array<{ path: string; score: number }>> {
    const files = entries ?? (await this.store.all());
    const queryVector = embed(query);
    const scored = files
      .map((file) => ({ path: file.path, score: cosineSimilarity(queryVector, file.vector) }))
      .filter((entry) => entry.score > 0.01)
      .sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  /** Bygger repo map från indexet i stället för att läsa om alla filer. */
  async repoMap(entries?: IndexedFile[]): Promise<ProjectRepoMapEntry[]> {
    const files = entries ?? (await this.store.all());
    return files
      .map((file) => ({
        path: file.path,
        size: file.bytes,
        lines: file.lines,
        language: file.language,
        symbols: file.symbols,
        imports: file.imports,
      }))
      .sort((a, b) => a.path.localeCompare(b.path));
  }
}
