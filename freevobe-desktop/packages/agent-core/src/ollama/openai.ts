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
  /**
   * Texten anropet skrevs i. Loopen tar bort den ur svaret innan det visas, så att chatten visar
   * modellens förklaring i stället för rå JSON.
   */
  source: string;
}

export interface TextualToolCallOptions {
  /** Namnen på de verktyg som finns. Ett block med okänt namn lämnas som text. */
  isToolName?: (name: string) => boolean;
}

interface Candidate {
  text: string;
  source: string;
  start: number;
  end: number;
}

/**
 * Letar upp JSON-block i texten: ```-staket, `<tool_call>`-taggar och naken JSON. Modeller som
 * inte kan tool calling lägger anropet i texten, och de gör det i alla tre formerna.
 */
function findCandidates(content: string): Candidate[] {
  const found: Candidate[] = [];
  const patterns = [
    /```(?:json|tool_call)?\s*([\s\S]*?)```/g,
    /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      const text = (match[1] ?? '').trim();
      if (text === '') continue;
      found.push({
        text,
        source: match[0],
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  // Naken JSON: modellen skriver anropet utan staket. Vi letar upp varje `{` som inte redan
  // ligger i ett hittat block och läser ett balanserat objekt därifrån.
  let index = 0;
  while (index < content.length) {
    const char = content[index];
    if (char !== '{') {
      index += 1;
      continue;
    }
    if (found.some((candidate) => index >= candidate.start && index < candidate.end)) {
      index += 1;
      continue;
    }

    const extracted = extractJsonValue(content, index);
    if (extracted) {
      found.push({
        text: extracted.text.trim(),
        source: extracted.text,
        start: index,
        end: extracted.end,
      });
      index = extracted.end;
      continue;
    }

    // Trunkerat svar (t.ex. när modellen nått max_tokens): resten är JSON som saknar sina
    // avslutande klamrar. Den lagas när den parsas.
    const rest = content.slice(index).trim();
    if (rest.startsWith('{')) {
      found.push({ text: rest, source: content.slice(index), start: index, end: content.length });
    }
    return found;
  }

  return found;
}

/** Läser ett balanserat JSON-objekt eller -fält från `start`. null om det aldrig stängs. */
function extractJsonValue(content: string, start: number): { text: string; end: number } | null {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < content.length; index += 1) {
    const char = content[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{' || char === '[') {
      depth += 1;
      continue;
    }
    if (char === '}' || char === ']') {
      depth -= 1;
      if (depth === 0) return { text: content.slice(start, index + 1), end: index + 1 };
    }
  }

  return null;
}

/** Stänger klamrar och citattecken som saknas i ett avklippt JSON-svar. */
function closeUnbalanced(text: string): string {
  const closers: string[] = [];
  let inString = false;
  let escaped = false;

  for (const char of text) {
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') closers.push('}');
    else if (char === '[') closers.push(']');
    else if (char === '}' || char === ']') closers.pop();
  }

  const tail = closers.reverse().join('');
  return inString ? `${text}"${tail}` : `${text}${tail}`;
}

/** JSON.parse med de lagningar lokala modeller brukar kräva: staket, trailing-komman, avklippta klamrar. */
function parseJsonLoose(raw: string): unknown {
  const trimmed = raw.trim();
  const withoutFence = trimmed.replace(/^```(?:json|tool_call)?/i, '').replace(/```$/, '').trim();
  const attempts = [
    trimmed,
    withoutFence,
    trimmed.replace(/,\s*([}\]])/g, '$1'),
    withoutFence.replace(/,\s*([}\]])/g, '$1'),
  ];
  attempts.push(closeUnbalanced(attempts[3] ?? withoutFence));
  attempts.push(closeUnbalanced(attempts[2] ?? trimmed));

  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch {
      // Nästa försök.
    }
  }
  return undefined;
}

/**
 * Verb som lokala modeller använder i stället för verktygsnamn när de hittar på ett eget
 * JSON-format ("action": "create_file", "operation": "write" och liknande).
 */
const WRITE_VERBS = new Set([
  'create_file',
  'createfile',
  'create',
  'write_file',
  'writefile',
  'write',
  'new_file',
  'newfile',
  'add_file',
  'addfile',
  'save_file',
  'savefile',
  'save',
  'generate_file',
]);
const EDIT_VERBS = new Set([
  'edit_file',
  'editfile',
  'edit',
  'update_file',
  'update',
  'modify',
  'replace',
  'change',
  'patch',
  'fix',
]);
const DELETE_VERBS = new Set([
  'delete_file',
  'deletefile',
  'delete',
  'remove_file',
  'remove',
  'unlink',
]);
const RUN_VERBS = new Set([
  'run_terminal_command',
  'run_command',
  'runcommand',
  'run',
  'command',
  'execute',
  'exec',
  'terminal',
  'shell',
  'bash',
  'cmd',
]);
const READ_VERBS = new Set(['read_file', 'readfile', 'read', 'view', 'open', 'cat']);

