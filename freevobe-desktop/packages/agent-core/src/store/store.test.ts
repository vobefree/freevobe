import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MIGRATIONS, FreevobeDatabase, databasePath, resolveFreevobeHome } from './db.js';
import { createRepositories, DEFAULT_SETTINGS } from './repositories.js';
import { DEFAULT_AUTO_APPROVE } from '@freevobe/protocol';
import { runDoctor, formatDoctorReport } from '../doctor/doctor.js';
import { startFakeOllama, type FakeOllamaHandle } from '../testing/fakeOllama.js';
import { buildRepoMap } from '../context/repoMap.js';

let db: FreevobeDatabase;
let tempDir: string;

beforeEach(async () => {
  db = new FreevobeDatabase({ file: ':memory:' });
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-store-'));
});

afterEach(async () => {
  db.close();
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe('FreevobeDatabase', () => {
  it('migrerar schemat och är idempotent', () => {
    // Läser den senaste migreringen i stället för en hårdkodad siffra: annars faller testet varje
    // gång schemat växer, trots att migreringen är korrekt.
    const latest = Math.max(...MIGRATIONS.map((migration) => migration.version));
    expect(db.schemaVersion).toBe(latest);
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
        'checkpoints',
        'plans',
        'verifications',
        'gives_back_entries',
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
      givesBack: { enabled: true, everyNPrompts: 5, causeIds: ['wwf'] },
    } as unknown as Partial<typeof DEFAULT_SETTINGS>);

    expect(updated.defaultModel).toBe('qwen2.5-coder:7b');
    expect(updated.permissionMode).toBe('auto-edit');
    expect(updated.givesBack.everyNPrompts).toBe(5);
    expect(updated.givesBack.causeIds).toEqual(['wwf']);
    expect(updated.telemetry).toBe(false);
    expect(updated.updatedAt).toBeGreaterThan(0);
  });

  it('migrerar en gammal annonsplats till Gives Back utan att tända något', () => {
    const repos = createRepositories(db);
    // Så här såg inställningarna ut innan Gives Back fanns.
    db.db
      .prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)')
      .run(
        'ads',
        JSON.stringify({ provider: 'custom', everyNPrompts: 7, enabled: false }),
        Date.now(),
      );

    const migrated = repos.settings.get().givesBack;
    expect(migrated.enabled).toBe(false);
    expect(migrated.everyNPrompts).toBe(7);
    expect(migrated.consentedAt).toBeUndefined();

    // Ett gammalt ja till annonsplatsen behåller en plats, men den är nu välgörenhet.
    db.db
      .prepare(
        'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      )
      .run(
        'ads',
        JSON.stringify({ provider: 'custom', everyNPrompts: 4, enabled: true, consentedAt: 11 }),
        Date.now(),
      );
    const kept = repos.settings.get().givesBack;
    expect(kept.enabled).toBe(true);
    expect(kept.everyNPrompts).toBe(4);
    expect(kept.consentedAt).toBe(11);
  });

  it('ignorerar ändamål som inte finns i katalogen', () => {
    const repos = createRepositories(db);
    const saved = repos.settings.set({
      givesBack: { enabled: true, everyNPrompts: 10, causeIds: ['wwf', 'päron'] },
    });
    expect(saved.givesBack.causeIds).toEqual(['wwf']);
  });

  it('registrerar, sammanställer och raderar ett eget stöd', () => {
    const repos = createRepositories(db);
    expect(repos.givesBack.list()).toEqual([]);
    expect(repos.givesBack.summary()).toEqual({ count: 0, totalSek: 0, causeCount: 0 });

    const first = repos.givesBack.add({
      causeId: 'wwf',
      amountSek: 250,
      note: 'Skogsplantering',
      createdAt: 1_000,
    });
    expect(first.source).toBe('self-reported');
    expect(first.amountSek).toBe(250);
    expect(first.note).toBe('Skogsplantering');

    repos.givesBack.add({ causeId: 'wwf', amountSek: 50, createdAt: 2_000 });
    repos.givesBack.add({ causeId: 'unicef', amountSek: 100, createdAt: 500 });

    const summary = repos.givesBack.summary();
    expect(summary.count).toBe(3);
    expect(summary.totalSek).toBe(400);
    expect(summary.causeCount).toBe(2);
    expect(repos.givesBack.summaryOf(repos.givesBack.list())).toEqual(summary);

    // Nyast först.
    expect(repos.givesBack.list().map((entry) => entry.amountSek)).toEqual([50, 250, 100]);

    expect(repos.givesBack.remove(first.id)).toBe(true);
    expect(repos.givesBack.remove(first.id)).toBe(false);
    expect(repos.givesBack.summary().totalSek).toBe(150);
  });

  it('avvisar okända ändamål, negativa belopp och för långa anteckningar', () => {
    const repos = createRepositories(db);
    expect(() => repos.givesBack.add({ causeId: 'finns-inte' })).toThrow(/katalogen/);
    expect(() => repos.givesBack.add({ causeId: 'wwf', amountSek: -1 })).toThrow(/Beloppet/);
    expect(() => repos.givesBack.add({ causeId: 'wwf', amountSek: 1.5 })).toThrow(/Beloppet/);
    expect(() =>
      repos.givesBack.add({ causeId: 'wwf', amountSek: 10, note: 'x'.repeat(201) }),
    ).toThrow(/200/);
  });

  it('slår ihop auto-godkännande per kategori med defaultvärdena', () => {
    const repos = createRepositories(db);
    expect(repos.settings.get().autoApprove).toEqual(DEFAULT_AUTO_APPROVE);

    const updated = repos.settings.set({ autoApprove: { file_write: true } as never });
    expect(updated.autoApprove.file_write).toBe(true);
    // Kategorier som inte skickades med behåller sitt defaultvärde (av).
    expect(updated.autoApprove.command).toBe(false);
    expect(updated.autoApprove.test).toBe(false);

    const disabled = repos.settings.set({
      autoApprove: { ...updated.autoApprove, file_write: false },
    });
    expect(disabled.autoApprove).toEqual(DEFAULT_AUTO_APPROVE);
  });

  it('sparar planer och håller en godkänd plan som kontrakt', () => {
    const repos = createRepositories(db);
    const project = repos.projects.upsert(tempDir);
    const session = repos.sessions.create({
      projectId: project.id,
      title: 'Plan-chatt',
      model: 'qwen2.5-coder:7b',
      mode: 'plan',
    });

    const first = repos.plans.create({
      id: 'plan_1',
      sessionId: session.id,
      runId: 'run_1',
      title: 'Första planen',
      summary: 'Ett steg.',
      steps: [{ id: 'step_1', title: 'Läs filen', files: ['src/a.ts'] }],
      files: ['src/a.ts'],
      status: 'proposed',
      createdAt: 1,
    });
    expect(repos.plans.get(first.id)?.steps[0]?.title).toBe('Läs filen');
    expect(repos.plans.active(session.id)).toBeNull();

    // Godkännandet gör planen till kontrakt. Beslutet sparas med tidsstämpel.
    const approved = repos.plans.decide('plan_1', 'approved');
    expect(approved?.status).toBe('approved');
    expect(approved?.decidedAt).toBeGreaterThan(0);
    expect(repos.plans.active(session.id)?.id).toBe('plan_1');

    // En ny godkänd plan ersätter den gamla – aldrig två kontrakt samtidigt.
    repos.plans.create({
      id: 'plan_2',
      sessionId: session.id,
      runId: 'run_2',
      title: 'Andra planen',
      summary: '',
      steps: [{ id: 'step_1', title: 'Skriv', files: [] }],
      files: [],
      status: 'proposed',
      createdAt: 2,
    });
    repos.plans.decide('plan_2', 'approved');
    expect(repos.plans.active(session.id)?.id).toBe('plan_2');
    expect(repos.plans.get('plan_1')?.status).toBe('superseded');
    expect(repos.plans.listBySession(session.id).map((plan) => plan.id)).toEqual([
      'plan_2',
      'plan_1',
    ]);

    // En avvisad plan blir aldrig kontrakt.
    repos.plans.create({
      id: 'plan_3',
      sessionId: session.id,
      runId: 'run_3',
      title: 'Tredje planen',
      summary: '',
      steps: [{ id: 'step_1', title: 'Något', files: [] }],
      files: [],
      status: 'proposed',
      createdAt: 3,
    });
    repos.plans.decide('plan_3', 'rejected');
    expect(repos.plans.active(session.id)?.id).toBe('plan_2');
  });

  it('sparar verifieringsrapporter och visar den senaste', () => {
    const repos = createRepositories(db);
    const project = repos.projects.upsert(tempDir);

    expect(repos.verifications.latest(project.id)).toBeNull();

    const report = {
      id: 'verify_1',
      projectId: project.id,
      sessionId: 'sess_1',
      trigger: 'run' as const,
      status: 'failed' as const,
      summary: '1 av 2 steg röda: Tester (1,2 s).',
      startedAt: 10,
      finishedAt: 20,
      durationMs: 10,
      checks: [
        {
          id: 'typecheck',
          label: 'Typkontroll',
          kind: 'typecheck' as const,
          command: 'npm run typecheck --silent',
          source: 'package.json',
          status: 'passed' as const,
          exitCode: 0,
          durationMs: 4,
          output: 'ok',
        },
        {
          id: 'test',
          label: 'Tester',
          kind: 'test' as const,
          command: 'npm run test --silent',
          source: 'package.json',
          status: 'failed' as const,
          exitCode: 1,
          durationMs: 6,
          output: 'Tests  1 failed',
          passed: 3,
          failed: 1,
        },
      ],
    };

    repos.verifications.create(report);
    const stored = repos.verifications.get('verify_1');
    expect(stored?.checks).toHaveLength(2);
    expect(stored?.checks[1]?.failed).toBe(1);
    expect(stored?.trigger).toBe('run');

    repos.verifications.create({ ...report, id: 'verify_2', status: 'passed', startedAt: 30 });
    expect(repos.verifications.latest(project.id)?.id).toBe('verify_2');
    expect(repos.verifications.list(project.id).map((entry) => entry.id)).toEqual([
      'verify_2',
      'verify_1',
    ]);
  });

  it('slår på automatisk verifiering som standard', () => {
    const repos = createRepositories(db);
    expect(repos.settings.get().verifyAfterRun).toBe(true);
    expect(repos.settings.set({ verifyAfterRun: false }).verifyAfterRun).toBe(false);
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
  it('använder FREEVOBE_HOME när den är satt', () => {
    const previous = process.env.FREEVOBE_HOME;
    process.env.FREEVOBE_HOME = path.join(tempDir, 'hemlig');
    try {
      expect(resolveFreevobeHome()).toBe(path.resolve(process.env.FREEVOBE_HOME));
      expect(databasePath()).toBe(
        path.join(path.resolve(process.env.FREEVOBE_HOME), 'freevobe.db'),
      );
    } finally {
      if (previous === undefined) delete process.env.FREEVOBE_HOME;
      else process.env.FREEVOBE_HOME = previous;
    }
  });

  it('tar en explicit sökväg före miljövariabeln', () => {
    expect(resolveFreevobeHome(path.join(tempDir, 'vald'))).toBe(path.resolve(tempDir, 'vald'));
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
        freevobeHome: path.join(tempDir, '.freevobe'),
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
