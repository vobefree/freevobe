import type { ProviderId } from '@freevobe/protocol';

/**
 * HTTP-adapterare för medieproviders. Varje funktion är liten och tar emot en `fetchImpl`, så att
 * testerna kan köra mot en lokal server och appen mot leverantörens riktiga API.
 *
 * Endpointsen följer leverantörernas REST-API:er (Gemini `:generateContent`, xAI:s
 * OpenAI-kompatibla bild- och videoendpoints, Anthropics `/v1/messages`). Modell-id:na kommer från
 * providerkatalogen, aldrig härifrån.
 */

export interface AdapterOptions {
  baseUrl: string;
  model: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Hur ofta en pågående generering frågas av. Injicerbar så att testerna slipper vänta. */
  pollIntervalMs?: number;
  maxPolls?: number;
}

export interface RawAsset {
  mime: string;
  base64: string;
}

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_POLL_INTERVAL_MS = 2_000;
const DEFAULT_MAX_POLLS = 60;

export class ProviderHttpError extends Error {
  readonly provider: ProviderId;
  readonly status?: number;

  constructor(provider: ProviderId, message: string, status?: number) {
    super(message);
    this.name = 'ProviderHttpError';
    this.provider = provider;
    if (status !== undefined) this.status = status;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJson(
  provider: ProviderId,
  response: Response,
): Promise<Record<string, unknown>> {
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new ProviderHttpError(
      provider,
      `${provider} svarade ${response.status}: ${detail.slice(0, 400) || response.statusText}`,
      response.status,
    );
  }
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return body;
}

async function request(
  provider: ProviderId,
  options: AdapterOptions,
  pathname: string,
  init: RequestInit = {},
): Promise<Record<string, unknown>> {
  const timeout = AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  let response: Response;
  try {
    response = await (options.fetchImpl ?? globalThis.fetch)(
      `${options.baseUrl.replace(/\/+$/, '')}${pathname}`,
      { ...init, signal },
    );
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ProviderHttpError(
      provider,
      `Kunde inte nå ${provider}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return readJson(provider, response);
}

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType?: string; data?: string };
  fileData?: { fileUri?: string; mimeType?: string };
}

interface GeminiPayload {
  candidates?: { content?: { parts?: GeminiPart[] } }[];
  operation?: { name?: string; done?: boolean };
  done?: boolean;
  response?: GeminiPayload;
  error?: { message?: string };
}

function geminiHeaders(apiKey: string): Record<string, string> {
  return { 'content-type': 'application/json', 'x-goog-api-key': apiKey };
}

async function downloadAsset(
  provider: ProviderId,
  url: string,
  options: AdapterOptions,
): Promise<RawAsset> {
  const response = await (options.fetchImpl ?? globalThis.fetch)(url, {
    ...(options.signal ? { signal: options.signal } : {}),
  });
  if (!response.ok) {
    throw new ProviderHttpError(
      provider,
      `Kunde inte hämta filen från ${provider} (${response.status}).`,
      response.status,
    );
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    mime: response.headers.get('content-type')?.split(';')[0] ?? 'application/octet-stream',
    base64: buffer.toString('base64'),
  };
}

async function collectGeminiAssets(
  provider: ProviderId,
  payload: GeminiPayload,
  options: AdapterOptions,
): Promise<RawAsset[]> {
  const assets: RawAsset[] = [];
  for (const candidate of payload.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (part.inlineData?.data) {
        assets.push({
          mime: part.inlineData.mimeType ?? 'application/octet-stream',
          base64: part.inlineData.data,
        });
      } else if (part.fileData?.fileUri) {
        assets.push(await downloadAsset(provider, part.fileData.fileUri, options));
      }
    }
  }
  return assets;
}

/** Väntar på en långkörande operation och returnerar det färdiga svaret. */
async function waitForOperation(
  provider: ProviderId,
  options: AdapterOptions,
  initial: GeminiPayload,
  pathPrefix: string,
): Promise<GeminiPayload> {
  let current = initial;
  const polls = options.maxPolls ?? DEFAULT_MAX_POLLS;
  for (let index = 0; index < polls; index += 1) {
    if (current.done) return current.response ?? current;
    const name = current.operation?.name;
    if (!name) return current;
    await sleep(options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS);
    current = (await request(provider, options, `${pathPrefix}${name}`, {
      method: 'GET',
      headers: geminiHeaders(options.apiKey),
    })) as GeminiPayload;
  }
  throw new ProviderHttpError(provider, 'Genereringen tog för lång tid och avbröts.');
}

function geminiModalities(modality: 'IMAGE' | 'VIDEO' | 'AUDIO'): string[] {
  return modality === 'IMAGE' ? ['IMAGE'] : ['TEXT', modality];
}

/** Bild, video eller ljud via Gemini. Video kan starta en långkörande operation som följs upp. */
export async function generateWithGemini(
  options: AdapterOptions & {
    prompt: string;
    modality: 'IMAGE' | 'VIDEO' | 'AUDIO';
    aspectRatio?: string;
    referenceImage?: RawAsset;
  },
): Promise<RawAsset[]> {
  const parts: Record<string, unknown>[] = [{ text: options.prompt }];
  if (options.referenceImage) {
    parts.push({
      inlineData: { mimeType: options.referenceImage.mime, data: options.referenceImage.base64 },
    });
  }

  const payload = (await request(
    'google',
    options,
    `/v1beta/models/${options.model}:generateContent`,
    {
      method: 'POST',
      headers: geminiHeaders(options.apiKey),
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseModalities: geminiModalities(options.modality),
          ...(options.aspectRatio ? { imageConfig: { aspectRatio: options.aspectRatio } } : {}),
        },
      }),
    },
  )) as GeminiPayload;

  const finished = payload.operation
    ? await waitForOperation('google', options, payload, '/v1beta/')
    : payload;
  const assets = await collectGeminiAssets('google', finished, options);
  if (assets.length === 0) {
    throw new ProviderHttpError(
      'google',
      'Gemini svarade utan media. Kontrollera att modellen kan generera den här sortens fil.',
    );
  }
  return assets;
}

interface XaiImageResponse {
  data?: { b64_json?: string; url?: string }[];
}

/** Bild via xAI:s OpenAI-kompatibla bildendpoint. */
export async function generateWithXai(
  options: AdapterOptions & { prompt: string; count: number; aspectRatio?: string },
): Promise<RawAsset[]> {
  const payload = (await request('xai', options, '/v1/images/generations', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${options.apiKey}` },
    body: JSON.stringify({
      model: options.model,
      prompt: options.prompt,
      n: options.count,
      response_format: 'b64_json',
      ...(options.aspectRatio ? { aspect_ratio: options.aspectRatio } : {}),
    }),
  })) as XaiImageResponse;

  const assets: RawAsset[] = [];
  for (const entry of payload.data ?? []) {
    if (entry.b64_json) {
      assets.push({ mime: 'image/png', base64: entry.b64_json });
    } else if (entry.url) {
      assets.push(await downloadAsset('xai', entry.url, options));
    }
  }
  if (assets.length === 0) {
    throw new ProviderHttpError('xai', 'xAI svarade utan bild.');
  }
  return assets;
}

