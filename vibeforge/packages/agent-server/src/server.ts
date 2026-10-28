import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { describeError } from '@vibeforge/agent-core';
import { createRoutes, type RouteContext } from './routes.js';
import type { AgentSessionHub } from './sessionHub.js';

export interface AgentServerOptions {
  hub: AgentSessionHub;
  host?: string;
  port?: number;
  /** Dev-läge: /api/dev-token får lämna ut token till loopback-klienter. */
  devMode?: boolean;
  allowedOrigins?: string[];
  token?: string;
}

export interface AgentServerHandle {
  server: http.Server;
  url: string;
  port: number;
  token: string;
  close(): Promise<void>;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const MAX_BODY_BYTES = 32 * 1024 * 1024;

/** Hämtar (eller skapar) åtkomsttoken. Ligger utanför git och läses bara av ägaren. */
export function loadOrCreateToken(home: string, provided?: string): string {
  if (provided && provided.trim() !== '') return provided.trim();
  const file = path.join(home, 'token');
  try {
    const existing = fs.readFileSync(file, 'utf8').trim();
    if (existing.length >= 32) return existing;
  } catch {
    // Ingen token ännu.
  }
  const token = crypto.randomBytes(32).toString('hex');
  fs.mkdirSync(home, { recursive: true });
  fs.writeFileSync(file, `${token}\n`, { mode: 0o600 });
  return token;
}

function isLoopback(address: string | undefined): boolean {
  if (!address) return false;
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

function isAllowedOrigin(origin: string): boolean {
  if (
    origin === 'tauri://localhost' ||
    origin === 'https://tauri.localhost' ||
    origin === 'http://tauri.localhost'
  ) {
    return true;
  }
  try {
    const url = new URL(origin);
    return url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]';
  } catch {
    return false;
  }
}

/** Token skickas i det nya namnet; det gamla läses fortfarande för äldre klienters skull. */
const TOKEN_HEADERS = ['x-freevobe-token', 'x-vibeforge-token'] as const;
const ALLOWED_HEADERS = ['content-type', ...TOKEN_HEADERS].join(', ');

function presentedToken(headers: http.IncomingHttpHeaders): string | undefined {
  for (const name of TOKEN_HEADERS) {
    const value = headers[name];
    if (typeof value === 'string') return value;
  }
  return undefined;
}

/**
 * Freevobe-agenten som lokal HTTP-server. Lyssnar bara på 127.0.0.1, kräver en token i
 * headern och avvisar anrop från andra origins – så att en godtycklig sida i webbläsaren inte
 * kan prata med agenten. Ingen telemetri, ingen extern trafik.
 */
export async function startAgentServer(options: AgentServerOptions): Promise<AgentServerHandle> {
  const host = options.host ?? '127.0.0.1';
  const requestedPort = options.port ?? 4319;
  const devMode = options.devMode ?? false;
  const token = loadOrCreateToken(options.hub.home, options.token);
  const routes = createRoutes({ port: requestedPort, devMode });

  const server = http.createServer((request, response) => {
    void handle(request, response).catch((error) => {
      if (!response.writableEnded) {
        response.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
        response.end(
          JSON.stringify({
            ok: false,
            error: { code: 'internal_error', message: describeError(error) },
          }),
        );
      }
    });
  });

  let actualPort = requestedPort;

  async function handle(
    request: http.IncomingMessage,
    response: http.ServerResponse,
  ): Promise<void> {
    const url = new URL(
      request.url ?? '/',
      `http://${request.headers.host ?? `${host}:${actualPort}`}`,
    );
    const method = request.method ?? 'GET';
    const origin = request.headers.origin;

    const allowedOrigin = origin && isAllowedOrigin(origin) ? origin : 'http://127.0.0.1';

    /**
     * Alla svar får CORS-huvudena, annars blockerar webbläsaren svaret även om
     * förfrågan gick igenom – och då ser gränssnittet bara "Failed to fetch".
     */
    const send = (status: number, payload: unknown): void => {
      const body = JSON.stringify(payload);
      response.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'content-length': Buffer.byteLength(body),
        'access-control-allow-origin': allowedOrigin,
        'access-control-allow-headers': ALLOWED_HEADERS,
        vary: 'origin',
      });
      response.end(body);
    };

