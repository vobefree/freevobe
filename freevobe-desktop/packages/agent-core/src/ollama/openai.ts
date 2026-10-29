import { createId } from '../util/ids.js';
import type {
  ChatChunk,
  ChatRequest,
  ChatToolCall,
  ChatTurnMessage,
  ToolCallDelta,
} from './types.js';

export interface OpenAIToolDefinition {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export type OpenAIMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string; tool_calls?: OpenAIToolCall[] }
  | { role: 'tool'; content: string; tool_call_id: string; name?: string };

export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface OpenAIChatBody {
  model: string;
  messages: OpenAIMessage[];
  stream: true;
  temperature?: number;
  max_tokens?: number;
  tools?: OpenAIToolDefinition[];
}

export function toOpenAITools(tools: ChatRequest['tools']): OpenAIToolDefinition[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters as unknown as Record<string, unknown>,
    },
  }));
}

export function toOpenAIMessages(messages: ChatTurnMessage[]): OpenAIMessage[] {
  return messages.map((message) => {
    if (message.role === 'tool') {
      const base: OpenAIMessage = {
        role: 'tool',
        content: message.content,
        tool_call_id: message.toolCallId ?? createId('call'),
      };
      return message.name ? { ...base, name: message.name } : base;
    }
    if (message.role === 'assistant') {
      const toolCalls = (message.toolCalls ?? []).map<OpenAIToolCall>((call) => ({
        id: call.id,
        type: 'function',
        function: {
          name: call.name,
          arguments: call.rawArguments || JSON.stringify(call.args ?? {}),
        },
      }));
      return toolCalls.length > 0
        ? { role: 'assistant', content: message.content ?? '', tool_calls: toolCalls }
        : { role: 'assistant', content: message.content ?? '' };
    }
    return { role: message.role, content: message.content };
  });
}

export function buildOpenAIBody(request: ChatRequest): OpenAIChatBody {
  const body: OpenAIChatBody = {
    model: request.model,
    messages: toOpenAIMessages(request.messages),
    stream: true,
  };
  if (request.temperature !== undefined) body.temperature = request.temperature;
  if (request.maxTokens !== undefined) body.max_tokens = request.maxTokens;
  const tools = toOpenAITools(request.tools);
  if (tools) body.tools = tools;
  return body;
}

/** Delar upp en SSE-ström i enskilda `data:`-payloads. Tål chunkade TCP-ramar och CRLF. */
export async function* iterateSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let separator = findSeparator(buffer);
      while (separator) {
        const rawEvent = buffer.slice(0, separator.index);
        buffer = buffer.slice(separator.index + separator.length);
        const data = rawEvent
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n')
          .trim();
        if (data) yield data;
        separator = findSeparator(buffer);
      }
    }
    const tail = buffer.trim();
    if (tail.startsWith('data:')) yield tail.slice(5).trim();
  } finally {
    reader.releaseLock();
  }
}

function findSeparator(buffer: string): { index: number; length: number } | null {
  const lf = buffer.indexOf('\n\n');
  const crlf = buffer.indexOf('\r\n\r\n');
  if (crlf !== -1 && (lf === -1 || crlf < lf)) return { index: crlf, length: 4 };
  if (lf !== -1) return { index: lf, length: 2 };
  return null;
}

