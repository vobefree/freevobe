import { assetUrlForTag, DOWNLOAD_LINKS, RELEASE_API_LATEST } from '@/config/release';

export type ReleaseAsset = {
  name: string;
  url: string;
  sizeBytes: number;
  downloads: number;
};

export type Release = {
  tag: string;
  name: string;
  notes: string;
  publishedAt: string;
  htmlUrl: string;
  assets: ReleaseAsset[];
};

/**
 * `missing` betyder att GitHub svarade 404 – repot finns inte eller har inga releases ännu.
 * `error` betyder att vi inte kunde fråga (nätverk, rate limit) och därför inte vet.
 */
export type ReleaseState =
  | { status: 'loading'; release: null }
  | { status: 'ready'; release: Release }
  | { status: 'missing'; release: null }
  | { status: 'error'; release: null };

export const INITIAL_RELEASE_STATE: ReleaseState = { status: 'loading', release: null };

const CACHE_KEY = 'freevobe:release:v1';
/** En timme: håller oss långt under GitHubs rate limit (60 anrop/timme oautentiserat). */
const CACHE_TTL_MS = 60 * 60 * 1000;

let state: ReleaseState = INITIAL_RELEASE_STATE;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function setState(next: ReleaseState) {
  state = next;
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): ReleaseState {
  return state;
}

export function getServerSnapshot(): ReleaseState {
  return INITIAL_RELEASE_STATE;
}

function readCache(): { fetchedAt: number; release: Release } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { fetchedAt?: unknown; release?: unknown };
    if (typeof parsed.fetchedAt !== 'number' || !parsed.release) return null;
    return parsed as { fetchedAt: number; release: Release };
  } catch {
    return null;
  }
}

function writeCache(release: Release) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), release }));
  } catch {
    // Privat läge eller full kvot – då får vi fråga API:t igen nästa gång.
  }
}

/** Gör om GitHubs JSON till vår egen form. Exporterad för att kunna testas utan nätverk. */
export function normalizeRelease(payload: unknown): Release | null {
  if (!payload || typeof payload !== 'object') return null;
  const raw = payload as Record<string, unknown>;
  const tag = typeof raw.tag_name === 'string' ? raw.tag_name : '';
  if (!tag) return null;

  const assets = Array.isArray(raw.assets)
    ? raw.assets.flatMap((entry) => {
        if (!entry || typeof entry !== 'object') return [];
        const asset = entry as Record<string, unknown>;
        if (typeof asset.name !== 'string' || typeof asset.browser_download_url !== 'string') {
          return [];
        }
        return [
          {
            name: asset.name,
            url: asset.browser_download_url,
            sizeBytes: typeof asset.size === 'number' ? asset.size : 0,
            downloads: typeof asset.download_count === 'number' ? asset.download_count : 0,
          },
        ];
      })
    : [];

  return {
    tag,
    name: typeof raw.name === 'string' && raw.name ? raw.name : tag,
    notes: typeof raw.body === 'string' ? raw.body : '',
    publishedAt: typeof raw.published_at === 'string' ? raw.published_at : '',
    htmlUrl:
      typeof raw.html_url === 'string' ? raw.html_url : `${DOWNLOAD_LINKS.all}/tag/${tag}`,
    assets,
  };
}

async function fetchLatest(): Promise<void> {
  try {
    const response = await fetch(RELEASE_API_LATEST, {
      headers: { accept: 'application/vnd.github+json' },
    });

    if (response.status === 404) {
      setState({ status: 'missing', release: null });
      return;
    }
    if (!response.ok) {
      setState({ status: 'error', release: null });
      return;
    }

    const release = normalizeRelease(await response.json());
    if (!release) {
      setState({ status: 'error', release: null });
      return;
    }
    writeCache(release);
    setState({ status: 'ready', release });
  } catch {
    setState({ status: 'error', release: null });
  }
}

/**
 * Startar (högst) en förfrågan. Cachat svar visas direkt medan ett nytt hämtas i bakgrunden, så
 * sidan varken väntar på nätet eller hamnar i layoutskifte.
 */
export function ensureRelease(): void {
  if (typeof window === 'undefined' || inflight) return;

  const cached = readCache();
  if (cached) {
    setState({ status: 'ready', release: cached.release });
    if (Date.now() - cached.fetchedAt < CACHE_TTL_MS) return;
  }

  inflight = fetchLatest().finally(() => {
    inflight = null;
  });
}

/** Endast för tester. */
export function resetReleaseState() {
  state = INITIAL_RELEASE_STATE;
  inflight = null;
}

export type Platform = 'windows' | 'macAppleSilicon' | 'macIntel' | 'linux' | 'unknown';

export const PLATFORM_LABELS: Record<Exclude<Platform, 'unknown'>, string> = {
  windows: 'Windows',
  macAppleSilicon: 'macOS (Apple Silicon)',
  macIntel: 'macOS (Intel)',
  linux: 'Linux',
};

export const PLATFORM_FILE_LABELS: Record<Exclude<Platform, 'unknown'>, string> = {
  windows: '.exe',
  macAppleSilicon: '.dmg',
  macIntel: '.dmg',
  linux: '.AppImage',
};

