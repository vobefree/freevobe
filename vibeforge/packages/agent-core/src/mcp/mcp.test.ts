import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { McpServerConfig } from '@vibeforge/protocol';
import { McpClient } from './client.js';
import { McpManager } from './manager.js';
import { StdioTransport } from './stdioTransport.js';
import { buildMcpServer, configsFromFile, defaultMcpExamples } from './config.js';
import { ToolRegistry } from '../tools/registry.js';
import type { ToolContext } from '../tools/types.js';

const FIXTURE = fileURLToPath(new URL('../testing/fixtures/fake-mcp-server.mjs', import.meta.url));

/**
 * Väntar tills villkoret är sant i stället för att sova en fast tid.
 *
 * Underprocessen svarar normalt på några millisekunder, men när hela sviten körs parallellt kan
 * rundturen ta längre tid än en fast fördröjning – och då blir testet flaky utan att något är fel.
 * Väntetiden är bara övre gräns; det som kontrolleras är fortfarande exakt samma sak.
 */
async function waitFor(predicate: () => boolean, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

function serverConfig(overrides: Partial<McpServerConfig> = {}): McpServerConfig {
  return buildMcpServer({
    name: 'fake',
    transport: 'stdio',
    command: process.execPath,
    args: [FIXTURE],
    enabled: true,
    requireApproval: true,
    ...overrides,
  });
}

describe('McpClient över stdio', () => {
  it('gör handskakning och listar verktyg, resurser och prompts', async () => {
    const client = new McpClient({
      serverId: 'fake',
      transport: new StdioTransport({ command: process.execPath, args: [FIXTURE] }),
    });
    try {
      const info = await client.connect();
      expect(info.name).toBe('fake-mcp');
      expect(info.version).toBe('1.2.3');
      expect(info.protocolVersion).toBe('2025-11-25');

      const tools = await client.listTools();
      expect(tools.map((tool) => tool.name)).toEqual(['mcp__fake__echo', 'mcp__fake__sum']);
      expect(tools[0]?.source).toBe('mcp');
      expect(tools[0]?.origin).toEqual({ server: 'fake', originalName: 'echo' });
      expect(tools[1]?.parameters.required).toEqual(['a', 'b']);

      const resources = await client.listResources();
      expect(resources[0]?.uri).toBe('file:///README.md');

      const prompts = await client.listPrompts();
      expect(prompts[0]?.name).toBe('granska');
    } finally {
      await client.close();
    }
  });

  it('anropar verktyg och rapporterar verktygsfel som isError', async () => {
    const client = new McpClient({
      serverId: 'fake',
      transport: new StdioTransport({ command: process.execPath, args: [FIXTURE] }),
    });
    try {
      await client.connect();
      const echo = await client.callTool('echo', { text: 'hej' });
      expect(echo.ok).toBe(true);
      expect(echo.content).toBe('hej');

      const sum = await client.callTool('sum', { a: 2, b: 3 });
      expect(sum.content).toBe('5');

      const unknown = await client.callTool('finns-inte', {});
      expect(unknown.ok).toBe(false);
    } finally {
      await client.close();
    }
  });

  it('ger ett tydligt fel när kommandot inte finns', async () => {
    const client = new McpClient({
      serverId: 'trasig',
      transport: new StdioTransport({ command: 'det-har-kommandot-finns-inte-1234' }),
      requestTimeoutMs: 2_000,
    });
    await expect(client.connect()).rejects.toThrow();
    await client.close();
  });
});

describe('McpManager', () => {
  function fakeContext(approved: boolean, approvals: string[]): ToolContext {
    return {
      root: process.cwd(),
      projectId: 'p',
      sessionId: 's',
      runId: 'r',
      signal: new AbortController().signal,
      approval: { required: true, risk: 'high', reason: 'mcp', hardBlock: true },
      emit: () => undefined,
      requestApproval: async (request) => {
        approvals.push(request.kind);
        return { approved };
      },
      proposeChange: async () => {
        throw new Error('ska inte anropas');
      },
      runHooks: async () => ({ blocked: false, output: '' }),
      exec: async () => ({
        command: '',
        exitCode: 0,
        passed: 0,
        failed: 0,
        output: '',
        timedOut: false,
      }),
      detectTestCommand: async () => null,
      fetchImpl: globalThis.fetch,
      limits: { terminalTimeoutMs: 1_000, maxOutputChars: 1_000 },
    };
  }

  it('registrerar MCP-verktyg som vanliga verktyg och kör dem efter godkännande', async () => {
    const registry = new ToolRegistry();
    const manager = new McpManager({ registry });
    const config = serverConfig();

    const status = await manager.connect(config);
    expect(status.connected).toBe(true);
    expect(status.toolCount).toBe(2);
    expect(registry.list().map((spec) => spec.name)).toContain('mcp__fake__echo');

    const approvals: string[] = [];
    const result = await registry.execute(
      { id: 'c1', name: 'mcp__fake__echo', args: { text: 'från VibeForge' } },
      fakeContext(true, approvals),
    );

    expect(result.ok).toBe(true);
    expect(result.content).toBe('från VibeForge');
    expect(approvals).toContain('mcp');

    await manager.disconnectAll();
    expect(registry.list().some((spec) => spec.source === 'mcp')).toBe(false);
  });

  it('kör inget när användaren inte godkänner servern', async () => {
    const registry = new ToolRegistry();
    const manager = new McpManager({ registry });
    await manager.connect(serverConfig());

    const approvals: string[] = [];
    const result = await registry.execute(
      { id: 'c1', name: 'mcp__fake__echo', args: { text: 'nej' } },
      fakeContext(false, approvals),
    );

    // Verktyget får inte köras: antingen stoppas det av registret eller av managerns godkännandekedja.
    expect(result.ok).toBe(false);
    expect(result.content).toMatch(/avvisade|godkände inte/);
    expect(approvals).toContain('mcp');
    await manager.disconnectAll();
  });

  it('ger inga verktyg från en server som inte är aktiverad', async () => {
    const registry = new ToolRegistry();
    const manager = new McpManager({ registry });
    await manager.connectEnabled([serverConfig({ enabled: false })]);
    expect(registry.list()).toHaveLength(0);
  });

  it('rapporterar fel i stället för att kasta när en server inte kan startas', async () => {
    const registry = new ToolRegistry();
    const manager = new McpManager({ registry });
    const status = await manager.connect(
      buildMcpServer({
        name: 'trasig',
        transport: 'stdio',
        command: 'finns-inte-alls-9999',
        enabled: true,
      }),
    );
    expect(status.connected).toBe(false);
    expect(status.error).toBeTruthy();
  });
});

describe('MCP-konfiguration', () => {
  it('lägger säkerhetsvarningar på känsliga servrar', () => {
    const filesystem = buildMcpServer({ name: 'filesystem', transport: 'stdio', command: 'npx' });
    expect(filesystem.warnings.some((warning) => warning.includes('filer'))).toBe(true);

    const postgres = buildMcpServer({ name: 'postgres', transport: 'stdio', command: 'npx' });
    expect(postgres.warnings.some((warning) => warning.includes('databas'))).toBe(true);

    const remote = buildMcpServer({
      name: 'sök',
      transport: 'http',
      url: 'https://exempel.se/mcp',
    });
    expect(remote.warnings.some((warning) => warning.includes('nätet'))).toBe(true);

    expect(filesystem.requireApproval).toBe(true);
    expect(filesystem.enabled).toBe(false);
  });

  it('innehåller exempel för filesystem, GitHub, Postgres, Playwright och webbsök', () => {
    const names = defaultMcpExamples().map((config) => config.name);
    expect(names).toEqual(
      expect.arrayContaining(['filesystem', 'github', 'postgres', 'playwright', 'web-search']),
    );
  });

  it('läser konfiguration i mcpServers-form', () => {
    const configs = configsFromFile({
      mcpServers: [
        { name: 'lokal', command: 'node', args: ['server.js'] },
        { name: 'fjärr', url: 'https://x.se/mcp', transport: 'http' },
      ],
    });
    expect(configs).toHaveLength(2);
    expect(configs[0]?.transport).toBe('stdio');
    expect(configs[1]?.transport).toBe('http');
  });
});

describe('StdioTransport', () => {
  it('tolkar flera meddelanden i samma chunk', async () => {
    const transport = new StdioTransport({
      command: process.execPath,
      args: ['-e', 'process.stdin.pipe(process.stdout)'],
    });
    await transport.start();
    const seen: unknown[] = [];
    transport.onMessage((message) => seen.push(message));
    await transport.send({ jsonrpc: '2.0', id: 1, method: 'a' });
    await transport.send({ jsonrpc: '2.0', id: 2, method: 'b' });
    await waitFor(() => seen.length >= 2);
    expect(seen).toHaveLength(2);
    await transport.close();
  });

  it('kastar om man skickar efter stängning', async () => {
    const transport = new StdioTransport({
      command: process.execPath,
      args: ['-e', 'setTimeout(()=>{},500)'],
    });
    await transport.start();
    await transport.close();
    await expect(transport.send({ jsonrpc: '2.0', id: 1, method: 'a' })).rejects.toThrow(
      /körs inte/,
    );
  });
});

describe('testfixturen', () => {
  it('ligger på en sökväg som går att starta', () => {
    expect(path.isAbsolute(FIXTURE)).toBe(true);
  });
});
