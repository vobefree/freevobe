import type { AgentEvent } from '@freevobe/protocol';

declare global {
  interface Window {
    __FREEVOBE_BOOTSTRAP__?: { token?: string; baseUrl?: string } | null;
  }
}

const TOKEN_KEY = 'freevobe.token';
const BASE_URL_KEY = 'freevobe.baseUrl';

export interface AgentConnection {
  baseUrl: string;
  token: string;
  source: 'tauri' | 'stored' | 'dev';
}

export interface ApiError {
  code: string;
  message: string;
}

export class AgentRequestError extends Error {
  readonly code: string;

  constructor(error: ApiError) {
    super(error.message);
    this.name = 'AgentRequestError';
    this.code = error.code;
  }
}

/**
 * Token skickas under ett enda namn. Skrivbordet, mobilappen och webbläsarläget använder samma
 * huvud och servern läser bara det.
 */
function tokenHeaders(token: string): Record<string, string> {
  return { 'x-freevobe-token': token };
}

/** Var agenten kör. I Tauri injiceras adressen; i webbläsarläge används env eller standardport. */
export function resolveAgentBaseUrl(): string {
  const bootstrap = window.__FREEVOBE_BOOTSTRAP__;
  if (bootstrap?.baseUrl) return bootstrap.baseUrl.replace(/\/$/, '');
  const stored = window.localStorage.getItem(BASE_URL_KEY);
  if (stored) return stored.replace(/\/$/, '');
  const fromEnv = import.meta.env.VITE_FREEVOBE_AGENT_URL as string | undefined;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  return (__FREEVOBE_DEFAULT_AGENT_URL__ || 'http://127.0.0.1:4319').replace(/\/$/, '');
}

/**
 * Hämtar åtkomsttoken. Ordning: Tauri-skalet, tidigare sparad token, och i utvecklingsläge
 * den lokala dev-endpointen. Ingen token skickas någon annanstans än till 127.0.0.1.
 */
export async function resolveConnection(): Promise<AgentConnection> {
  const baseUrl = resolveAgentBaseUrl();

  const injected = window.__FREEVOBE_BOOTSTRAP__?.token;
  if (injected) {
    window.localStorage.setItem(TOKEN_KEY, injected);
    return { baseUrl, token: injected, source: 'tauri' };
  }

  const stored = window.localStorage.getItem(TOKEN_KEY);
  if (stored) return { baseUrl, token: stored, source: 'stored' };

  const response = await fetch(`${baseUrl}/api/dev-token`);
  if (!response.ok) {
    throw new AgentRequestError({
      code: 'no_token',
      message:
        'Ingen åtkomsttoken hittades. Starta Freevobe-agenten (npm run dev:server) eller öppna appen från skrivbordsversionen.',
    });
  }
  const payload = (await response.json()) as { data?: { token?: string } };
  const token = payload.data?.token;
  if (!token) {
    throw new AgentRequestError({ code: 'no_token', message: 'Agenten svarade utan token.' });
  }
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(BASE_URL_KEY, baseUrl);
  return { baseUrl, token, source: 'dev' };
}

export interface AgentClientOptions {
  connection: AgentConnection;
}

/** Tunn klient mot den lokala agenten. Varje anrop går till 127.0.0.1 med token i headern. */
export class AgentClient {
  readonly baseUrl: string;
  readonly token: string;

  constructor(options: AgentClientOptions) {
    this.baseUrl = options.connection.baseUrl;
    this.token = options.connection.token;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { 'content-type': 'application/json', ...tokenHeaders(this.token), ...extra };
  }