/**
 * Gissar användarens plattform i webbläsaren. macOS-armkitektur går inte att läsa ur user-agenten
 * pålitligt, så vi frågar UA Client Hints när webbläsaren stödjer det och antar Apple Silicon
 * annars (den vanligaste Macen idag). Båda macOS-filerna finns alltid som egna knappar.
 */
export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = `${navigator.userAgent} ${navigator.platform ?? ''}`;

  // Mobil kan inte installera skrivbordsapparna – då får släppsidan ta över.
  if (/Android|iPhone|iPad|iPod/i.test(ua)) return 'unknown';
  if (/Windows|Win32|Win64/i.test(ua)) return 'windows';
  if (/Linux|X11|CrOS/i.test(ua)) return 'linux';
  if (/Macintosh|Mac OS X|MacIntel/i.test(ua)) return 'macAppleSilicon';
  return 'unknown';
}

type NavigatorWithHints = Navigator & {
  userAgentData?: { getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string }> };
};

/** Förfinar macOS-valet med UA Client Hints när det går. */
export async function refineMacArchitecture(platform: Platform): Promise<Platform> {
  if (platform !== 'macAppleSilicon' && platform !== 'macIntel') return platform;
  const navigatorWithHints = navigator as NavigatorWithHints;
  try {
    const hints = await navigatorWithHints.userAgentData?.getHighEntropyValues?.(['architecture']);
    const architecture = hints?.architecture ?? '';
    if (/x86/i.test(architecture)) return 'macIntel';
    if (/arm/i.test(architecture)) return 'macAppleSilicon';
  } catch {
    // Ingen UA-CH (t.ex. Firefox/Safari) – behåll standardvalet.
  }
  return platform;
}

/**
 * Mönster i preferensordning: första träffen vinner. Flera mönster behövs när en plattform har
 * flera arkitekturer i samma release (t.ex. Linux x86_64 och arm64 AppImage) – då ska x86_64 väljas
 * först, eftersom det är det vanligaste.
 */
const ASSET_PATTERNS: Record<Exclude<Platform, 'unknown'>, RegExp[]> = {
  windows: [/(_x64-setup\.exe|-setup\.exe|x64[^/]*\.exe)$/i, /\.exe$/i],
  macAppleSilicon: [/(aarch64|arm64)[^/]*\.dmg$/i],
  macIntel: [/(x64|x86_64|intel|amd64)[^/]*\.dmg$/i],
  linux: [/(x86_64|amd64|x64)[^/]*\.AppImage$/i, /\.AppImage$/i],
};

/** Första tillgång som matchar något av plattformens mönster, i preferensordning. */
function findAsset(
  assets: Release['assets'],
  platform: Exclude<Platform, 'unknown'>,
): Release['assets'][number] | undefined {
  for (const pattern of ASSET_PATTERNS[platform]) {
    const match = assets.find((asset) => pattern.test(asset.name));
    if (match) return match;
  }
  return undefined;
}

/** En .dmg utan arkitektur i namnet är oftast en universal-binär som passar båda Macarna. */
const DMG = /\.dmg$/i;
const ARCH_HINT = /(aarch64|arm64|x64|x86_64|intel|amd64)/i;

/**
 * Rätt installationsfil, i tur och ordning:
 *  1. den fil som faktiskt ligger i releasen,
 *  2. en universal-dmg när releasen inte skiljer på Mac-arkitekturerna,
 *  3. den förväntade adressen med releasens tagg (när releasen saknar tillgångar),
 *  4. releasens sida – hellre än en gissad länk som 404:ar,
 *  5. den förväntade adressen från src/config/release.ts när releasen är okänd.
 */
export function assetUrlFor(platform: Exclude<Platform, 'unknown'>, release: Release | null): string {
  if (release) {
    const exact = findAsset(release.assets, platform);
    if (exact) return exact.url;

    // Universal-dmg (utan arkitektur i namnet) fungerar på både Apple Silicon och Intel.
    if (platform === 'macAppleSilicon' || platform === 'macIntel') {
      const universal = release.assets.find(
        (asset) => DMG.test(asset.name) && !ARCH_HINT.test(asset.name),
      );
      if (universal) return universal.url;
    }

    // Releasen finns och har filer, men ingen för den här plattformen: låt användaren välja själv.
    if (release.assets.length > 0) return release.htmlUrl;
    return assetUrlForTag(platform, release.tag);
  }
  return DOWNLOAD_LINKS[platform];
}

/**
 * Etiketten och adressen för versionsmärket. Ren funktion så att alla tre lägena kan testas utan
 * nätverk:
 *  – `ready`: "Latest release v0.1.0" mot releasen,
 *  – `missing`: "View releases" mot släppsidan (repot finns inte eller har inga releaser),
 *  – `loading`/`error`: "Latest release" utan versionsnummer – GitHub svarade inte, så vi gissar inte.
 */
export function releaseBadge(state: ReleaseState): { label: string; href: string } {
  if (state.status === 'ready') {
    return { label: `Latest release ${state.release.tag}`, href: state.release.htmlUrl };
  }
  if (state.status === 'missing') {
    return { label: 'View releases', href: DOWNLOAD_LINKS.all };
  }
  return { label: 'Latest release', href: DOWNLOAD_LINKS.latest };
}