interface RawOpenAIEvent {
  choices?: Array<{
    delta?: {
      content?: string | null;
      reasoning?: string | null;
      reasoning_content?: string | null;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason?: string | null;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
}

/** Översätter ett OpenAI-kompatibelt SSE-event till noll eller flera ChatChunk. */
export function toChatChunks(event: RawOpenAIEvent): ChatChunk[] {
  const chunks: ChatChunk[] = [];
  const choice = event.choices?.[0];
  const delta = choice?.delta;

  if (delta?.content) chunks.push({ contentDelta: delta.content });
  const reasoning = delta?.reasoning_content ?? delta?.reasoning;
  if (reasoning) chunks.push({ reasoningDelta: reasoning });

  for (const call of delta?.tool_calls ?? []) {
    const toolCallDelta: ToolCallDelta = { index: call.index ?? 0 };
    if (call.id) toolCallDelta.id = call.id;
    if (call.function?.name) toolCallDelta.name = call.function.name;
    if (call.function?.arguments) toolCallDelta.argumentsFragment = call.function.arguments;
    chunks.push({ toolCallDelta });
  }

  if (choice?.finish_reason) {
    const reason = choice.finish_reason;
    if (reason === 'tool_calls' || reason === 'stop' || reason === 'length') {
      chunks.push({ finishReason: reason });
    } else {
      chunks.push({ finishReason: 'stop' });
    }
  }

  if (event.usage) {
    chunks.push({
      usage: {
        promptTokens: event.usage.prompt_tokens ?? 0,
        completionTokens: event.usage.completion_tokens ?? 0,
      },
    });
  }

  return chunks;
}

/**
 * Ackumulerar strömmande tool call-fragment. OpenAI-formatet skickar namn i första fragmentet
 * och sedan argumenten i bitar, så de måste sättas ihop innan de kan köras.
 */
export class ToolCallAccumulator {
  private readonly calls = new Map<number, { id: string; name: string; args: string }>();

  add(delta: ToolCallDelta): void {
    const existing = this.calls.get(delta.index) ?? { id: '', name: '', args: '' };
    if (delta.id) existing.id = delta.id;
    if (delta.name) existing.name = delta.name;
    if (delta.argumentsFragment) existing.args += delta.argumentsFragment;
    this.calls.set(delta.index, existing);
  }

  get size(): number {
    return this.calls.size;
  }

  list(): ChatToolCall[] {
    return [...this.calls.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, call]) => {
        const rawArguments = call.args.trim() === '' ? '{}' : call.args;
        return {
          id: call.id || createId('call'),
          name: call.name,
          args: parseArguments(rawArguments),
          rawArguments,
        };
      })
      .filter((call) => call.name !== '');
  }
}

/** Modeller skickar ibland trasig JSON. Vi försöker laga det vanligaste fallen i stället för att ge upp. */
export function parseArguments(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  if (trimmed === '') return {};
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return isRecord(parsed) ? parsed : { value: parsed };
  } catch {
    const repaired = trimmed
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/, '')
      .trim();
    try {
      const parsed: unknown = JSON.parse(repaired);
      return isRecord(parsed) ? parsed : { value: parsed };
    } catch {
      return {};
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export interface TextualToolCall {
  name: string;
  args: Record<string, unknown>;
}

/**
 * Reservväg för modeller utan inbyggt tool calling: de skriver ofta anropet som JSON i texten.
 * Vi känner igen ```json-fenced JSON med `name`/`tool` + `arguments`/`args`, och `<tool_call>`-block.
 */
export function parseTextualToolCalls(content: string): TextualToolCall[] {
  const calls: TextualToolCall[] = [];
  const candidates: string[] = [];

  const fenced = /```(?:json|tool_call)?\s*\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = fenced.exec(content)) !== null) {
    if (match[1]) candidates.push(match[1].trim());
  }
  const tagged = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;
  while ((match = tagged.exec(content)) !== null) {
    if (match[1]) candidates.push(match[1].trim());
  }

  for (const candidate of candidates) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(candidate);
    } catch {
      continue;
    }
    if (!isRecord(parsed)) continue;
    const name =
      typeof parsed.name === 'string'
        ? parsed.name
        : typeof parsed.tool === 'string'
          ? parsed.tool
          : undefined;
    if (!name) continue;
    const rawArgs = parsed.arguments ?? parsed.args ?? parsed.parameters ?? {};
    const args =
      typeof rawArgs === 'string' ? parseArguments(rawArgs) : isRecord(rawArgs) ? rawArgs : {};
    calls.push({ name, args });
  }

  return calls;
}