interface XaiVideoResponse {
  id?: string;
  status?: string;
  video_url?: string;
  url?: string;
  b64_json?: string;
}

/** Video via xAI: starta jobbet, följ upp tills det är klart och hämta filen. */
export async function generateVideoWithXai(
  options: AdapterOptions & {
    prompt: string;
    mode: 'text_to_video' | 'image_to_video';
    resolution?: string;
  },
): Promise<RawAsset[]> {
  const created = (await request('xai', options, '/v1/videos/generations', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${options.apiKey}` },
    body: JSON.stringify({
      model: options.model,
      prompt: options.prompt,
      mode: options.mode,
      ...(options.resolution ? { resolution: options.resolution } : {}),
    }),
  })) as XaiVideoResponse;

  let current = created;
  const polls = options.maxPolls ?? DEFAULT_MAX_POLLS;
  for (
    let index = 0;
    index < polls && current.id && !current.video_url && !current.url;
    index += 1
  ) {
    if (current.status === 'failed') {
      throw new ProviderHttpError('xai', 'xAI kunde inte skapa videon.');
    }
    await sleep(options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS);
    current = (await request('xai', options, `/v1/videos/${current.id}`, {
      method: 'GET',
      headers: { authorization: `Bearer ${options.apiKey}` },
    })) as XaiVideoResponse;
  }

  const url = current.video_url ?? current.url;
  if (url) return [await downloadAsset('xai', url, options)];
  if (current.b64_json) return [{ mime: 'video/mp4', base64: current.b64_json }];
  throw new ProviderHttpError('xai', 'Videogenereringen blev klar utan någon fil.');
}

interface AnthropicResponse {
  content?: { type?: string; text?: string }[];
}

/** Vision via Claude: bilden skickas som base64 tillsammans med frågan. */
export async function analyzeWithAnthropic(
  options: AdapterOptions & { image: RawAsset; question: string },
): Promise<string> {
  const payload = (await request('anthropic', options, '/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': options.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: options.model,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: options.image.mime,
                data: options.image.base64,
              },
            },
            { type: 'text', text: options.question },
          ],
        },
      ],
    }),
  })) as AnthropicResponse;

  const text = (payload.content ?? [])
    .filter((part) => part.type === 'text' && part.text)
    .map((part) => part.text)
    .join('\n')
    .trim();
  if (!text) throw new ProviderHttpError('anthropic', 'Claude svarade utan text.');
  return text;
}

/** Vision via Gemini: bild eller video skickas inline tillsammans med frågan. */
export async function analyzeWithGemini(
  options: AdapterOptions & { asset: RawAsset; question: string },
): Promise<string> {
  const payload = (await request(
    'google',
    options,
    `/v1beta/models/${options.model}:generateContent`,
    {
      method: 'POST',
      headers: geminiHeaders(options.apiKey),
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: options.asset.mime, data: options.asset.base64 } },
              { text: options.question },
            ],
          },
        ],
      }),
    },
  )) as GeminiPayload;

  const text = (payload.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text)
    .filter((value): value is string => typeof value === 'string')
    .join('\n')
    .trim();
  if (!text) throw new ProviderHttpError('google', 'Gemini svarade utan text.');
  return text;
}
