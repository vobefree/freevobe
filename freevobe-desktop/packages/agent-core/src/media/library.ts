import type { Dirent } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { MediaAsset, MediaKind } from '@freevobe/protocol';
import { MEDIA_DIR } from './service.js';

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

export function mimeForMediaFile(file: string): string {
  const extension = path.extname(file).replace('.', '').toLowerCase();
  return EXTENSION_MIMES[extension] ?? 'application/octet-stream';
}

export function mediaKindForMime(mime: string): MediaKind | null {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return null;
}

interface Sidecar {
  provider?: unknown;
  model?: unknown;
  prompt?: unknown;
  costUsd?: unknown;
  createdAt?: unknown;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

/**
 * Läser media-mappen i projektet. Metadatafilerna (`<fil>.json`) som tjänsten skriver bredvid varje
 * fil ger provider, modell, prompt och kostnad – saknas de visas filen ändå.
 */
export async function listMedia(root: string): Promise<MediaAsset[]> {
  const directory = path.join(path.resolve(root), MEDIA_DIR);
  let entries: Dirent[];
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  const assets: MediaAsset[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || entry.name.startsWith('.') || entry.name.endsWith('.json')) continue;
    const absolutePath = path.join(directory, entry.name);
    const mime = mimeForMediaFile(absolutePath);
    const kind = mediaKindForMime(mime);
    if (!kind) continue;

    let sidecar: Sidecar = {};
    try {
      sidecar = JSON.parse(await fs.readFile(`${absolutePath}.json`, 'utf8')) as Sidecar;
    } catch {
      // Utan metadatafil visas filen med enbart storlek och tid.
    }

    const stat = await fs.stat(absolutePath);
    const createdAt =
      typeof sidecar.createdAt === 'number' ? sidecar.createdAt : stat.birthtimeMs || stat.mtimeMs;
    const provider = text(sidecar.provider);
    const model = text(sidecar.model);
    const prompt = text(sidecar.prompt);

    assets.push({
      path: `${MEDIA_DIR}/${entry.name}`,
      kind,
      mime,
      bytes: stat.size,
      createdAt,
      ...(provider ? { provider } : {}),
      ...(model ? { model } : {}),
      ...(prompt ? { prompt } : {}),
      ...(typeof sidecar.costUsd === 'number' ? { costUsd: sidecar.costUsd } : {}),
    });
  }

  return assets.sort((left, right) => right.createdAt - left.createdAt);
}

/**
 * Slår upp en projektrelativ mediasökväg. Vägrar allt som ligger utanför `.freevobe/media/` –
 * punkt-punkt-segment, absoluta sökvägar och sidometadatafilerna.
 */
export function resolveMediaFile(
  root: string,
  relativePath: string,
): { absolutePath: string; mime: string } {
  const directory = path.resolve(root, MEDIA_DIR);
  const absolutePath = path.resolve(root, relativePath);
  if (!absolutePath.startsWith(`${directory}${path.sep}`)) {
    throw new Error('Filen ligger utanför media-mappen.');
  }
  if (absolutePath.endsWith('.json')) {
    throw new Error('Metadatofiler kan inte visas som media.');
  }
  const mime = mimeForMediaFile(absolutePath);
  if (!mediaKindForMime(mime)) {
    throw new Error('Filen är inte en bild, video eller ljudfil.');
  }
  return { absolutePath, mime };
}
