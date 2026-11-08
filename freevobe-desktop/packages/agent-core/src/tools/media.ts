import type { MediaKind, ProviderId, ToolSpec } from '@freevobe/protocol';
import { isProviderId } from '@freevobe/protocol';
import type { GeneratedMedia, MediaPreview, MediaService } from '../media/service.js';
import { fail, numberArg, ok, stringArg, type RegisteredTool, type ToolContext } from './types.js';

/**
 * De fem medieverktygen. De validerar argument, ber om ett personligt ja med priset synligt och
 * rapporterar – allt som kostar pengar och rör nätet ligger i MediaService, och policyn blockerar
 * hemligheter och kringgående av leverantörens filter innan verktyget ens körs.
 */

function spec(name: string, description: string, parameters: ToolSpec['parameters']): ToolSpec {
  return { name, description, parameters, danger: 'network', source: 'builtin' };
}

function media(ctx: ToolContext): MediaService | null {
  return ctx.media ?? null;
}

function providerArg(args: Record<string, unknown>): ProviderId | undefined {
  const value = stringArg(args, 'provider');
  return value && isProviderId(value) ? value : undefined;
}

function formatMedia(items: GeneratedMedia[]): string {
  return items
    .map(
      (item) =>
        `${item.path} – ${item.kind} från ${item.provider}/${item.model}, ${Math.round(
          item.bytes / 1024,
        )} kB${item.costUsd !== undefined ? `, uppskattad kostnad $${item.costUsd}` : ''}`,
    )
    .join('\n');
}

interface MediaApproval {
  title: string;
  kind: MediaKind;
  prompt: string;
  preview: MediaPreview | null;
}

/**
 * Godkännandet för ett medieanrop. Det visas alltid – policyn gör dessa verktyg hårda, även i
 * Full auto – och bär prompten, providern och den uppskattade kostnaden så att valet går att ta
 * innan något skickas eller debiteras.
 */
async function confirmMedia(
  ctx: ToolContext,
  input: MediaApproval,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!ctx.approval?.required) return { ok: true };

  const detail = [
    input.prompt.length > 400 ? `${input.prompt.slice(0, 400)}…` : input.prompt,
    input.preview ? `${input.preview.provider}/${input.preview.model}` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');

  const outcome = await ctx.requestApproval({
    kind: 'media',
    title: input.title,
    detail,
    reason: ctx.approval.reason,
    risk: 'medium',
    hardBlock: true,
    ...(input.preview?.costUsd !== undefined ? { costUsd: input.preview.costUsd } : {}),
    media: {
      kind: input.kind,
      prompt: input.prompt.slice(0, 2_000),
      ...(input.preview ? { provider: input.preview.provider, model: input.preview.model } : {}),
    },
  });

  return outcome.approved
    ? { ok: true }
    : { ok: false, reason: 'Du avvisade medieanropet. Ingenting skickades och inget skapades.' };
}

export const generateImageTool: RegisteredTool = {
  spec: spec(
    'generate_image',
    'Genererar en bild från en textprompt med Gemini eller Grok. Filen sparas i projektet och kan sedan användas i koden. Kostar pengar och kräver godkännande.',
    {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Vad bilden ska föreställa.' },
        provider: {
          type: 'string',
          enum: ['gemini', 'grok'],
          description: 'Valfri provider. Utelämnas den används din valda bildprovider.',
        },
        aspect_ratio: {
          type: 'string',
          enum: ['1:1', '16:9', '9:16'],
          description: 'Bildförhållande. Standard 1:1.',
        },
        count: { type: 'integer', minimum: 1, maximum: 10, description: 'Antal bilder (1–10).' },
      },
      required: ['prompt'],
    },
  ),
  handler: async (args, ctx) => {
    const prompt = stringArg(args, 'prompt');
    if (!prompt) return fail('generate_image kräver en prompt.');
    const service = media(ctx);
    if (!service) {
      return fail(
        'Medieverktygen är inte tillgängliga i den här körningen. Starta om appen och försök igen.',
      );
    }

    const requested = providerArg(args);
    const aspectRatio = stringArg(args, 'aspect_ratio') ?? undefined;
    const count = numberArg(args, 'count', 1);
    const provider = requested === 'google' || requested === 'xai' ? requested : undefined;
    const preview = service.preview('image', {
      count,
      ...(provider ? { provider } : {}),
    });

    const confirmed = await confirmMedia(ctx, {
      title: `Generera ${count} bild(er)`,
      kind: 'image',
      prompt,
      preview,
    });
    if (!confirmed.ok) return fail(confirmed.reason);

    const items = await service.generateImage({
      prompt,
      ...(provider ? { provider } : {}),
      ...(aspectRatio ? { aspectRatio } : {}),
      count,
    });

    return ok(`Skapade ${items.length} bild(er):\n${formatMedia(items)}`, {
      files: items.map((item) => item.path),
      provider: items[0]?.provider,
      model: items[0]?.model,
    });
  },
};

