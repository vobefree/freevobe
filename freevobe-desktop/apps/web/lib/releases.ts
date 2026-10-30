/**
 * Releasefilerna som CI laddar upp till GitHub-releasen, se `.github/workflows/release.yml`.
 * Namnen här måste matcha filnamnen jobben ger exakt – annars blir nedladdningslänkarna 404.
 *
 * Samma namn finns i `freevobe/src/config/release.ts` (den publika startsidan). Ändrar du
 * namngivningen i workflowen måste båda ställena uppdateras.
 */

export const RELEASE_REPO = 'vobefree/freevobe';
export const RELEASE_TAG = 'v0.2.5';

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
  'Freevobe_v0.2.5_x64-setup.exe':
    'f8205e9a3f8246618e469fb7c48bc1e4a0c485a33849983afa1c17ec65a5826a',
  // Apple Silicon-dmg:n saknas i 0.2.5: GitHub avbokade arm64-kön båda gångerna. Filen läggs till
  // med workflowen `macOS Apple Silicon (.dmg)` och summan fylls i när den finns i releasen.
  'Freevobe_v0.2.5_x64.dmg': 'd425dd18559eea3d355b89e99ae1554b35ce4852d54009c2dab705b7b1da4158',
  'Freevobe_v0.2.5_amd64.AppImage':
    '1c080d79a9635b5ecf0edb90101363f3bb25aa10ed36947e4e6921f463a9588e',
  'Freevobe-Mobile_1.0.0.apk': '09540a6e314ecc01a42478b27c85558df85dbc9b35ed88e3938d7f1edc62203d',
  'freevobe-learn.html': 'bbc3db03bb13d96c2c597090b48752ee6dc1a24db3e7a7a28287b32a52e8d0cb',
};