/**
 * Ett objekt och de nästlade objekt modeller lägger argumenten i ("arguments", "params" …).
 * Sökningen går i den ordningen, så yttersta nivån vinner.
 */
function looseSources(entry: Record<string, unknown>): Array<Record<string, unknown>> {
  const sources: Array<Record<string, unknown>> = [entry];
  for (const key of ['arguments', 'args', 'params', 'parameters', 'input']) {
    const value = entry[key];
    if (isRecord(value)) sources.push(value);
  }
  return sources;
}

/** Sökvägen ur de nycklar modeller använder för filnamn. */
function loosePath(sources: Array<Record<string, unknown>>): string | null {
  for (const source of sources) {
    for (const key of ['path', 'file', 'filename', 'filePath', 'file_path', 'target', 'name']) {
      const value = source[key];
      if (typeof value !== 'string' || value.trim() === '') continue;
      // `name` är bara en sökväg när den ser ut som en fil – annars är det ett steg eller ett verktyg.
      if (key === 'name' && !/\.[a-z0-9]+$/i.test(value.trim())) continue;
      return value.trim();
    }
  }
  return null;
}

/** Filinnehållet ur de nycklar modeller använder i stället för `content`. */
function looseContent(sources: Array<Record<string, unknown>>): string | null {
  for (const source of sources) {
    for (const key of [
      'content',
      'contents',
      'text',
      'body',
      'code',
      'newContent',
      'new_content',
      'newString',
    ]) {
      const value = source[key];
      if (typeof value === 'string') return value;
    }
  }
  return null;
}

function normalizeVerb(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const verb = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return verb === '' ? null : verb;
}

/** Sant när strängen är en åtgärd ("create_file") och inte ett kommando att köra. */
function isVerb(value: string): boolean {
  const verb = normalizeVerb(value);
  if (!verb) return false;
  return (
    WRITE_VERBS.has(verb) ||
    EDIT_VERBS.has(verb) ||
    DELETE_VERBS.has(verb) ||
    RUN_VERBS.has(verb) ||
    READ_VERBS.has(verb)
  );
}

function looseCommand(sources: Array<Record<string, unknown>>): string | null {
  for (const source of sources) {
    for (const key of ['command', 'cmd', 'shell', 'script']) {
      const value = source[key];
      if (typeof value !== 'string' || value.trim() === '') continue;
      // `"command": "create_file"` är en åtgärd, inte ett skal-kommando.
      if (isVerb(value)) continue;
      return value.trim();
    }
  }
  return null;
}

/**
 * Läser ett eget JSON-format – `{"files": [...]}`, `{"actions": [...]}` eller ett enskilt
 * `{"action": "create_file", ...}` – och gör riktiga verktygsanrop av det.
 *
 * Lokala modeller hittar på egna scheman i stället för att anropa verktygen, och då hände
 * ingenting: filen skapades aldrig trots att modellen beskrev den. Nycklarna matchas mot de
 * namn verktygen faktiskt har, så ett block som beskriver en fil blir en skrivning.
 */
