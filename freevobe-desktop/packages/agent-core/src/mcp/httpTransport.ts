import { StdioTransport } from './stdioTransport.js';
import type {
  JsonRpcNotification,
  JsonRpcRequest,
  JsonRpcResponse,
  McpTransport,
} from './types.js';

export interface HttpTransportOptions {
  url: string;
  headers?: Record<string, string>;
  /** Anslutningens tidsgräns per anrop. */
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Strömbar HTTP-transport: en POST-endpoint som svarar med antingen JSON eller en SSE-ström
 * för det aktuella anropet. Servern kan skicka tillbaka en sessions-id som vi måste upprepa.
 */
export class StreamableHttpTransport implements McpTransport {
  readonly label: string;
  private readonly options: HttpTransportOptions;
  private sessionId: string | null = null;
  private protocolVersion: string | null = null;
  private messageHandler: ((message: JsonRpcResponse) => void) | null = null;
  private errorHandler: ((error: Error) => void) | null = null;
  private closeHandler: (() => void) | null = null;

  constructor(options: HttpTransportOptions) {
    this.options = options;
    this.label = `http:${options.url}`;
  }

  setProtocolVersion(version: string): void {
    this.protocolVersion = version;
  }

  async start(): Promise<void> {
    // Ingen separat anslutning: varje anrop är ett POST.
  }

  async send(message: JsonRpcRequest | JsonRpcNotification): Promise<void> {
    const fetchImpl = this.options.fetchImpl ?? globalThis.fetch;
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(this.options.headers ?? {}),
    };
    if (this.sessionId) headers['mcp-session-id'] = this.sessionId;
    if (this.protocolVersion) headers['mcp-protocol-version'] = this.protocolVersion;

    const response = await fetchImpl(this.options.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(this.options.timeoutMs ?? 30_000),
    });

    const sessionHeader = response.headers.get('mcp-session-id');
    if (sessionHeader) this.sessionId = sessionHeader;

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `MCP-servern svarade ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`,
      );
    }

    // Notifikationer kan besvaras med 202 utan innehåll.
    if (response.status === 202 || response.status === 204) return;

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('text/event-stream')) {
      for await (const payload of iterateSse(response)) {
        this.deliver(payload);
      }
      return;
    }

    const text = await response.text();
    if (text.trim() !== '') this.deliver(text);
  }

  private deliver(text: string): void {
    try {
      const parsed = JSON.parse(text) as JsonRpcResponse;
      this.messageHandler?.(parsed);
    } catch {
      this.errorHandler?.(new Error(`Kunde inte tolka MCP-svaret: ${text.slice(0, 200)}`));
    }
  }

  onMessage(handler: (message: JsonRpcResponse) => void): void {
    this.messageHandler = handler;
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandler = handler;
  }

  onClose(handler: () => void): void {
    this.closeHandler = handler;
  }

  async close(): Promise<void> {
    this.closeHandler?.();
  }
}

/** Delar upp en SSE-ström i `data:`-payloads. Används av både HTTP- och SSE-transporten. */
export async function* iterateSse(response: Response): AsyncGenerator<string> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let separator = buffer.indexOf('\n\n');
      while (separator !== -1) {
        const rawEvent = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);
        const data = rawEvent
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trim())
          .join('\n')
          .trim();
        if (data) yield data;
        separator = buffer.indexOf('\n\n');
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export type SseTransportOptions = HttpTransportOptions;

/**
 * Äldre HTTP+SSE-transport (protokoll 2024-11-05): en GET-ström där servern först skickar en
 * `endpoint`-händelse med adressen som klienten ska POST:a till.
 */
export class LegacySseTransport implements McpTransport {
  readonly label: string;
  private readonly options: SseTransportOptions;
  private readonly http: StreamableHttpTransport;
  private controller: AbortController | null = null;
  private endpoint: string | null = null;
  private messageHandler: ((message: JsonRpcResponse) => void) | null = null;
  private errorHandler: ((error: Error) => void) | null = null;
  private closeHandler: (() => void) | null = null;

  constructor(options: SseTransportOptions) {
    this.options = options;
    this.label = `sse:${options.url}`;
    this.http = new StreamableHttpTransport(options);
  }

  async start(): Promise<void> {
    const fetchImpl = this.options.fetchImpl ?? globalThis.fetch;
    this.controller = new AbortController();
    const response = await fetchImpl(this.options.url, {
      headers: { accept: 'text/event-stream', ...(this.options.headers ?? {}) },
      signal: this.controller.signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`Kunde inte ansluta till SSE-endpointen (${response.status}).`);
    }

    const base = new URL(this.options.url);
    void (async () => {
      try {
        for await (const payload of iterateSse(response)) {
          const text = payload.trim();
          if (text === '') continue;
          if (!text.startsWith('{')) {
            // `endpoint`-händelsen innehåller den relativa POST-adressen i klartext eller som JSON.
            const candidate = text.replace(/^endpoint\s*/, '').replace(/^"|"$/g, '');
            try {
              this.endpoint = new URL(candidate, base).toString();
            } catch {
              this.endpoint = candidate;
            }
            continue;
          }
          try {
            this.messageHandler?.(JSON.parse(text) as JsonRpcResponse);
          } catch {
            this.errorHandler?.(new Error(`Ogiltigt SSE-meddelande: ${text.slice(0, 200)}`));
          }
        }
      } catch (error) {
        if (!this.controller?.signal.aborted) {
          this.errorHandler?.(error instanceof Error ? error : new Error(String(error)));
        }
      }
    })();
  }

  async send(message: JsonRpcRequest | JsonRpcNotification): Promise<void> {
    const fetchImpl = this.options.fetchImpl ?? globalThis.fetch;
    const target = this.endpoint ?? this.options.url;
    const response = await fetchImpl(target, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(this.options.headers ?? {}) },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(this.options.timeoutMs ?? 30_000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `MCP-servern svarade ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`,
      );
    }
    if (response.status !== 202 && response.status !== 204) {
      const text = await response.text();
      if (text.trim().startsWith('{')) {
        try {
          this.messageHandler?.(JSON.parse(text) as JsonRpcResponse);
        } catch {
          // Svaret kan vara tomt – strömmen levererar ändå resultatet.
        }
      }
    }
  }

  onMessage(handler: (message: JsonRpcResponse) => void): void {
    this.messageHandler = handler;
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandler = handler;
  }

  onClose(handler: () => void): void {
    this.closeHandler = handler;
  }

  async close(): Promise<void> {
    this.controller?.abort();
    this.controller = null;
    await this.http.close();
    this.closeHandler?.();
  }
}

/** Väljer transport utifrån konfigurationen. */
export function createTransport(
  config: {
    transport: 'stdio' | 'http' | 'sse';
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    cwd?: string;
  },
  fetchImpl?: typeof fetch,
): McpTransport {
  if (config.transport === 'stdio') {
    if (!config.command) throw new Error('MCP-server med stdio kräver ett "command".');
    return new StdioTransport({
      command: config.command,
      ...(config.args ? { args: config.args } : {}),
      ...(config.env ? { env: config.env } : {}),
      ...(config.cwd ? { cwd: config.cwd } : {}),
    });
  }
  if (!config.url) throw new Error(`MCP-server med ${config.transport} kräver en "url".`);
  const options: HttpTransportOptions = { url: config.url, ...(fetchImpl ? { fetchImpl } : {}) };
  return config.transport === 'sse'
    ? new LegacySseTransport(options)
    : new StreamableHttpTransport(options);
}
