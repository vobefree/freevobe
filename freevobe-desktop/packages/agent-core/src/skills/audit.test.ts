import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { appendSkillAudit, readSkillAudit, type SkillAuditEntry } from './audit.js';

let root = '';

function entry(overrides: Partial<SkillAuditEntry> = {}): SkillAuditEntry {
  return {
    at: '2026-11-03T10:00:00.000Z',
    runId: 'run-1',
    skill: 'review',
    source: 'project',
    reason: 'trigger',
    trigger: 'review',
    ...overrides,
  };
}

async function makeRoot(): Promise<string> {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-audit-'));
  return root;
}

describe('skill-audit', () => {
  afterEach(async () => {
    if (root) await fs.rm(root, { recursive: true, force: true });
    root = '';
  });

  it('skriver rader lokalt och läser dem nyast först', async () => {
    const dir = await makeRoot();
    await appendSkillAudit(dir, [entry({ skill: 'review' })]);
    await appendSkillAudit(dir, [
      entry({ skill: 'deploy', importedFrom: 'claude', sourceUrl: 'https://example.com/x' }),
    ]);

    const entries = await readSkillAudit(dir, 10);
    expect(entries.map((row) => row.skill)).toEqual(['deploy', 'review']);
    expect(entries[0]?.importedFrom).toBe('claude');
    expect(entries[0]?.sourceUrl).toBe('https://example.com/x');

    const raw = await fs.readFile(path.join(dir, '.freevobe', 'audit', 'skills.jsonl'), 'utf8');
    expect(raw.trim().split('\n')).toHaveLength(2);
    // Loggen innehåller bara metadata, aldrig projektets innehåll.
    expect(raw).not.toContain('body');
  });

  it('skriver inget när listan är tom', async () => {
    const dir = await makeRoot();
    await appendSkillAudit(dir, []);
    await expect(fs.access(path.join(dir, '.freevobe'))).rejects.toBeTruthy();
    expect(await readSkillAudit(dir)).toEqual([]);
  });

  it('hoppar över trasiga rader i stället för att krascha', async () => {
    const dir = await makeRoot();
    await appendSkillAudit(dir, [entry()]);
    await fs.appendFile(
      path.join(dir, '.freevobe', 'audit', 'skills.jsonl'),
      'inte json\n',
      'utf8',
    );

    const entries = await readSkillAudit(dir, 5);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.skill).toBe('review');
  });

  it('begränsar antalet rader som returneras', async () => {
    const dir = await makeRoot();
    for (let index = 0; index < 8; index += 1) {
      await appendSkillAudit(dir, [entry({ skill: `skill-${index}` })]);
    }
    expect((await readSkillAudit(dir, 3)).map((row) => row.skill)).toEqual([
      'skill-7',
      'skill-6',
      'skill-5',
    ]);
  });
});
