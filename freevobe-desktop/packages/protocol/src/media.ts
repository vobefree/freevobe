import type { MediaKind } from './providers.js';

/**
 * En fil som agenten har skapat och som gränssnittet kan visa. Sökvägen är projektrelativ och
 * pekar alltid in i `.freevobe/media/`; servern vägrar läsa något annat.
 */
export interface MediaAsset {
  path: string;
  kind: MediaKind;
  mime: string;
  bytes: number;
  createdAt: number;
  /** Provider och modell som skapade filen, när metadatafilen finns kvar. */
  provider?: string;
  model?: string;
  prompt?: string;
  costUsd?: number;
}

export interface MediaLibraryResponse {
  /** Projektrelativ mapp, t.ex. `.freevobe/media`. */
  directory: string;
  assets: MediaAsset[];
}

/** Summan av de kostnader som metadatafilerna känner till. Alltid en uppskattning. */
export interface MediaSpendSummary {
  totalUsd: number;
  todayUsd: number;
  /** Antal filer med en känd kostnad. */
  count: number;
}

function sameLocalDay(left: number, right: number): boolean {
  const a = new Date(left);
  const b = new Date(right);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Räknar ihop kostnaden för en lista medier. Dagens summa jämförs mot den lokala dagens datum,
 * eftersom budgeten gäller användarens dag och inte UTC.
 */
export function summarizeMediaSpend(
  assets: Pick<MediaAsset, 'costUsd' | 'createdAt'>[],
  now = Date.now(),
): MediaSpendSummary {
  let total = 0;
  let today = 0;
  let count = 0;
  for (const asset of assets) {
    if (typeof asset.costUsd !== 'number' || !Number.isFinite(asset.costUsd)) continue;
    total += asset.costUsd;
    count += 1;
    if (sameLocalDay(asset.createdAt, now)) today += asset.costUsd;
  }
  const round = (value: number) => Number(value.toFixed(4));
  return { totalUsd: round(total), todayUsd: round(today), count };
}

/** Filnamnet som används i chatten när en körning har skapat media. */
export function mediaFileName(path: string): string {
  return path.split('/').pop() ?? path;
}

/** Gissar sorten ur filändelsen. Används bara för att välja förhandsvisning i UI:t. */
export function mediaKindFromPath(path: string): MediaKind {
  const extension = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  if (['mp4', 'webm', 'mov', 'mkv'].includes(extension)) return 'video';
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(extension)) return 'audio';
  return 'image';
}
