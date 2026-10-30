/**
 * Enda källan för var Freevobe publiceras. Inga nedladdningslänkar får hårdkodas någon annanstans –
 * alla knappar läser härifrån (direkt eller via src/lib/release.ts).
 *
 * Byter du repo (fork, annat konto) räcker det att sätta miljövariabeln NEXT_PUBLIC_RELEASE_REPO vid
 * bygget – annars används den repo som projektet redan pekar ut i src/lib/site.ts.
 *
 * Filnamnen nedan måste matcha det som CI laddar upp till releasen. De används som fallback när
 * GitHub-API:t inte kan svara; när API:t svarar hittas rätt fil bland release-tillgångarna.
 */

const REPO_FALLBACK = 'vobefree/freevobe';
const TAG_FALLBACK = 'v0.2.4';

/**
 * GitHub-repo på formen "agare/repo". Tål att man klistrar in en hel URL.
 * Ingen procentkodning: GitHub-sökvägar är ASCII, och kodning skulle förvanska namnet.
 */
function normalizeRepo(input: string): string {
  const cleaned = input
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/^\/+|\/+$/g, '');
  return cleaned || REPO_FALLBACK;
}

export const RELEASE_REPO = normalizeRepo(process.env.NEXT_PUBLIC_RELEASE_REPO || REPO_FALLBACK);

/** Senaste kända tagg. Används för att bygga filnamnen nedan. */
export const RELEASE_TAG = (process.env.NEXT_PUBLIC_RELEASE_TAG || TAG_FALLBACK).trim();

const base = `https://github.com/${RELEASE_REPO}/releases`;

/**
 * Mobilappens version. APK:n namnges efter appens egen version (freevobe-mobile/app.json), inte
 * efter releasetaggen, eftersom appversionen är det Android visar i Inställningar. Håll de två i
 * takt – annars hittas filen bara via GitHub-API:t, aldrig via den förväntade adressen.
 */
export const MOBILE_APP_VERSION = (process.env.NEXT_PUBLIC_MOBILE_VERSION || '1.0.0').trim();

/**
 * Filnamnen som CI laddar upp till varje release. Ändrar du namnen i release-workflowen måste de
 * ändras här också – annars hittas filen bara via GitHub-API:t, inte via den förväntade adressen.
 */
export const ASSET_FILE_NAMES = {
  windows: (tag: string) => `Freevobe_${tag}_x64-setup.exe`,
  macAppleSilicon: (tag: string) => `Freevobe_${tag}_aarch64.dmg`,
  macIntel: (tag: string) => `Freevobe_${tag}_x64.dmg`,
  linux: (tag: string) => `Freevobe_${tag}_amd64.AppImage`,
  android: () => `Freevobe-Mobile_${MOBILE_APP_VERSION}.apk`,
  // Learn är en egen app: en enda HTML-fil som laddas ner, öppnas och spelas offline.
  learn: () => 'freevobe-learn.html',
} as const;

/** Direktadress till en plattformsfil för en viss tagg. */
export function assetUrlForTag(
  platform: keyof typeof ASSET_FILE_NAMES,
  tag: string = RELEASE_TAG,
): string {
  return `https://github.com/${RELEASE_REPO}/releases/download/${tag}/${ASSET_FILE_NAMES[platform](tag)}`;
}

/**
 * Filen med SHA-256-summan för varje releasefil, i `sha256sum`-format. Release-workflowen skapar den
 * och laddar upp den bredvid installationsfilerna, så den kan användas direkt:
 * `sha256sum -c SHA256SUMS.txt`.
 */
export const CHECKSUMS_FILE_NAME = 'SHA256SUMS.txt';

/** Direktadress till kontrollsummefilen för en viss tagg. */
export function checksumsUrlForTag(tag: string = RELEASE_TAG): string {
  return `https://github.com/${RELEASE_REPO}/releases/download/${tag}/${CHECKSUMS_FILE_NAME}`;
}

export const DOWNLOAD_LINKS = {
  latest: `${base}/latest`,
  all: base,
  windows: assetUrlForTag('windows'),
  macAppleSilicon: assetUrlForTag('macAppleSilicon'),
  macIntel: assetUrlForTag('macIntel'),
  linux: assetUrlForTag('linux'),
  android: assetUrlForTag('android'),
  learn: assetUrlForTag('learn'),
} as const;

/** GitHub-sidan för repot (används av nav, footer och "Star on GitHub"). */
export const RELEASE_REPO_URL = `https://github.com/${RELEASE_REPO}`;

/** API-endpoint för senaste release. */
export const RELEASE_API_LATEST = `https://api.github.com/repos/${RELEASE_REPO}/releases/latest`;

export type DownloadKey = keyof Pick<
  typeof DOWNLOAD_LINKS,
  'windows' | 'macAppleSilicon' | 'macIntel' | 'linux' | 'android'
>;