  /** Hämtar en binärfil (media) med token i huvudet. Blob-URL:er används i gränssnittet. */
  async blob(path: string): Promise<Blob> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, { headers: tokenHeaders(this.token) });
    } catch (error) {
      throw new AgentRequestError({
        code: 'unreachable',
        message: `Kan inte nå Freevobe-agenten på ${this.baseUrl}. Starta den med "npm run dev:server". (${error instanceof Error ? error.message : String(error)})`,
      });
    }
    if (!response.ok) {
      throw new AgentRequestError({
        code: 'request_failed',
        message: `Filen kunde inte hämtas (${response.status}).`,
      });
    }
    return response.blob();
  }

  async request<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers: this.headers(),
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      });
    } catch (error) {
      throw new AgentRequestError({
        code: 'unreachable',
        message: `Kan inte nå Freevobe-agenten på ${this.baseUrl}. Starta den med "npm run dev:server". (${error instanceof Error ? error.message : String(error)})`,
      });
    }

    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean;
      data?: T;
      error?: ApiError;
    } | null;

    if (!response.ok || payload?.ok === false) {
      throw new AgentRequestError(
        payload?.error ?? {
          code: `http_${response.status}`,
          message: `Agenten svarade ${response.status}.`,
        },
      );
    }
    return (payload?.data ?? (payload as unknown)) as T;
  }

  get = <T>(path: string) => this.request<T>(path);
  post = <T>(path: string, body?: unknown) =>
    this.request<T>(path, { method: 'POST', body: body ?? {} });
  put = <T>(path: string, body?: unknown) =>
    this.request<T>(path, { method: 'PUT', body: body ?? {} });
  patch = <T>(path: string, body?: unknown) =>
    this.request<T>(path, { method: 'PATCH', body: body ?? {} });
  del = <T>(path: string) => this.request<T>(path, { method: 'DELETE' });

  /**
   * Prenumererar på händelser för en körning. Använder fetch i stället för EventSource,
   * eftersom token måste skickas som header.
   */
  /** Strömmar ett POST-svar som SSE, t.ex. modellhämtningens framsteg. */
  async streamPost(
    path: string,
    body: unknown,
    onEvent: (name: string, data: unknown) => void,
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { ...this.headers(), accept: 'text/event-stream' },
      body: JSON.stringify(body),
    });
    if (!response.ok || !response.body) {
      throw new AgentRequestError({
        code: `http_${response.status}`,
        message: `Agenten svarade ${response.status}.`,
      });
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const flush = (block: string) => {
      let name = 'message';
      const data: string[] = [];
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) name = line.slice(6).trim();
        else if (line.startsWith('data:')) data.push(line.slice(5).trim());
      }
      if (data.length === 0) return;
      try {
        onEvent(name, JSON.parse(data.join('')) as unknown);
      } catch {
        // En trasig rad ska inte tappa hela strömmen.
      }
    };

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let separator = buffer.indexOf('\n\n');
      while (separator !== -1) {
        flush(buffer.slice(0, separator));
        buffer = buffer.slice(separator + 2);
        separator = buffer.indexOf('\n\n');
      }
    }
    if (buffer.trim() !== '') flush(buffer);
  }

  subscribe(runId: string, onEvent: (event: AgentEvent) => void, onDone?: () => void): () => void {
    const controller = new AbortController();
    let stopped = false;

    void (async () => {
      try {
        const response = await fetch(`${this.baseUrl}/api/runs/${runId}/events`, {
          headers: { ...tokenHeaders(this.token), accept: 'text/event-stream' },
          signal: controller.signal,
        });
        if (!response.body) throw new Error('Ingen händelseström från agenten.');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let separator = buffer.indexOf('\n\n');
          while (separator !== -1) {
            const chunk = buffer.slice(0, separator);
            buffer = buffer.slice(separator + 2);
            separator = buffer.indexOf('\n\n');
            const data = chunk
              .split('\n')
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.slice(5).trim())
              .join('');
            if (data.startsWith('{')) {
              try {
                onEvent(JSON.parse(data) as AgentEvent);
              } catch {
                // Ignorera enstaka trasiga händelser i stället för att tappa strömmen.
              }
            }
          }
        }
      } catch (error) {
        if (!stopped && (error as Error).name !== 'AbortError') {
          onEvent({
            type: 'error',
            runId,
            code: 'transport_error',
            message: `Tappade kontakten med agenten: ${(error as Error).message}`,
          });
        }
      } finally {
        if (!stopped) onDone?.();
      }
    })();

    return () => {
      stopped = true;
      controller.abort();
      onDone?.();
    };
  }
}

declare const __FREEVOBE_DEFAULT_AGENT_URL__: string;
