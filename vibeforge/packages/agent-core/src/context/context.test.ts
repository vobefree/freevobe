import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cosineSimilarity, embed, tokenize, vectorLength } from './embedding.js';
import { MemoryIndexStore, ProjectIndexer } from './indexer.js';
import { buildRepoMap, extractImports, extractSymbols, formatRepoMap } from './repoMap.js';
import { selectContext } from './selector.js';

describe('embedding', () => {
  it('är deterministisk och normaliserad', () => {
    const first = embed('skriv en react-komponent för listan');
    const second = embed('skriv en react-komponent för listan');
    expect(first).toEqual(second);
    expect(vectorLength(first)).toBeCloseTo(1, 6);
  });

  it('delar upp kamelCase och skiljetecken', () => {
    expect(tokenize('getUserById')).toEqual(['get', 'user', 'by', 'id']);
    expect(tokenize('read_file')).toContain('read');
  });

  it('ger högre likhet för besläktad text', () => {
    const query = embed('ollama modellval och streaming');
    const related = embed('modellval för ollama med streaming av svar');
    const unrelated = embed('css grid layout med färger och typografi');
    expect(cosineSimilarity(query, related)).toBeGreaterThan(cosineSimilarity(query, unrelated));
  });

  it('returnerar nollvektor för tom text', () => {
    expect(vectorLength(embed(''))).toBe(0);
  });
});

describe('repoMap', () => {
  let root: string;

  beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'vibeforge-repomap-'));
    await fs.mkdir(path.join(root, 'src'), { recursive: true });
    await fs.mkdir(path.join(root, 'node_modules', 'left-pad'), { recursive: true });
    await fs.writeFile(
      path.join(root, 'src', 'agent.ts'),
      [
        "import { OllamaClient } from './ollama/client';",
        "import fs from 'node:fs';",
        'export interface AgentOptions { model: string }',
        'export function createAgent(options: AgentOptions) { return options; }',
        'class Internal { run() {} }',
      ].join('\n'),
    );
    await fs.writeFile(
      path.join(root, 'src', 'python_bit.py'),
      'def hamta_modeller(url):\n    return url\n',
    );
    await fs.writeFile(path.join(root, 'README.md'), '# Projekt\n');
    await fs.writeFile(
      path.join(root, 'node_modules', 'left-pad', 'index.js'),
      'module.exports = 1;',
    );
    await fs.writeFile(path.join(root, '.gitignore'), 'hemligt/\n*.log\n');
    await fs.mkdir(path.join(root, 'hemligt'), { recursive: true });
    await fs.writeFile(path.join(root, 'hemligt', 'nyckel.txt'), 'sk-hemlig');
  });

  afterAll(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('respekterar ignore-regler och hoppar över node_modules', async () => {
    const map = await buildRepoMap(root);
    const paths = map.map((entry) => entry.path);
    expect(paths).toContain('src/agent.ts');
    expect(paths).toContain('README.md');
    expect(paths.some((p) => p.includes('node_modules'))).toBe(false);
    expect(paths.some((p) => p.includes('hemligt'))).toBe(false);
  });

  it('plockar ut symboler och importer per språk', async () => {
    const map = await buildRepoMap(root);
    const agent = map.find((entry) => entry.path === 'src/agent.ts');
    expect(agent?.language).toBe('typescript');
    expect(agent?.symbols).toContain('createAgent');
    expect(agent?.symbols).toContain('AgentOptions');
    expect(agent?.symbols).toContain('Internal');
    expect(agent?.imports.some((entry) => entry.includes('./ollama/client'))).toBe(true);

    const python = map.find((entry) => entry.path === 'src/python_bit.py');
    expect(python?.symbols).toContain('hamta_modeller');
  });

  it('formaterar en kompakt repo map', async () => {
    const map = await buildRepoMap(root);
    const text = formatRepoMap(map, 500);
    expect(text).toContain('src/agent.ts');
    expect(text.length).toBeLessThanOrEqual(500 + 60);
  });

  it('extraherar symboler och importer direkt', () => {
    expect(extractSymbols('export const svep = 1;')).toContain('svep');
    expect(extractImports("import x from './y';")).toContain('./y');
  });
});

