import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  MediaKind,
  ProviderCapability,
  ProviderId,
  ProviderResolution,
} from '@freevobe/protocol';
import { PROVIDER_CATALOG, providerModelFor, providerSupports } from '@freevobe/protocol';
import { resolveProjectPath } from '../security/paths.js';
import { createId } from '../util/ids.js';
import {
  analyzeWithAnthropic,
  analyzeWithGemini,
  generateVideoWithXai,
  generateWithGemini,
  generateWithXai,
  type RawAsset,
} from './adapters.js';
import { readMediaSpend } from './spend.js';

/** Allt genererat hamnar i projektet, under en mapp som git kan ignorera. */
export const MEDIA_DIR = '.freevobe/media';

/** Antal sekunder som en videogenerering räknas som i kostnadsöversikten. */
const VIDEO_SECONDS = 5;

const CAPABILITY_FOR_KIND: Record<MediaKind, ProviderCapability> = {
  image: 'image_gen',
  video: 'video_gen',
  audio: 'audio_gen',
};

const MIME_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/flac': 'flac',
};

const EXTENSION_MIMES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
};

export interface MediaProviders {
  resolve(capability: ProviderCapability): ProviderResolution;
  /** Läses bara här och skickas som Authorization till leverantörens eget API. */
  key(id: ProviderId): string | null;
}

export interface MediaServiceOptions {
  /** Absolut sökväg till projektroten. Genererade filer sparas under den. */
  root: string;
  providers: MediaProviders;
  /** Överstyr leverantörernas bas-URL. Används av testerna och av en framtida proxy. */
  baseUrls?: Partial<Record<ProviderId, string>>;
  fetchImpl?: typeof fetch;
  /** Endast för tester: kortare väntan mellan avfrågningarna. */
  pollIntervalMs?: number;
  maxPolls?: number;
  /** Daglig budget i USD, läses vid varje anrop. 0 eller undefined betyder ingen gräns. */
  dailyBudgetUsd?: () => number;
}

export interface GeneratedMedia {
  kind: MediaKind;
  /** Projektrelativ sökväg, t.ex. `.freevobe/media/image-….png`. */
  path: string;
  absolutePath: string;
  provider: ProviderId;
  model: string;
  mime: string;
  bytes: number;
  prompt: string;
  /** Uppskattad kostnad i USD, om katalogen har ett pris för modellen. */
  costUsd?: number;
}

export interface GenerateImageInput {
  prompt: string;
  provider?: ProviderId;
  aspectRatio?: string;
  count?: number;
}

export interface GenerateVideoInput {
  prompt: string;
  provider?: ProviderId;
  mode: 'text_to_video' | 'image_to_video';
  referenceImagePath?: string;
  resolution?: string;
}

export interface GenerateAudioInput {
  prompt: string;
  provider?: ProviderId;
}

export interface AnalyzeMediaInput {
  path: string;
  question: string;
}

/** Vad ett medieanrop väntas kosta, innan något skickas till providern. */
export interface MediaPreview {
  provider: ProviderId;
  model: string;
  /** Antal pris-enheter: bilder, videosekunder eller ljudspår. */
  units: number;
  costUsd?: number;
}

interface PickedProvider {
  providerId: ProviderId;
  model: string;
  apiKey: string;
}

function extensionFor(mime: string): string {
  return MIME_EXTENSIONS[mime.toLowerCase()] ?? 'bin';
}

function mimeFor(file: string): string {
  const extension = path.extname(file).replace('.', '').toLowerCase();
  return EXTENSION_MIMES[extension] ?? 'application/octet-stream';
}

/** Uppskattad kostnad för en modell. Används i godkännandet innan något genereras. */
export function estimateCostUsd(modelId: string, units = 1): number | undefined {
  for (const provider of PROVIDER_CATALOG) {
    const model = provider.models.find((entry) => entry.id === modelId);
    if (model?.cost) return Number((model.cost.usd * units).toFixed(4));
  }
  return undefined;
}

/**
 * Medietjänsten äger allt som kostar pengar: den väljer provider, läser nyckeln, anropar API:t och
 * sparar filen i projektet. Verktygen ovanpå den behöver bara validera argument och rapportera.
 *
 * Tjänsten skickar aldrig nyckeln vidare någon annanstans än som `Authorization`/`x-api-key` till
 * leverantörens eget API, och loggar den aldrig.
 */
export class MediaService {
  private readonly root: string;
  private readonly providers: MediaProviders;
  private readonly baseUrls: Partial<Record<ProviderId, string>>;
  private readonly fetchImpl?: typeof fetch;
  private readonly pollIntervalMs?: number;
  private readonly maxPolls?: number;
  private readonly dailyBudgetUsd?: () => number;

  constructor(options: MediaServiceOptions) {
    this.root = path.resolve(options.root);
    this.providers = options.providers;
    this.baseUrls = options.baseUrls ?? {};
    this.fetchImpl = options.fetchImpl;
    this.pollIntervalMs = options.pollIntervalMs;
    this.maxPolls = options.maxPolls;
    this.dailyBudgetUsd = options.dailyBudgetUsd;
  }

