/**
 * Releasefilerna som CI laddar upp till GitHub-releasen, se `.github/workflows/release.yml`.
 * Namnen här måste matcha filnamnen jobben ger exakt – annars blir nedladdningslänkarna 404.
 *
 * Samma namn finns i `freevobe/src/config/release.ts` (den publika startsidan). Ändrar du
 * namngivningen i workflowen måste båda ställena uppdateras.
 */

export const RELEASE_REPO = 'vobefree/freevobe';
export const RELEASE_TAG = 'v0.2.4';

/** Mobilappens egen version (`freevobe-mobile/app.json`), inte releasetaggens. */
export const MOBILE_VERSION = '1.0.0';

export const RELEASE_PAGE_URL = `https://github.com/${RELEASE_REPO}/releases/tag/${RELEASE_TAG}`;
export const ALL_RELEASES_URL = `https://github.com/${RELEASE_REPO}/releases/latest`;

const DOWNLOAD_BASE = `https://github.com/${RELEASE_REPO}/releases/download/${RELEASE_TAG}`;

export interface ReleaseAsset {
  id: string;
  platform: string;
  architecture: string;
  file: string;
  requirement: string;
}

export const RELEASE_ASSETS: ReleaseAsset[] = [
  {
    id: 'windows-x64',
    platform: 'Windows',
    architecture: 'x64',
    file: `Freevobe_${RELEASE_TAG}_x64-setup.exe`,
    requirement: 'Windows 10 eller senare.',
  },
  {
    id: 'macos-arm64',
    platform: 'macOS',
    architecture: 'Apple Silicon',
    file: `Freevobe_${RELEASE_TAG}_aarch64.dmg`,
    requirement: 'macOS 11 eller senare (M1 och senare).',
  },
  {
    id: 'macos-x64',
    platform: 'macOS',
    architecture: 'Intel',
    file: `Freevobe_${RELEASE_TAG}_x64.dmg`,
    requirement: 'macOS 11 eller senare (Intel).',
  },
  {
    id: 'linux-amd64',
    platform: 'Linux',
    architecture: 'x86-64',
    file: `Freevobe_${RELEASE_TAG}_amd64.AppImage`,
    requirement: 'WebKitGTK 4.1 och FUSE.',
  },
  {
    id: 'android',
    platform: 'Android',
    architecture: 'APK',
    file: `Freevobe-Mobile_${MOBILE_VERSION}.apk`,
    requirement: 'Android 8 eller senare. Kräver skrivbordsappen på samma nätverk.',
  },
];

/** Direktadress till en fil i den här releasen. */
export function assetUrl(file: string): string {
  return `${DOWNLOAD_BASE}/${file}`;
}

/**
 * SHA-256 för varje fil i releasen. Värdena är GitHubs egna asset-digest för de uppladdade
 * filerna, så de beskriver exakt de bytes som ligger i releasen. Fyll på när en ny release
 * publiceras – saknas en summa visas filen utan kontrollrad i stället för med en gissning.
 */
export const RELEASE_SHA256: Record<string, string> = {
  'Freevobe_v0.2.4_x64-setup.exe':
    '0a931d0b0b1618d52a19b49a066a2cdaeb8e62b5273f91e06b38b4693bc57cd7',
  'Freevobe_v0.2.4_aarch64.dmg': '02cd7f7e8dd8137ae19a1686973130ac9235b2cf53972bc3ed84382316a1c1de',
  'Freevobe_v0.2.4_x64.dmg': 'f1cf812587fb4d484efdf1a298cf77a4bc663e92c736eb5e525d41d9d6978c75',
  'Freevobe_v0.2.4_amd64.AppImage':
    '676ac5b20616bba93263f44478a93be1c753ac3e7cc77fca6acb1cc8aa148ca9',
  'Freevobe-Mobile_1.0.0.apk': 'c948f0e4f201b660d198550666dd12bffb9ee7376245f682cc151e9eacba358d',
  'freevobe-learn.html': 'bbc3db03bb13d96c2c597090b48752ee6dc1a24db3e7a7a28287b32a52e8d0cb',
};
