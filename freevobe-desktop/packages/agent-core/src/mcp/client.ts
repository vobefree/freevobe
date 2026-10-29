import type { ToolSpec } from '@freevobe/protocol';
import {
  McpProtocolError,
  MCP_CLIENT_INFO,
  MCP_PROTOCOL_VERSIONS,
  asJsonSchema,
  contentToText,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type McpInitializeResult,
  type McpPromptDefinition,
  type McpPromptResult,
  type McpResourceContents,
  type McpResourceDefinition,
  type McpToolCallResult,
  type McpToolDefinition,
  type McpTransport,
} from './types.js';

export interface McpClientOptions {
  serverId: string;
  transport: McpTransport;
  /** Tidsgräns per JSON-RPC-anrop. */
  requestTimeoutMs?: number;
  onLog?: (line: string) => void;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
  method: string;
}

export interface McpServerInfo {
  name: string;
  version: string;
  protocolVersion: string;
  capabilities: string[];
}

/**
 * Minimal men komplett MCP-klient. Den gör handskakning med versionsförhandling (äldre
 * servrar använder `initialize`, nyare versioner kan svara med en annan version), och
 * exponerar verktyg, resurser och prompts.
 */
export class McpClient {
  readonly serverId: string;
  private readonly options: McpClientOptions;
  private readonly pending = new Map<number, PendingRequest>();
  private nextId = 1;
  private connected = false;
  private serverInfo: McpServerInfo | null = null;
  private readonly logs: string[] = [];

  constructor(options: McpClientOptions) {
    this.options = options;
    this.serverId = options.serverId;
  }

  get transportLabel(): string {
    return this.options.transport.label;
  }

  get info(): McpServerInfo | null {
    return this.serverInfo;
  }

  get recentLogs(): string[] {
    return [...this.logs];
  }

