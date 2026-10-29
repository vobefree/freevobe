import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFakeOllama, type FakeOllamaHandle } from '../testing/fakeOllama.js';
import { OllamaClient } from './client.js';
import { ToolCallAccumulator, parseArguments, parseTextualToolCalls } from './openai.js';
import type { ChatChunk } from './types.js';
import { TransportError } from './types.js';

let fake: FakeOllamaHandle;

beforeAll(async () => {
  fake = await startFakeOllama({
    turns: [
      { content: 'Jag läser filen åt dig.', splitEvery: 4 },
      {
        toolCalls: [{ id: 'call_1', name: 'read_file', args: { path: 'src/index.ts' } }],
      },
    ],
  });
});

afterAll(async () => {
  await fake.close();
});

function collect(source: AsyncIterable<ChatChunk>): Promise<ChatChunk[]> {
  return (async () => {
    const chunks: ChatChunk[] = [];
    for await (const chunk of source) chunks.push(chunk);
    return chunks;
  })();
}

describe('OllamaClient.probe', () => {
  it('hämtar version och modeller med kontextlängd och tool-stöd', async () => {
    const client = new OllamaClient({ baseUrl: fake.url });
    const result = await client.probe();

    expect(result.available).toBe(true);
    expect(result.version).toBe('0.5.0-fake');
    expect(result.models.map((model) => model.name)).toEqual([
      'deepseek-r1:8b',
      'qwen2.5-coder:1.5b',
    ]);

    const deepseek = result.models.find((model) => model.name === 'deepseek-r1:8b');
    expect(deepseek?.contextLength).toBe(131_072);
    expect(deepseek?.parameterSize).toBe('8.2B');
    expect(deepseek?.supportsTools).toBe(true);

    const qwen = result.models.find((model) => model.name === 'qwen2.5-coder:1.5b');
    expect(qwen?.supportsTools).toBe(false);
  });

  it('rapporterar tydligt fel med hjälplänk när Ollama inte svarar', async () => {
    const client = new OllamaClient({ baseUrl: 'http://127.0.0.1:1', timeoutMs: 1_000 });
    const result = await client.probe();
    expect(result.available).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.helpUrl).toBe('https://freevobe.dev/docs/ollama');
  });
});

describe('OllamaClient.chat', () => {
  it('strömmar innehåll och sätter ihop tool call-fragment', async () => {
    const client = new OllamaClient({ baseUrl: fake.url });
    const content: string[] = [];
    const accumulator = new ToolCallAccumulator();
    let finish: string | undefined;

    for await (const chunk of client.chat({
      model: 'deepseek-r1:8b',
      messages: [{ role: 'user', content: 'läs filen' }],
    })) {
      if (chunk.contentDelta) content.push(chunk.contentDelta);
      if (chunk.toolCallDelta) accumulator.add(chunk.toolCallDelta);
      if (chunk.finishReason) finish = chunk.finishReason;
    }

    expect(content.join('')).toBe('Jag läser filen åt dig.');
    expect(finish).toBe('stop');
    expect(accumulator.size).toBe(0);
  });

  it('skickar verktygsdefinitioner och får tillbaka ett komplett anrop', async () => {
    const client = new OllamaClient({ baseUrl: fake.url });
    const accumulator = new ToolCallAccumulator();
    let finish: string | undefined;

    const chunks = await collect(
      client.chat({
        model: 'deepseek-r1:8b',
        messages: [{ role: 'user', content: 'läs src/index.ts' }],
        tools: [
          {
            name: 'read_file',
            description: 'Läs en fil',
            parameters: {
              type: 'object',
              properties: { path: { type: 'string' } },
              required: ['path'],
            },
            danger: 'safe',
            source: 'builtin',
          },
        ],
      }),
    );

    for (const chunk of chunks) {
      if (chunk.toolCallDelta) accumulator.add(chunk.toolCallDelta);
      if (chunk.finishReason) finish = chunk.finishReason;
    }

    expect(finish).toBe('tool_calls');
    const calls = accumulator.list();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.name).toBe('read_file');
    expect(calls[0]?.args).toEqual({ path: 'src/index.ts' });
    expect(calls[0]?.rawArguments).toBe('{"path":"src/index.ts"}');

    const sent = fake.requests[1]?.body as { tools?: unknown[] };
    expect(sent.tools).toHaveLength(1);
  });

  it('kastar TransportError när modellen inte kan laddas', async () => {
    const failing = await startFakeOllama({ chatFails: true });
    try {
      const client = new OllamaClient({ baseUrl: failing.url });
      await expect(
        collect(client.chat({ model: 'x', messages: [{ role: 'user', content: 'hej' }] })),
      ).rejects.toBeInstanceOf(TransportError);
    } finally {
      await failing.close();
    }
  });

  it('avbryts via AbortSignal', async () => {
    const client = new OllamaClient({ baseUrl: fake.url });
    const controller = new AbortController();
    controller.abort();
    await expect(
      collect(
        client.chat({
          model: 'deepseek-r1:8b',
          messages: [{ role: 'user', content: 'hej' }],
          signal: controller.signal,
        }),
      ),
    ).rejects.toThrow();
  });
});

describe('argumentparsning', () => {
  it('lagar trailing-komma och fenced JSON', () => {
    expect(parseArguments('{"path":"a.ts",}')).toEqual({ path: 'a.ts' });
    expect(parseArguments('```json\n{"path":"a.ts"}\n```')).toEqual({ path: 'a.ts' });
    expect(parseArguments('inte json alls')).toEqual({});
  });

  it('plockar ut textuella tool calls från modeller utan tool calling', () => {
    const content = [
      'Jag kollar filen.',
      '```json',
      '{"name":"read_file","arguments":{"path":"README.md"}}',
      '```',
      '<tool_call>{"tool":"search_files","args":{"query":"ollama"}}</tool_call>',
    ].join('\n');

    const calls = parseTextualToolCalls(content);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual({ name: 'read_file', args: { path: 'README.md' } });
    expect(calls[1]).toEqual({ name: 'search_files', args: { query: 'ollama' } });
  });
});
