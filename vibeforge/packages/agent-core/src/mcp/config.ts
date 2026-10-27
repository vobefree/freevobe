import { createId } from '../util/ids.js';
import type { McpServerConfig } from '@vibeforge/protocol';

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[åä]/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export interface McpServerInput {
  id?: string;
  name: string;
  transport: 'stdio' | 'http' | 'sse';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  enabled?: boolean;
  requireApproval?: boolean;
}

const WARNING_RULES: Array<{ test: (config: McpServerInput) => boolean; warning: string }> = [
  {
    test: (config) =>
      ['filesystem', 'fs', 'file'].some((needle) => config.name.toLowerCase().includes(needle)),
    warning: 'Kan läsa och skriva filer på din dator utanför projektet.',
  },
  {
    test: (config) => /postgres|mysql|sqlite|mongo|database|db/i.test(config.name),
    warning: 'Kan läsa och ändra databasdata. Använd en läsbehörighet om du bara vill läsa.',
  },
  {
    test: (config) => /github|gitlab|git/i.test(config.name),
    warning: 'Kan komma åt dina repos med den token som skickas i miljövariablerna.',
  },
  {
    test: (config) => /playwright|puppeteer|browser/i.test(config.name),
    warning: 'Startar en webbläsare och kan besöka externa adresser.',
  },
  {
    test: (config) => /search|fetch|web|http/i.test(config.name),
    warning: 'Skickar sökord eller adresser till externa tjänster.',
  },
  {
    test: (config) => config.transport === 'http' || config.transport === 'sse',
    warning: 'Pratar med en extern server över nätet – verktygsanropen lämnar datorn.',
  },
  {
    test: (config) => (config.args ?? []).some((arg) => arg.includes('\\') || arg.startsWith('/')),
    warning: 'Får en absolut sökväg som argument, vilket kan ge åtkomst utanför projektet.',
  },
];

/** Gör om ett användarinput till en komplett serverkonfiguration med säkerhetsvarningar. */
export function buildMcpServer(input: McpServerInput): McpServerConfig {
  const warnings: string[] = [];
  for (const rule of WARNING_RULES) {
    if (rule.test(input) && !warnings.includes(rule.warning)) warnings.push(rule.warning);
  }

  if (input.transport === 'stdio' && !input.command)
    warnings.push('Saknar kommandot som ska startas.');
  if ((input.transport === 'http' || input.transport === 'sse') && !input.url) {
    warnings.push('Saknar adressen till servern.');
  }

  return {
    // Ett läsbart id (slug av namnet) ger läsbara verktygsnamn som `mcp__postgres__query`.
    // Ett slumpat id hade blivit obegripligt för både modellen och användaren.
    id: input.id ?? (slugify(input.name) || createId('mcp')),
    name: input.name,
    transport: input.transport,
    enabled: input.enabled ?? false,
    requireApproval: input.requireApproval ?? true,
    warnings,
    ...(input.command ? { command: input.command } : {}),
    ...(input.args ? { args: input.args } : {}),
    ...(input.env ? { env: input.env } : {}),
    ...(input.url ? { url: input.url } : {}),
  };
}

/** Konfiguration som kan klistras in i `.vibeforge/mcp.json` – samma form som andra klienter. */
export function defaultMcpExamples(): McpServerConfig[] {
  return [
    buildMcpServer({
      name: 'filesystem',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
      enabled: false,
    }),
    buildMcpServer({
      name: 'github',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: { GITHUB_PERSONAL_ACCESS_TOKEN: 'din-token-här' },
      enabled: false,
    }),
    buildMcpServer({
      name: 'postgres',
      transport: 'stdio',
      command: 'npx',
      args: [
        '-y',
        '@modelcontextprotocol/server-postgres',
        'postgresql://läsare:lösenord@localhost/din_databas',
      ],
      enabled: false,
    }),
    buildMcpServer({
      name: 'playwright',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@playwright/mcp@latest'],
      enabled: false,
    }),
    buildMcpServer({
      name: 'web-search',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', 'mcp-server-web-search'],
      enabled: false,
    }),
    buildMcpServer({
      name: 'extern-http',
      transport: 'http',
      url: 'https://exempel.se/mcp',
      enabled: false,
    }),
  ];
}

export function configsFromFile(parsed: unknown): McpServerConfig[] {
  if (typeof parsed !== 'object' || parsed === null) return [];
  const container = parsed as { mcpServers?: unknown; servers?: unknown };
  const raw = Array.isArray(parsed)
    ? parsed
    : Array.isArray(container.mcpServers)
      ? container.mcpServers
      : Array.isArray(container.servers)
        ? container.servers
        : [];

  const configs: McpServerConfig[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as Record<string, unknown>;
    if (typeof record.name !== 'string') continue;
    const command = typeof record.command === 'string' ? record.command : undefined;
    const url = typeof record.url === 'string' ? record.url : undefined;
    const transport =
      record.transport === 'http' || record.transport === 'sse' || record.transport === 'stdio'
        ? record.transport
        : url
          ? 'http'
          : 'stdio';

    configs.push(
      buildMcpServer({
        ...(typeof record.id === 'string' ? { id: record.id } : {}),
        name: record.name,
        transport,
        ...(command ? { command } : {}),
        ...(Array.isArray(record.args) ? { args: record.args.map(String) } : {}),
        ...(typeof record.env === 'object' && record.env !== null
          ? {
              env: Object.fromEntries(
                Object.entries(record.env as Record<string, unknown>).map(([key, value]) => [
                  key,
                  String(value),
                ]),
              ),
            }
          : {}),
        ...(url ? { url } : {}),
        ...(typeof record.enabled === 'boolean' ? { enabled: record.enabled } : {}),
        ...(typeof record.requireApproval === 'boolean'
          ? { requireApproval: record.requireApproval }
          : {}),
      }),
    );
  }
  return configs;
}
