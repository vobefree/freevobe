import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Plan, Session } from '@freevobe/protocol';
import { startFakeOllama, type FakeOllamaHandle } from '@freevobe/agent-core/testing';
import { AgentSessionHub } from './sessionHub.js';
import { startAgentServer, type AgentServerHandle } from './server.js';

const TOKEN = 'd'.repeat(64);
const ORIGINAL = "export const halsa = 'hej';\n";

let projectRoot: string;
let home: string;
let fake: FakeOllamaHandle;
let hub: AgentSessionHub;
let server: AgentServerHandle;

beforeEach(async () => {
  projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-plan-proj-'));
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-plan-home-'));
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
            id: 'plan_1',
            name: 'propose_plan',
            args: {
              title: 'Uppdatera hälsningen',
              summary: 'Byt texten i src/halsa.ts.',
              steps: [
                { title: 'Läs filen', files: ['src/halsa.ts'] },
                { title: 'Byt hälsningen', files: ['src/halsa.ts'] },
              ],
              files: ['src/halsa.ts'],
            },
          },
        ],
      },
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
): Promise<{ status: number; data: T }> {
  const response = await fetch(`${server.url}${pathname}`, {
    method: options.method ?? 'GET',
    headers: { 'content-type': 'application/json', 'x-freevobe-token': TOKEN },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  const raw = (await response.json()) as { data?: T };
  return { status: response.status, data: raw.data as T };
}

async function waitFor<T>(read: () => Promise<T | null>, label: string): Promise<T> {
  const started = Date.now();
  for (;;) {
    const value = await read();
    if (value) return value;
    if (Date.now() - started > 15_000) throw new Error(`Tidsgränsen nåddes: ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function openProject(options: { permissionMode?: string } = {}): Promise<{
  projectId: string;
  sessionId: string;
}> {
  const created = await api<{ project: { id: string } }>('/api/projects', {
    method: 'POST',
    body: { path: projectRoot, name: 'Planprojekt', index: false },
  });
  const projectId = created.data.project.id;
  await api(`/api/projects/${projectId}`, {
    method: 'PATCH',
    body: { permissionMode: options.permissionMode ?? 'auto-edit' },
  });
  const session = await api<Session>('/api/sessions', {
    method: 'POST',
    body: { projectId, title: 'Planchatt', mode: 'plan' },
  });
  return { projectId, sessionId: session.data.id };
}

async function waitForRun(runId: string): Promise<void> {
  await waitFor(async () => {
    const runs = await api<Array<{ runId: string; status: string }>>('/api/runs');
    return runs.data.find((run) => run.runId === runId && run.status === 'finished') ?? null;
  }, `körningen ${runId} avslutas`);
}

describe('Plan/Act över HTTP', () => {
  it('sparar planen, godkänner den och låter kontraktet styra körningen', async () => {
    const { sessionId } = await openProject();

    const started = await api<{ runId: string }>('/api/chat', {
      method: 'POST',
      body: { sessionId, prompt: 'Föreslå en plan för att byta hälsning.' },
    });
    await waitForRun(started.data.runId);

    // 1. Planen ligger i databasen och väntar på beslut.
    const plans = await api<Plan[]>(`/api/sessions/${sessionId}/plans`);
    expect(plans.data).toHaveLength(1);
    const plan = plans.data[0];
    expect(plan?.status).toBe('proposed');
    expect(plan?.files).toEqual(['src/halsa.ts']);

    // 2. Sessionen är kvar i Plan-läget tills användaren bestämt sig.
    expect((await api<Session>(`/api/sessions/${sessionId}`)).data.mode).toBe('plan');

    const decided = await api<Plan>(`/api/plans/${plan?.id}/decision`, {
      method: 'POST',
      body: { decision: 'approved' },
    });
    expect(decided.data.status).toBe('approved');
    expect(decided.data.decidedAt).toBeGreaterThan(0);
    // Godkännandet växlar sessionen till Execute – det är då agenten får skriva.
    expect((await api<Session>(`/api/sessions/${sessionId}`)).data.mode).toBe('execute');

    // 3. Nästa körning får planen som kontrakt i systemprompten.
    fake.setTurns([
      {
        toolCalls: [
          {
            id: 'edit_1',
            name: 'edit_file',
            args: { path: 'src/halsa.ts', oldString: "'hej'", newString: "'hej från planen'" },
          },
        ],
      },
      { content: 'Klart enligt planen.' },
    ]);

    const execution = await api<{ runId: string }>('/api/chat', {
      method: 'POST',
      body: { sessionId, prompt: 'Utför den godkända planen.' },
    });
    await waitForRun(execution.data.runId);

    const prompt = (
      fake.requests.at(-2)?.body.messages as Array<{ content: string }> | undefined
    )?.[0]?.content;
    expect(prompt).toContain('Godkänd plan (kontrakt)');
    expect(prompt).toContain('Uppdatera hälsningen');
    expect(await fs.readFile(path.join(projectRoot, 'src', 'halsa.ts'), 'utf8')).toContain(
      'hej från planen',
    );
    // Auto-redigera godkänner filändringen – inget godkännandekort behövdes.
    expect(await api('/api/approvals')).toMatchObject({ data: [] });
  });

  it('kräver ett personligt ja för en fil utanför den godkända planen', async () => {
    const { sessionId } = await openProject();

    const approved: Plan = {
      id: 'plan_manuell',
      sessionId,
      runId: 'run_0',
      title: 'Bara hälsningen',
      summary: 'Kontraktet omfattar src/halsa.ts.',
      steps: [{ id: 'step_1', title: 'Byt hälsningen', files: ['src/halsa.ts'] }],
      files: ['src/halsa.ts'],
      status: 'approved',
      createdAt: 1,
      decidedAt: 2,
    };
    hub.repositories.plans.create(approved);

    fake.setTurns([
      {
        toolCalls: [
          {
            id: 'write_outside',
            name: 'write_file',
            args: { path: 'src/ny.ts', content: 'export const ny = 1;\n' },
          },
        ],
      },
      { content: 'Jag väntar på besked.' },
    ]);

    // Sessionen skapades i Plan-läget; här gäller Execute så att det är kontraktet som prövas.
    const started = await api<{ runId: string }>('/api/chat', {
      method: 'POST',
      body: { sessionId, prompt: 'Skapa en ny fil.', mode: 'execute' },
    });

    // Även i Auto-redigera, som annars godkänner filändringar, krävs ett ja utanför planen.
    const pending = await waitFor(async () => {
      const approvals =
        await api<Array<{ id: string; path?: string; reason: string }>>('/api/approvals');
      return approvals.data.find((entry) => entry.path === 'src/ny.ts') ?? null;
    }, 'godkännandet för src/ny.ts');
    expect(pending.reason).toContain('utanför den godkända planen');

    await api(`/api/approvals/${pending.id}`, {
      method: 'POST',
      body: { decision: 'rejected' },
    });
    await waitForRun(started.data.runId);
    await expect(fs.access(path.join(projectRoot, 'src', 'ny.ts'))).rejects.toThrow();
  });
});
