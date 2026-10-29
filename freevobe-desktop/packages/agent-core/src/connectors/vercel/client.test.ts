import { describe, expect, it } from 'vitest';
import { VercelApiError, VercelClient, deploymentUrl } from './client.js';

const TOKEN = 'vercel_test_token_1234567890';
type FetchInput = Parameters<typeof fetch>[0];

interface Recorded {
  url: string;
  init: RequestInit;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function fakeFetch(handler: (recorded: Recorded) => Response): {
  fetchImpl: typeof fetch;
  calls: Recorded[];
} {
  const calls: Recorded[] = [];
  const fetchImpl = (async (input: FetchInput, init?: RequestInit) => {
    const recorded = { url: String(input), init: init ?? {} };
    calls.push(recorded);
    return handler(recorded);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

describe('VercelClient', () => {
  it('skickar token i Authorization och teamId som query – aldrig i URL:ens sökväg', async () => {
    const { fetchImpl, calls } = fakeFetch(() =>
      json({ projects: [{ id: 'prj_1', name: 'demo', framework: 'nextjs' }] }),
    );
    const client = new VercelClient({ token: TOKEN, teamId: 'team_42', fetchImpl });

    const projects = await client.listProjects(5);

    expect(projects).toEqual([{ id: 'prj_1', name: 'demo', framework: 'nextjs' }]);
    expect(calls).toHaveLength(1);
    const url = new URL(calls[0]!.url);
    expect(url.pathname).toBe('/v9/projects');
    expect(url.searchParams.get('limit')).toBe('5');
    expect(url.searchParams.get('teamId')).toBe('team_42');
    expect(calls[0]!.url).not.toContain(TOKEN);
    expect((calls[0]!.init.headers as Record<string, string>).authorization).toBe(
      `Bearer ${TOKEN}`,
    );
  });

  it('gör Vercels fel till VercelApiError utan att läcka token', async () => {
    const { fetchImpl } = fakeFetch(() =>
      json({ error: { code: 'forbidden', message: 'Not authorized' } }, 403),
    );
    const client = new VercelClient({ token: TOKEN, fetchImpl });

    const error = await client.getProject('demo').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(VercelApiError);
    expect((error as VercelApiError).status).toBe(403);
    expect((error as VercelApiError).code).toBe('forbidden');
    expect((error as Error).message).toContain('Not authorized');
    expect((error as Error).message).not.toContain(TOKEN);
  });

  it('deployar från projektets git-länk med repoId och ref, utan target för preview', async () => {
    const { fetchImpl, calls } = fakeFetch((recorded) => {
      if (recorded.url.includes('/v9/projects/')) {
        return json({
          id: 'prj_1',
          name: 'demo',
          link: { type: 'github', repoId: 1234, productionBranch: 'main' },
        });
      }
      return json({ id: 'dpl_1', url: 'demo-abc.vercel.app', readyState: 'QUEUED' });
    });
    const client = new VercelClient({ token: TOKEN, fetchImpl });

    const deployment = await client.createDeployment({ project: 'demo', target: 'preview' });

    expect(deployment.id).toBe('dpl_1');
    expect(deploymentUrl(deployment.url)).toBe('https://demo-abc.vercel.app');

    const post = calls.find((call) => call.init.method === 'POST');
    expect(post).toBeDefined();
    expect(new URL(post!.url).pathname).toBe('/v13/deployments');
    const body = JSON.parse(String(post!.init.body)) as Record<string, unknown>;
    expect(body.name).toBe('demo');
    expect(body.project).toBe('prj_1');
    expect(body.target).toBeUndefined();
    expect(body.gitSource).toEqual({ type: 'github', repoId: 1234, ref: 'main' });
  });

  it('sätter target production och använder angiven ref', async () => {
    const { fetchImpl, calls } = fakeFetch((recorded) => {
      if (recorded.url.includes('/v9/projects/')) {
        return json({
          id: 'prj_1',
          name: 'demo',
          link: { type: 'github', org: 'acme', repo: 'demo', productionBranch: 'main' },
        });
      }
      return json({ id: 'dpl_2', url: 'demo-prod.vercel.app', readyState: 'BUILDING' });
    });
    const client = new VercelClient({ token: TOKEN, fetchImpl });

    await client.createDeployment({ project: 'demo', target: 'production', ref: 'release/1.2' });

    const body = JSON.parse(
      String(calls.find((call) => call.init.method === 'POST')!.init.body),
    ) as Record<string, unknown>;
    expect(body.target).toBe('production');
    expect(body.gitSource).toEqual({
      type: 'github',
      org: 'acme',
      repo: 'demo',
      ref: 'release/1.2',
    });
  });

  it('vägrar deploya ett projekt utan git-länk med ett tydligt fel', async () => {
    const { fetchImpl } = fakeFetch(() => json({ id: 'prj_1', name: 'demo', link: null }));
    const client = new VercelClient({ token: TOKEN, fetchImpl });

    await expect(client.createDeployment({ project: 'demo', target: 'preview' })).rejects.toThrow(
      /inte kopplat till ett git-repo/,
    );
  });

  it('normaliserar svaret när en miljövariabel skapas', async () => {
    const { fetchImpl, calls } = fakeFetch(() =>
      json({ created: { id: 'env_1', key: 'API_URL', target: ['production'], type: 'encrypted' } }),
    );
    const client = new VercelClient({ token: TOKEN, fetchImpl });

    const saved = await client.setEnvVar('prj_1', {
      key: 'API_URL',
      value: 'https://example.com',
      targets: ['production'],
    });

    expect(saved).toEqual({
      id: 'env_1',
      key: 'API_URL',
      target: ['production'],
      type: 'encrypted',
    });
    const post = calls.find((call) => call.init.method === 'POST');
    const body = JSON.parse(String(post!.init.body)) as Record<string, unknown>;
    expect(body).toEqual({
      key: 'API_URL',
      value: 'https://example.com',
      type: 'encrypted',
      target: ['production'],
    });
  });

  it('plockar ut byggloggar ur händelseströmmen', async () => {
    const { fetchImpl, calls } = fakeFetch(() =>
      json([
        { type: 'build-start', payload: { text: 'Cloning github.com/acme/demo' } },
        { type: 'stdout', payload: { text: 'npm run build' } },
        { type: 'stdout' },
      ]),
    );
    const client = new VercelClient({ token: TOKEN, fetchImpl });

    const logs = await client.buildLogs('dpl_1', 50);

    expect(logs).toBe('Cloning github.com/acme/demo\nnpm run build');
    const url = new URL(calls[0]!.url);
    expect(url.pathname).toBe('/v2/deployments/dpl_1/events');
    expect(url.searchParams.get('builds')).toBe('1');
    expect(url.searchParams.get('limit')).toBe('50');
  });

  it('hanterar 204 från radering utan att försöka tolka en kropp', async () => {
    const { fetchImpl } = fakeFetch(() => new Response(null, { status: 204 }));
    const client = new VercelClient({ token: TOKEN, fetchImpl });

    await expect(client.deleteEnvVar('prj_1', 'env_1')).resolves.toBeUndefined();
  });

  it('kräver en token', () => {
    expect(() => new VercelClient({ token: '   ' })).toThrow(/token saknas/i);
  });
});
