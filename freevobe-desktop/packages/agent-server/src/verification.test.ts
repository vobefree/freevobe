import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
  AgentEvent,
  Session,
  VerificationCommand,
  VerificationReport,
} from '@freevobe/protocol';
import { startFakeOllama, type FakeOllamaHandle } from '@freevobe/agent-core/testing';
import { AgentSessionHub } from './sessionHub.js';
import { startAgentServer, type AgentServerHandle } from './server.js';

const TOKEN = 'e'.repeat(64);

let projectRoot: string;
let home: string;
let fake: FakeOllamaHandle;
let hub: AgentSessionHub;
let server: AgentServerHandle;

beforeEach(async () => {
  projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-verify-proj-'));
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-verify-home-'));
  await fs.mkdir(path.join(projectRoot, 'src'), { recursive: true });
  await fs.writeFile(
    path.join(projectRoot, 'package.json'),
    JSON.stringify({
      name: 'verifieringsprojekt',
      scripts: {
        typecheck: 'node -e "console.log(\'inga typfel\')"',
        lint: 'node -e "console.log(\'ren kod\')"',
        test: 'node -e "console.log(\'Tests  3 passed (3)\')"',
      },
    }),
  );

  fake = await startFakeOllama({
    turns: [
      {
        toolCalls: [
          {
            id: 'w1',
            name: 'write_file',
            args: { path: 'src/ny.ts', content: 'export const ny = 1;\n' },
          },
        ],
      },
      { content: 'Klart – filen är skapad.' },
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

async function api<T = unknown>(
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

async function openProject(permissionMode = 'auto-edit'): Promise<{
  projectId: string;
  sessionId: string;
}> {
  const created = await api<{ project: { id: string } }>('/api/projects', {
    method: 'POST',
    body: { path: projectRoot, name: 'Verifiering', index: false },
  });
  const projectId = created.data.project.id;
  await api(`/api/projects/${projectId}`, { method: 'PATCH', body: { permissionMode } });
  const session = await api<Session>('/api/sessions', {
    method: 'POST',
    body: { projectId, title: 'Verifieringschatt' },
  });
  return { projectId, sessionId: session.data.id };
}

/** Läser SSE-strömmen tills körningen är klar och returnerar alla händelser i ordning. */
async function readRunEvents(runId: string): Promise<AgentEvent[]> {
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

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let separator = buffer.indexOf('\n\n');
      while (separator !== -1) {
        const chunk = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);
        separator = buffer.indexOf('\n\n');
        const dataLine = chunk
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trim())
          .join('');
        if (dataLine.startsWith('{')) {
          const event = JSON.parse(dataLine) as AgentEvent;
          events.push(event);
          if (event.type === 'run_finished') return events;
        }
      }
    }
  } catch (error) {
    if ((error as Error).name !== 'AbortError') throw error;
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }

  return events;
}

describe('verifiering över HTTP', () => {
  it('listar projektets steg och kör dem på begäran', async () => {
    const { projectId } = await openProject();

    const detected = await api<{ commands: VerificationCommand[] }>(
      `/api/projects/${projectId}/verification`,
    );
    expect(detected.data.commands.map((command) => command.id)).toEqual([
      'typecheck',
      'lint',
      'test',
    ]);

    const report = await api<VerificationReport>(`/api/projects/${projectId}/verification`, {
      method: 'POST',
      body: {},
    });
    expect(report.data.trigger).toBe('manual');
    expect(report.data.status).toBe('passed');
    expect(report.data.checks).toHaveLength(3);
    // Teststeget fick antalet tester ur utdata.
    expect(report.data.checks[2]?.passed).toBe(3);

    const history = await api<VerificationReport[]>(`/api/projects/${projectId}/verifications`);
    expect(history.data[0]?.id).toBe(report.data.id);
  });

  it('verifierar automatiskt efter en körning som ändrat filer', async () => {
    const { projectId, sessionId } = await openProject();

    const started = await api<{ runId: string }>('/api/chat', {
      method: 'POST',
      body: { sessionId, prompt: 'Skapa src/ny.ts.' },
    });
    const events = await readRunEvents(started.data.runId);

    // Rapporten kommer före run_finished, så att klienten hinner visa den.
    const verificationIndex = events.findIndex((event) => event.type === 'verification');
    const finishedIndex = events.findIndex((event) => event.type === 'run_finished');
    expect(verificationIndex).toBeGreaterThan(-1);
    expect(verificationIndex).toBeLessThan(finishedIndex);
    expect(events.some((event) => event.type === 'verification_check')).toBe(true);

    const report = events.find((event) => event.type === 'verification');
    expect(report?.type === 'verification' && report.report.trigger).toBe('run');
    expect(report?.type === 'verification' && report.report.status).toBe('passed');
    expect(report?.type === 'verification' && report.report.runId).toBe(started.data.runId);

    // Bygget körs inte automatiskt – bara typkontroll, lint och tester.
    expect(
      report?.type === 'verification' && report.report.checks.map((check) => check.kind),
    ).toEqual(['typecheck', 'lint', 'test']);

    const stored = await api<VerificationReport[]>(`/api/projects/${projectId}/verifications`);
    expect(stored.data[0]?.runId).toBe(started.data.runId);
  });

  it('hoppar över verifieringen när inställningen är av', async () => {
    const { sessionId } = await openProject();
    await api('/api/settings', { method: 'PATCH', body: { verifyAfterRun: false } });

    const started = await api<{ runId: string }>('/api/chat', {
      method: 'POST',
      body: { sessionId, prompt: 'Skapa src/ny.ts.' },
    });
    const events = await readRunEvents(started.data.runId);

    expect(events.some((event) => event.type === 'verification')).toBe(false);
  });
});