  async connect(): Promise<McpServerInfo> {
    const transport = this.options.transport;
    transport.onMessage((message) => this.handleMessage(message));
    transport.onError((error) => {
      this.log(`fel: ${error.message}`);
      for (const [id, entry] of [...this.pending.entries()]) {
        this.pending.delete(id);
        clearTimeout(entry.timer);
        entry.reject(error);
      }
    });
    transport.onClose(() => {
      this.log('anslutningen stängdes');
      this.connected = false;
      // Väntande anrop kan aldrig besvaras när processen är borta – avvisa dem direkt.
      this.rejectPending(new McpProtocolError(`MCP-servern "${this.serverId}" stängdes.`, -32001));
    });

    await transport.start();

    let lastError: Error | null = null;
    for (const version of MCP_PROTOCOL_VERSIONS) {
      try {
        const result = (await this.request('initialize', {
          protocolVersion: version,
          capabilities: { roots: { listChanged: false }, sampling: {} },
          clientInfo: { ...MCP_CLIENT_INFO },
        })) as McpInitializeResult;

        this.serverInfo = {
          name: result.serverInfo?.name ?? this.serverId,
          version: result.serverInfo?.version ?? 'okänd',
          protocolVersion: result.protocolVersion ?? version,
          capabilities: Object.keys(result.capabilities ?? {}),
        };
        if (
          'setProtocolVersion' in transport &&
          typeof transport.setProtocolVersion === 'function'
        ) {
          (transport as { setProtocolVersion: (value: string) => void }).setProtocolVersion(
            this.serverInfo.protocolVersion,
          );
        }
        await this.notify('notifications/initialized');
        this.connected = true;
        this.log(
          `ansluten till ${this.serverInfo.name} ${this.serverInfo.version} (${this.serverInfo.protocolVersion})`,
        );
        return this.serverInfo;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    throw (
      lastError ??
      new McpProtocolError('Kunde inte förhandla fram en protokollversion med MCP-servern.')
    );
  }

  async listTools(): Promise<ToolSpec[]> {
    this.assertConnected();
    const result = (await this.request('tools/list', {})) as { tools?: McpToolDefinition[] };
    const tools = result.tools ?? [];
    return tools.map((tool) => ({
      name: `mcp__${this.serverId}__${tool.name}`,
      description: tool.description?.trim() || `MCP-verktyg ${tool.name} från ${this.serverId}`,
      parameters: asJsonSchema(tool.inputSchema) as ToolSpec['parameters'],
      danger: 'execute' as const,
      source: 'mcp' as const,
      origin: { server: this.serverId, originalName: tool.name },
    }));
  }

  async callTool(
    originalName: string,
    args: Record<string, unknown>,
  ): Promise<{ ok: boolean; content: string; data?: Record<string, unknown> }> {
    this.assertConnected();
    const result = (await this.request('tools/call', {
      name: originalName,
      arguments: args,
    })) as McpToolCallResult;
    return {
      ok: result.isError !== true,
      content: contentToText(result.content),
      ...(result.structuredContent
        ? { data: { structuredContent: result.structuredContent as Record<string, unknown> } }
        : {}),
    };
  }

  async listResources(): Promise<McpResourceDefinition[]> {
    this.assertConnected();
    const result = (await this.request('resources/list', {})) as {
      resources?: McpResourceDefinition[];
    };
    return result.resources ?? [];
  }

  async readResource(uri: string): Promise<McpResourceContents[]> {
    this.assertConnected();
    const result = (await this.request('resources/read', { uri })) as {
      contents?: McpResourceContents[];
    };
    return result.contents ?? [];
  }

  async listPrompts(): Promise<McpPromptDefinition[]> {
    this.assertConnected();
    const result = (await this.request('prompts/list', {})) as { prompts?: McpPromptDefinition[] };
    return result.prompts ?? [];
  }

  async getPrompt(name: string, args: Record<string, string> = {}): Promise<McpPromptResult> {
    this.assertConnected();
    return (await this.request('prompts/get', { name, arguments: args })) as McpPromptResult;
  }

  async close(): Promise<void> {
    this.rejectPending(new Error('Anslutningen stängdes.'));
    this.connected = false;
    await this.options.transport.close();
  }

  private rejectPending(error: Error): void {
    for (const [id, entry] of [...this.pending.entries()]) {
      this.pending.delete(id);
      clearTimeout(entry.timer);
      entry.reject(error);
    }
  }

  private assertConnected(): void {
    if (!this.connected)
      throw new McpProtocolError(`MCP-servern "${this.serverId}" är inte ansluten.`);
  }

  private request(method: string, params: Record<string, unknown>): Promise<unknown> {
    const id = this.nextId;
    this.nextId += 1;
    const message: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new McpProtocolError(`Tidsgränsen nåddes för ${method} mot ${this.serverId}.`));
      }, this.options.requestTimeoutMs ?? 30_000);

      this.pending.set(id, { resolve, reject, timer, method });
      void this.options.transport.send(message).catch((error: unknown) => {
        const entry = this.pending.get(id);
        if (entry) {
          this.pending.delete(id);
          clearTimeout(entry.timer);
        }
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    });
  }

  private async notify(method: string, params?: Record<string, unknown>): Promise<void> {
    await this.options.transport.send(
      params ? { jsonrpc: '2.0', method, params } : { jsonrpc: '2.0', method },
    );
  }

  private handleMessage(message: JsonRpcResponse): void {
    if (!('id' in message) || message.id === null) return;
    const entry = this.pending.get(Number(message.id));
    if (!entry) return;
    this.pending.delete(Number(message.id));
    clearTimeout(entry.timer);

    if ('error' in message) {
      entry.reject(
        new McpProtocolError(`${entry.method}: ${message.error.message}`, message.error.code),
      );
      return;
    }
    entry.resolve(message.result);
  }

  private log(line: string): void {
    this.logs.push(line);
    if (this.logs.length > 100) this.logs.shift();
    this.options.onLog?.(line);
  }
}
