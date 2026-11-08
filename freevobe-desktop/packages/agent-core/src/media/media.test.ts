import fs from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ProviderCapability, ProviderResolution } from '@freevobe/protocol';
import { evaluateToolCall } from '../security/policy.js';
import { generateImageTool } from '../tools/media.js';
import type { ToolContext } from '../tools/types.js';
import { MediaService, estimateCostUsd } from './service.js';

interface Captured {
  path: string;
  headers: http.IncomingHttpHeaders;
  body: Record<string, unknown> | undefined;
}

let server: http.Server;
let baseUrl: string;
let root: string;
let requests: Captured[];
let handler: (request: Captured) => {
  status: number;
  json?: unknown;
  binary?: Buffer;
  mime?: string;
};

function resolveOk(providerId: 'google' | 'xai' | 'anthropic', model: string): ProviderResolution {
  return { ok: true, providerId, model, code: 'ok' };
}

function serviceFor(
  resolution: ProviderResolution,
  keys: { google?: string; xai?: string; anthropic?: string } = {
    google: 'test-nyckel',
    xai: 'xai-nyckel',
    anthropic: 'ant-nyckel',
  },
  dailyBudgetUsd?: () => number,
): MediaService {
  return new MediaService({
    root,
    baseUrls: { google: baseUrl, xai: baseUrl, anthropic: baseUrl },
    pollIntervalMs: 1,
    maxPolls: 5,
    ...(dailyBudgetUsd ? { dailyBudgetUsd } : {}),
    providers: {
      resolve: (_capability: ProviderCapability) => resolution,
      key: (id) => keys[id as keyof typeof keys] ?? null,
    },
  });
}

beforeEach(async () => {
  requests = [];
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-media-'));
  server = http.createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      const captured: Captured = {
        path: request.url ?? '',
        headers: request.headers,
        body: raw ? (JSON.parse(raw) as Record<string, unknown>) : undefined,
      };
      requests.push(captured);
      const result = handler(captured);
      if (result.binary) {
        response.writeHead(result.status, { 'content-type': result.mime ?? 'image/png' });
        response.end(result.binary);
        return;
      }
      response.writeHead(result.status, { 'content-type': 'application/json' });
      response.end(JSON.stringify(result.json ?? {}));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await fs.rm(root, { recursive: true, force: true });
});

describe('MediaService', () => {
  it('genererar en bild via Gemini och sparar den i projektet', async () => {
    handler = () => ({
      status: 200,
      json: {
        candidates: [
          { content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'aGVsbG8=' } }] } },
        ],
      },
    });

    const service = serviceFor(resolveOk('google', 'gemini-3.1-flash-image'));
    const [image] = await service.generateImage({ prompt: 'En räv', aspectRatio: '16:9' });

    expect(requests[0]?.path).toContain('/v1beta/models/gemini-3.1-flash-image:generateContent');
    expect(requests[0]?.headers['x-goog-api-key']).toBe('test-nyckel');
    expect(image?.path.startsWith('.freevobe/media/image-')).toBe(true);
    expect(await fs.readFile(image!.absolutePath, 'utf8')).toBe('hello');
    expect(image?.mime).toBe('image/png');
    expect(image?.costUsd).toBe(0.02);
  });

  it('genererar en bild via Grok med aspect ratio och antal', async () => {
    handler = () => ({ status: 200, json: { data: [{ b64_json: 'aGVsbG8=' }] } });

    const service = serviceFor(resolveOk('xai', 'grok-imagine-image-2.0'));
    const images = await service.generateImage({
      prompt: 'Ett berg',
      aspectRatio: '9:16',
      count: 2,
    });

    expect(requests[0]?.path).toBe('/v1/images/generations');
    expect(requests[0]?.headers.authorization).toBe('Bearer xai-nyckel');
    expect(requests[0]?.body).toMatchObject({
      model: 'grok-imagine-image-2.0',
      n: 2,
      aspect_ratio: '9:16',
    });
    expect(images).toHaveLength(1);
  });

  it('följer upp en videogenerering och hämtar filen när den är klar', async () => {
    handler = (request) => {
      if (request.path === '/v1/videos/generations') {
        return { status: 200, json: { id: 'video-1', status: 'pending' } };
      }
      if (request.path === '/v1/videos/video-1') {
        return { status: 200, json: { status: 'done', video_url: `${baseUrl}/filer/video.mp4` } };
      }
      return { status: 200, binary: Buffer.from('mp4-innehall'), mime: 'video/mp4' };
    };

    const service = serviceFor(resolveOk('xai', 'grok-imagine-video-1.5'));
    const [video] = await service.generateVideo({
      prompt: 'En produkt som snurrar',
      mode: 'text_to_video',
    });

    expect(requests.map((entry) => entry.path)).toContain('/v1/videos/video-1');
    expect(video?.kind).toBe('video');
    expect(video?.mime).toBe('video/mp4');
    expect(await fs.readFile(video!.absolutePath, 'utf8')).toBe('mp4-innehall');
    expect(video?.costUsd).toBe(0.25);
  });

  it('genererar ljud via Gemini', async () => {
    handler = () => ({
      status: 200,
      json: {
        candidates: [
          { content: { parts: [{ inlineData: { mimeType: 'audio/mpeg', data: 'bXVzaWs=' } }] } },
        ],
      },
    });

    const service = serviceFor(resolveOk('google', 'gemini-omni-1.1-flash'));
    const [audio] = await service.generateAudio({ prompt: 'Lugn pianomusik' });

    expect(requests[0]?.body?.generationConfig as { responseModalities: string[] }).toMatchObject({
      responseModalities: ['TEXT', 'AUDIO'],
    });
    expect(audio?.mime).toBe('audio/mpeg');
    expect(audio?.path.endsWith('.mp3')).toBe(true);
  });

  it('analyserar en bild med Claude och skickar bilden som base64', async () => {
    const imageFile = path.join(root, 'skarm.png');
    await fs.writeFile(imageFile, Buffer.from('bilddata'));
    handler = () => ({
      status: 200,
      json: { content: [{ type: 'text', text: 'En räv på en äng.' }] },
    });

    const service = serviceFor(resolveOk('anthropic', 'claude-sonnet-4-5'));
    const answer = await service.analyzeImage({ path: 'skarm.png', question: 'Vad visas?' });

    expect(requests[0]?.path).toBe('/v1/messages');
    expect(requests[0]?.headers['x-api-key']).toBe('ant-nyckel');
    const content = (requests[0]?.body?.messages as { content: unknown[] }[])[0]?.content as {
      type: string;
      source?: { data: string; media_type: string };
      text?: string;
    }[];
    expect(content[0]?.source).toEqual({
      type: 'base64',
      data: Buffer.from('bilddata').toString('base64'),
      media_type: 'image/png',
    });
    expect(content[1]?.text).toBe('Vad visas?');
    expect(answer).toBe('En räv på en äng.');
  });

  it('vägrar skicka något när molnet är avstängt', async () => {
    const service = serviceFor({ ok: false, code: 'local_only' }, {});

    await expect(service.generateImage({ prompt: 'En räv' })).rejects.toThrow(/moln-provider/);
    expect(requests).toHaveLength(0);
  });

  it('avvisar en provider som inte kan mediesorten', async () => {
    const service = serviceFor(resolveOk('google', 'gemini-3.1-flash-image'));
    await expect(
      service.generateImage({ prompt: 'En räv', provider: 'anthropic' }),
    ).rejects.toThrow(/kan inte leverera image_gen/);
  });

  it('räknar ut en uppskattad kostnad ur katalogen', () => {
    expect(estimateCostUsd('gemini-3.1-flash-image', 3)).toBe(0.06);
    expect(estimateCostUsd('grok-imagine-video-1.5', 2)).toBe(0.1);
    expect(estimateCostUsd('okand-modell')).toBeUndefined();
  });
});