  /** Var filerna hamnar. UI:t läser samma mapp när mediafliken byggs i nästa steg. */
  get mediaDirectory(): string {
    return path.join(this.root, MEDIA_DIR);
  }

  private adapterOptions(picked: PickedProvider): {
    baseUrl: string;
    model: string;
    apiKey: string;
    fetchImpl?: typeof fetch;
    pollIntervalMs?: number;
    maxPolls?: number;
  } {
    const definition = PROVIDER_CATALOG.find((provider) => provider.id === picked.providerId);
    return {
      baseUrl: this.baseUrls[picked.providerId] ?? definition?.baseUrl ?? '',
      model: picked.model,
      apiKey: picked.apiKey,
      ...(this.fetchImpl ? { fetchImpl: this.fetchImpl } : {}),
      ...(this.pollIntervalMs !== undefined ? { pollIntervalMs: this.pollIntervalMs } : {}),
      ...(this.maxPolls !== undefined ? { maxPolls: this.maxPolls } : {}),
    };
  }

  private pick(capability: ProviderCapability, requested?: ProviderId): PickedProvider {
    if (requested) {
      if (!providerSupports(requested, capability)) {
        throw new Error(`${requested} kan inte leverera ${capability}.`);
      }
      const apiKey = this.providers.key(requested);
      if (apiKey) {
        return {
          providerId: requested,
          model: providerModelFor(requested, capability)?.id ?? '',
          apiKey,
        };
      }
    }

    const resolution = this.providers.resolve(capability);
    if (!resolution.ok || !resolution.providerId) {
      throw new Error(
        resolution.code === 'local_only'
          ? 'Bild-, video- och ljudgenerering kräver en moln-provider (Gemini eller Grok). Slå på en provider i Inställningar → Providers.'
          : 'Ingen provider är redo för det här. Slå på en provider och spara dess API-nyckel i Inställningar → Providers.',
      );
    }

    const apiKey = this.providers.key(resolution.providerId);
    if (!apiKey) {
      throw new Error(
        `Providern ${resolution.providerId} saknar API-nyckel. Spara den i Inställningar → Providers.`,
      );
    }

    return {
      providerId: resolution.providerId,
      model: resolution.model || providerModelFor(resolution.providerId, capability)?.id || '',
      apiKey,
    };
  }

  /**
   * Räknar ut provider, modell och pris för ett anrop utan att kontakta någon. Godkännandet i
   * chatten visar samma siffra som budgeten senare kontrollerar. Returnerar null när ingen
   * provider är redo – då visas godkännandet utan pris och felet kommer först vid anropet.
   */
  preview(
    kind: MediaKind,
    options: { provider?: ProviderId; count?: number; seconds?: number } = {},
  ): MediaPreview | null {
    try {
      const picked = this.pick(CAPABILITY_FOR_KIND[kind], options.provider);
      const units = Math.max(1, options.count ?? (kind === 'video' ? VIDEO_SECONDS : 1));
      const costUsd = estimateCostUsd(picked.model, units);
      return {
        provider: picked.providerId,
        model: picked.model,
        units,
        ...(costUsd !== undefined ? { costUsd } : {}),
      };
    } catch {
      return null;
    }
  }

  /** Stoppar anropet när dagens uppskattade kostnad skulle passera användarens budget. */
  private async assertBudget(picked: PickedProvider, units: number): Promise<void> {
    const budgetUsd = this.dailyBudgetUsd?.() ?? 0;
    if (!(budgetUsd > 0)) return;
    const estimate = estimateCostUsd(picked.model, units);
    // Utan pris i katalogen går anropet inte att jämföra mot en budget; det släpps igenom och
    // kostnaden syns i stället i mediefliken efteråt.
    if (estimate === undefined) return;
    const spend = await readMediaSpend(this.root);
    if (spend.todayUsd + estimate <= budgetUsd + 1e-9) return;
    throw new Error(
      `Daglig mediabudget är slut: ${spend.todayUsd.toFixed(2)} av ${budgetUsd.toFixed(2)} USD använda idag, och det här anropet beräknas kosta ${estimate.toFixed(2)} USD. Höj gränsen i Inställningar → Agent och säkerhet.`,
    );
  }

  private async save(
    kind: MediaKind,
    asset: RawAsset,
    picked: PickedProvider,
    prompt: string,
    units: number,
  ): Promise<GeneratedMedia> {
    await fs.mkdir(this.mediaDirectory, { recursive: true });
    const extension = extensionFor(asset.mime);
    const name = `${kind}-${Date.now()}-${createId('m').slice(-6)}.${extension}`;
    const absolutePath = path.join(this.mediaDirectory, name);
    const bytes = Buffer.from(asset.base64, 'base64');
    await fs.writeFile(absolutePath, bytes);

    const costUsd = estimateCostUsd(picked.model, units);
    // Metadatafilen gör att mediefliken kan visa provider, modell, prompt och kostnad även efter
    // en omstart. Den innehåller aldrig någon nyckel och läses bara av den lokala servern.
    await fs.writeFile(
      `${absolutePath}.json`,
      JSON.stringify(
        {
          kind,
          provider: picked.providerId,
          model: picked.model,
          prompt,
          mime: asset.mime,
          bytes: bytes.length,
          createdAt: Date.now(),
          ...(costUsd !== undefined ? { costUsd } : {}),
        },
        null,
        2,
      ),
    );
    return {
      kind,
      path: `${MEDIA_DIR}/${name}`,
      absolutePath,
      provider: picked.providerId,
      model: picked.model,
      mime: asset.mime,
      bytes: bytes.length,
      prompt,
      ...(costUsd !== undefined ? { costUsd } : {}),
    };
  }

