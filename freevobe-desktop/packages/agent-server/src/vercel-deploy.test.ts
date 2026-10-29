import http from 'node:http';
import type { AddressInfo } from 'node:net';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AgentEvent } from '@freevobe/protocol';
import { startFakeOllama, type FakeOllamaHandle } from '@freevobe/agent-core/testing';
import { AgentSessionHub } from './sessionHub.js';
import { startAgentServer, type AgentServerHandle } from './server.js';

const TOKEN = 'c'.repeat(64);
const VERCEL_TOKEN = 'vercel_integration_token_1234567890';

interface RecordedRequest {
  method: string;
  path: string;
  authorization: string | undefined;
  body: Record<string, unknown> | null;
}

let projectRoot: string;
let home: string;
let ollama: FakeOllamaHandle;
let vercel: http.Server;
let vercelUrl: string;
let vercelRequests: RecordedRequest[];
let hub: AgentSessionHub;
let server: AgentServerHandle;

beforeEach(async () => {
  projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-vercel-e2e-proj-'));
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-vercel-e2e-home-'));
  await fs.writeFile(path.join(projectRoot, 'package.json'), JSON.stringify({ name: 'demo' }));

  vercelRequests = [];
  vercel = http.createServer((request, response) => {
    void (async () => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(chunk as Buffer);
      const raw = Buffer.concat(chunks).toString('utf8');
      const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
      const url = new URL(request.url ?? '/', 'http://localhost');
      vercelRequests.push({
        method: request.method ?? 'GET',
        path: url.pathname,
        authorization: request.headers.authorization,
        body,
      });

      const send = (payload: unknown): void => {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify(payload));
      };

      if (url.pathname === '/v9/projects/demo') {
        send({
          id: 'prj_1',
          name: 'demo',
          link: { type: 'github', repoId: 99, productionBranch: 'main' },
        });
        return;
      }
      if (url.pathname === '/v13/deployments') {
        send({ id: 'dpl_1', url: 'demo-preview.vercel.app', readyState: 'QUEUED' });
        return;
      }
      send({});
    })();
  });
  await new Promise<void>((resolve) => vercel.listen(0, '127.0.0.1', resolve));
  vercelUrl = `http://127.0.0.1:${(vercel.address() as AddressInfo).port}`;

  ollama = await startFakeOllama({
    turns: [
      {
        toolCalls: [
          { id: 'v1', name: 'vercel_deploy', args: { project: 'demo', target: 'production' } },
        ],
      },
      { content: 'Klart.' },
    ],
  });

  hub = new AgentSessionHub({
    home,
    dbFile: ':memory:',
    ollamaBaseUrl: ollama.url,
    vercelApiBaseUrl: vercelUrl,
  });
  server = await startAgentServer({ hub, port: 0, devMode: true, token: TOKEN });
});

afterEach(async () => {
  await server.close();
  hub.close();
  await ollama.close();
  await new Promise<void>((resolve) => vercel.close(() => resolve()));
  await fs.rm(projectRoot, { recursive: true, force: true });
  await fs.rm(home, { recursive: true, force: true });
});

async function api<T>(
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

async function readEvents(
  runId: string,
  onEvent: (events: AgentEvent[]) => Promise<void>,
): Promise<AgentEvent[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
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
        const dataLine = chunk
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trim())
          .join('');
        if (dataLine.startsWith('{')) {
          events.push(JSON.parse(dataLine) as AgentEvent);
          await onEvent(events);
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

async function openProjectWithVercel(): Promise<{ projectId: string; sessionId: string }> {
  const created = await api<{ project: { id: string } }>('/api/projects', {
    method: 'POST',
    body: { path: projectRoot, name: 'Deploy', index: false },
  });
  const projectId = created.data.project.id;
  const session = await api<{ id: string }>('/api/sessions', {
    method: 'POST',
    body: { projectId, title: 'Deploy' },
  });
  const connected = await api<unknown>(`/api/projects/${projectId}/connectors/vercel/connect`, {
    method: 'POST',
    body: { secret: VERCEL_TOKEN },
  });
  expect(connected.status).toBe(200);
  return { projectId, sessionId: session.data.id };
}

describe('Vercel-deploy genom agenten', () => {
  it('kräver två godkännanden för produktion och skickar token bara till Vercel', async () => {
    const { sessionId } = await openProjectWithVercel();
    const run = await api<{ runId: string }>('/api/chat', {
      method: 'POST',
      // Full auto bevisar att connectorändringar ändå alltid frågar.
      body: { sessionId, prompt: 'Deploya till produktion', permissionMode: 'full-auto' },
    });

    const titles: string[] = [];
    const handled = new Set<string>();
    const events = await readEvents(run.data.runId, async (list) => {
      for (const event of list) {
        if (event.type !== 'approval_request' || handled.has(event.request.id)) continue;
        handled.add(event.request.id);
        titles.push(event.request.title);
        const resolved = await api<{ resolved: boolean }>(`/api/approvals/${event.request.id}`, {
          method: 'POST',
          body: { decision: 'approved' },
        });
        expect(resolved.data.resolved).toBe(true);
      }
    });

    expect(titles).toHaveLength(2);
    expect(titles.some((title) => title.toLowerCase().includes('produktion'))).toBe(true);

    const deployment = vercelRequests.find(
      (request) => request.path === '/v13/deployments' && request.method === 'POST',
    );
    expect(deployment).toBeDefined();
    expect(deployment?.authorization).toBe(`Bearer ${VERCEL_TOKEN}`);
    expect(deployment?.body).toMatchObject({ name: 'demo', target: 'production' });

    const result = events.find((event) => event.type === 'tool_result');
    expect(result?.type === 'tool_result' && result.result.ok).toBe(true);
    expect(
      events.some(
        (event) =>
          event.type === 'tool_result' &&
          event.result.content.includes('https://demo-preview.vercel.app'),
      ),
    ).toBe(true);
  });

  it('skapar ingen produktionsdeploy när det extra godkännandet nekas', async () => {
    const { sessionId } = await openProjectWithVercel();
    const run = await api<{ runId: string }>('/api/chat', {
      method: 'POST',
      body: { sessionId, prompt: 'Deploya till produktion', permissionMode: 'full-auto' },
    });

    let answered = 0;
    const handled = new Set<string>();
    const events = await readEvents(run.data.runId, async (list) => {
      for (const event of list) {
        if (event.type !== 'approval_request' || handled.has(event.request.id)) continue;
        handled.add(event.request.id);
        const resolved = await api<{ resolved: boolean }>(`/api/approvals/${event.request.id}`, {
          method: 'POST',
          body: { decision: answered === 0 ? 'approved' : 'rejected' },
        });
        if (resolved.data.resolved) answered += 1;
      }
    });

    expect(answered).toBe(2);
    expect(vercelRequests.some((request) => request.path === '/v13/deployments')).toBe(false);
    const result = events.find((event) => event.type === 'tool_result');
    expect(result?.type === 'tool_result' && result.result.content).toContain(
      'Produktionsdeploy avbröts',
    );
  });
});
