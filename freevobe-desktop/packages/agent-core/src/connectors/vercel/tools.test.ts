import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentEvent } from '@freevobe/protocol';
import type { ApprovalOutcome, ToolContext } from '../../tools/types.js';
import { vercelTools } from './tools.js';

const TOKEN = 'vercel_test_token_abcdef123456';
type FetchInput = Parameters<typeof fetch>[0];

let root: string;
let requests: Array<{ method: string; url: URL; body?: unknown }>;
let respond: (request: { method: string; url: URL; body?: unknown }) => Response;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function context(approvals: ApprovalOutcome[] = []): ToolContext {
  const events: AgentEvent[] = [];
  return {
    root,
    projectId: 'proj',
    sessionId: 'sess',
    runId: 'run_1',
    signal: new AbortController().signal,
    approval: { required: false, risk: 'low', reason: 'Tillåtet.', hardBlock: false },
    emit: (event: AgentEvent) => events.push(event),
    requestApproval: vi.fn(async () => approvals.shift() ?? { approved: false }),
    proposeChange: async () => {
      throw new Error('används inte');
    },
    runHooks: async () => ({ blocked: false, output: '' }),
    exec: async () => {
      throw new Error('används inte');
    },
    detectTestCommand: async () => null,
    fetchImpl: fetch,
    limits: { terminalTimeoutMs: 2_000, maxOutputChars: 20_000 },
  };
}

