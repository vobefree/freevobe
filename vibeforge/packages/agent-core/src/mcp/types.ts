/** Protokollversioner vi kan tala. Nyast först. Servern får svara med en annan den stödjer. */
export const MCP_PROTOCOL_VERSIONS = [
  '2025-11-25',
  '2025-06-18',
  '2025-03-26',
  '2024-11-05',
] as const;

export const MCP_CLIENT_INFO = { name: 'VibeForge', version: '0.1.0' } as const;

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcSuccess {
  jsonrpc: '2.0';
  id: number | string;
  result: unknown;
}

export interface JsonRpcFailure {
  jsonrpc: '2.0';
  id: number | string | null;
  error: { code: number; message: string; data?: unknown };
}

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcFailure;
export type JsonRpcMessage = JsonRpcRequest | JsonRpcNotification | JsonRpcResponse;

export interface McpInitializeResult {
  protocolVersion: string;
  capabilities?: Record<string, unknown>;
  serverInfo?: { name?: string; version?: string };
}

export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpContentBlock {
  type: string;
  text?: string;
  data?: string;
  mimeType?: string;
  uri?: string;
  resource?: { uri?: string; mimeType?: string; text?: string; blob?: string };
}

export interface McpToolCallResult {
  content?: McpContentBlock[];
  isError?: boolean;
  structuredContent?: unknown;
}

export interface McpResourceDefinition {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

export interface McpResourceContents {
  uri?: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

export interface McpPromptDefinition {
  name: string;
  description?: string;
  arguments?: { name: string; description?: string; required?: boolean }[];
}

export interface McpPromptResult {
  description?: string;
  messages?: { role: string; content: McpContentBlock | McpContentBlock[] }[];
}

/** Transportkontrakt. Tre implementationer: stdio, streamable HTTP och äldre HTTP+SSE. */
export interface McpTransport {
  readonly label: string;
  start(): Promise<void>;
  send(message: JsonRpcRequest | JsonRpcNotification): Promise<void>;
  onMessage(handler: (message: JsonRpcResponse) => void): void;
  onError(handler: (error: Error) => void): void;
  onClose(handler: () => void): void;
  close(): Promise<void>;
}

export class McpProtocolError extends Error {
  readonly code: number;

  constructor(message: string, code = -32000) {
    super(message);
    this.name = 'McpProtocolError';
    this.code = code;
  }
}

/** Gör en verktygstabell från MCP till VibeForges parametertyp. */
export function asJsonSchema(input: unknown): Record<string, unknown> {
  if (typeof input === 'object' && input !== null) {
    const record = input as Record<string, unknown>;
    if (record.type === 'object' || record.properties) return record;
  }
  return { type: 'object', properties: {} };
}

export function contentToText(blocks: McpContentBlock[] | undefined): string {
  if (!blocks || blocks.length === 0) return '(inget innehåll)';
  return blocks
    .map((block) => {
      if (block.type === 'text') return block.text ?? '';
      if (block.type === 'image') return `[bild: ${block.mimeType ?? 'okänd typ'}]`;
      if (block.type === 'resource') {
        const resource = block.resource;
        if (resource?.text) return resource.text;
        return `[resurs: ${resource?.uri ?? 'okänd'}]`;
      }
      return `[${block.type}]`;
    })
    .filter(Boolean)
    .join('\n');
}
