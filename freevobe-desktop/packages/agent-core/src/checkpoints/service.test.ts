import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CHECKPOINT_LIMIT } from '@freevobe/protocol';
import { CheckpointService } from './service.js';
import { FreevobeDatabase } from '../store/db.js';
import { createRepositories } from '../store/repositories.js';

let root: string;
let home: string;
let db: FreevobeDatabase;
let service: CheckpointService;
let projectId: string;

const ORIGINAL = 'export const halsa = 1;\n';
const UPDATED = 'export const halsa = 2;\n';

async function write(relative: string, content: string): Promise<void> {
  const absolute = path.join(root, relative);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, content, 'utf8');
}

async function read(relative: string): Promise<string> {
  return fs.readFile(path.join(root, relative), 'utf8');
}

async function exists(relative: string): Promise<boolean> {
  try {
    await fs.access(path.join(root, relative));
    return true;
  } catch {
    return false;
  }
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-cp-proj-'));
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-cp-home-'));
  db = new FreevobeDatabase({ file: ':memory:' });
  const repositories = createRepositories(db);
  projectId = repositories.projects.upsert(root, 'Checkpoint-test').id;
  service = new CheckpointService({ db, root, home });
});

afterEach(async () => {
  db.close();
  await fs.rm(root, { recursive: true, force: true });
  await fs.rm(home, { recursive: true, force: true });
});

