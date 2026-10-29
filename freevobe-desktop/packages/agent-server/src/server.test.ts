import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_AUTO_APPROVE, type AgentEvent } from '@freevobe/protocol';
import { startFakeOllama, type FakeOllamaHandle } from '@freevobe/agent-core/testing';
import { AgentSessionHub } from './sessionHub.js';
import { startAgentServer, type AgentServerHandle } from './server.js';

const TOKEN = 'a'.repeat(64);

let projectRoot: string;
let home: string;
let fake: FakeOllamaHandle;
let hub: AgentSessionHub;
let server: AgentServerHandle;

const ORIGINAL = "export const halsa = 'hej';\n";

beforeEach(async () => {
  projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-http-proj-'));
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-http-home-'));
  await fs.mkdir(path.join(projectRoot, 'src'), { recursive: true });
  await fs.writeFile(path.join(projectRoot, 'src', 'halsa.ts'), ORIGINAL);
  await fs.writeFile(
    path.join(projectRoot, 'package.json'),
    JSON.stringify({ scripts: { test: 'echo ok' } }),
  );

  fake = await startFakeOllama({
    turns: [
      {
        toolCalls: [{ id: 'c1', name: 'read_file', args: { path: 'src/halsa.ts' } }],
        content: 'Läser filen.',
      },
      {
        toolCalls: [
          {
            id: 'c2',
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
  options: { method?: string; body?: unknown; token?: string | null; origin?: string } = {},
): Promise<{ status: number; data: T; raw: unknown }> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const token = options.token === undefined ? TOKEN : options.token;
  if (token) headers['x-freevobe-token'] = token;
  if (options.origin) headers.origin = options.origin;

  const response = await fetch(`${server.url}${pathname}`, {
    method: options.method ?? 'GET',
    headers,
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  const raw = await response.json();
  return { status: response.status, data: (raw as { data?: T }).data as T, raw };
}

/** Läser en SSE-ström tills ett villkor är uppfyllt, och returnerar alla händelser. */
async function readEvents(
  runId: string,
  options: {
    until: (events: AgentEvent[]) => boolean;
    onEvent?: (events: AgentEvent[]) => Promise<void>;
    timeoutMs?: number;
  },
): Promise<AgentEvent[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000);
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

    while (!options.until(events)) {
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
        if (dataLine && dataLine.startsWith('{')) {
          events.push(JSON.parse(dataLine) as AgentEvent);
          // Anropas efter varje händelse; testerna avgör själva när de ska agera.
          await options.onEvent?.(events);
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

async function openProject(): Promise<{ projectId: string; sessionId: string }> {
  const created = await api<{ project: { id: string } }>('/api/projects', {
    method: 'POST',
    body: { path: projectRoot, name: 'Svep', index: false },
  });
  const projectId = created.data.project.id;
  const session = await api<{ id: string }>('/api/sessions', {
    method: 'POST',
    body: { projectId, title: 'Första chatten' },
  });
  return { projectId, sessionId: session.data.id };
}

describe('autentisering och skydd', () => {
  it('svarar på hälsokontrollen utan token', async () => {
    const response = await api<{ name: string }>('/api/health', { token: null });
    expect(response.status).toBe(200);
    expect(response.data.name).toBe('Freevobe Agent');
  });

  it('kräver token för API-anrop', async () => {
    const unauthorized = await api('/api/projects', { token: null });
    expect(unauthorized.status).toBe(401);

    const withWrongToken = await api('/api/projects', { token: 'fel-token' });
    expect(withWrongToken.status).toBe(401);

    const authorized = await api('/api/projects');
    expect(authorized.status).toBe(200);
  });

  it('accepterar token i både det nya och det gamla huvudnamnet', async () => {
    const modern = await fetch(`${server.url}/api/projects`, {
      headers: { 'x-freevobe-token': TOKEN },
    });
    expect(modern.status).toBe(200);

    // Äldre klienter skickar fortfarande x-freevobe-token, och det ska fortsätta fungera.
    const legacy = await api('/api/projects');
    expect(legacy.status).toBe(200);

    const wrong = await fetch(`${server.url}/api/projects`, {
      headers: { 'x-freevobe-token': 'fel-token' },
    });
    expect(wrong.status).toBe(401);
  });

  it('avvisar anrop från en annan origin', async () => {
    const blocked = await api('/api/projects', {
      method: 'POST',
      body: { path: projectRoot },
      origin: 'https://ond.example',
    });
    expect(blocked.status).toBe(403);
    expect(JSON.stringify(blocked.raw)).toContain('forbidden_origin');

    const allowed = await api('/api/projects', {
      method: 'POST',
      body: { path: projectRoot, index: false },
      origin: 'http://localhost:1420',
    });
    expect(allowed.status).toBe(200);
  });

  it('lämnar bara ut dev-token i dev-läge', async () => {
    const response = await api<{ token: string }>('/api/dev-token', { token: null });
    expect(response.status).toBe(200);
    expect(response.data.token).toBe(TOKEN);
  });
});

describe('projekt och sessioner', () => {
  it('öppnar ett projekt och skapar .freevobe-stommen', async () => {
    const created = await api<{ project: { id: string; name: string }; rules: string[] }>(
      '/api/projects',
      {
        method: 'POST',
        body: { path: projectRoot, name: 'Svep', index: true },
      },
    );

    expect(created.status).toBe(200);
    expect(created.data.project.name).toBe('Svep');
    await expect(
      fs.access(path.join(projectRoot, '.freevobe', 'rules.md')),
    ).resolves.toBeUndefined();
    await expect(
      fs.access(path.join(projectRoot, '.freevobe', 'skills')),
    ).resolves.toBeUndefined();
  });

  it('sparar och läser meddelanden per session', async () => {
    const { projectId, sessionId } = await openProject();

    const sessions = await api<Array<{ id: string }>>(`/api/sessions?projectId=${projectId}`);
    expect(sessions.data.map((session) => session.id)).toContain(sessionId);

    await api(`/api/projects/${projectId}/memory/remember`, {
      method: 'POST',
      body: { kind: 'decision', text: 'Vi använder node:sqlite.' },
    });
    const memory = await api<{ content: string }>(`/api/projects/${projectId}/memory`);
    expect(memory.data.content).toContain('node:sqlite');
  });

  it('läser och skriver filer i projektet', async () => {
    const { projectId } = await openProject();
    const read = await api<{ content: string }>(
      `/api/projects/${projectId}/file?path=src/halsa.ts`,
    );
    expect(read.data.content).toBe(ORIGINAL);

    await api(`/api/projects/${projectId}/file`, {
      method: 'PUT',
      body: { path: 'src/ny.ts', content: 'export const ny = 1;\n' },
    });
    expect(await fs.readFile(path.join(projectRoot, 'src', 'ny.ts'), 'utf8')).toBe(
      'export const ny = 1;\n',
    );

    const outside = await api(`/api/projects/${projectId}/file`, {
      method: 'PUT',
      body: { path: '../utanfor.txt', content: 'nej' },
    });
    expect(outside.status).toBe(400);
    await expect(fs.access(path.join(projectRoot, '..', 'utanfor.txt'))).rejects.toThrow();
  });
});

describe('chatten över HTTP', () => {
  it('kör hela flödet och skriver filen när behörighetsläget tillåter det', async () => {
    const { projectId, sessionId } = await openProject();
    await api(`/api/projects/${projectId}`, {
      method: 'PATCH',
      body: { permissionMode: 'auto-edit' },
    });

    const started = await api<{ runId: string }>('/api/chat', {
      method: 'POST',
      body: { sessionId, prompt: 'Uppdatera hälsningen i src/halsa.ts till en svensk variant.' },
    });
    expect(started.status).toBe(200);
    const runId = started.data.runId;

    const events = await readEvents(runId, {
      until: (list) => list.some((event) => event.type === 'run_finished'),
    });

    const types = events.map((event) => event.type);
    expect(types[0]).toBe('run_started');
    expect(types).toContain('context');
    expect(types).toContain('diff');
    expect(types).toContain('file_changed');
    expect(types.at(-1)).toBe('run_finished');

    const finished = events.at(-1);
    expect(finished?.type === 'run_finished' && finished.reason).toBe('final');

    expect(await fs.readFile(path.join(projectRoot, 'src', 'halsa.ts'), 'utf8')).toContain(
      "'hej från Freevobe'",
    );

    const messages = await api<Array<{ role: string; content: string }>>(
      `/api/sessions/${sessionId}/messages`,
    );
    expect(messages.data[0]?.role).toBe('user');
    expect(messages.data.some((message) => message.role === 'assistant')).toBe(true);
  });

  it('väntar på användarens godkännande och skriver först efter ja', async () => {
    const { sessionId } = await openProject();

    const started = await api<{ runId: string }>('/api/chat', {
      method: 'POST',
      body: { sessionId, prompt: 'Uppdatera hälsningen.' },
    });
    const runId = started.data.runId;

    let approvalId = '';
    let acted = false;
    const events = await readEvents(runId, {
      timeoutMs: 25_000,
      until: (list) => list.some((event) => event.type === 'run_finished'),
      onEvent: async (list) => {
        if (acted) return;
        const request = list.find((event) => event.type === 'approval_request');
        if (request?.type !== 'approval_request') return;
        acted = true;
        approvalId = request.request.id;

        // Filen är inte ändrad ännu – vi väntar på användaren.
        expect(await fs.readFile(path.join(projectRoot, 'src', 'halsa.ts'), 'utf8')).toBe(ORIGINAL);

        const pending = await api<Array<{ id: string }>>('/api/approvals');
        expect(pending.data.map((request) => request.id)).toContain(approvalId);

        const resolved = await api<{ resolved: boolean }>(`/api/approvals/${approvalId}`, {
          method: 'POST',
          body: { decision: 'approved' },
        });
        expect(resolved.data.resolved).toBe(true);
      },
    });

    expect(approvalId).not.toBe('');
    expect(events.some((event) => event.type === 'approval_resolved')).toBe(true);
    expect(await fs.readFile(path.join(projectRoot, 'src', 'halsa.ts'), 'utf8')).toContain(
      'hej från Freevobe',
    );
  });

  it('skriver utan godkännandekort när kategorin är auto-godkänd', async () => {
    // Behörighetsläget är kvar på "Fråga alltid"; det är kategorin som gör att agenten slipper fråga.
    const patched = await api<{ autoApprove: Record<string, boolean> }>('/api/settings', {
      method: 'PATCH',
      body: { autoApprove: { ...DEFAULT_AUTO_APPROVE, file_write: true } },
    });
    expect(patched.data.autoApprove.file_write).toBe(true);
    expect(patched.data.autoApprove.command).toBe(false);

    const { projectId } = await openProject();
    const projects = await api<Array<{ id: string; permissionMode: string }>>('/api/projects');
    expect(projects.data.find((entry) => entry.id === projectId)?.permissionMode).toBe('ask');

    const session = await api<{ id: string }>('/api/sessions', {
      method: 'POST',
      body: { projectId, title: 'Auto-godkänd' },
    });
    const started = await api<{ runId: string }>('/api/chat', {
      method: 'POST',
      body: { sessionId: session.data.id, prompt: 'Uppdatera hälsningen.' },
    });

    const events = await readEvents(started.data.runId, {
      timeoutMs: 25_000,
      until: (list) => list.some((event) => event.type === 'run_finished'),
    });

    expect(events.some((event) => event.type === 'approval_request')).toBe(false);
    expect(events.find((event) => event.type === 'run_finished')?.reason).toBe('final');
    expect(await fs.readFile(path.join(projectRoot, 'src', 'halsa.ts'), 'utf8')).toContain(
      'hej från Freevobe',
    );
  });

  it('skriver inte filen när användaren avvisar', async () => {
    const { sessionId } = await openProject();

    const started = await api<{ runId: string }>('/api/chat', {
      method: 'POST',
      body: { sessionId, prompt: 'Uppdatera hälsningen.' },
    });
    const runId = started.data.runId;

    let acted = false;
    const events = await readEvents(runId, {
      timeoutMs: 25_000,
      until: (list) => list.some((event) => event.type === 'run_finished'),
      onEvent: async (list) => {
        if (acted) return;
        const request = list.find((event) => event.type === 'approval_request');
        if (request?.type !== 'approval_request') return;
        acted = true;
        await api(`/api/approvals/${request.request.id}`, {
          method: 'POST',
          body: { decision: 'rejected' },
        });
      },
    });

    expect(
      events.some((event) => event.type === 'error' && event.code === 'approval_rejected'),
    ).toBe(true);
    expect(await fs.readFile(path.join(projectRoot, 'src', 'halsa.ts'), 'utf8')).toBe(ORIGINAL);
  });

  it('kan avbrytas via API:t', async () => {
    const { sessionId } = await openProject();
    const started = await api<{ runId: string }>('/api/chat', {
      method: 'POST',
      body: { sessionId, prompt: 'Läs filen.' },
    });

    const aborted = await api<{ aborted: boolean }>(`/api/runs/${started.data.runId}/abort`, {
      method: 'POST',
    });
    expect(aborted.data.aborted).toBe(true);
  });

  it('kör om samma samtal när modellen upprepar samma anrops-id', async () => {
    // Svaga lokala modeller återanvänder anrops-id ("c1", "c2") mellan varv och sessioner.
    // Det får inte krascha sessionslagringen – historiken ska kunna läsas efteråt.
    const first = await openProject();
    const started = await api<{ runId: string }>('/api/chat', {
      method: 'POST',
      body: { sessionId: first.sessionId, prompt: 'Läs filen igen.' },
    });

    await readEvents(started.data.runId, {
      timeoutMs: 25_000,
      until: (list) => list.some((event) => event.type === 'run_finished'),
      onEvent: async (list) => {
        const request = list.find((event) => event.type === 'approval_request');
        if (request?.type !== 'approval_request') return;
        await api(`/api/approvals/${request.request.id}`, {
          method: 'POST',
          body: { decision: 'approved' },
        });
      },
    });

    const second = await api<{ id: string }>('/api/sessions', {
      method: 'POST',
      body: { projectId: first.projectId, title: 'Andra chatten' },
    });
    const rerun = await api<{ runId: string }>('/api/chat', {
      method: 'POST',
      body: { sessionId: second.data.id, prompt: 'Gör samma sak igen.' },
    });

    const events = await readEvents(rerun.data.runId, {
      timeoutMs: 25_000,
      until: (list) => list.some((event) => event.type === 'run_finished'),
      onEvent: async (list) => {
        const request = list.find((event) => event.type === 'approval_request');
        if (request?.type !== 'approval_request') return;
        await api(`/api/approvals/${request.request.id}`, {
          method: 'POST',
          body: { decision: 'approved' },
        });
      },
    });

    expect(events.some((event) => event.type === 'error' && event.code === 'internal_error')).toBe(
      false,
    );
    expect(events.find((event) => event.type === 'run_finished')?.reason).toBe('final');

    // Historiken går fortfarande att läsa: ett verktygssvar per anrop, utan krockar.
    const messages = await api<Array<{ role: string; toolCallId?: string }>>(
      `/api/sessions/${first.sessionId}/messages`,
    );
    const toolMessages = messages.data.filter((message) => message.role === 'tool');
    expect(toolMessages.length).toBeGreaterThanOrEqual(2);
    expect(new Set(toolMessages.map((message) => message.toolCallId)).size).toBe(
      toolMessages.length,
    );
  });
});

describe('CORS och webbläsargränssnittet', () => {
  it('sätter CORS-huvuden på vanliga svar så att webbläsaren får läsa dem', async () => {
    const response = await fetch(`${server.url}/api/health`, {
      headers: { origin: 'http://127.0.0.1:1420' },
    });
    expect(response.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:1420');
    expect(response.headers.get('vary')).toBe('origin');
  });

  it('sätter CORS-huvuden även på händelseströmmen', async () => {
    const { sessionId } = await openProject();
    const started = await api<{ runId: string }>('/api/chat', {
      method: 'POST',
      body: { sessionId, prompt: 'Läs filen.' },
    });

    const response = await fetch(`${server.url}/api/runs/${started.data.runId}/events`, {
      headers: { 'x-freevobe-token': TOKEN, origin: 'http://127.0.0.1:1420' },
    });
    expect(response.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:1420');
    await response.body?.cancel();
  });
});

describe('verktyg och övriga resurser', () => {
  it('listar agentens verktyg', async () => {
    const { projectId } = await openProject();
    const tools = await api<Array<{ name: string; danger: string }>>(
      `/api/tools?projectId=${projectId}`,
    );
    const names = tools.data.map((tool) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'read_file',
        'write_file',
        'run_terminal_command',
        'ask_user',
        'browser_open',
      ]),
    );
  });

  it('listar de inbyggda skillsen och kopierar dem till projektet', async () => {
    const { projectId } = await openProject();
    const skills = await api<Array<{ name: string; source: string }>>(
      `/api/projects/${projectId}/skills`,
    );
    expect(skills.data).toHaveLength(10);
    expect(skills.data.every((skill) => skill.source === 'builtin')).toBe(true);

    const copied = await api<{ created: string[] }>(
      `/api/projects/${projectId}/skills/copy-builtin`,
      { method: 'POST' },
    );
    expect(copied.data.created).toHaveLength(10);

    const after = await api<Array<{ name: string; source: string }>>(
      `/api/projects/${projectId}/skills`,
    );
    expect(after.data.find((skill) => skill.name === 'bug-fix')?.source).toBe('project');
  });

  it('skapar, läser och tar bort en egen skill', async () => {
    const { projectId } = await openProject();
    await api(`/api/projects/${projectId}/skills`, {
      method: 'POST',
      body: {
        name: 'kund-komponent',
        description: 'Enligt kundens designsystem.',
        triggers: ['designsystem'],
      },
    });

    const exported = await api<{ markdown: string }>(
      `/api/projects/${projectId}/skills/kund-komponent/export`,
    );
    expect(exported.data.markdown).toContain('kund-komponent');

    const removed = await api<{ removed: boolean }>(
      `/api/projects/${projectId}/skills/kund-komponent`,
      { method: 'DELETE' },
    );
    expect(removed.data.removed).toBe(true);
  });

  it('ger MCP-exempel och status', async () => {
    const { projectId } = await openProject();
    const mcp = await api<{ examples: Array<{ name: string }>; statuses: unknown[] }>(
      `/api/projects/${projectId}/mcp`,
    );
    expect(mcp.data.examples.map((example) => example.name)).toEqual(
      expect.arrayContaining(['filesystem', 'github', 'postgres', 'playwright', 'web-search']),
    );
  });

  it('rapporterar doctor-status för projektet', async () => {
    const { projectId } = await openProject();
    const report = await api<{ checks: Array<{ id: string; status: string }> }>(
      `/api/projects/${projectId}/doctor`,
    );
    const ollama = report.data.checks.find((check) => check.id === 'ollama');
    expect(ollama?.status).toBe('ok');
  });

  it('listar subagenterna', async () => {
    const subagents = await api<Array<{ kind: string; readOnly: boolean }>>('/api/subagents');
    expect(subagents.data.map((entry) => entry.kind)).toEqual([
      'explorer',
      'implementer',
      'tester',
      'reviewer',
      'documenter',
    ]);
  });

  it('svarar 404 för okända vägar och okända körningar', async () => {
    expect((await api('/api/finns-inte')).status).toBe(404);
    expect(
      (await api<{ aborted: boolean }>('/api/runs/okand/abort', { method: 'POST' })).data.aborted,
    ).toBe(false);
  });
});
