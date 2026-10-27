import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AgentEvent } from '@vibeforge/protocol';
import { AgentSessionHub } from './sessionHub.js';

/**
 * Regressionstest för en verklig bugg: transporten mot Ollama byggdes en gång vid start och
 * ignorerade senare ändringar av bas-URL:en. Då fortsatte körningarna mot den gamla adressen
 * (oftast localhost:11434) även om användaren pekat om i inställningarna.
 */
describe('AgentSessionHub och Ollama-adressen', () => {
  let projectRoot: string;
  let home: string;
  let hub: AgentSessionHub;
  let requests: string[];

  const SSE_TURNS = [
    'data: {"choices":[{"delta":{"content":"Klart."},"finish_reason":null}]}\n\n',
    'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
    'data: [DONE]\n\n',
  ].join('');

  beforeEach(async () => {
    projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vibeforge-hub-proj-'));
    home = await fs.mkdtemp(path.join(os.tmpdir(), 'vibeforge-hub-home-'));
    requests = [];

    const fetchImpl: typeof fetch = async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      requests.push(url);
      if (url.includes('/v1/chat/completions')) {
        return new Response(SSE_TURNS, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        });
      }
      if (url.includes('/api/tags')) {
        return Response.json({
          models: [{ name: 'lokal-modell', size: 1, details: { parameter_size: '7B' } }],
        });
      }
      if (url.includes('/api/show')) {
        return Response.json({ capabilities: ['tools'], model_info: { 'x.context_length': 8192 } });
      }
      return Response.json({ version: '1.2.3' });
    };

    hub = new AgentSessionHub({
      home,
      dbFile: ':memory:',
      ollamaBaseUrl: 'http://127.0.0.1:1',
      fetchImpl,
    });
  });

  afterEach(async () => {
    hub.close();
    await fs.rm(projectRoot, { recursive: true, force: true });
    await fs.rm(home, { recursive: true, force: true });
  });

  async function openProjectAndSession(): Promise<string> {
    const workspace = await hub.openProject(projectRoot, 'Bas-URL-test');
    const session = hub.repositories.sessions.create({
      projectId: workspace.project.id,
      title: 'Bas-URL',
      model: 'lokal-modell',
    });
    return session.id;
  }

  it('använder den nya bas-URL:en för nya körningar', async () => {
    const sessionId = await openProjectAndSession();

    hub.updateSettings({ ollamaBaseUrl: 'http://127.0.0.1:2', defaultModel: 'lokal-modell' });
    expect(hub.settings().ollamaBaseUrl).toBe('http://127.0.0.1:2');

    const run = hub.startRun({ sessionId, prompt: 'Säg hej.' });
    const events: AgentEvent[] = [];
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Körningen blev inte klar.')), 20_000);
      hub.subscribe(run.runId, (event) => {
        events.push(event);
        if (event.type === 'run_finished') {
          clearTimeout(timeout);
          resolve();
        }
      });
    });

    expect(events.find((event) => event.type === 'run_finished')?.reason).toBe('final');
    const chatCalls = requests.filter((url) => url.includes('/v1/chat/completions'));
    expect(chatCalls.length).toBeGreaterThan(0);
    expect(chatCalls.every((url) => url.startsWith('http://127.0.0.1:2'))).toBe(true);
    expect(requests.every((url) => !url.startsWith('http://127.0.0.1:1'))).toBe(true);
  });

  it('läser den sparade bas-URL:en även när hubben startas utan en egen adress', async () => {
    hub.updateSettings({ ollamaBaseUrl: 'http://127.0.0.1:3' });
    const probe = await hub.probeOllama();
    expect(probe.baseUrl).toBe('http://127.0.0.1:3');
    expect(requests.some((url) => url.startsWith('http://127.0.0.1:3'))).toBe(true);
  });
});