describe('ProjectIndexer', () => {
  let root: string;
  let store: MemoryIndexStore;

  beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'vibeforge-index-'));
    await fs.mkdir(path.join(root, 'src'), { recursive: true });
    await fs.writeFile(
      path.join(root, 'src', 'ollama.ts'),
      'export function fetchModels() {}\n// ollama modeller streaming\n',
    );
    await fs.writeFile(path.join(root, 'src', 'styles.css'), '.a { color: red; }\n');
    store = new MemoryIndexStore();
  });

  afterAll(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('indexerar och hoppar över oförändrade filer vid omkörning', async () => {
    const indexer = new ProjectIndexer(store);
    const first = await indexer.index(root);
    expect(first.indexed).toBe(2);
    expect(first.unchanged).toBe(0);

    const second = await indexer.index(root);
    expect(second.indexed).toBe(0);
    expect(second.unchanged).toBe(2);
  });

  it('tar bort filer som försvunnit ur indexet', async () => {
    const indexer = new ProjectIndexer(store);
    await fs.rm(path.join(root, 'src', 'styles.css'));
    const result = await indexer.index(root);
    expect(result.removed).toBe(1);
    expect((await store.all()).map((file) => file.path)).toEqual(['src/ollama.ts']);
  });

  it('rankar relevanta filer först', async () => {
    const indexer = new ProjectIndexer(store);
    const results = await indexer.search('ollama modeller streaming', 5);
    expect(results[0]?.path).toBe('src/ollama.ts');
    expect(results[0]?.score).toBeGreaterThan(0);
  });
});

describe('selectContext', () => {
  const files = [
    {
      path: 'src/agent.ts',
      hash: 'a',
      bytes: 4_000,
      lines: 100,
      language: 'typescript',
      symbols: ['createAgent'],
      imports: ['./ollama/client'],
      vector: embed('agent loop verktyg ollama'),
      updatedAt: 0,
    },
    {
      path: 'src/ollama/client.ts',
      hash: 'b',
      bytes: 3_000,
      lines: 80,
      language: 'typescript',
      symbols: ['OllamaClient'],
      imports: [],
      vector: embed('ollama klient modeller'),
      updatedAt: 0,
    },
    {
      path: 'src/styles.css',
      hash: 'c',
      bytes: 500,
      lines: 20,
      language: 'css',
      symbols: [],
      imports: [],
      vector: embed('css färger layout'),
      updatedAt: 0,
    },
    {
      path: 'README.md',
      hash: 'd',
      bytes: 2_000,
      lines: 50,
      language: 'markdown',
      symbols: [],
      imports: [],
      vector: embed('dokumentation projekt'),
      updatedAt: 0,
    },
  ];

  it('lägger pinnade filer först', () => {
    const result = selectContext({
      prompt: 'hej',
      entries: files,
      pinned: ['README.md'],
      budgetChars: 50_000,
    });
    expect(result.files[0]?.path).toBe('README.md');
    expect(result.files[0]?.reason).toBe('pinned');
  });

  it('håller sig inom teckenbudgeten', () => {
    const result = selectContext({ prompt: 'ollama modeller', entries: files, budgetChars: 3_500 });
    expect(result.chars).toBeLessThanOrEqual(3_500);
    expect(result.dropped).toBeGreaterThan(0);
  });

  it('tar med importgrannar till valda filer', () => {
    const result = selectContext({
      prompt: 'createAgent verktyg',
      entries: files,
      budgetChars: 100_000,
    });
    const paths = result.files.map((file) => file.path);
    expect(paths).toContain('src/agent.ts');
    expect(paths).toContain('src/ollama/client.ts');
  });

  it('ger alltid plats åt en pinnad fil även när budgeten är trång', () => {
    const result = selectContext({
      prompt: 'css',
      entries: files,
      pinned: ['src/agent.ts'],
      budgetChars: 900,
    });
    expect(result.files[0]?.path).toBe('src/agent.ts');
    expect(result.files[0]?.truncated).toBe(true);
  });

  it('ignorerar irrelevanta filer helt', () => {
    const result = selectContext({
      prompt: 'helt orelaterad fråga om kaffebryggaren',
      entries: files,
      budgetChars: 50_000,
    });
    expect(result.files.map((file) => file.path)).not.toContain('src/styles.css');
  });
});
