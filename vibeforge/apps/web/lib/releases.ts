/**
 * Releasefilerna som CI laddar upp till GitHub-releasen, se `.github/workflows/release.yml`.
 * Namnen här måste matcha filnamnen jobben ger exakt – annars blir nedladdningslänkarna 404.
 *
 * Samma namn finns i `freevobe/src/config/release.ts` (den publika startsidan). Ändrar du
 * namngivningen i workflowen måste båda ställena uppdateras.
 */

export const RELEASE_REPO = 'vobefree/freevobe';
export const RELEASE_TAG = 'v0.1.0';

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
  'Freevobe_v0.1.0_x64-setup.exe':
    'a1446e2d4425b28c375efa4278f029ad4462418e5c1597ab5a572980037fdae4',
  'Freevobe_v0.1.0_aarch64.dmg': '4783a6d4b00c38eb2a34f9ebd260e0781397b10d4d4fbf4d04edd0bf57371461',
  'Freevobe_v0.1.0_x64.dmg': '39abb4f9278ccaede265c49223b552812d7b43c658d8427a40b7b47382cd7ecf',
  'Freevobe_v0.1.0_amd64.AppImage':
    '5a55960baa2376cbb95bd8226c98fdbc315610ad62f7fcdbf13018234877c64f',
  'Freevobe-Mobile_1.0.0.apk': '74aa14ed121f5edf42a2abd546e3308cb48b963c90f5e698861a01c2360f81a7',
};
