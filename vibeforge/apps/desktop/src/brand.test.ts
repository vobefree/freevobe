// @vitest-environment node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
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
  identifier: string;
  app: { windows: { title: string }[]; trayIcon: { tooltip: string } };
  bundle: {
    publisher: string;
    copyright: string;
    longDescription: string;
    targets: string[];
    icon: string[];
    windows: { nsis: { installMode: string; languages: string[] } };
    linux: { deb: { depends: string[] } };
  };
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

  it('bygger en installerare per operativsystem, med samma namn i alla', () => {
    // Windows: Freevobe_<version>_x64-setup.exe → Start-menyn och Program Files\Freevobe.
    // macOS: Freevobe.app i Freevobe_<version>_<arch>.dmg.
    // Linux: Freevobe_<version>_amd64.AppImage (och freevobe_<version>_amd64.deb).
    expect(config.bundle.targets).toEqual(expect.arrayContaining(['nsis', 'dmg', 'appimage']));
    expect(config.bundle.windows.nsis.languages).toContain('English');
    expect(config.bundle.windows.nsis.languages).toContain('Swedish');

    // AppImage kräver ingen installation, men deb-paketet måste dra in webkit och gtk.
    expect(config.bundle.linux.deb.depends.length).toBeGreaterThan(0);

    // Ikonerna är det användaren ser bredvid namnet i Start-menyn, Dock och appmenyn.
    for (const icon of config.bundle.icon) {
      const path = join(appRoot, 'src-tauri', icon);
      expect(existsSync(path), `saknar ${icon}`).toBe(true);
      expect(statSync(path).size).toBeGreaterThan(100);
    }
  });

  it('behåller det gamla paket-ID:t så en ny installerare ersätter den gamla', () => {
    // identifier styr Windows appdata, .deb-paketets installationspost och macOS bundle-ID.
    // Den byttes aldrig vid namnbytet: en ny identifier hade blivit en andra installation bredvid
    // v0.1.0, med dubbla Start-meny poster och en tom profil.
    expect(config.identifier).toBe('dev.vibeforge.desktop');
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