function looseCallsFromValue(
  value: unknown,
  options: TextualToolCallOptions,
): Array<{ name: string; args: Record<string, unknown> }> {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];

  const add = (name: string, args: Record<string, unknown>) => {
    if (options.isToolName && !options.isToolName(name)) return;
    calls.push({ name, args });
  };

  const visitFile = (file: unknown) => {
    if (!isRecord(file)) return;
    const sources = looseSources(file);
    const filePath = loosePath(sources);
    const content = looseContent(sources);
    if (filePath && content !== null) add('write_file', { path: filePath, content });
  };

  const visitAction = (action: unknown) => {
    if (!isRecord(action)) return;
    const sources = looseSources(action);
    // Verbnyckeln kan heta nästan vad som helst. `command` räknas bara som verb när värdet är en
    // känd åtgärd – annars är det ett skal-kommando.
    const verb = normalizeVerb(
      action.action ??
        action.operation ??
        action.op ??
        action.tool ??
        action.type ??
        action.kind ??
        action.intent ??
        (typeof action.command === 'string' && isVerb(action.command) ? action.command : null),
    );
    if (!verb) return;

    const filePath = loosePath(sources);
    const content = looseContent(sources);

    if (WRITE_VERBS.has(verb) && filePath && content !== null) {
      add('write_file', { path: filePath, content });
      return;
    }
    if (EDIT_VERBS.has(verb) && filePath) {
      const pick = (keys: string[]): string | undefined => {
        for (const source of sources) {
          const found = keys
            .map((key) => source[key])
            .find((candidate): candidate is string => typeof candidate === 'string');
          if (found !== undefined) return found;
        }
        return undefined;
      };
      const oldString = pick(['oldString', 'old_string', 'search', 'find']);
      const newString = pick(['newString', 'new_string', 'replace']);
      if (oldString !== undefined && oldString !== '' && newString !== undefined) {
        add('edit_file', { path: filePath, oldString, newString });
        return;
      }
      if (content !== null) {
        add('write_file', { path: filePath, content });
        return;
      }
    }
    if (DELETE_VERBS.has(verb) && filePath) {
      add('delete_file', { path: filePath });
      return;
    }
    const command = looseCommand(sources);
    if (RUN_VERBS.has(verb) && command) {
      add('run_terminal_command', { command });
      return;
    }
    if (READ_VERBS.has(verb) && filePath) add('read_file', { path: filePath });
  };

  for (const entry of Array.isArray(value) ? value : [value]) {
    if (!isRecord(entry)) continue;
    if (Array.isArray(entry.files)) entry.files.forEach(visitFile);
    const actions = Array.isArray(entry.actions)
      ? entry.actions
      : Array.isArray(entry.steps)
        ? entry.steps
        : [];
    actions.forEach(visitAction);
    visitAction(entry);
  }

  return calls;
}

/** Läser ut verktygsanrop ur ett tolkat JSON-värde (objekt, lista eller OpenAI-format). */
function callsFromValue(
  value: unknown,
  options: TextualToolCallOptions,
): Array<{ name: string; args: Record<string, unknown> }> {
  const entries = Array.isArray(value) ? value : [value];
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];

  for (const entry of entries) {
    if (!isRecord(entry)) continue;
    const fn = isRecord(entry.function) ? entry.function : undefined;
    const name = [entry.name, entry.tool, fn?.name].find(
      (candidate): candidate is string => typeof candidate === 'string' && candidate.trim() !== '',
    );
    // `name` och `function.name` är uttryckliga verktygsnamn. Ett namn som bara står under
    // `tool`/`action` är oftast en åtgärd i modellens eget format ("tool": "write"), och då
    // ska den tolkas som ett verktyg i stället för att skickas vidare som ett okänt namn.
    const nameFromActionKey = typeof entry.name !== 'string' && typeof fn?.name !== 'string';
    const loose = looseCallsFromValue(entry, options);

    if (!name) {
      calls.push(...loose);
      continue;
    }
    const trimmedName = name.trim();
    if (options.isToolName && !options.isToolName(trimmedName)) {
      calls.push(...loose);
      continue;
    }
    if (nameFromActionKey && loose.length > 0) {
      calls.push(...loose);
      continue;
    }

    const rawArgs = entry.arguments ?? entry.args ?? entry.parameters ?? fn?.arguments ?? {};
    const args =
      typeof rawArgs === 'string' ? parseArguments(rawArgs) : isRecord(rawArgs) ? rawArgs : {};
    calls.push({ name: trimmedName, args });
  }

  return calls;
}

/**
 * Reservväg för modeller som skriver anropet som text i stället för att fylla i tool_calls.
 * Det händer även modeller som uppger verktygsstöd, så loopen använder alltid den här vägen när
 * ett svar saknar riktiga anrop.
 */
export function parseTextualToolCalls(
  content: string,
  options: TextualToolCallOptions = {},
): TextualToolCall[] {
  const calls: TextualToolCall[] = [];
  const seen = new Set<string>();

  for (const candidate of findCandidates(content)) {
    const value = parseJsonLoose(candidate.text);
    if (value === undefined) continue;

    for (const call of callsFromValue(value, options)) {
      const key = `${call.name}:${JSON.stringify(call.args)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      calls.push({ ...call, source: candidate.source });
    }
  }

  return calls;
}

/** Tar bort verktygsanropen ur texten så att bara modellens förklaring blir kvar. */
export function stripTextualToolCalls(content: string, calls: TextualToolCall[]): string {
  let text = content;
  for (const call of calls) {
    if (call.source !== '') text = text.replace(call.source, '');
  }

  return text
    .replace(/```(?:json|tool_call)?\s*```/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
