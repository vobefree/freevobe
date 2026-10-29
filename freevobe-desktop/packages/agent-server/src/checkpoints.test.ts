import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
  AgentEvent,
  Checkpoint,
  CheckpointDiff,
  CheckpointRestoreReport,
} from '@freevobe/protocol';
import { startFakeOllama, type FakeOllamaHandle } from '@freevobe/agent-core/testing';
import { AgentSessionHub } from './sessionHub.js';
import { startAgentServer, type AgentServerHandle } from './server.js';

const TOKEN = 'b'.repeat(64);
const ORIGINAL = "export const halsa = 'hej';\n";

let projectRoot: string;
let home: string;
let fake: FakeOllamaHandle;
let hub: AgentSessionHub;
let server: AgentServerHandle;

beforeEach(async () => {
  projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-cp-http-'));
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-cp-http-home-'));
  await fs.mkdir(path.join(projectRoot, 'src'), { recursive: true });
  await fs.writeFile(path.join(projectRoot, 'src', 'halsa.ts'), ORIGINAL);
  await fs.writeFile(
    path.join(projectRoot, 'package.json'),
    JSON.stringify({ scripts: { test: 'echo ok' } }),
  );

  fake = await startFakeOllama({
    turns: [
      {
        toolCalls: [
          {
            id: 'c1',
            name: 'edit_file',
            args: { path: 'src/halsa.ts', oldString: "'hej'", newString: "'hej från Freevobe'" },
          },
        ],
      },
      { content: 'Klart – hälsningen är uppdaterad.' },
    ],
  });

  hub = new AgentSessionHub({ home, dbFile: ':memory:', ollamaBaseUrl: fake.url });
  server = await startAgentServer({ hub, port: 0, devMode: true, token: TOKEN });
});

afterEach(async () => {
  await server.close();
  hub.close();
  await fake.close();
  await fs.rm(projectRoot, { recursive: true, force: true });
  await fs.rm(home, { recursive: true, force: true });
});

async function api<T = any>(
  pathname: string,
  options: { method?: string; body?: unknown } = {},
): Promise<{ status: number; data: T; raw: unknown }> {
  const response = await fetch(`${server.url}${pathname}`, {
    method: options.method ?? 'GET',
    headers: { 'content-type': 'application/json', 'x-freevobe-token': TOKEN },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  const raw = await response.json();
  return { status: response.status, data: (raw as { data?: T }).data as T, raw };
}

async function openProject(): Promise<{ projectId: string; sessionId: string }> {
  const created = await api<{ project: { id: string } }>('/api/projects', {
    method: 'POST',
    body: { path: projectRoot, name: 'Checkpoints', index: false },
  });
  const projectId = created.data.project.id;
  await api(`/api/projects/${projectId}`, {
    method: 'PATCH',
    body: { permissionMode: 'auto-edit' },
  });
  const session = await api<{ id: string }>('/api/sessions', {
    method: 'POST',
    body: { projectId, title: 'Checkpoint-chatt' },
  });
  return { projectId, sessionId: session.data.id };
}

/** Läser körningens händelseström tills den är klar. */
async function runPrompt(
  sessionId: string,
  prompt: string,
): Promise<{ runId: string; events: AgentEvent[] }> {
  const started = await api<{ runId: string }>('/api/chat', {
    method: 'POST',
    body: { sessionId, prompt },
  });
  const runId = started.data.runId;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  const events: AgentEvent[] = [];
  try {
    const response = await fetch(`${server.url}/api/runs/${runId}/events`, {
      headers: { 'x-freevobe-token': TOKEN, accept: 'text/event-stream' },
      signal: controller.signal,
    });
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Ingen ström från servern.');
    const decoder = new TextDecoder();
    let buffer = '';
    while (!events.some((event) => event.type === 'run_finished')) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let separator = buffer.indexOf('\n\n');
      while (separator !== -1) {
        const chunk = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);
        separator = buffer.indexOf('\n\n');
        const data = chunk
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trim())
          .join('');
        if (data.startsWith('{')) events.push(JSON.parse(data) as AgentEvent);
      }
    }
  } catch (error) {
    if ((error as Error).name !== 'AbortError') throw error;
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }

  return { runId, events };
}

