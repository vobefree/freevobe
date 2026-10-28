import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VibeForgeDatabase, databasePath, resolveVibeForgeHome } from './db.js';
import { createRepositories, DEFAULT_SETTINGS } from './repositories.js';
import { runDoctor, formatDoctorReport } from '../doctor/doctor.js';
import { startFakeOllama, type FakeOllamaHandle } from '../testing/fakeOllama.js';
import { buildRepoMap } from '../context/repoMap.js';

let db: VibeForgeDatabase;
let tempDir: string;

beforeEach(async () => {
  db = new VibeForgeDatabase({ file: ':memory:' });
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vibeforge-store-'));
});

afterEach(async () => {
  db.close();
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe('VibeForgeDatabase', () => {
  it('migrerar schemat och är idempotent', () => {
    expect(db.schemaVersion).toBe(1);
    expect(db.migrate()).toBe(0);
    const tables = db.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as { name: string }[];
    const names = tables.map((row) => row.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'projects',
        'sessions',
        'messages',
        'settings',
        'index_files',
        'tasks',
        'approvals_log',
      ]),
    );
  });

  it('rullar tillbaka en trasig transaktion', () => {
    const projects = createRepositories(db).projects;
    expect(() =>
      db.transaction(() => {
        projects.upsert(tempDir);
        throw new Error('något gick fel');
      }),
    ).toThrow(/gick fel/);
    expect(projects.list()).toHaveLength(0);
  });
});

describe('repositories', () => {
  it('skapar och hittar ett projekt', () => {
    const repos = createRepositories(db);
    const project = repos.projects.upsert(tempDir, 'Svep');
    expect(project.name).toBe('Svep');
    expect(repos.projects.findByPath(tempDir)?.id).toBe(project.id);

    const again = repos.projects.upsert(tempDir);
    expect(again.id).toBe(project.id);
    expect(repos.projects.list()).toHaveLength(1);
  });

  it('sparar sessioner och meddelanden i ordning', () => {
    const repos = createRepositories(db);
    const project = repos.projects.upsert(tempDir);
    const session = repos.sessions.create({
      projectId: project.id,
      title: 'Första chatten',
      model: 'deepseek-r1:8b',
    });

    repos.messages.append({
      id: 'm1',
      sessionId: session.id,
      role: 'user',
      content: 'hej',
      createdAt: 1,
    });
    repos.messages.append({
      id: 'm2',
      sessionId: session.id,
      role: 'assistant',
      content: 'hej själv',
      createdAt: 2,
      toolCalls: [{ id: 'c1', name: 'read_file', args: { path: 'a.ts' } }],
      reasoning: 'jag tänker',
    });

    const messages = repos.messages.list(session.id);
    expect(messages.map((message) => message.id)).toEqual(['m1', 'm2']);
    expect(messages[1]?.reasoning).toBe('jag tänker');
    expect(messages[1]?.toolCalls?.[0]?.name).toBe('read_file');
    expect(repos.sessions.get(session.id)?.messageCount).toBe(2);
    expect(repos.messages.countUserMessages(session.id)).toBe(1);
  });

  it('tar bort en session med dess meddelanden', () => {
    const repos = createRepositories(db);
    const project = repos.projects.upsert(tempDir);
    const session = repos.sessions.create({ projectId: project.id, title: 'x', model: 'm' });
    repos.messages.append({
      id: 'm1',
      sessionId: session.id,
      role: 'user',
      content: 'hej',
      createdAt: 1,
    });
    repos.sessions.delete(session.id);
    expect(repos.sessions.get(session.id)).toBeNull();
    expect(repos.messages.list(session.id)).toHaveLength(0);
  });

  it('håller telemetri avstängt och slår ihop inställningar', () => {
    const repos = createRepositories(db);
    expect(repos.settings.get()).toEqual({ ...DEFAULT_SETTINGS, updatedAt: 0 });

    // Avsiktligt "felaktig" patch: inställningen telemetri får aldrig kunna slås på.
    const updated = repos.settings.set({
      defaultModel: 'qwen2.5-coder:7b',
      permissionMode: 'auto-edit',
      telemetry: true,
      ads: { provider: 'custom', everyNPrompts: 5, enabled: true },
    } as unknown as Partial<typeof DEFAULT_SETTINGS>);

    expect(updated.defaultModel).toBe('qwen2.5-coder:7b');
    expect(updated.permissionMode).toBe('auto-edit');
    expect(updated.ads.provider).toBe('custom');
    expect(updated.ads.everyNPrompts).toBe(5);
    expect(updated.telemetry).toBe(false);
    expect(updated.updatedAt).toBeGreaterThan(0);
  });

  it('sparar och läser filindex med vektorer', () => {
    const repos = createRepositories(db);
    repos.index.putMany([
      {
        path: 'src/agent.ts',
        hash: 'abc',
        bytes: 100,
        lines: 10,
        language: 'typescript',
        symbols: ['createAgent'],
        imports: ['./ollama'],
        vector: [0.123456, -0.5],
        updatedAt: 1,
      },
    ]);

    const all = repos.index.all();
    expect(all).toHaveLength(1);
    expect(all[0]?.symbols).toEqual(['createAgent']);
    expect(all[0]?.vector[0]).toBeCloseTo(0.123, 3);

    const first = all[0];
    expect(first).toBeDefined();
    repos.index.putMany([{ ...(first as NonNullable<typeof first>), hash: 'def' }]);
    expect(repos.index.all()[0]?.hash).toBe('def');

    repos.index.remove(['src/agent.ts']);
    expect(repos.index.all()).toHaveLength(0);
  });

  it('sparar uppgifter och godkännandeloggen', () => {
    const repos = createRepositories(db);
    const project = repos.projects.upsert(tempDir);
    const session = repos.sessions.create({ projectId: project.id, title: 'x', model: 'm' });

    const task = repos.tasks.create(session.id, 'Skriv testet');
    repos.tasks.setStatus(task.id, 'done');
    expect(repos.tasks.list(session.id)[0]?.status).toBe('done');
    repos.tasks.remove(task.id);
    expect(repos.tasks.list(session.id)).toHaveLength(0);

    repos.approvals.record({
      id: 'a1',
      sessionId: session.id,
      kind: 'file_write',
      target: 'src/a.ts',
      decision: 'approved',
    });
    const log = repos.approvals.list(session.id);
    expect(log[0]?.decision).toBe('approved');
    expect(log[0]?.target).toBe('src/a.ts');
  });
});

