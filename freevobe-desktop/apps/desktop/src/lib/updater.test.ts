// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UpdateInfo } from './updater';

const check = vi.fn();
const downloadAndInstall = vi.fn();
const relaunch = vi.fn();

vi.mock('@tauri-apps/plugin-updater', () => ({ check: () => check() }));
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: () => relaunch() }));

interface UpdaterModule {
  canUpdate: () => boolean;
  checkForUpdate: () => Promise<UpdateInfo | null>;
  installUpdate: (onProgress?: (fraction: number) => void) => Promise<void>;
}

/** Modulen sparar uppdateringen mellan kontrollen och installationen – därför en färsk modul per test. */
async function loadUpdater(): Promise<UpdaterModule> {
  vi.resetModules();
  return import('./updater');
}

beforeEach(() => {
  vi.clearAllMocks();
  delete (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  check.mockResolvedValue(null);
  downloadAndInstall.mockResolvedValue(undefined);
  relaunch.mockResolvedValue(undefined);
});

afterEach(() => {
  delete (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
});

describe('canUpdate', () => {
  it('är falskt i webbläsaren och sant i den installerade appen', async () => {
    const { canUpdate } = await loadUpdater();
    expect(canUpdate()).toBe(false);

    (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    expect(canUpdate()).toBe(true);
  });
});

describe('checkForUpdate', () => {
  it('frågar inte uppdateraren när appen körs i webbläsaren', async () => {
    const { checkForUpdate } = await loadUpdater();
    expect(await checkForUpdate()).toBeNull();
    expect(check).not.toHaveBeenCalled();
  });

  it('returnerar version och anteckningar när det finns en nyare version', async () => {
    (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    check.mockResolvedValue({
      version: '0.3.0',
      currentVersion: '0.2.5',
      body: 'Modellfixen',
    });

    const { checkForUpdate } = await loadUpdater();
    await expect(checkForUpdate()).resolves.toEqual({
      version: '0.3.0',
      currentVersion: '0.2.5',
      notes: 'Modellfixen',
    });
  });

  it('sväljer ett fel från servern – en misslyckad kontroll ska inte synas i appen', async () => {
    (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    check.mockRejectedValue(new Error('404'));

    const { checkForUpdate } = await loadUpdater();
    await expect(checkForUpdate()).resolves.toBeNull();
  });
});

describe('installUpdate', () => {
  it('laddar ner, rapporterar andel och startar om', async () => {
    (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    // Tauri:s check() ger ett Update-objekt som bär nedladdningen; det är samma objekt som
    // installationen sedan använder.
    check.mockResolvedValue({
      version: '0.3.0',
      currentVersion: '0.2.5',
      body: null,
      downloadAndInstall,
    });
    downloadAndInstall.mockImplementation(async (onEvent: (event: unknown) => void) => {
      onEvent({ event: 'Started', data: { contentLength: 200 } });
      onEvent({ event: 'Progress', data: { chunkLength: 100 } });
      onEvent({ event: 'Finished', data: {} });
    });

    const { checkForUpdate, installUpdate } = await loadUpdater();
    await checkForUpdate();

    const fractions: number[] = [];
    await installUpdate((fraction) => fractions.push(fraction));

    expect(fractions).toEqual([0.5, 1]);
    expect(relaunch).toHaveBeenCalledTimes(1);
  });

  it('kastar när ingen uppdatering har hämtats', async () => {
    const { installUpdate } = await loadUpdater();
    await expect(installUpdate()).rejects.toThrow('Ingen uppdatering att installera.');
    expect(downloadAndInstall).not.toHaveBeenCalled();
  });
});