async function git(args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    execFile('git', args, { cwd: projectRoot }, (error) => (error ? reject(error) : resolve()));
  });
}

async function initGit(): Promise<void> {
  await git(['init']);
  await git(['config', 'user.email', 'test@freevobe.dev']);
  await git(['config', 'user.name', 'Freevobe Test']);
  await git(['add', '.']);
  await git(['commit', '-m', 'Första commit']);
}

describe('checkpoints över HTTP', () => {
  it('sparar en checkpoint före agentens filändring och återställer den', async () => {
    const { projectId, sessionId } = await openProject();
    const { events } = await runPrompt(sessionId, 'Uppdatera hälsningen i src/halsa.ts.');

    expect(events.some((event) => event.type === 'checkpoint')).toBe(true);
    expect(await fs.readFile(path.join(projectRoot, 'src', 'halsa.ts'), 'utf8')).toContain(
      'hej från Freevobe',
    );

    const list = await api<Checkpoint[]>(`/api/projects/${projectId}/checkpoints`);
    expect(list.data).toHaveLength(1);
    const checkpoint = list.data[0]!;
    expect(checkpoint.label).toBe('Uppdatera hälsningen i src/halsa.ts.');
    expect(checkpoint.reason).toBe('agent-run');
    expect(checkpoint.status).toBe('open');
    expect(checkpoint.files).toEqual([
      { path: 'src/halsa.ts', changeKind: 'update', additions: 1, deletions: 1, snapshot: true },
    ]);

    const diff = await api<CheckpointDiff>(`/api/checkpoints/${checkpoint.id}/diff`);
    expect(diff.data.files[0]?.path).toBe('src/halsa.ts');
    expect(diff.data.text).toContain('-export const halsa =');

    const restored = await api<CheckpointRestoreReport>(
      `/api/checkpoints/${checkpoint.id}/restore`,
      { method: 'POST', body: {} },
    );
    expect(restored.data.restored).toEqual(['src/halsa.ts']);
    expect(await fs.readFile(path.join(projectRoot, 'src', 'halsa.ts'), 'utf8')).toBe(ORIGINAL);

    const after = await api<Checkpoint>(`/api/checkpoints/${checkpoint.id}`);
    expect(after.data.status).toBe('restored');
  });

  it('läser och återställer filerna i checkpointens eget projekt', async () => {
    // Två öppna projekt delar databas. Checkpointen i det andra projektet får aldrig läsas eller
    // skrivas mot det först öppnade projektets filer.
    const otherRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-cp-other-'));
    await fs.mkdir(path.join(otherRoot, 'src'), { recursive: true });
    await fs.writeFile(path.join(otherRoot, 'src', 'halsa.ts'), '// annat projekt\n', 'utf8');
    await api('/api/projects', {
      method: 'POST',
      body: { path: otherRoot, name: 'Annat projekt', index: false },
    });

    try {
      const { projectId, sessionId } = await openProject();
      await runPrompt(sessionId, 'Uppdatera hälsningen i src/halsa.ts.');
      const checkpoint = (await api<Checkpoint[]>(`/api/projects/${projectId}/checkpoints`))
        .data[0]!;

      const diff = await api<CheckpointDiff>(`/api/checkpoints/${checkpoint.id}/diff`);
      expect(diff.data.files.map((file) => file.path)).toEqual(['src/halsa.ts']);
      expect(diff.data.text).toContain('-export const halsa =');

      const restored = await api<CheckpointRestoreReport>(
        `/api/checkpoints/${checkpoint.id}/restore`,
        { method: 'POST', body: {} },
      );
      expect(restored.data.restored).toEqual(['src/halsa.ts']);
      expect(restored.data.skipped).toEqual([]);
      expect(await fs.readFile(path.join(projectRoot, 'src', 'halsa.ts'), 'utf8')).toBe(ORIGINAL);
      expect(await fs.readFile(path.join(otherRoot, 'src', 'halsa.ts'), 'utf8')).toBe(
        '// annat projekt\n',
      );
    } finally {
      await fs.rm(otherRoot, { recursive: true, force: true });
    }
  });

  it('kräver force när filen ändrats efter checkpointen', async () => {
    const { sessionId, projectId } = await openProject();
    await runPrompt(sessionId, 'Uppdatera hälsningen.');
    const checkpoint = (await api<Checkpoint[]>(`/api/projects/${projectId}/checkpoints`)).data[0]!;

    await fs.writeFile(path.join(projectRoot, 'src', 'halsa.ts'), '// nyare arbete\n', 'utf8');

    const blocked = await api<CheckpointRestoreReport>(
      `/api/checkpoints/${checkpoint.id}/restore`,
      {
        method: 'POST',
        body: {},
      },
    );
    expect(blocked.data.skipped).toEqual([{ path: 'src/halsa.ts', reason: 'changed-since' }]);
    expect(await fs.readFile(path.join(projectRoot, 'src', 'halsa.ts'), 'utf8')).toBe(
      '// nyare arbete\n',
    );

    const forced = await api<CheckpointRestoreReport>(`/api/checkpoints/${checkpoint.id}/restore`, {
      method: 'POST',
      body: { force: true },
    });
    expect(forced.data.restored).toEqual(['src/halsa.ts']);
    expect(await fs.readFile(path.join(projectRoot, 'src', 'halsa.ts'), 'utf8')).toBe(ORIGINAL);
  });

  it('låter användaren spara och kasta en egen checkpoint', async () => {
    await initGit();
    const { projectId } = await openProject();
    await fs.writeFile(
      path.join(projectRoot, 'src', 'halsa.ts'),
      "export const halsa = 'manuell';\n",
      'utf8',
    );

    const created = await api<Checkpoint>(`/api/projects/${projectId}/checkpoints`, {
      method: 'POST',
      body: { label: 'Före refaktoreringen' },
    });
    expect(created.data.reason).toBe('manual');
    expect(created.data.label).toBe('Före refaktoreringen');
    expect(created.data.files.map((file) => file.path)).toEqual(['src/halsa.ts']);

    const discarded = await api<{ discarded: boolean }>(`/api/checkpoints/${created.data.id}`, {
      method: 'DELETE',
    });
    expect(discarded.data.discarded).toBe(true);

    const after = await api<Checkpoint>(`/api/checkpoints/${created.data.id}`);
    expect(after.data.status).toBe('discarded');
  });

  it('committar filerna i en checkpoint och markerar den som committad', async () => {
    await initGit();
    const { projectId } = await openProject();
    await fs.writeFile(
      path.join(projectRoot, 'src', 'halsa.ts'),
      "export const halsa = 'commit';\n",
      'utf8',
    );

    const created = await api<Checkpoint>(`/api/projects/${projectId}/checkpoints`, {
      method: 'POST',
      body: { label: 'Commit-läge' },
    });

    const committed = await api<{ hash: string; message: string }>(
      `/api/checkpoints/${created.data.id}/commit`,
      { method: 'POST', body: { message: 'Checkpoint: hälsningen' } },
    );
    expect(committed.data.hash.length).toBeGreaterThan(3);
    expect(committed.data.message).toBe('Checkpoint: hälsningen');

    const after = await api<Checkpoint>(`/api/checkpoints/${created.data.id}`);
    expect(after.data.status).toBe('committed');
    expect(after.data.committedHash).toBe(committed.data.hash);

    const log = await new Promise<string>((resolve) => {
      execFile('git', ['log', '-1', '--pretty=%s'], { cwd: projectRoot }, (_error, stdout) =>
        resolve(stdout),
      );
    });
    expect(log.trim()).toBe('Checkpoint: hälsningen');
  });
});
