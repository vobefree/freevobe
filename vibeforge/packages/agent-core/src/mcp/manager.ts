import type { McpServerConfig, McpServerStatus, ToolResult } from '@vibeforge/protocol';
import type { ToolRegistry } from '../tools/registry.js';
import type { ToolContext } from '../tools/types.js';
import { ok, fail } from '../tools/types.js';
import { describeError } from '../util/errors.js';
import { McpClient } from './client.js';
import { createTransport } from './httpTransport.js';
import type { McpServerInfo } from './client.js';

export interface McpManagerOptions {
  registry: ToolRegistry;
  fetchImpl?: typeof fetch;
  onStatusChange?: (status: McpServerStatus) => void;
}

interface ConnectedServer {
  config: McpServerConfig;
  client: McpClient;
  info: McpServerInfo;
  toolCount: number;
  resourceCount: number;
  promptCount: number;
}

/**
 * Håller MCP-servrar anslutna och speglar deras verktyg in i ToolRegistry som vanliga
 * VibeForge-verktyg (`mcp__<server>__<verktyg>`). Varje server kan slås av och på per projekt,
 * och verktygen kräver godkännande tills användaren godkänt servern i sessionen.
 */
export class McpManager {
  private readonly options: McpManagerOptions;
  private readonly servers = new Map<string, ConnectedServer>();
  private readonly errors = new Map<string, string>();
  private readonly approved = new Set<string>();

  constructor(options: McpManagerOptions) {
    this.options = options;
  }

  statuses(configs: McpServerConfig[] = []): McpServerStatus[] {
    const statuses: McpServerStatus[] = [];

    for (const config of configs) {
      const connected = this.servers.get(config.id);
      const error = this.errors.get(config.id);
      statuses.push({
        id: config.id,
        connected: connected !== undefined,
        toolCount: connected?.toolCount ?? 0,
        resourceCount: connected?.resourceCount ?? 0,
        promptCount: connected?.promptCount ?? 0,
        ...(connected?.info.name ? { serverName: connected.info.name } : {}),
        ...(connected?.info.version ? { serverVersion: connected.info.version } : {}),
        ...(connected?.info.protocolVersion
          ? { protocolVersion: connected.info.protocolVersion }
          : {}),
        ...(error ? { error } : {}),
      });
    }

    for (const [id, server] of this.servers) {
      if (configs.some((config) => config.id === id)) continue;
      statuses.push({
        id,
        connected: true,
        toolCount: server.toolCount,
        resourceCount: server.resourceCount,
        promptCount: server.promptCount,
        serverName: server.info.name,
        serverVersion: server.info.version,
        protocolVersion: server.info.protocolVersion,
      });
    }

    return statuses;
  }

  isApproved(serverId: string): boolean {
    const config = [...this.servers.values()].find((server) => server.config.id === serverId);
    // En server som uttryckligen inte kräver godkännande räknas som godkänd.
    if (config && !config.config.requireApproval) return true;
    return this.approved.has(serverId);
  }

  approve(serverId: string): void {
    this.approved.add(serverId);
  }

  revoke(serverId: string): void {
    this.approved.delete(serverId);
  }

  async connect(config: McpServerConfig): Promise<McpServerStatus> {
    await this.disconnect(config.id);
    this.errors.delete(config.id);

    try {
      const transport = createTransport(
        {
          transport: config.transport,
          ...(config.command ? { command: config.command } : {}),
          ...(config.args ? { args: config.args } : {}),
          ...(config.env ? { env: config.env } : {}),
          ...(config.url ? { url: config.url } : {}),
        },
        this.options.fetchImpl,
      );

      const client = new McpClient({ serverId: config.id, transport });
      const info = await client.connect();

      const tools = await client.listTools();
      const resources = await client.listResources().catch(() => []);
      const prompts = await client.listPrompts().catch(() => []);

      this.options.registry.removeWhere(
        (spec) => spec.source === 'mcp' && spec.origin?.server === config.id,
      );
      for (const spec of tools)
        this.registerRemoteTool(config.id, spec.name, spec.origin?.originalName ?? spec.name);

      const server: ConnectedServer = {
        config,
        client,
        info,
        toolCount: tools.length,
        resourceCount: resources.length,
        promptCount: prompts.length,
      };
      this.servers.set(config.id, server);

      const status: McpServerStatus = {
        id: config.id,
        connected: true,
        toolCount: tools.length,
        resourceCount: resources.length,
        promptCount: prompts.length,
        serverName: info.name,
        serverVersion: info.version,
        protocolVersion: info.protocolVersion,
      };
      this.options.onStatusChange?.(status);
      return status;
    } catch (error) {
      const message = describeError(error);
      this.errors.set(config.id, message);
      const status: McpServerStatus = {
        id: config.id,
        connected: false,
        toolCount: 0,
        resourceCount: 0,
        promptCount: 0,
        error: message,
      };
      this.options.onStatusChange?.(status);
      return status;
    }
  }

