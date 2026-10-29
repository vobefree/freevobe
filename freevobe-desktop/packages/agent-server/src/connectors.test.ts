import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
  ConnectorDisconnectResult,
  ConnectorsResponse,
  ConnectorView,
  ToolSpec,
} from '@freevobe/protocol';
import { AgentSessionHub } from './sessionHub.js';
import { startAgentServer, type AgentServerHandle } from './server.js';

const TOKEN = 'b'.repeat(64);
const GITHUB_TOKEN = 'ghp_abcdefghijklmnopqrstuvwxyz0123456789';

let projectRoot: string;
let home: string;
let hub: AgentSessionHub;
let server: AgentServerHandle;
let projectId: string;

beforeEach(async () => {
  projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-connectors-proj-'));
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-connectors-home-'));
  await fs.writeFile(path.join(projectRoot, 'package.json'), JSON.stringify({ name: 'demo' }));

  hub = new AgentSessionHub({ home, dbFile: ':memory:' });
  server = await startAgentServer({ hub, port: 0, devMode: true, token: TOKEN });
  const workspace = await hub.openProject(projectRoot, 'Demo');
  projectId = workspace.project.id;
});

afterEach(async () => {
  await server.close();
  hub.close();
  await fs.rm(projectRoot, { recursive: true, force: true });
  await fs.rm(home, { recursive: true, force: true });
});

async function api<T>(
  pathname: string,
  options: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const token = options.token === undefined ? TOKEN : options.token;
  if (token) headers['x-freevobe-token'] = token;
  const response = await fetch(`${server.url}${pathname}`, {
    method: options.method ?? 'GET',
    headers,
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  const raw = (await response.json()) as { data?: T };
  return { status: response.status, data: raw.data as T };
}

const base = () => `/api/projects/${projectId}/connectors`;

describe('connector-rutter', () => {
  it('kräver token som alla andra rutter', async () => {
    const anonymous = await api<ConnectorsResponse>(base(), { token: null });
    expect(anonymous.status).toBe(401);
  });

  it('listar katalogen med lagringsinformation', async () => {
    const response = await api<ConnectorsResponse>(base());
    expect(response.status).toBe(200);
    expect(response.data.connectors).toHaveLength(10);
    expect(response.data.storage.cipher).toBe('aes-256-gcm');
    expect(response.data.storage.keychain).toBe(false);
    expect(response.data.storage.path).not.toContain('freevobe.db');

    const git = response.data.connectors.find((entry) => entry.definition.id === 'git');
    expect(git?.state.status).toBe('connected');
  });

  it('ansluter, slår av och kopplar bort utan att läcka token', async () => {
    const connected = await api<ConnectorView>(`${base()}/github/connect`, {
      method: 'POST',
      body: { secret: GITHUB_TOKEN, accountLabel: 'vobefree' },
    });
    expect(connected.status).toBe(200);
    expect(connected.data.state.status).toBe('connected');
    expect(connected.data.state.accountLabel).toBe('vobefree');
    expect(JSON.stringify(connected.data)).not.toContain(GITHUB_TOKEN);

    const listed = await api<ConnectorsResponse>(base());
    expect(JSON.stringify(listed.data)).not.toContain(GITHUB_TOKEN);
    const github = listed.data.connectors.find((entry) => entry.definition.id === 'github');
    expect(github?.state.secretHint).toBeTruthy();

    const disabled = await api<ConnectorView>(`${base()}/github`, {
      method: 'PATCH',
      body: { enabled: false },
    });
    expect(disabled.data.state.status).toBe('disconnected');
    expect(disabled.data.state.enabled).toBe(false);

    const reconnect = await api<ConnectorView>(`${base()}/github`, {
      method: 'PATCH',
      body: { enabled: true },
    });
    expect(reconnect.data.state.status).toBe('connected');

    const removed = await api<ConnectorDisconnectResult>(`${base()}/github`, { method: 'DELETE' });
    expect(removed.status).toBe(200);
    expect(removed.data.view.state.status).toBe('disconnected');
    expect(removed.data.revokedScopes).toContain('repository:read');
  });

  it('avvisar trasiga anrop med tydliga fel', async () => {
    // Anroparens fel svarar 400 – servern kraschar inte och läcker inget om valvet.
    const missing = await api<unknown>(`${base()}/github/connect`, { method: 'POST', body: {} });
    expect(missing.status).toBe(400);

    const notBoolean = await api<unknown>(`${base()}/github`, {
      method: 'PATCH',
      body: { enabled: 'ja' },
    });
    expect(notBoolean.status).toBe(400);

    const unknown = await api<unknown>(`${base()}/nope/connect`, {
      method: 'POST',
      body: { secret: GITHUB_TOKEN },
    });
    expect(unknown.status).toBe(400);

    const comingSoon = await api<unknown>(`${base()}/netlify/connect`, {
      method: 'POST',
      body: { secret: GITHUB_TOKEN },
    });
    expect(comingSoon.status).toBe(400);
  });

  it('ger agenten Vercel-verktygen först när connectorn är på', async () => {
    const toolNames = async (): Promise<string[]> => {
      const response = await api<ToolSpec[]>(`/api/tools?projectId=${projectId}`);
      expect(response.status).toBe(200);
      return response.data.filter((spec) => spec.source === 'connector').map((spec) => spec.name);
    };

    expect(await toolNames()).toEqual([]);

    const token = 'vercel_token_1234567890';
    const connected = await api<ConnectorView>(`${base()}/vercel/connect`, {
      method: 'POST',
      body: { secret: token, accountLabel: 'vobefree' },
    });
    expect(connected.status).toBe(200);

    const names = await toolNames();
    expect(names).toContain('vercel_deploy');
    expect(names).toContain('vercel_get_deployment_logs');
    expect(names).toHaveLength(11);
    expect(
      JSON.stringify(await api<ToolSpec[]>(`/api/tools?projectId=${projectId}`)),
    ).not.toContain(token);

    await api<ConnectorView>(`${base()}/vercel`, { method: 'PATCH', body: { enabled: false } });
    expect(await toolNames()).toEqual([]);

    // Token ligger kvar i valvet: att slå på connectorn igen kräver ingen ny inmatning.
    await api<ConnectorView>(`${base()}/vercel`, { method: 'PATCH', body: { enabled: true } });
    expect(await toolNames()).toHaveLength(11);

    await api<ConnectorDisconnectResult>(`${base()}/vercel`, { method: 'DELETE' });
    expect(await toolNames()).toEqual([]);
  });

  it('skriver valvet utanför projektet utan klartext', async () => {
    await api<ConnectorView>(`${base()}/vercel/connect`, {
      method: 'POST',
      body: { secret: 'vercel_token_1234567890' },
    });
    const vault = await fs.readFile(path.join(home, 'connectors.vault.json'), 'utf8');
    expect(vault).not.toContain('vercel_token_1234567890');
    const inProject = await fs.readdir(projectRoot);
    expect(inProject).not.toContain('connectors.vault.json');
  });
});
