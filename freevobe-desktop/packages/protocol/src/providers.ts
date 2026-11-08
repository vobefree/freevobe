/**
 * Providers: varifrån modellerna kommer.
 *
 * Ollama är lokal och standard. Anthropic, Google och xAI är valfria molnleverantörer som
 * användaren själv aktiverar och ger en egen API-nyckel – nyckeln lämnar aldrig datorn och
 * skickas bara till leverantörens eget API när användaren har slagit på providern.
 *
 * Protokollet beskriver bara FORMEN: id:n, capabilities och modeller. All text som visas för
 * användaren bor i locale-filerna, så servern skickar aldrig språkberoende strängar.
 */

export const PROVIDER_IDS = ['ollama', 'anthropic', 'google', 'xai'] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

/**
 * Vad en provider eller modell kan leverera. `text` och `code` räknas som samma sak: kod är text
 * med ett annat syfte, och routing skiljer dem inte.
 */
export const PROVIDER_CAPABILITIES = [
  'text',
  'vision',
  'tools',
  'image_gen',
  'video_gen',
  'audio_gen',
] as const;

export type ProviderCapability = (typeof PROVIDER_CAPABILITIES)[number];

/** `local` betyder att providern redan finns på datorn och inte kräver någon nyckel. */
export type ProviderAuthType = 'local' | 'api_key';

/** De tre sorters media som kan genereras. */
export type MediaKind = 'image' | 'video' | 'audio';

export const MEDIA_KINDS = ['image', 'video', 'audio'] as const;

/** Leverantörer som kan generera media. Ollama och Claude kan det inte. */
export const MEDIA_PROVIDER_IDS = ['google', 'xai'] as const;

export type MediaProviderId = (typeof MEDIA_PROVIDER_IDS)[number];

export interface ProviderCost {
  /** Vad priset avser. `per_unit` är en bild, en videosekund eller ett ljudspår. */
  unit: 'image' | 'video_second' | 'audio_track';
  /** Ungefärligt pris i USD. Leverantörerna ändrar priser – siffran är en uppskattning. */
  usd: number;
}

export interface ProviderModel {
  /** Modellens id hos leverantören, t.ex. `gemini-3.1-flash-image`. */
  id: string;
  capabilities: ProviderCapability[];
  /** Ungefärligt pris när det är känt. Saknas för lokala modeller. */
  cost?: ProviderCost;
}

export interface ProviderDefinition {
  id: ProviderId;
  /** Två tecken i providerns ikonplatta, t.ex. `AN`. */
  icon: string;
  authType: ProviderAuthType;
  /** Bas-URL till leverantörens API. Tom för Ollama, som har en konfigurerbar adress. */
  baseUrl: string;
  /** Var användaren hämtar en API-nyckel. */
  keyUrl?: string;
  capabilities: ProviderCapability[];
  models: ProviderModel[];
}

/**
 * Katalogen är statisk och ordningen är stabil: Ollama först (standard), därefter molnet i den
 * ordning UI:t visar dem.
 */
export const PROVIDER_CATALOG: readonly ProviderDefinition[] = [
  {
    id: 'ollama',
    icon: 'OL',
    authType: 'local',
    baseUrl: '',
    capabilities: ['text', 'tools'],
    models: [],
  },
  {
    id: 'anthropic',
    icon: 'AN',
    authType: 'api_key',
    baseUrl: 'https://api.anthropic.com',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    capabilities: ['text', 'vision', 'tools'],
    models: [
      { id: 'claude-sonnet-4-5', capabilities: ['text', 'vision', 'tools'] },
      { id: 'claude-haiku-4-5', capabilities: ['text', 'vision', 'tools'] },
    ],
  },
  {
    id: 'google',
    icon: 'GE',
    authType: 'api_key',
    baseUrl: 'https://generativelanguage.googleapis.com',
    keyUrl: 'https://aistudio.google.com/apikey',
    capabilities: ['text', 'vision', 'image_gen', 'video_gen', 'audio_gen'],
    models: [
      { id: 'gemini-3-pro', capabilities: ['text', 'vision'] },
      {
        id: 'gemini-3.1-flash-image',
        capabilities: ['image_gen', 'vision'],
        cost: { unit: 'image', usd: 0.02 },
      },
      {
        id: 'gemini-3-pro-image',
        capabilities: ['image_gen', 'vision'],
        cost: { unit: 'image', usd: 0.05 },
      },
      {
        id: 'gemini-omni-1.1-flash',
        capabilities: ['video_gen', 'vision', 'audio_gen'],
        cost: { unit: 'video_second', usd: 0.08 },
      },
    ],
  },
  {
    id: 'xai',
    icon: 'XA',
    authType: 'api_key',
    baseUrl: 'https://api.x.ai',
    keyUrl: 'https://console.x.ai',
    capabilities: ['text', 'image_gen', 'video_gen'],
    models: [
      { id: 'grok-4', capabilities: ['text'] },
      {
        id: 'grok-imagine-image-2.0',
        capabilities: ['image_gen'],
        cost: { unit: 'image', usd: 0.02 },
      },
      {
        id: 'grok-imagine-video-1.5',
        capabilities: ['video_gen'],
        cost: { unit: 'video_second', usd: 0.05 },
      },
    ],
  },
];

/** Sant när strängen är ett provider-id vi känner igen. Används av API:t för att avvisa skräp. */
export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && (PROVIDER_IDS as readonly string[]).includes(value);
}