  async generateImage(input: GenerateImageInput): Promise<GeneratedMedia[]> {
    const count = Math.min(Math.max(input.count ?? 1, 1), 10);
    const picked = this.pick('image_gen', input.provider);
    await this.assertBudget(picked, count);
    const assets =
      picked.providerId === 'xai'
        ? await generateWithXai({
            ...this.adapterOptions(picked),
            prompt: input.prompt,
            count,
            ...(input.aspectRatio ? { aspectRatio: input.aspectRatio } : {}),
          })
        : await generateWithGemini({
            ...this.adapterOptions(picked),
            prompt: input.prompt,
            modality: 'IMAGE',
            ...(input.aspectRatio ? { aspectRatio: input.aspectRatio } : {}),
          });

    const saved: GeneratedMedia[] = [];
    for (const asset of assets) {
      saved.push(await this.save('image', asset, picked, input.prompt, 1));
    }
    return saved;
  }

  async generateVideo(input: GenerateVideoInput): Promise<GeneratedMedia[]> {
    const picked = this.pick('video_gen', input.provider);
    await this.assertBudget(picked, VIDEO_SECONDS);
    let referenceImage: RawAsset | undefined;

    if (input.mode === 'image_to_video') {
      if (!input.referenceImagePath) {
        throw new Error('image_to_video kräver reference_image_path.');
      }
      if (picked.providerId !== 'google') {
        throw new Error('Bild-till-video stöds bara av Gemini i den här versionen.');
      }
      referenceImage = await this.readAsset(input.referenceImagePath);
    }

    const assets =
      picked.providerId === 'xai'
        ? await generateVideoWithXai({
            ...this.adapterOptions(picked),
            prompt: input.prompt,
            mode: input.mode,
            ...(input.resolution ? { resolution: input.resolution } : {}),
          })
        : await generateWithGemini({
            ...this.adapterOptions(picked),
            prompt: input.prompt,
            modality: 'VIDEO',
            ...(referenceImage ? { referenceImage } : {}),
          });

    const saved: GeneratedMedia[] = [];
    for (const asset of assets) {
      // Katalogens videopris gäller per sekund; en kort generering räknas som fem sekunder.
      saved.push(await this.save('video', asset, picked, input.prompt, VIDEO_SECONDS));
    }
    return saved;
  }

  async generateAudio(input: GenerateAudioInput): Promise<GeneratedMedia[]> {
    const picked = this.pick('audio_gen', input.provider);
    await this.assertBudget(picked, 1);
    if (picked.providerId === 'xai') {
      throw new Error('xAI kan inte generera ljud. Välj Gemini.');
    }
    const assets = await generateWithGemini({
      ...this.adapterOptions(picked),
      prompt: input.prompt,
      modality: 'AUDIO',
    });
    const saved: GeneratedMedia[] = [];
    for (const asset of assets) {
      saved.push(await this.save('audio', asset, picked, input.prompt, 1));
    }
    return saved;
  }

  async analyzeImage(input: AnalyzeMediaInput): Promise<string> {
    const picked = this.pick('vision');
    const asset = await this.readAsset(input.path);

    if (picked.providerId === 'anthropic') {
      return analyzeWithAnthropic({
        ...this.adapterOptions(picked),
        image: asset,
        question: input.question,
      });
    }
    return analyzeWithGemini({
      ...this.adapterOptions(picked),
      asset,
      question: input.question,
    });
  }

  async analyzeVideo(input: AnalyzeMediaInput): Promise<string> {
    const picked = this.pick('vision');
    if (picked.providerId !== 'google') {
      throw new Error('Videoanalys kräver Gemini i den här versionen.');
    }
    const asset = await this.readAsset(input.path);
    return analyzeWithGemini({ ...this.adapterOptions(picked), asset, question: input.question });
  }

  /** Läser en fil i projektet. Sökvägar utanför roten avvisas innan något skickas till en provider. */
  private async readAsset(candidate: string): Promise<RawAsset> {
    const resolved = resolveProjectPath(this.root, candidate);
    if (!resolved.ok) throw new Error(resolved.reason ?? 'Sökvägen är inte tillåten.');
    const bytes = await fs.readFile(resolved.absolute);
    return { mime: mimeFor(resolved.absolute), base64: bytes.toString('base64') };
  }
}