describe('CheckpointService', () => {
  it('sparar filens tidigare innehåll och skriver tillbaka det', async () => {
    await write('src/halsa.ts', ORIGINAL);

    const draft = service.begin({ projectId, label: 'Uppdatera hälsningen', reason: 'agent-run' });
    expect(draft.id).toBeNull();

    await write('src/halsa.ts', UPDATED);
    await draft.record({
      path: 'src/halsa.ts',
      beforeContent: ORIGINAL,
      afterContent: UPDATED,
      additions: 1,
      deletions: 1,
      changeKind: 'update',
    });

    const saved = await draft.finish();
    expect(saved?.label).toBe('Uppdatera hälsningen');
    expect(saved?.reason).toBe('agent-run');
    expect(saved?.files).toEqual([
      { path: 'src/halsa.ts', changeKind: 'update', additions: 1, deletions: 1, snapshot: true },
    ]);

    const report = await service.restore(saved!.id);
    expect(report.restored).toEqual(['src/halsa.ts']);
    expect(report.skipped).toEqual([]);
    expect(await read('src/halsa.ts')).toBe(ORIGINAL);

    const after = service.get(saved!.id);
    expect(after?.status).toBe('restored');
    expect(after?.restoredAt).toBeTypeOf('number');
  });

  it('tar bort filer som skapades efter checkpointen', async () => {
    const draft = service.begin({ projectId, label: 'Skapa ny fil', reason: 'agent-run' });
    await write('src/ny.ts', 'export const ny = true;\n');
    await draft.record({
      path: 'src/ny.ts',
      beforeContent: null,
      afterContent: 'export const ny = true;\n',
      additions: 1,
      deletions: 0,
      changeKind: 'create',
    });
    const saved = await draft.finish();

    const report = await service.restore(saved!.id);
    expect(report.deleted).toEqual(['src/ny.ts']);
    expect(report.restored).toEqual([]);
    expect(await exists('src/ny.ts')).toBe(false);
  });

  it('hoppar över filer som ändrats efter checkpointen, om inte force används', async () => {
    await write('src/halsa.ts', ORIGINAL);
    const draft = service.begin({ projectId, label: 'Ändra', reason: 'agent-run' });
    await write('src/halsa.ts', UPDATED);
    await draft.record({
      path: 'src/halsa.ts',
      beforeContent: ORIGINAL,
      afterContent: UPDATED,
      additions: 1,
      deletions: 1,
      changeKind: 'update',
    });
    const saved = await draft.finish();

    // Användaren (eller en senare körning) har hunnit ändra filen igen.
    await write('src/halsa.ts', 'export const halsa = 3;\n');

    const skipped = await service.restore(saved!.id);
    expect(skipped.restored).toEqual([]);
    expect(skipped.skipped).toEqual([{ path: 'src/halsa.ts', reason: 'changed-since' }]);
    expect(await read('src/halsa.ts')).toBe('export const halsa = 3;\n');

    const forced = await service.restore(saved!.id, { force: true });
    expect(forced.restored).toEqual(['src/halsa.ts']);
    expect(await read('src/halsa.ts')).toBe(ORIGINAL);
  });

  it('behåller det ursprungliga innehållet när samma fil ändras flera gånger i en körning', async () => {
    await write('src/halsa.ts', ORIGINAL);
    const draft = service.begin({ projectId, label: 'Flera steg', reason: 'agent-run' });

    await write('src/halsa.ts', UPDATED);
    await draft.record({
      path: 'src/halsa.ts',
      beforeContent: ORIGINAL,
      afterContent: UPDATED,
      additions: 1,
      deletions: 1,
      changeKind: 'update',
    });

    await write('src/halsa.ts', 'export const halsa = 3;\n');
    await draft.record({
      path: 'src/halsa.ts',
      beforeContent: UPDATED,
      afterContent: 'export const halsa = 3;\n',
      additions: 1,
      deletions: 1,
      changeKind: 'update',
    });

    const saved = await draft.finish();
    expect(saved?.files).toHaveLength(1);
    expect(saved?.files[0]?.additions).toBe(2);

    await service.restore(saved!.id);
    expect(await read('src/halsa.ts')).toBe(ORIGINAL);
  });

  it('visar skillnaden mellan checkpointen och filerna på disk', async () => {
    await write('src/halsa.ts', ORIGINAL);
    const draft = service.begin({ projectId, label: 'Diff', reason: 'agent-run' });
    await write('src/halsa.ts', UPDATED);
    await draft.record({
      path: 'src/halsa.ts',
      beforeContent: ORIGINAL,
      afterContent: UPDATED,
      additions: 1,
      deletions: 1,
      changeKind: 'update',
    });
    const saved = await draft.finish();

    const diff = await service.diff(saved!.id);
    expect(diff.checkpointId).toBe(saved!.id);
    expect(diff.files).toHaveLength(1);
    expect(diff.files[0]?.path).toBe('src/halsa.ts');
    expect(diff.text).toContain('-export const halsa = 1;');
    expect(diff.text).toContain('+export const halsa = 2;');

    // Efter en återställning finns ingen skillnad kvar.
    await service.restore(saved!.id);
    const empty = await service.diff(saved!.id);
    expect(empty.files).toEqual([]);
  });

  it('sparar teststatus från körningen', async () => {
    const draft = service.begin({ projectId, label: 'Tester', reason: 'agent-run' });
    await write('src/halsa.ts', UPDATED);
    await draft.record({
      path: 'src/halsa.ts',
      beforeContent: ORIGINAL,
      afterContent: UPDATED,
      additions: 1,
      deletions: 1,
      changeKind: 'update',
    });
    await draft.setTests({ status: 'passed', summary: '12 godkända, 0 underkända' });
    const saved = await draft.finish();

    expect(saved?.testStatus).toBe('passed');
    expect(saved?.testSummary).toBe('12 godkända, 0 underkända');
    expect(service.get(saved!.id)?.testStatus).toBe('passed');
  });

  it('skapar ingen checkpoint när inga filer ändras', async () => {
    const draft = service.begin({ projectId, label: 'Bara läsning', reason: 'agent-run' });
    await draft.setTests({ status: 'passed' });
    expect(await draft.finish()).toBeNull();
    expect(service.list(projectId)).toEqual([]);
  });

  it('låter användaren spara nuvarande läge som en egen checkpoint', async () => {
    await write('src/halsa.ts', 'export const halsa = 9;\n');
    const checkpoint = await service.createManual({
      projectId,
      label: 'Före refaktoreringen',
      files: [
        {
          path: 'src/halsa.ts',
          beforeContent: 'export const halsa = 9;\n',
          afterContent: 'export const halsa = 9;\n',
          additions: 0,
          deletions: 0,
          changeKind: 'update',
        },
      ],
    });

    expect(checkpoint.reason).toBe('manual');
    await write('src/halsa.ts', 'export const halsa = 10;\n');
    const report = await service.restore(checkpoint.id);
    expect(report.restored).toEqual(['src/halsa.ts']);
    expect(await read('src/halsa.ts')).toBe('export const halsa = 9;\n');
  });

  it('kastar bort en checkpoint utan att röra filerna', async () => {
    await write('src/halsa.ts', ORIGINAL);
    const draft = service.begin({ projectId, label: 'Avförd', reason: 'agent-run' });
    await write('src/halsa.ts', UPDATED);
    await draft.record({
      path: 'src/halsa.ts',
      beforeContent: ORIGINAL,
      afterContent: UPDATED,
      additions: 1,
      deletions: 1,
      changeKind: 'update',
    });
    const saved = await draft.finish();

    expect(await service.discard(saved!.id)).toBe(true);
    expect(service.get(saved!.id)?.status).toBe('discarded');
    expect(await read('src/halsa.ts')).toBe(UPDATED);

    // Snapshoten är borta: inget att återställa.
    const report = await service.restore(saved!.id);
    expect(report.restored).toEqual([]);
  });

  it('behåller bara de senaste checkpointsen per projekt', async () => {
    for (let index = 0; index < CHECKPOINT_LIMIT + 2; index += 1) {
      await service.createManual({
        projectId,
        label: `Checkpoint ${index}`,
        files: [
          {
            path: `src/fil-${index}.ts`,
            beforeContent: '',
            afterContent: '',
            additions: 0,
            deletions: 0,
            changeKind: 'create',
          },
        ],
      });
    }

    const list = service.list(projectId);
    expect(list).toHaveLength(CHECKPOINT_LIMIT);
    expect(list[0]?.label).toBe(`Checkpoint ${CHECKPOINT_LIMIT + 1}`);
    expect(list.some((checkpoint) => checkpoint.label === 'Checkpoint 0')).toBe(false);
  });

  it('vägrar spara en manuell checkpoint utan filer', async () => {
    await expect(service.createManual({ projectId, label: 'Tom', files: [] })).rejects.toThrow(
      /Inga ändrade filer/,
    );
  });
});
