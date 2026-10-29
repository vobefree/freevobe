import { expect, test, type APIRequestContext } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { AGENT, FAKE_OLLAMA, MODEL } from './fixtures/env';

interface AgentEvent {
  type: string;
  [key: string]: unknown;
}

function auth(token: string) {
  return { 'x-freevobe-token': token };
}

async function devToken(request: APIRequestContext): Promise<string> {
  const response = await request.get(`${AGENT}/api/dev-token`);
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as { data: { token: string } };
  return payload.data.token;
}

/**
 * Skapar ett litet projekt i en temp-mapp som agenten kan arbeta i.
 */
async function createTempProject(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-e2e-'));
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(
    path.join(root, 'package.json'),
    JSON.stringify(
      { name: 'e2e-projekt', private: true, scripts: { test: 'node --test' } },
      null,
      2,
    ),
  );
  await fs.writeFile(path.join(root, 'src', 'app.ts'), 'export const start = () => "hej";\n');
  return root;
}

/**
 * Läser SSE-strömmen från en körning och svarar på godkännandeförfrågningar.
 * Returnerar alla händelser i ordning.
 */
async function runAndCollect(
  request: APIRequestContext,
  token: string,
  runId: string,
  decision: 'approved' | 'rejected' = 'approved',
): Promise<{ events: AgentEvent[]; approvals: string[] }> {
  const controller = new AbortController();
  const response = await fetch(`${AGENT}/api/runs/${runId}/events`, {
    headers: auth(token),
    signal: controller.signal,
  });
  expect(response.ok).toBeTruthy();
  const body = response.body;
  if (!body) throw new Error('Körningen saknade händelseström.');

  const reader = body.getReader();
  const decoder = new TextDecoder();
  const events: AgentEvent[] = [];
  const approvals: string[] = [];
  let buffer = '';
  const deadline = Date.now() + 60_000;

  try {
    while (Date.now() < deadline) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let separator = buffer.indexOf('\n\n');
      while (separator !== -1) {
        const raw = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);
        const payload = raw
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trim())
          .join('');
        if (payload) {
          const event = JSON.parse(payload) as AgentEvent;
          events.push(event);
          if (event.type === 'approval_request') {
            const approval = event.request as { id: string; kind: string };
            approvals.push(approval.kind);
            const answer = await request.post(`${AGENT}/api/approvals/${approval.id}`, {
              headers: auth(token),
              data: { decision },
            });
            expect(answer.ok()).toBeTruthy();
          }
          if (event.type === 'run_finished') {
            controller.abort();
            return { events, approvals };
          }
        }
        separator = buffer.indexOf('\n\n');
      }
    }
  } finally {
    reader.releaseLock();
  }

  return { events, approvals };
}

