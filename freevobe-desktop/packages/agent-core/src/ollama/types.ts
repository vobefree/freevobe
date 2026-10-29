import type { ToolSpec } from '@freevobe/protocol';

export interface ChatToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  rawArguments: string;
}

export interface ChatTurnMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** Anrop som assistenten begärde. */
  toolCalls?: ChatToolCall[];
  /** Vilket anrop ett tool-svar hör till. */
  toolCallId?: string;
  /** Namn på verktyget som svarade (för loggning och för modeller som vill ha det). */
  name?: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatTurnMessage[];
  tools?: ToolSpec[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface ToolCallDelta {
  index: number;
  id?: string;
  name?: string;
  argumentsFragment?: string;
}

export interface ChatChunk {
  contentDelta?: string;
  reasoningDelta?: string;
  toolCallDelta?: ToolCallDelta;
  finishReason?: 'stop' | 'tool_calls' | 'length' | 'error';
  usage?: { promptTokens: number; completionTokens: number };
}

/**
 * Transporten är injicerbar. Det gör att agent-loopen kan testas helt utan Ollama,
 * och att en framtida molntransport kan läggas till utan att röra loopen.
 */
export interface ChatTransport {
  readonly label: string;
  chat(request: ChatRequest): AsyncIterable<ChatChunk>;
}

export class TransportError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'TransportError';
    this.status = status;
  }
}
