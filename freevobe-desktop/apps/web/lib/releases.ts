/**
 * Releasefilerna som CI laddar upp till GitHub-releasen, se `.github/workflows/release.yml`.
 * Namnen här måste matcha filnamnen jobben ger exakt – annars blir nedladdningslänkarna 404.
 *
 * Samma namn finns i `freevobe/src/config/release.ts` (den publika startsidan). Ändrar du
 * namngivningen i workflowen måste båda ställena uppdateras.
 */

export const RELEASE_REPO = 'vobefree/freevobe';
export const RELEASE_TAG = 'v0.2.0';

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
  'Freevobe_v0.2.0_x64-setup.exe':
    '8d7d61c2dceff87dcebbb1655233189359a51bc830dc40860d8cefa0be553462',
  'Freevobe_v0.2.0_aarch64.dmg': '2a5b9d69d60f1b3eecf2e33f792490790a8130a06ce2c03c63db0068f8556675',
  'Freevobe_v0.2.0_x64.dmg': 'b15069be78cc6813d54456430e17bbefb457d8216d2ccb702e02a6322c7181a5',
  'Freevobe_v0.2.0_amd64.AppImage':
    'f9f8ee3e15017819097d6e4c22cfa7859bb6a5eb8df593f056eabe522a0b0308',
  'Freevobe-Mobile_1.0.0.apk': 'f93553eae3c10fd7dec7067284b5f5550f44fd37f42288bc1114847d74b36df7',
  'freevobe-learn.html': 'bbc3db03bb13d96c2c597090b48752ee6dc1a24db3e7a7a28287b32a52e8d0cb',
};
