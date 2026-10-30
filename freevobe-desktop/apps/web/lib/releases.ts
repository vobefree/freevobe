/**
 * Releasefilerna som CI laddar upp till GitHub-releasen, se `.github/workflows/release.yml`.
 * Namnen här måste matcha filnamnen jobben ger exakt – annars blir nedladdningslänkarna 404.
 *
 * Samma namn finns i `freevobe/src/config/release.ts` (den publika startsidan). Ändrar du
 * namngivningen i workflowen måste båda ställena uppdateras.
 */

export const RELEASE_REPO = 'vobefree/freevobe';
export const RELEASE_TAG = 'v0.2.2';

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
  'Freevobe_v0.2.2_x64-setup.exe':
    '1dc56ae101fa0cce19d37053f64df9cedfea7e9613ab52ad10490b534596eb4f',
  'Freevobe_v0.2.2_aarch64.dmg': '10d291dbdb49de3c542883f2c29700354e0fdc6451cd58b23519f4827da69f66',
  'Freevobe_v0.2.2_x64.dmg': '36a609c2a5fa4896f63b435dc8c34993ea5d1bd078a097bb4f0c9877c26dffca',
  'Freevobe_v0.2.2_amd64.AppImage':
    'fb378ba8923068cf9a88ecdbef8e21f81eb3a8154ea9014b9a8b0c4b8c586f25',
  'Freevobe-Mobile_1.0.0.apk': '2e0aaf6ec1060f3d14bddf22977a27eb29fd922eb1fd06213ba57dc401a5761f',
  'freevobe-learn.html': 'bbc3db03bb13d96c2c597090b48752ee6dc1a24db3e7a7a28287b32a52e8d0cb',
};