function tools(onError?: (message: string) => void) {
  const fakeFetch = (async (input: FetchInput, init?: RequestInit) => {
    const request = {
      method: init?.method ?? 'GET',
      url: new URL(String(input)),
      ...(typeof init?.body === 'string' ? { body: JSON.parse(init.body) as unknown } : {}),
    };
    requests.push(request);
    return respond(request);
  }) as typeof fetch;

  const list = vercelTools({
    token: TOKEN,
    projectRoot: root,
    fetchImpl: fakeFetch,
    ...(onError ? { onError } : {}),
  });
  return (name: string) => {
    const tool = list.find((entry) => entry.spec.name === name);
    if (!tool?.handler) throw new Error(`Verktyget ${name} saknas`);
    return tool;
  };
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-vercel-tools-'));
  requests = [];
  respond = (request) => {
    if (request.url.pathname.endsWith('/env') && request.method === 'GET') {
      return json({
        envs: [
          { id: 'env_1', key: 'API_URL', target: ['production'], type: 'encrypted', value: 'x' },
        ],
      });
    }
    if (request.url.pathname === '/v13/deployments') {
      return json({ id: 'dpl_1', url: 'demo-xyz.vercel.app', readyState: 'QUEUED' });
    }
    if (request.url.pathname.startsWith('/v9/projects/') && request.method === 'GET') {
      return json({
        id: 'prj_1',
        name: 'demo',
        framework: 'nextjs',
        link: { type: 'github', repoId: 1234, productionBranch: 'main' },
      });
    }
    return json({ ok: true });
  };
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('vercel-verktyg', () => {
  it('märker alla verktyg som connectorverktyg och tvingar godkännande för ändringar', () => {
    const tool = tools();
    const specs = [
      'vercel_list_projects',
      'vercel_get_project',
      'vercel_create_project',
      'vercel_deploy',
      'vercel_get_deployments',
      'vercel_get_deployment_logs',
      'vercel_get_env_vars',
      'vercel_set_env_var',
      'vercel_delete_env_var',
      'vercel_get_domains',
      'vercel_add_domain',
    ].map((name) => tool(name).spec);

    expect(specs).toHaveLength(11);
    for (const spec of specs) {
      expect(spec.source).toBe('connector');
      expect(spec.connectorId).toBe('vercel');
      expect(spec.description.length).toBeGreaterThan(10);
    }

    const mutations = specs.filter((spec) => spec.danger !== 'network' && spec.danger !== 'safe');
    expect(mutations.map((spec) => spec.name).sort()).toEqual([
      'vercel_add_domain',
      'vercel_create_project',
      'vercel_delete_env_var',
      'vercel_deploy',
      'vercel_set_env_var',
    ]);
    for (const spec of mutations) expect(spec.alwaysRequiresApproval).toBe(true);
  });

  it('frågar om lov innan anropet när policyn kräver det, och gör inget om det nekas', async () => {
    const tool = tools();
    const ctx = context([{ approved: false }]);
    ctx.approval = {
      required: true,
      risk: 'low',
      reason: 'Läsning kräver godkännande.',
      hardBlock: false,
    };

    const result = await tool('vercel_list_projects').handler?.({}, ctx);

    expect(result?.ok).toBe(false);
    expect(result?.content).toContain('avvisade vercel_list_projects');
    expect(ctx.requestApproval).toHaveBeenCalledTimes(1);
    expect(requests).toHaveLength(0);
  });

  it('visar ett maskat env-värde i godkännandekortet', async () => {
    const tool = tools();
    const ctx = context([{ approved: true }]);
    ctx.approval = {
      required: true,
      risk: 'medium',
      reason: 'Ändringar kräver godkännande.',
      hardBlock: true,
    };

    await tool('vercel_set_env_var').handler?.(
      { project: 'demo', key: 'TOKEN', value: 'super-hemligt-varde' },
      ctx,
    );

    const request = (ctx.requestApproval as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0]?.[0] as { detail: string };
    expect(request.detail).toContain('••••');
    expect(request.detail).not.toContain('super-hemligt-varde');
  });

  it('deployar preview utan extra fråga och returnerar URL:en', async () => {
    const tool = tools();
    const ctx = context();

    const result = await tool('vercel_deploy').handler?.({ project: 'demo' }, ctx);

    expect(result?.ok).toBe(true);
    expect(result?.content).toContain('Deploy skapad mot preview: https://demo-xyz.vercel.app');
    expect(result?.data).toMatchObject({ deploymentId: 'dpl_1', target: 'preview' });
    expect(ctx.requestApproval).not.toHaveBeenCalled();

    const post = requests.find((request) => request.url.pathname === '/v13/deployments');
    expect((post?.body as Record<string, unknown>).target).toBeUndefined();
  });

  it('kräver ett extra godkännande för produktion och deployar först efteråt', async () => {
    const tool = tools();
    const ctx = context([{ approved: true }]);

    const result = await tool('vercel_deploy').handler?.(
      { project: 'demo', target: 'production' },
      ctx,
    );

    expect(ctx.requestApproval).toHaveBeenCalledTimes(1);
    const request = (ctx.requestApproval as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0]?.[0] as { title: string; risk: string; hardBlock: boolean; kind: string };
    expect(request.title).toContain('produktion');
    expect(request.risk).toBe('high');
    expect(request.hardBlock).toBe(true);
    expect(result?.ok).toBe(true);

    const post = requests.find((request) => request.url.pathname === '/v13/deployments');
    expect((post?.body as Record<string, unknown>).target).toBe('production');
  });

  it('ställer två frågor till produktion när policyn redan kräver godkännande', async () => {
    const tool = tools();
    const ctx = context([{ approved: true }, { approved: true }]);
    ctx.approval = {
      required: true,
      risk: 'high',
      reason: 'Ändringar kräver alltid godkännande.',
      hardBlock: true,
    };

    const result = await tool('vercel_deploy').handler?.(
      { project: 'demo', target: 'production' },
      ctx,
    );

    expect(result?.ok).toBe(true);
    expect(ctx.requestApproval).toHaveBeenCalledTimes(2);
  });

  it('avbryter produktionsdeploy när det extra godkännandet nekas', async () => {
    const tool = tools();
    const ctx = context([{ approved: false }]);

    const result = await tool('vercel_deploy').handler?.(
      { project: 'demo', target: 'production' },
      ctx,
    );

    expect(result?.ok).toBe(false);
    expect(result?.content).toContain('Produktionsdeploy avbröts');
    expect(requests.some((request) => request.url.pathname === '/v13/deployments')).toBe(false);
  });

  it('läser env-värdet från en fil och skickar det bara till Vercel', async () => {
    await fs.writeFile(
      path.join(root, '.env.local'),
      'OTHER=1\nAPI_URL="https://hemlig.example"\n',
    );
    const tool = tools();

    const result = await tool('vercel_set_env_var').handler?.(
      { project: 'demo', key: 'API_URL', valueFromFile: '.env.local', targets: ['production'] },
      context(),
    );

    expect(result?.ok).toBe(true);
    expect(result?.content).not.toContain('hemlig.example');
    expect(result?.data).toMatchObject({ key: 'API_URL', valueSource: 'file' });
    const post = requests.find((request) => request.url.pathname === '/v10/projects/prj_1/env');
    expect((post?.body as Record<string, unknown>).value).toBe('https://hemlig.example');
  });

  it('vägrar läsa env-värde utanför projektet', async () => {
    const tool = tools();
    const result = await tool('vercel_set_env_var').handler?.(
      { project: 'demo', key: 'API_URL', valueFromFile: '../../secret.txt' },
      context(),
    );

    expect(result?.ok).toBe(false);
    expect(result?.content).toContain('utanför projektet');
    expect(requests).toHaveLength(0);
  });

  it('kräver ett värde eller en fil', async () => {
    const tool = tools();
    const result = await tool('vercel_set_env_var').handler?.(
      { project: 'demo', key: 'X' },
      context(),
    );

    expect(result?.ok).toBe(false);
    expect(result?.content).toContain('valueFromFile');
  });

  it('listar miljövariabler utan att hämta värden', async () => {
    const tool = tools();
    const result = await tool('vercel_get_env_vars').handler?.({ project: 'demo' }, context());

    expect(result?.ok).toBe(true);
    expect(result?.content).toContain('API_URL');
    expect(result?.content).toContain('värden visas aldrig');
    const get = requests.find((request) => request.url.pathname === '/v9/projects/prj_1/env');
    expect(get?.url.searchParams.has('decrypt')).toBe(false);
  });

  it('raderar bara env-variabler efter ett extra ja', async () => {
    const tool = tools();
    const denied = context([{ approved: false }]);

    const blocked = await tool('vercel_delete_env_var').handler?.(
      { project: 'demo', key: 'API_URL' },
      denied,
    );
    expect(blocked?.ok).toBe(false);
    expect(requests.some((request) => request.method === 'DELETE')).toBe(false);

    const allowed = await tool('vercel_delete_env_var').handler?.(
      { project: 'demo', key: 'API_URL' },
      context([{ approved: true }]),
    );
    expect(allowed?.ok).toBe(true);
    const deletion = requests.find((request) => request.method === 'DELETE');
    expect(deletion?.url.pathname).toBe('/v9/projects/prj_1/env/env_1');
  });

  it('rapporterar API-fel till connector-kortet utan token i texten', async () => {
    respond = () => json({ error: { code: 'forbidden', message: 'Token is not valid' } }, 403);
    const onError = vi.fn();
    const tool = tools(onError);

    const result = await tool('vercel_list_projects').handler?.({}, context());

    expect(result?.ok).toBe(false);
    expect(result?.content).toContain('Vercel-anropet misslyckades');
    expect(result?.content).not.toContain(TOKEN);
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('Token is not valid'));
    expect(String(onError.mock.calls[0]?.[0])).not.toContain(TOKEN);
  });

  it('hämtar byggloggar för en deployment', async () => {
    respond = (request) => {
      if (request.url.pathname.startsWith('/v13/deployments/')) {
        return json({ id: 'dpl_1', url: 'demo.vercel.app', readyState: 'READY' });
      }
      return json([{ payload: { text: 'Compiled successfully' } }]);
    };
    const tool = tools();

    const result = await tool('vercel_get_deployment_logs').handler?.(
      { deploymentId: 'dpl_1' },
      context(),
    );

    expect(result?.ok).toBe(true);
    expect(result?.content).toContain('Compiled successfully');
    expect(result?.data).toMatchObject({ lines: 1 });
  });
});