test.describe('Vertikal skiva över HTTP', () => {
  let token: string;
  let projectRoot: string;
  let projectId: string;

  test.beforeAll(async ({ request }) => {
    projectRoot = await createTempProject();
    token = await devToken(request);

    const settings = await request.patch(`${AGENT}/api/settings`, {
      headers: auth(token),
      data: {
        ollamaBaseUrl: FAKE_OLLAMA,
        defaultModel: MODEL,
        permissionMode: 'ask',
        maxIterations: 6,
      },
    });
    expect(settings.ok()).toBeTruthy();

    const probe = await request.get(
      `${AGENT}/api/ollama?baseUrl=${encodeURIComponent(FAKE_OLLAMA)}`,
      {
        headers: auth(token),
      },
    );
    const probeBody = (await probe.json()) as {
      data: { available: boolean; models: { name: string; supportsTools: boolean }[] };
    };
    expect(probeBody.data.available).toBe(true);
    expect(probeBody.data.models[0]?.supportsTools).toBe(true);

    const project = await request.post(`${AGENT}/api/projects`, {
      headers: auth(token),
      data: { path: projectRoot, name: 'E2E-projekt', index: true },
    });
    expect(project.ok()).toBeTruthy();
    projectId = ((await project.json()) as { data: { project: { id: string } } }).data.project.id;
  });

  test.afterAll(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true }).catch(() => undefined);
  });

  test('kräver token', async ({ request }) => {
    const unauthorized = await request.get(`${AGENT}/api/settings`);
    expect(unauthorized.status()).toBe(401);

    const wrong = await request.get(`${AGENT}/api/settings`, { headers: auth('fel-token') });
    expect(wrong.status()).toBe(401);
  });

  test('läser en fil, föreslår en skrivning, visar diff och skriver efter godkännande', async ({
    request,
  }) => {
    const session = await request.post(`${AGENT}/api/sessions`, {
      headers: auth(token),
      data: { projectId, title: 'E2E: vertikal skiva', model: MODEL },
    });
    expect(session.ok()).toBeTruthy();
    const sessionId = ((await session.json()) as { data: { id: string } }).data.id;

    const chat = await request.post(`${AGENT}/api/chat`, {
      headers: auth(token),
      data: {
        sessionId,
        prompt: 'Läs package.json och skapa src/hello.ts.',
        model: MODEL,
        mode: 'execute',
        permissionMode: 'ask',
      },
    });
    expect(chat.ok()).toBeTruthy();
    const runId = ((await chat.json()) as { data: { runId: string } }).data.runId;

    const { events, approvals } = await runAndCollect(request, token, runId);
    const types = events.map((event) => event.type);

    // 1. Verktyget läste en fil.
    const readCalls = events.filter(
      (event) =>
        event.type === 'tool_call' && (event.call as { name: string }).name === 'read_file',
    );
    expect(readCalls.length).toBeGreaterThan(0);

    // 2. Skrivningen krävde ett godkännande – och bara den.
    expect(approvals).toEqual(['file_write']);

    // 3. En diff producerades och beskriver en ny fil.
    const diffEvent = events.find((event) => event.type === 'diff');
    expect(diffEvent).toBeTruthy();
    const diff = diffEvent?.diff as {
      path: string;
      kind: string;
      additions: number;
      newContent: string;
    };
    expect(diff.kind).toBe('create');
    expect(diff.path).toBe('src/hello.ts');
    expect(diff.additions).toBeGreaterThan(0);

    // 4. Filen finns på disk med exakt det innehåll diffen beskrev.
    const written = await fs.readFile(path.join(projectRoot, 'src', 'hello.ts'), 'utf8');
    expect(written).toBe(diff.newContent);

    // 5. Agenten avslutade med ett svar, och körningen stängdes på rätt sätt.
    const answers = events.filter((event) => event.type === 'assistant_message');
    expect(String(answers[answers.length - 1]?.text)).toContain('Klart');
    const finished = events.find((event) => event.type === 'run_finished');
    expect(finished?.reason).toBe('final');

    // 6. Meddelandena finns kvar i sessionen efter körningen.
    const messages = await request.get(`${AGENT}/api/sessions/${sessionId}/messages`, {
      headers: auth(token),
    });
    const messageList = ((await messages.json()) as { data: { role: string }[] }).data;
    expect(messageList.some((message) => message.role === 'user')).toBe(true);
    expect(messageList.some((message) => message.role === 'assistant')).toBe(true);

    expect(types).toContain('context');
  });

  test('avvisad skrivning lämnar projektet orört', async ({ request }) => {
    // Testet ovan skapade filen; ta bort den så att vi kan se att avvisandet inte återskapar den.
    await fs.rm(path.join(projectRoot, 'src', 'hello.ts'), { force: true });

    const session = await request.post(`${AGENT}/api/sessions`, {
      headers: auth(token),
      data: { projectId, title: 'E2E: avvisad skrivning', model: MODEL },
    });
    const sessionId = ((await session.json()) as { data: { id: string } }).data.id;

    const chat = await request.post(`${AGENT}/api/chat`, {
      headers: auth(token),
      data: {
        sessionId,
        prompt: 'Skapa src/hello.ts.',
        model: MODEL,
        mode: 'execute',
        permissionMode: 'ask',
      },
    });
    const runId = ((await chat.json()) as { data: { runId: string } }).data.runId;

    // Svara nej på godkännandet i stället för ja.
    const { events, approvals } = await runAndCollect(request, token, runId, 'rejected');
    expect(approvals).toEqual(['file_write']);

    // Förslaget visades som diff, men inget skrevs och ingen fil ändrades.
    expect(events.some((event) => event.type === 'diff')).toBe(true);
    expect(events.some((event) => event.type === 'file_changed')).toBe(false);
    await expect(fs.access(path.join(projectRoot, 'src', 'hello.ts'))).rejects.toThrow();

    // Avvisandet rapporterades som ett fel med rätt kod.
    const rejection = events.find(
      (event) => event.type === 'error' && event.code === 'approval_rejected',
    );
    expect(rejection).toBeTruthy();

    // Godkännandelistan är tom efteråt.
    const pending = await request.get(`${AGENT}/api/approvals`, { headers: auth(token) });
    expect(((await pending.json()) as { data: unknown[] }).data).toEqual([]);
  });
});