export function providerDefinition(id: ProviderId): ProviderDefinition {
  const found = PROVIDER_CATALOG.find((provider) => provider.id === id);
  if (!found) throw new Error(`Okänd provider: ${id}`);
  return found;
}

/** Sant när providern har capabilityn. Används av routing och av UI:ts badge-lista. */
export function providerSupports(id: ProviderId, capability: ProviderCapability): boolean {
  return providerDefinition(id).capabilities.includes(capability);
}

export function providersWithCapability(capability: ProviderCapability): ProviderId[] {
  return PROVIDER_CATALOG.filter((provider) => provider.capabilities.includes(capability)).map(
    (provider) => provider.id,
  );
}

/** Första modellen hos providern som klarar capabilityn, eller undefined. */
export function providerModelFor(
  id: ProviderId,
  capability: ProviderCapability,
): ProviderModel | undefined {
  return providerDefinition(id).models.find((model) => model.capabilities.includes(capability));
}

/**
 * Routingtabellen som dokumentationen och UI:t bygger på. `local` är alltid sant för text och kod
 * och falskt för allt annat: bild, video och ljud kräver en molnleverantör.
 */
export const PROVIDER_CAPABILITY_MATRIX: Record<
  ProviderId,
  Record<MediaKind | 'text' | 'vision', boolean>
> = {
  ollama: { text: true, vision: false, image: false, video: false, audio: false },
  anthropic: { text: true, vision: true, image: false, video: false, audio: false },
  google: { text: true, vision: true, image: true, video: true, audio: true },
  xai: { text: true, vision: false, image: true, video: true, audio: false },
};

/** Användarens val: vilka providers som är på, och vem som gör vilken media. */
export interface ProviderPreferences {
  enabled: Record<ProviderId, boolean>;
  image: MediaProviderId;
  video: MediaProviderId;
  audio: MediaProviderId;
}

export const DEFAULT_PROVIDER_PREFERENCES: ProviderPreferences = {
  enabled: { ollama: true, anthropic: false, google: false, xai: false },
  image: 'google',
  video: 'google',
  audio: 'google',
};

function isMediaProviderId(value: unknown): value is MediaProviderId {
  return typeof value === 'string' && (MEDIA_PROVIDER_IDS as readonly string[]).includes(value);
}

/**
 * Läser sparade preferenser och fyller på med defaults. Äldre installationer saknar helt nyckeln,
 * och ett halvskrivet objekt får aldrig ge odefinierade fält – då slutar routing att fungera.
 */
export function resolveProviderPreferences(value: unknown): ProviderPreferences {
  const stored = (typeof value === 'object' && value !== null ? value : {}) as Record<
    string,
    unknown
  >;
  const enabled = (typeof stored.enabled === 'object' && stored.enabled !== null
    ? stored.enabled
    : {}) as Record<string, unknown>;

  return {
    enabled: {
      ollama: enabled.ollama !== false,
      anthropic: enabled.anthropic === true,
      google: enabled.google === true,
      xai: enabled.xai === true,
    },
    image: isMediaProviderId(stored.image) ? stored.image : DEFAULT_PROVIDER_PREFERENCES.image,
    video: isMediaProviderId(stored.video) ? stored.video : DEFAULT_PROVIDER_PREFERENCES.video,
    audio: isMediaProviderId(stored.audio) ? stored.audio : DEFAULT_PROVIDER_PREFERENCES.audio,
  };
}

/** En provider som UI:t visar: katalogen plus användarens läge och en maskerad nyckel-ledtråd. */
export interface ProviderView {
  definition: ProviderDefinition;
  enabled: boolean;
  /** Sant när providern kan användas nu: påslagen och med nyckel (eller lokal). */
  ready: boolean;
  /** Maskerad ledtråd, t.ex. `sk-…4f2a`. Aldrig nyckeln själv. */
  keyHint?: string;
}

export interface ProvidersResponse {
  providers: ProviderView[];
  preferences: ProviderPreferences;
  /** Sant när molntjänster är avstängda: då fungerar bara text och kod, via Ollama. */
  localOnly: boolean;
  /** Var nycklarna lagras. Samma krypterade valv som connectors använder. */
  keyStorage: {
    backend: 'encrypted-file';
    cipher: 'aes-256-gcm';
    path: string;
  };
}

/** Varför en begäran om en capability inte kunde routas. */
export type ProviderResolutionCode = 'ok' | 'local_only' | 'not_configured' | 'unsupported';

export interface ProviderResolution {
  ok: boolean;
  providerId?: ProviderId;
  model?: string;
  code: ProviderResolutionCode;
}

/** Vad användaren ber om. Routingens första dimension: kod är text med filavsikt. */
export const OUTPUT_TYPES = ['text', 'code', 'image', 'video', 'audio'] as const;

export type OutputType = (typeof OUTPUT_TYPES)[number];

const OUTPUT_CAPABILITY: Record<OutputType, ProviderCapability> = {
  text: 'text',
  code: 'text',
  image: 'image_gen',
  video: 'video_gen',
  audio: 'audio_gen',
};

/** Capabilityn som en output_type kräver. Text och kod kräver samma sak: en textmodell. */
export function capabilityForOutputType(type: OutputType): ProviderCapability {
  return OUTPUT_CAPABILITY[type];
}

/** Providers som kan leverera en output_type, i katalogens ordning. */
export function providersForOutputType(type: OutputType): ProviderId[] {
  return providersWithCapability(OUTPUT_CAPABILITY[type]);
}