describe('mediekostnad och budget', () => {
  it('räknar ut priset för ett anrop utan att kontakta providern', () => {
    const service = serviceFor(resolveOk('google', 'gemini-3.1-flash-image'));

    expect(service.preview('image', { count: 3 })).toMatchObject({
      provider: 'google',
      model: 'gemini-3.1-flash-image',
      units: 3,
      costUsd: 0.06,
    });
    // Videopriset gäller per sekund: en generering räknas som fem sekunder.
    const videoService = serviceFor(resolveOk('google', 'gemini-omni-1.1-flash'));
    expect(videoService.preview('video')).toMatchObject({ units: 5, costUsd: 0.4 });
    expect(service.preview('audio')).toMatchObject({ units: 1 });
    expect(requests).toHaveLength(0);
  });

  it('ger ingen uppskattning när ingen provider är redo', () => {
    const service = serviceFor({ ok: false, code: 'local_only' });
    expect(service.preview('image')).toBeNull();
  });

  it('stoppar anropet när dagens budget inte räcker', async () => {
    handler = () => ({
      status: 200,
      json: {
        candidates: [
          { content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'aGVsbG8=' } }] } },
        ],
      },
    });
    const service = serviceFor(
      resolveOk('google', 'gemini-3.1-flash-image'),
      undefined,
      () => 0.01,
    );

    await expect(service.generateImage({ prompt: 'En räv' })).rejects.toThrow(/Daglig mediabudget/);
    expect(requests).toHaveLength(0);
  });
});

describe('medieverktygen', () => {
  it('kräver alltid godkännande, även i full auto', () => {
    const decision = evaluateToolCall(
      { spec: generateImageTool.spec, args: { prompt: 'En räv' } },
      {
        root,
        mode: 'full-auto',
        browserAutomationEnabled: false,
        mcpServerApproved: () => true,
        autoApprove: { network: true },
      },
    );
    expect(decision.effect).toBe('require-approval');
    if (decision.effect === 'require-approval') expect(decision.hardBlock).toBe(true);
  });

  it('säger till när medietjänsten saknas i körningen', async () => {
    const ctx = { root } as unknown as ToolContext;
    const result = await generateImageTool.handler?.({ prompt: 'En räv' }, ctx);
    expect(result?.ok).toBe(false);
    expect(result?.content).toMatch(/inte tillgängliga/);
  });
});
