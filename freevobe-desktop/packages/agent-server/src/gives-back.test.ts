import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AppSettings, Contribution, GivesBackSummary } from '@freevobe/protocol';
import { AgentSessionHub } from './sessionHub.js';
import { startAgentServer, type AgentServerHandle } from './server.js';

const TOKEN = 'b'.repeat(64);

let home: string;
let hub: AgentSessionHub;
let server: AgentServerHandle;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-gives-back-'));
  hub = new AgentSessionHub({ home, dbFile: ':memory:' });
  server = await startAgentServer({ hub, port: 0, devMode: true, token: TOKEN });
});

afterEach(async () => {
  await server.close();
  hub.close();
  await fs.rm(home, { recursive: true, force: true });
});

async function api<T = any>(
  pathname: string,
  options: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<{ status: number; data: T; raw: any }> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const token = options.token === undefined ? TOKEN : options.token;
  if (token) headers['x-freevobe-token'] = token;

  const response = await fetch(`${server.url}${pathname}`, {
    method: options.method ?? 'GET',
    headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  const raw = await response.json();
  return { status: response.status, data: (raw as { data?: T }).data as T, raw };
}

interface Payload {
  entries: Contribution[];
  summary: GivesBackSummary;
  removed?: boolean;
}

describe('Gives Back över HTTP', () => {
  it('börjar tomt och kräver token', async () => {
    const unauthorized = await api('/api/gives-back', { token: null });
    expect(unauthorized.status).toBe(401);

    const empty = await api<Payload>('/api/gives-back');
    expect(empty.status).toBe(200);
    expect(empty.data.entries).toEqual([]);
    expect(empty.data.summary).toEqual({ count: 0, totalSek: 0, causeCount: 0 });
  });

  it('sparar ett eget stöd och räknar ihop loggen', async () => {
    const first = await api<Payload>('/api/gives-back', {
      method: 'POST',
      body: { causeId: 'wwf', amountSek: 250, note: 'Skog' },
    });
    expect(first.status).toBe(200);
    expect(first.data.entries).toHaveLength(1);
    expect(first.data.entries[0]).toMatchObject({
      causeId: 'wwf',
      amountSek: 250,
      note: 'Skog',
      source: 'self-reported',
    });
    expect(first.data.summary).toMatchObject({ count: 1, totalSek: 250, causeCount: 1 });

    const second = await api<Payload>('/api/gives-back', {
      method: 'POST',
      body: { causeId: 'unicef' },
    });
    expect(second.status).toBe(200);
    expect(second.data.entries).toHaveLength(2);
    // Utan belopp räknas stödet men bidrar inte till summan.
    expect(second.data.summary).toMatchObject({ count: 2, totalSek: 250, causeCount: 2 });
  });

  it('avvisar okända ändamål och felaktiga belopp', async () => {
    const unknown = await api('/api/gives-back', {
      method: 'POST',
      body: { causeId: 'hittepa' },
    });
    expect(unknown.status).toBe(400);

    const negative = await api('/api/gives-back', {
      method: 'POST',
      body: { causeId: 'wwf', amountSek: -5 },
    });
    expect(negative.status).toBe(400);

    const text = await api('/api/gives-back', {
      method: 'POST',
      body: { causeId: 'wwf', amountSek: '250' },
    });
    expect(text.status).toBe(400);

    const missing = await api('/api/gives-back', { method: 'POST', body: {} });
    expect(missing.status).toBe(400);
  });

  it('raderar en post och lämnar resten kvar', async () => {
    const created = await api<Payload>('/api/gives-back', {
      method: 'POST',
      body: { causeId: 'kiva', amountSek: 100 },
    });
    const id = created.data.entries[0]!.id;

    const removed = await api<Payload>(`/api/gives-back/${id}`, { method: 'DELETE' });
    expect(removed.status).toBe(200);
    expect(removed.data.removed).toBe(true);
    expect(removed.data.entries).toEqual([]);

    const again = await api<Payload>(`/api/gives-back/${id}`, { method: 'DELETE' });
    expect(again.data.removed).toBe(false);
  });

  it('sparar Gives Back-inställningen via settings-API:t', async () => {
    const patched = await api<AppSettings>('/api/settings', {
      method: 'PATCH',
      body: {
        givesBack: {
          enabled: true,
          everyNPrompts: 5,
          causeIds: ['wwf', 'unicef'],
          consentedAt: 123,
        },
      },
    });

    expect(patched.status).toBe(200);
    expect(patched.data.givesBack).toMatchObject({
      enabled: true,
      everyNPrompts: 5,
      causeIds: ['wwf', 'unicef'],
      consentedAt: 123,
    });

    const reloaded = await api<AppSettings>('/api/settings');
    expect(reloaded.data.givesBack.enabled).toBe(true);
  });
});
