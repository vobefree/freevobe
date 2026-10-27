import type { OllamaModel, OllamaProbeResult } from '@vibeforge/protocol';
import { DEFAULT_OLLAMA_URL } from '@vibeforge/protocol';
import { OllamaUnavailableError } from '../util/errors.js';
import { buildOpenAIBody, iterateSSE, toChatChunks } from './openai.js';
import { TransportError, type ChatChunk, type ChatRequest, type ChatTransport } from './types.js';

export interface OllamaClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  /** Tidsgräns per HTTP-anrop. Streamade svar får en egen, generösare gräns. */
  timeoutMs?: number;
  /** Max antal modeller att hämta detaljer för (varje modell kräver ett /api/show-anrop). */
  maxModelDetails?: number;
}

export interface OllamaModelDetails {
  name: string;
  contextLength: number;
  supportsTools: boolean;
  parameterSize: string;
  quantization?: string;
  family?: string;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DETAIL_CONCURRENCY = 4;
const HELPER_URL = 'https://vibeforge.dev/docs/ollama';

interface RawTagsResponse {
  models?: Array<{
    name?: string;
    model?: string;
    size?: number;
    modified_at?: string;
    details?: { parameter_size?: string; quantization_level?: string; family?: string };
  }>;
}

interface RawShowResponse {
  capabilities?: string[];
  model_info?: Record<string, unknown>;
  details?: { parameter_size?: string; quantization_level?: string; family?: string };
}

export class OllamaClient implements ChatTransport {
  readonly label = 'ollama:openai-compatible';
  readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxModelDetails: number;

  constructor(options: OllamaClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_OLLAMA_URL).replace(/\/+$/, '');
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxModelDetails = options.maxModelDetails ?? 50;
  }

  /** Kontrollerar att Ollama svarar och hämtar modellistan i en och samma runda. */
  async probe(signal?: AbortSignal): Promise<OllamaProbeResult> {
    try {
      const version = await this.version(signal);
      const models = await this.listModels(signal);
      return { available: true, baseUrl: this.baseUrl, version, models, helpUrl: HELPER_URL };
    } catch (error) {
      return {
        available: false,
        baseUrl: this.baseUrl,
        models: [],
        error: error instanceof Error ? error.message : String(error),
        helpUrl: HELPER_URL,
      };
    }
  }

  async version(signal?: AbortSignal): Promise<string> {
    const response = await this.request('/api/version', { method: 'GET' }, signal);
    const body = (await response.json()) as { version?: string };
    return body.version ?? 'okänd';
  }

  async listModels(signal?: AbortSignal): Promise<OllamaModel[]> {
    const response = await this.request('/api/tags', { method: 'GET' }, signal);
    const body = (await response.json()) as RawTagsResponse;
    const raw = (body.models ?? []).slice(0, this.maxModelDetails);

    const models: OllamaModel[] = [];
    for (let index = 0; index < raw.length; index += DETAIL_CONCURRENCY) {
      const batch = raw.slice(index, index + DETAIL_CONCURRENCY);
      const detailed = await Promise.all(
        batch.map(async (entry) => {
          const name = entry.name ?? entry.model ?? 'okänd';
          const details = await this.showModel(name, signal).catch(() => null);
          const model: OllamaModel = {
            name,
            sizeBytes: entry.size ?? 0,
            parameterSize: details?.parameterSize || entry.details?.parameter_size || 'okänd',
            contextLength: details?.contextLength ?? 0,
            supportsTools: details?.supportsTools ?? false,
          };
          const quantization = details?.quantization ?? entry.details?.quantization_level;
          if (quantization) model.quantization = quantization;
          const family = details?.family ?? entry.details?.family;
          if (family) model.family = family;
          if (entry.modified_at) model.modifiedAt = entry.modified_at;
          return model;
        }),
      );
      models.push(...detailed);
    }

    return models.sort((a, b) => a.name.localeCompare(b.name));
  }

  async showModel(name: string, signal?: AbortSignal): Promise<OllamaModelDetails> {
    const response = await this.request(
      '/api/show',
      { method: 'POST', body: JSON.stringify({ model: name }) },
      signal,
    );
    const body = (await response.json()) as RawShowResponse;
    const info = body.model_info ?? {};
    const contextKey = Object.keys(info).find((key) => key.endsWith('.context_length'));
    const contextLength = contextKey ? Number(info[contextKey]) || 0 : 0;

    const details: OllamaModelDetails = {
      name,
      contextLength,
      supportsTools: (body.capabilities ?? []).includes('tools'),
      parameterSize: body.details?.parameter_size ?? 'okänd',
    };
    const quantization = body.details?.quantization_level;
    if (quantization) details.quantization = quantization;
    const family = body.details?.family;
    if (family) details.family = family;
    return details;
  }

  /**
   * Strömmar ett chatt-svar via Ollamas OpenAI-kompatibla endpoint.
   * Kastar OllamaUnavailableError om servern inte svarar, så att UI:t kan visa hjälpknappen.
   */
  async *chat(request: ChatRequest): AsyncIterable<ChatChunk> {
    let response: Response;
    try {
      response = await this.request(
        '/v1/chat/completions',
        { method: 'POST', body: JSON.stringify(buildOpenAIBody(request)) },
        request.signal,
      );
    } catch (error) {
      if (error instanceof TransportError) throw error;
      throw new OllamaUnavailableError(
        this.baseUrl,
        error instanceof Error ? error.message : String(error),
      );
    }

    if (!response.body) {
      throw new TransportError('Ollama svarade utan innehåll.', response.status);
    }

    for await (const data of iterateSSE(response.body)) {
      if (data === '[DONE]') return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }
      if (typeof parsed === 'object' && parsed !== null && 'error' in parsed) {
        const message =
          (parsed as { error?: { message?: string } }).error?.message ?? 'Okänt fel från Ollama.';
        throw new TransportError(message, response.status);
      }
      for (const chunk of toChatChunks(parsed as Parameters<typeof toChatChunks>[0])) {
        yield chunk;
      }
    }
  }

  private async request(
    pathname: string,
    init: RequestInit,
    signal?: AbortSignal,
  ): Promise<Response> {
    const timeout = AbortSignal.timeout(this.timeoutMs);
    const composite = signal ? AbortSignal.any([signal, timeout]) : timeout;

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${pathname}`, {
        ...init,
        headers: {
          'content-type': 'application/json',
          ...(init.headers ?? {}),
        },
        signal: composite,
      });
    } catch (error) {
      throw new OllamaUnavailableError(
        this.baseUrl,
        error instanceof Error ? error.message : String(error),
      );
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      if (response.status === 404) {
        throw new TransportError(
          `Modellen eller endpointen hittades inte (404): ${detail.slice(0, 300)}`,
          404,
        );
      }
      throw new TransportError(
        `Ollama svarade ${response.status}: ${detail.slice(0, 300)}`,
        response.status,
      );
    }

    return response;
  }
}

/** Bygger en transport som svarar på förbestämda turer. Används av tester och av `--dry-run`. */
export function createStaticTransport(turns: ChatChunk[][]): ChatTransport {
  let index = 0;
  return {
    label: 'static',
    async *chat() {
      const turn = turns[index] ?? turns[turns.length - 1] ?? [];
      index += 1;
      for (const chunk of turn) yield chunk;
    },
  };
}