describe('sökvägar', () => {
  it('använder VIBEFORGE_HOME när den är satt', () => {
    const previous = process.env.VIBEFORGE_HOME;
    process.env.VIBEFORGE_HOME = path.join(tempDir, 'hemlig');
    try {
      expect(resolveVibeForgeHome()).toBe(path.resolve(process.env.VIBEFORGE_HOME));
      expect(databasePath()).toBe(
        path.join(path.resolve(process.env.VIBEFORGE_HOME), 'vibeforge.db'),
      );
    } finally {
      if (previous === undefined) delete process.env.VIBEFORGE_HOME;
      else process.env.VIBEFORGE_HOME = previous;
    }
  });

  it('tar en explicit sökväg före miljövariabeln', () => {
    expect(resolveVibeForgeHome(path.join(tempDir, 'vald'))).toBe(path.resolve(tempDir, 'vald'));
  });
});

describe('doctor', () => {
  it('rapporterar att allt är ok med en fungerande Ollama', async () => {
    const fake: FakeOllamaHandle = await startFakeOllama({});
    try {
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ scripts: { test: 'vitest run' } }),
      );
      const report = await runDoctor({
        projectRoot: tempDir,
        vibeForgeHome: path.join(tempDir, '.vibeforge'),
        ollamaBaseUrl: fake.url,
        model: 'deepseek-r1:8b',
        testCommand: 'npm test',
        gitVersion: 'git version 2.54.0',
      });

      expect(report.summary.fail).toBe(0);
      const ollama = report.checks.find((check) => check.id === 'ollama');
      expect(ollama?.status).toBe('ok');
      const model = report.checks.find((check) => check.id === 'ollama-model');
      expect(model?.status).toBe('ok');
      expect(formatDoctorReport(report)).toContain('Ollama');
    } finally {
      await fake.close();
    }
  });

  it('anger en åtgärd när Ollama inte körs och när modellen saknas', async () => {
    const fake = await startFakeOllama({});
    try {
      const dead = await runDoctor({ projectRoot: tempDir, ollamaBaseUrl: 'http://127.0.0.1:1' });
      const ollama = dead.checks.find((check) => check.id === 'ollama');
      expect(ollama?.status).toBe('fail');
      expect(ollama?.fix).toContain('https://freevobe.dev/docs/ollama');

      const missing = await runDoctor({
        projectRoot: tempDir,
        ollamaBaseUrl: fake.url,
        model: 'finns-inte:7b',
      });
      const model = missing.checks.find((check) => check.id === 'ollama-model');
      expect(model?.status).toBe('fail');
      expect(model?.fix).toContain('ollama pull');
    } finally {
      await fake.close();
    }
  });

  it('varnar för en modell utan verktygsstöd och för saknat testkommando', async () => {
    const fake = await startFakeOllama({});
    try {
      const report = await runDoctor({
        projectRoot: tempDir,
        ollamaBaseUrl: fake.url,
        model: 'qwen2.5-coder:1.5b',
        testCommand: null,
      });
      expect(report.checks.find((check) => check.id === 'ollama-model')?.status).toBe('warn');
      expect(report.checks.find((check) => check.id === 'test-command')?.status).toBe('warn');
      expect(report.checks.find((check) => check.id === 'git')?.status).toBe('warn');
      expect(report.summary.fail).toBe(0);
    } finally {
      await fake.close();
    }
  });

  it('kastar aldrig när projektmappen inte finns', async () => {
    const fake = await startFakeOllama({});
    try {
      const report = await runDoctor({
        projectRoot: path.join(tempDir, 'finns-inte'),
        ollamaBaseUrl: fake.url,
      });
      expect(report.checks.find((check) => check.id === 'project')?.status).toBe('fail');
    } finally {
      await fake.close();
    }
  });

  it('räknar indexerade filer', async () => {
    await fs.writeFile(path.join(tempDir, 'a.ts'), 'export const a = 1;\n');
    const map = await buildRepoMap(tempDir);
    const fake = await startFakeOllama({});
    try {
      const report = await runDoctor({
        projectRoot: tempDir,
        ollamaBaseUrl: fake.url,
        indexedFiles: map.length,
      });
      expect(report.checks.find((check) => check.id === 'project-index')?.status).toBe('ok');
    } finally {
      await fake.close();
    }
  });
});