    const readBody = async (): Promise<unknown> => {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of request) {
        const buffer = chunk as Buffer;
        size += buffer.length;
        if (size > MAX_BODY_BYTES) throw new Error('Begäran är för stor.');
        chunks.push(buffer);
      }
      if (chunks.length === 0) return {};
      const text = Buffer.concat(chunks).toString('utf8');
      if (text.trim() === '') return {};
      try {
        return JSON.parse(text);
      } catch {
        throw new Error('Begäran innehåller ogiltig JSON.');
      }
    };

    if (method === 'OPTIONS') {
      response.writeHead(204, {
        'access-control-allow-origin': allowedOrigin,
        'access-control-allow-headers': ALLOWED_HEADERS,
        'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      });
      response.end();
      return;
    }

    // 1. Skydd mot andra sidor i webbläsaren (CSRF / DNS-rebinding).
    if (origin && !SAFE_METHODS.has(method) && !isAllowedOrigin(origin)) {
      send(403, {
        ok: false,
        error: { code: 'forbidden_origin', message: `Anrop från ${origin} tillåts inte.` },
      });
      return;
    }

    const context = (overrides: Partial<RouteContext> = {}): RouteContext => ({
      hub: options.hub,
      url,
      method,
      params: {},
      body: readBody,
      stream: () => undefined,
      ...overrides,
    });

    // 2. Öppna vägar: hälsokontroll och (endast i dev) token till loopback-klienter.
    const healthRoute = routes.find(
      (entry) => entry.method === 'GET' && entry.pattern.test('/api/health'),
    );
    if (url.pathname === '/api/health') {
      send(200, { ok: true, data: await healthRoute?.handler(context()) });
      return;
    }

    if (url.pathname === '/api/dev-token') {
      if (!devMode || !isLoopback(request.socket.remoteAddress)) {
        send(404, { ok: false, error: { code: 'not_found', message: 'Sidan finns inte.' } });
        return;
      }
      send(200, { ok: true, data: { token, port: actualPort } });
      return;
    }

    // 3. Token krävs för allt annat. Nya namnet är x-freevobe-token; det gamla accepteras
    // fortfarande eftersom äldre klienter och dokumentation använder det.
    if (presentedToken(request.headers) !== token) {
      send(401, {
        ok: false,
        error: { code: 'unauthorized', message: 'Ogiltig eller saknad token.' },
      });
      return;
    }

    const match = routes.find(
      (entry) => entry.method === method && entry.pattern.test(url.pathname),
    );
    if (!match) {
      send(404, {
        ok: false,
        error: { code: 'not_found', message: `Ingen väg för ${method} ${url.pathname}` },
      });
      return;
    }

    const executed = match.pattern.exec(url.pathname);
    const params: Record<string, string> = {};
    match.keys.forEach((key, index) => {
      params[key] = decodeURIComponent(executed?.[index + 1] ?? '');
    });

    // 4. Händelseströmmen (SSE) håller anslutningen öppen och avslutas när körningen är klar.
    const isEvents = url.pathname.startsWith('/api/runs/') && url.pathname.endsWith('/events');
    if (isEvents) {
      response.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
        'access-control-allow-origin': allowedOrigin,
        vary: 'origin',
      });

      let stopSubscription: () => void = () => undefined;
      const sseContext = context({
        params,
        stream: (start, stop) => {
          start((chunk) => {
            if (!response.writableEnded) response.write(chunk);
          });
          stopSubscription = stop;
          request.on('close', () => {
            stop();
            if (!response.writableEnded) response.end();
          });
        },
      });

      try {
        await match.handler(sseContext);
      } catch (error) {
        if (!response.writableEnded) {
          response.write(
            `event: error\ndata: ${JSON.stringify({ message: describeError(error) })}\n\n`,
          );
        }
      }
      void stopSubscription;
      return;
    }

    try {
      const result = await match.handler(context({ params }));
      send(200, { ok: true, data: result ?? null });
    } catch (error) {
      send(400, { ok: false, error: { code: 'request_failed', message: describeError(error) } });
    }
  }

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(requestedPort, host, () => {
      actualPort = (server.address() as AddressInfo).port;
      resolve();
    });
  });

  return {
    server,
    url: `http://${host}:${actualPort}`,
    port: actualPort,
    token,
    async close() {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
