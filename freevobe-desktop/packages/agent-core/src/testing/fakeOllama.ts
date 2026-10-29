import http from 'node:http';
import type { AddressInfo } from 'node:net';

export interface FakeToolCall {
  id?: string;
  name: string;
  args: Record<string, unknown>;
}

export interface FakeTurn {
  content?: string;
  reasoning?: string;
  toolCalls?: FakeToolCall[];
  /** Delar upp content i flera SSE-chunks (testar strömning). */
  splitEvery?: number;
  /** Simulerar att modellen inte kan tool calling och skriver anropet i texten i stället. */
  textual?: boolean;
}

export interface FakeModel {
  name: string;
  size?: number;
  parameterSize?: string;
  quantization?: string;
  family?: string;
  contextLength?: number;
  supportsTools?: boolean;
}

export interface RecordedChatRequest {
  path: string;
  body: Record<string, unknown>;
}

export interface FakeOllamaOptions {
  version?: string;
  models?: FakeModel[];
  turns?: FakeTurn[];
  /** Sant → chatt-endpointen svarar 503 (testar felvägen). */
  chatFails?: boolean;
  /** Sant → /api/tags blockerar i `hangMs` millisekunder (testar timeouts). */
  hangMs?: number;
  /** Fördröjer första byten på chatten, som när Ollama laddar in modellen (testar tidsgränser). */
  chatDelayMs?: number;
}

export interface FakeOllamaHandle {
  url: string;
  port: number;
  requests: RecordedChatRequest[];
  /** Sätter nya turer under körning. */
  setTurns(turns: FakeTurn[]): void;
  close(): Promise<void>;
}

const DEFAULT_MODELS: FakeModel[] = [
  {
    name: 'deepseek-r1:8b',
    size: 5_225_376_047,
    parameterSize: '8.2B',
    family: 'qwen3',
    contextLength: 131_072,
    supportsTools: true,
  },
  {
    name: 'qwen2.5-coder:1.5b',
    size: 986_000_000,
    parameterSize: '1.5B',
    family: 'qwen2',
    contextLength: 32_768,
    supportsTools: false,
  },
];

function readBody(request: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', () => resolve(''));
  });
}

/**
 * En liten HTTP-server som uppför sig som Ollama. Används av enhets- och E2E-tester så att
 * Freevobe kan verifieras utan att en riktig modell är installerad.
 */
export async function startFakeOllama(options: FakeOllamaOptions = {}): Promise<FakeOllamaHandle> {
  const models = options.models ?? DEFAULT_MODELS;
  let turns = options.turns ?? [];
  let turnIndex = 0;
  const requests: RecordedChatRequest[] = [];

  const server = http.createServer((request, response) => {
    void (async () => {
      const raw = await readBody(request);
      const parsedBody = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      const path = request.url ?? '/';

      if (options.hangMs && path === '/api/tags') {
        await new Promise((resolve) => setTimeout(resolve, options.hangMs));
      }

      if (path === '/api/version') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ version: options.version ?? '0.5.0-fake' }));
        return;
      }

      if (path === '/api/tags') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(
          JSON.stringify({
            models: models.map((model) => ({
              name: model.name,
              model: model.name,
              size: model.size ?? 1_000_000,
              modified_at: '2026-10-27T10:00:00Z',
              details: {
                parameter_size: model.parameterSize ?? '1B',
                quantization_level: model.quantization ?? 'Q4_K_M',
                family: model.family ?? 'qwen2',
              },
            })),
          }),
        );
        return;
      }

      if (path === '/api/show') {
        const model = models.find((entry) => entry.name === parsedBody.model);
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(
          JSON.stringify({
            details: {
              parameter_size: model?.parameterSize ?? '1B',
              quantization_level: model?.quantization ?? 'Q4_K_M',
              family: model?.family ?? 'qwen2',
            },
            capabilities: model?.supportsTools === false ? ['completion'] : ['completion', 'tools'],
            model_info: { 'qwen3.context_length': model?.contextLength ?? 8192 },
          }),
        );
        return;
      }

      if (path === '/v1/chat/completions') {
        requests.push({ path, body: parsedBody });
        if (options.chatFails) {
          response.writeHead(503, { 'content-type': 'application/json' });
          response.end(JSON.stringify({ error: { message: 'modellen är inte laddad' } }));
          return;
        }

        const turn = turns[turnIndex] ?? turns[turns.length - 1] ?? { content: 'klart' };
        turnIndex += 1;

        if (options.chatDelayMs) {
          await new Promise((resolve) => setTimeout(resolve, options.chatDelayMs));
        }

        response.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
        });

        const emit = (payload: unknown) => response.write(`data: ${JSON.stringify(payload)}\n\n`);

        if (turn.reasoning) {
          emit({ choices: [{ index: 0, delta: { reasoning_content: turn.reasoning } }] });
        }

        if (turn.content) {
          const size =
            turn.splitEvery && turn.splitEvery > 0 ? turn.splitEvery : turn.content.length;
          for (let offset = 0; offset < turn.content.length; offset += size) {
            emit({
              choices: [
                { index: 0, delta: { content: turn.content.slice(offset, offset + size) } },
              ],
            });
          }
        }

        (turn.toolCalls ?? []).forEach((call, index) => {
          const args = JSON.stringify(call.args ?? {});
          emit({
            choices: [
              {
                index: 0,
                delta: {
                  tool_calls: [
                    {
                      index,
                      id: call.id ?? `call_${index}`,
                      type: 'function',
                      function: { name: call.name, arguments: '' },
                    },
                  ],
                },
              },
            ],
          });
          // Argumenten skickas i två fragment, precis som en riktig modell kan göra.
          const middle = Math.max(1, Math.floor(args.length / 2));
          for (const fragment of [args.slice(0, middle), args.slice(middle)]) {
            emit({
              choices: [
                {
                  index: 0,
                  delta: { tool_calls: [{ index, function: { arguments: fragment } }] },
                },
              ],
            });
          }
        });

        emit({
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: (turn.toolCalls ?? []).length > 0 ? 'tool_calls' : 'stop',
            },
          ],
          usage: { prompt_tokens: 120, completion_tokens: 24 },
        });
        response.write('data: [DONE]\n\n');
        response.end();
        return;
      }

      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'not found' }));
    })().catch(() => {
      response.writeHead(500);
      response.end();
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;

  return {
    url: `http://127.0.0.1:${port}`,
    port,
    requests,
    setTurns(next) {
      turns = next;
      turnIndex = 0;
    },
    async close() {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
