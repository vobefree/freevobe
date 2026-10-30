/**
 * Automatisk uppdatering.
 *
 * Tauri-uppdateraren finns bara i den installerade appen. I webbläsaren (och i testerna) saknas
 * `window.__TAURI_INTERNALS__`, och då gör modulen ingenting – appen ska fungera lika bra utan.
 *
 * Adressen till latest.json och den publika nycken står i `tauri.conf.json`; här sköts bara
 * kontrollen, nedladdningen och omstarten.
 */
import type { Update } from '@tauri-apps/plugin-updater';

export interface UpdateInfo {
  /** Versionen som finns att hämta, t.ex. "0.3.0". */
  version: string;
  /** Versionen som körs just nu. */
  currentVersion: string;
  /** Releaseanteckningarna, om releasen har några. */
  notes?: string;
}

/** Finns Tauri-runtime? Då kan appen uppdatera sig själv. */
export function canUpdate(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

// Uppdateringen hämtas en gång och sparas: `installUpdate` måste använda samma objekt som
// kontrollen gav, annars vet Tauri inte vilken fil som ska laddas ner.
let pending: Update | null = null;

/**
 * Frågar latest.json om det finns en nyare version. Returnerar null när appen redan är senaste,
 * när den körs i webbläsaren eller när servern inte svarar – en misslyckad kontroll ska aldrig
 * synas som ett fel i appen.
 */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (!canUpdate()) return null;

  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check();
    if (!update) return null;
    pending = update;
    return {
      version: update.version,
      currentVersion: update.currentVersion,
      notes: update.body ?? undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Laddar ner och installerar uppdateringen och startar om appen. `onProgress` får en andel mellan
 * 0 och 1 när servern anger filens storlek.
 */
export async function installUpdate(onProgress?: (fraction: number) => void): Promise<void> {
  if (!pending) throw new Error('Ingen uppdatering att installera.');

  let downloaded = 0;
  let total = 0;
  await pending.downloadAndInstall((event) => {
    if (event.event === 'Started') {
      total = event.data.contentLength ?? 0;
    } else if (event.event === 'Progress') {
      downloaded += event.data.chunkLength;
      if (total > 0) onProgress?.(Math.min(downloaded / total, 1));
    } else if (event.event === 'Finished') {
      onProgress?.(1);
    }
  });

  // Installationen är klar först när processen startas om i den nya versionen.
  const { relaunch } = await import('@tauri-apps/plugin-process');
  await relaunch();
}
