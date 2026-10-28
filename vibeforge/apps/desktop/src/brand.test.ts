// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Installationsvakthund: namnet som syns i operativsystemet (Start-menyn, Program Files,
 * .app-paketet, avinstallationsposten, fönstret och tray-ikonen) kommer från tauri.conf.json.
 * Ändrar någon tillbaka det gamla namnet ska det här testet falla – en installerare som heter
 * rätt men visar fel namn är precis den bugg det är tänkt att fånga.
 */
const appRoot = fileURLToPath(new URL('..', import.meta.url));
const read = (relativePath: string) => readFileSync(join(appRoot, relativePath), 'utf8');

interface TauriConfig {
  productName: string;
  mainBinaryName: string;
  app: { windows: { title: string }[]; trayIcon: { tooltip: string } };
  bundle: { publisher: string; copyright: string; longDescription: string };
}

const config = JSON.parse(read('src-tauri/tauri.conf.json')) as TauriConfig;
const mainWindow = config.app.windows[0];

// Delarna byggs ihop i stället för att stå som hela strängar, så att filen själv inte
// räknas som en träff när källkoden genomsöks nedan.
const OLD_NAME = ['Vibe', 'Forge'].join('');
const OLD_WORDMARK = ['Vibe', '<span'].join('');

describe('installationsidentitet', () => {
  it('namnger appen Freevobe i fälten operativsystemet visar', () => {
    expect(config.productName).toBe('Freevobe');
    expect(mainWindow?.title).toBe('Freevobe');
    expect(config.app.trayIcon.tooltip).toBe('Freevobe');
    expect(config.bundle.publisher).toBe('Freevobe');
    expect(config.bundle.copyright).toContain('Freevobe');
    expect(config.bundle.longDescription).toContain('Freevobe');
  });

  it('döper huvudbinären så att filnamnet i installationen stämmer', () => {
    // Utan det här heter binären fortfarande vibeforge-desktop.exe i Program Files och .app-paketet.
    expect(config.mainBinaryName).toBe('Freevobe');
  });

  it('titeln i HTML-skalet följer produktnamnet', () => {
    expect(read('index.html')).toContain('<title>Freevobe</title>');
  });

  it('behåller inget gammalt produktnamn i gränssnittskoden', () => {
    const files = readdirSync(join(appRoot, 'src'), { recursive: true })
      .map((entry) => String(entry))
      .filter((entry) => /\.(tsx?|css)$/.test(entry));
    expect(files.length).toBeGreaterThan(20);

    const offenders = files.filter((entry) => {
      const text = readFileSync(join(appRoot, 'src', entry), 'utf8');
      return text.includes(OLD_NAME) || text.includes(OLD_WORDMARK);
    });

    expect(offenders).toEqual([]);
  });
});