  async connectEnabled(configs: McpServerConfig[]): Promise<McpServerStatus[]> {
    const results: McpServerStatus[] = [];
    for (const config of configs) {
      if (!config.enabled) {
        const status: McpServerStatus = {
          id: config.id,
          connected: false,
          toolCount: 0,
          resourceCount: 0,
          promptCount: 0,
        };
        this.options.onStatusChange?.(status);
        results.push(status);
        continue;
      }
      results.push(await this.connect(config));
    }
    return results;
  }

  /** Bygger en ToolSpec som pekar på serverns eget verktygsnamn. */
  private registerRemoteTool(serverId: string, name: string, originalName: string): void {
    this.options.registry.register({
      spec: {
        name,
        description: `MCP-verktyg från ${serverId}`,
        parameters: { type: 'object' },
        danger: 'execute',
        source: 'mcp',
        origin: { server: serverId, originalName },
      },
      handler: null,
      remote: async (toolName, args, ctx) => this.callRemote(serverId, toolName, args, ctx),
    });
  }

  private async callRemote(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<Omit<ToolResult, 'callId' | 'name' | 'durationMs'>> {
    const server = this.servers.get(serverId);
    if (!server) return fail(`MCP-servern "${serverId}" är inte ansluten.`);
    if (!this.isApproved(serverId)) {
      const outcome = await ctx.requestApproval({
        kind: 'mcp',
        title: `Godkänn MCP-servern ${serverId}`,
        detail: toolName,
        reason: `MCP-servern är inte godkänd för den här sessionen${server.config.warnings.length > 0 ? `: ${server.config.warnings.join(' ')}` : '.'}`,
        risk: 'high',
        hardBlock: true,
      });
      if (!outcome.approved) return fail('Användaren godkände inte MCP-servern.');
      this.approve(serverId);
    }

    const originalName = this.options.registry.get(toolName)?.spec.origin?.originalName ?? toolName;
    try {
      const result = await server.client.callTool(originalName, args);
      return result.ok ? ok(result.content, result.data) : fail(result.content, result.data);
    } catch (error) {
      return fail(`MCP-anropet misslyckades: ${describeError(error)}`);
    }
  }

  async listResources(serverId: string): Promise<unknown[]> {
    const server = this.servers.get(serverId);
    if (!server) return [];
    return server.client.listResources().catch(() => []);
  }

  async listPrompts(serverId: string): Promise<unknown[]> {
    const server = this.servers.get(serverId);
    if (!server) return [];
    return server.client.listPrompts().catch(() => []);
  }

  /** Läser en resurs som text – användbart för att lägga in den i kontexten. */
  async readResource(serverId: string, uri: string): Promise<string> {
    const server = this.servers.get(serverId);
    if (!server) return '';
    const contents = await server.client.readResource(uri).catch(() => []);
    return contents
      .map(
        (entry) =>
          entry.text ?? (entry.blob ? `[binär resurs: ${entry.mimeType ?? 'okänd typ'}]` : ''),
      )
      .filter(Boolean)
      .join('\n');
  }

  async disconnect(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    this.options.registry.removeWhere(
      (spec) => spec.source === 'mcp' && spec.origin?.server === serverId,
    );
    if (!server) return;
    this.servers.delete(serverId);
    await server.client.close().catch(() => undefined);
  }

  async disconnectAll(): Promise<void> {
    for (const id of [...this.servers.keys()]) await this.disconnect(id);
  }
}

export type { McpServerInfo };
