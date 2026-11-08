import fs from 'node:fs/promises';
import path from 'node:path';
import { summarizeMediaSpend, type MediaSpendSummary } from '@freevobe/protocol';
import { MEDIA_DIR } from './service.js';

interface SidecarCost {
  costUsd?: unknown;
  createdAt?: unknown;
}

/**
 * Läser kostnad och tid ur metadatafilerna i projektets media-mapp. Används av den dagliga
 * budgeten: summan räknas fram ur det som faktiskt sparats, inte ur en separat räknare som kan
 * hamna i otakt med diskens innehåll. Metadatafilerna innehåller aldrig några nycklar.
 */
export async function readMediaSpend(root: string, now = Date.now()): Promise<MediaSpendSummary> {
  const directory = path.join(path.resolve(root), MEDIA_DIR);
  let names: string[];
  try {
    names = await fs.readdir(directory);
  } catch {
    return { totalUsd: 0, todayUsd: 0, count: 0 };
  }

  const entries: { costUsd: number; createdAt: number }[] = [];
  for (const name of names) {
    if (!name.endsWith('.json') || name.startsWith('.')) continue;
    try {
      const parsed = JSON.parse(
        await fs.readFile(path.join(directory, name), 'utf8'),
      ) as SidecarCost;
      if (typeof parsed.costUsd !== 'number' || !Number.isFinite(parsed.costUsd)) continue;
      entries.push({
        costUsd: parsed.costUsd,
        createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : 0,
      });
    } catch {
      // En trasig eller halvskriven metadatafil ska inte stoppa en ny körning.
    }
  }

  return summarizeMediaSpend(entries, now);
}
