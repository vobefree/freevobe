import { spawn, type ChildProcess } from 'node:child_process';
import type {
  JsonRpcNotification,
  JsonRpcRequest,
  JsonRpcResponse,
  McpTransport,
} from './types.js';

export interface StdioTransportOptions {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  /** Tidsgräns för att servern ska skriva något alls efter start. */
  startupTimeoutMs?: number;
}

/**
 * Startar MCP-servern som ett barn­process och pratar JSON-RPC över stdin/stdout:
 * ett meddelande per rad, inga inbäddade radbrytningar. Serverns stderr loggas vidare
 * men tolkas aldrig som protokoll.
 */
function needsShell(command: string): boolean {
  if (process.platform !== 'win32') return false;
  if (command.includes('/') || command.includes('\\')) return false;
  return !/\.exe$/i.test(command);
}

export class StdioTransport implements McpTransport {
  readonly label: string;
  private readonly options: StdioTransportOptions;
  private child: ChildProcess | null = null;
  private buffer = '';
  private messageHandler: ((message: JsonRpcResponse) => void) | null = null;
  private errorHandler: ((error: Error) => void) | null = null;
  private closeHandler: (() => void) | null = null;
  private closed = false;

  constructor(options: StdioTransportOptions) {
    this.options = options;
    this.label = `stdio:${options.command}`;
  }

  get stderrText(): string {
    return this.stderr.join('');
  }

  private readonly stderr: string[] = [];

  async start(): Promise<void> {
    const child = spawn(this.options.command, this.options.args ?? [], {
      cwd: this.options.cwd,
      env: { ...process.env, ...(this.options.env ?? {}) },
      stdio: ['pipe', 'pipe', 'pipe'],
      // Ett absolut sökvägsnamn (t.ex. process.execPath) får aldrig gå genom skalet – mellanslag
      // i sökvägen skulle då bryta kommandot. Korta kommandon som "npx" behöver skalet på Windows.
      shell: needsShell(this.options.command),
      windowsHide: true,
    });
    this.child = child;

    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => this.consume(chunk));

    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk: string) => {
      this.stderr.push(chunk.slice(0, 4_000));
      if (this.stderr.length > 20) this.stderr.shift();
    });

    child.on('error', (error) => {
      this.closed = true;
      this.errorHandler?.(error);
      this.closeHandler?.();
    });
    child.on('close', () => {
      const wasClosed = this.closed;
      this.closed = true;
      if (!wasClosed) this.closeHandler?.();
    });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => resolve(), this.options.startupTimeoutMs ?? 1_500);
      child.once('spawn', () => {
        clearTimeout(timer);
        resolve();
      });
      child.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  async send(message: JsonRpcRequest | JsonRpcNotification): Promise<void> {
    if (!this.child?.stdin || this.closed) {
      throw new Error('MCP-servern körs inte.');
    }
    const payload = `${JSON.stringify(message)}\n`;
    await new Promise<void>((resolve, reject) => {
      this.child?.stdin?.write(payload, (error) => (error ? reject(error) : resolve()));
    });
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
    this.closed = true;
    const child = this.child;
    this.child = null;
    if (!child) return;
    child.stdin?.end();
    child.kill('SIGTERM');
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        resolve();
      }, 2_000);
      child.once('close', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  /** Radbrytningsseparerad JSON. Tål att flera meddelanden kommer i samma chunk. */
  private consume(chunk: string): void {
    this.buffer += chunk;
    let newline = this.buffer.indexOf('\n');
    while (newline !== -1) {
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (line !== '') {
        try {
          this.messageHandler?.(JSON.parse(line) as JsonRpcResponse);
        } catch {
          this.errorHandler?.(
            new Error(`Ogiltigt JSON-RPC-meddelande från MCP-servern: ${line.slice(0, 200)}`),
          );
        }
      }
      newline = this.buffer.indexOf('\n');
    }
  }
}