export const generateVideoTool: RegisteredTool = {
  spec: spec(
    'generate_video',
    'Genererar en video från text, eller animerar en bild, med Gemini eller Grok. Filen sparas i projektet. Kostar pengar och kräver godkännande.',
    {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Vad videon ska visa.' },
        provider: { type: 'string', enum: ['gemini', 'grok'], description: 'Valfri provider.' },
        mode: {
          type: 'string',
          enum: ['text_to_video', 'image_to_video'],
          description: 'Standard text_to_video.',
        },
        reference_image_path: {
          type: 'string',
          description: 'Projektrelativ sökväg till bilden som ska animeras (image_to_video).',
        },
        resolution: { type: 'string', enum: ['720p', '1080p'], description: 'Upplösning.' },
      },
      required: ['prompt'],
    },
  ),
  handler: async (args, ctx) => {
    const prompt = stringArg(args, 'prompt');
    if (!prompt) return fail('generate_video kräver en prompt.');
    const service = media(ctx);
    if (!service) {
      return fail(
        'Medieverktygen är inte tillgängliga i den här körningen. Starta om appen och försök igen.',
      );
    }

    const requested = providerArg(args);
    const mode = stringArg(args, 'mode') === 'image_to_video' ? 'image_to_video' : 'text_to_video';
    const reference = stringArg(args, 'reference_image_path') ?? undefined;
    const resolution = stringArg(args, 'resolution') ?? undefined;
    const provider = requested === 'google' || requested === 'xai' ? requested : undefined;
    const preview = service.preview('video', provider ? { provider } : {});

    const confirmed = await confirmMedia(ctx, {
      title: 'Generera en video',
      kind: 'video',
      prompt,
      preview,
    });
    if (!confirmed.ok) return fail(confirmed.reason);

    const items = await service.generateVideo({
      prompt,
      mode,
      ...(provider ? { provider } : {}),
      ...(reference ? { referenceImagePath: reference } : {}),
      ...(resolution ? { resolution } : {}),
    });

    return ok(`Skapade ${items.length} video(fil):\n${formatMedia(items)}`, {
      files: items.map((item) => item.path),
      provider: items[0]?.provider,
      model: items[0]?.model,
    });
  },
};

export const generateAudioTool: RegisteredTool = {
  spec: spec(
    'generate_audio',
    'Genererar musik eller ljud från en textprompt med Gemini. Filen sparas i projektet. Kostar pengar och kräver godkännande.',
    {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Vilken musik eller vilket ljud som ska skapas.' },
        provider: { type: 'string', enum: ['gemini'], description: 'Endast Gemini kan ljud.' },
      },
      required: ['prompt'],
    },
  ),
  handler: async (args, ctx) => {
    const prompt = stringArg(args, 'prompt');
    if (!prompt) return fail('generate_audio kräver en prompt.');
    const service = media(ctx);
    if (!service) {
      return fail(
        'Medieverktygen är inte tillgängliga i den här körningen. Starta om appen och försök igen.',
      );
    }

    const requested = providerArg(args);
    const provider = requested === 'google' ? requested : undefined;
    const preview = service.preview('audio', provider ? { provider } : {});

    const confirmed = await confirmMedia(ctx, {
      title: 'Generera ljud',
      kind: 'audio',
      prompt,
      preview,
    });
    if (!confirmed.ok) return fail(confirmed.reason);

    const items = await service.generateAudio({
      prompt,
      ...(provider ? { provider } : {}),
    });

    return ok(`Skapade ${items.length} ljudfil(er):\n${formatMedia(items)}`, {
      files: items.map((item) => item.path),
      provider: items[0]?.provider,
      model: items[0]?.model,
    });
  },
};

export const analyzeImageTool: RegisteredTool = {
  spec: spec(
    'analyze_image',
    'Analyserar en bild i projektet med vision (Claude eller Gemini) och svarar på en fråga om den. Bilden skickas till providern och kräver godkännande.',
    {
      type: 'object',
      properties: {
        image_path: { type: 'string', description: 'Projektrelativ sökväg till bilden.' },
        question: { type: 'string', description: 'Vad du vill veta om bilden.' },
      },
      required: ['image_path', 'question'],
    },
  ),
  handler: async (args, ctx) => {
    const imagePath = stringArg(args, 'image_path');
    const question = stringArg(args, 'question');
    if (!imagePath) return fail('analyze_image kräver image_path.');
    if (!question) return fail('analyze_image kräver en fråga.');
    const service = media(ctx);
    if (!service) return fail('Medieverktygen är inte tillgängliga i den här körningen.');

    const confirmed = await confirmMedia(ctx, {
      title: `Analysera ${imagePath}`,
      kind: 'image',
      prompt: question,
      preview: null,
    });
    if (!confirmed.ok) return fail(confirmed.reason);

    const answer = await service.analyzeImage({ path: imagePath, question });
    return ok(answer, { path: imagePath });
  },
};

export const analyzeVideoTool: RegisteredTool = {
  spec: spec(
    'analyze_video',
    'Analyserar en video i projektet med Gemini och svarar på en fråga om den. Videon skickas till providern och kräver godkännande.',
    {
      type: 'object',
      properties: {
        video_path: { type: 'string', description: 'Projektrelativ sökväg till videon.' },
        question: { type: 'string', description: 'Vad du vill veta om videon.' },
      },
      required: ['video_path', 'question'],
    },
  ),
  handler: async (args, ctx) => {
    const videoPath = stringArg(args, 'video_path');
    const question = stringArg(args, 'question');
    if (!videoPath) return fail('analyze_video kräver video_path.');
    if (!question) return fail('analyze_video kräver en fråga.');
    const service = media(ctx);
    if (!service) return fail('Medieverktygen är inte tillgängliga i den här körningen.');

    const confirmed = await confirmMedia(ctx, {
      title: `Analysera ${videoPath}`,
      kind: 'video',
      prompt: question,
      preview: null,
    });
    if (!confirmed.ok) return fail(confirmed.reason);

    const answer = await service.analyzeVideo({ path: videoPath, question });
    return ok(answer, { path: videoPath });
  },
};

export const mediaTools: RegisteredTool[] = [
  generateImageTool,
  generateVideoTool,
  generateAudioTool,
  analyzeImageTool,
  analyzeVideoTool,
];
