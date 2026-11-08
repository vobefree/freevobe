import type {
  AppSettings,
  MediaKind,
  MediaProviderId,
  ProviderCapability,
  ProviderId,
  ProviderPreferences,
  ProviderResolution,
  ProvidersResponse,
  ProviderView,
} from '@freevobe/protocol';
import {
  DEFAULT_MODEL,
  MEDIA_KINDS,
  PROVIDER_CATALOG,
  isProviderId,
  providerModelFor,
  providerSupports,
  resolveProviderPreferences,
} from '@freevobe/protocol';
import { ProviderKeyStore } from './keys.js';

/** Capabilityn som en mediesort kräver. Bild, video och ljud är tre olika endpoints. */
const MEDIA_CAPABILITY: Record<MediaKind, ProviderCapability> = {
  image: 'image_gen',
  video: 'video_gen',
  audio: 'audio_gen',
};

export interface ProviderServiceOptions {
  /** Freevobe-mappen. Provider-nycklarna lagras i valvet där. */
  home: string;
  readSettings: () => AppSettings;
  writeSettings: (patch: Partial<AppSettings>) => AppSettings;
  keys?: ProviderKeyStore;
}

export interface ProviderKeyResult {
  hint: string;
}

function isMediaKind(value: unknown): value is MediaKind {
  return typeof value === 'string' && (MEDIA_KINDS as readonly string[]).includes(value);
}

/**
 * Provider-tjänsten äger allt som rör vilka modellkällor som är påslagna och vem som får göra vad.
 *
 * Den känner INTE till några API-klienter: den svarar bara på vilken provider som ska användas.
 * Routing, verktyg och kostnad byggs ovanpå detta i senare steg, och då finns redan ett enda
 * ställe där reglerna bor.
 */
export class ProviderService {
  private readonly keys: ProviderKeyStore;
  private readonly options: ProviderServiceOptions;

  constructor(options: ProviderServiceOptions) {
    this.options = options;
    this.keys = options.keys ?? new ProviderKeyStore(options.home);
  }

  /** Nycklarna är hemliga: den här gettern används bara av API-klienterna i senare steg. */
  key(id: ProviderId): string | null {
    return this.keys.get(id);
  }

  private preferences(): ProviderPreferences {
    return resolveProviderPreferences(this.options.readSettings().providers);
  }

  private isReady(definition: (typeof PROVIDER_CATALOG)[number]): boolean {
    if (definition.authType === 'local') return true;
    return this.keys.has(definition.id);
  }

  private view(definition: (typeof PROVIDER_CATALOG)[number]): ProviderView {
    const preferences = this.preferences();
    const enabled = preferences.enabled[definition.id];
    const hint = definition.authType === 'api_key' ? this.keys.hint(definition.id) : undefined;
    const view: ProviderView = {
      definition,
      enabled,
      // En påslagen provider utan nyckel kan inte användas än – UI:t visar det som "behöver nyckel".
      ready: enabled && this.isReady(definition),
    };
    if (hint) view.keyHint = hint;
    return view;
  }

  list(): ProvidersResponse {
    const preferences = this.preferences();
    const storage = this.keys.info();
    return {
      providers: PROVIDER_CATALOG.map((definition) => this.view(definition)),
      preferences,
      localOnly: !this.options.readSettings().allowCloudServices,
      keyStorage: {
        backend: 'encrypted-file',
        cipher: 'aes-256-gcm',
        path: storage.path,
      },
    };
  }

  /** Slår på eller av en provider. Att slå på en provider med nyckel gör den redo direkt. */
  setEnabled(id: ProviderId, enabled: boolean): ProvidersResponse {
    if (!isProviderId(id)) throw new Error(`Okänd provider: ${String(id)}`);
    const preferences = this.preferences();
    this.options.writeSettings({
      providers: { ...preferences, enabled: { ...preferences.enabled, [id]: enabled } },
    });
    return this.list();
  }

  /** Sparar en API-nyckel krypterat. Svaret innehåller bara en maskerad ledtråd. */
  setKey(id: ProviderId, key: string): ProviderKeyResult {
    const definition = this.definition(id);
    if (definition.authType !== 'api_key') {
      // Ollama finns på datorn och har ingen nyckel – ett tyst accepterande vore missvisande.
      throw new Error('Ollama är lokal och använder ingen API-nyckel.');
    }
    return this.keys.set(id, key);
  }

  clearKey(id: ProviderId): boolean {
    this.definition(id);
    return this.keys.clear(id);
  }

  /** Väljer vilken provider som gör bild, video respektive ljud. */
  setMediaPreference(kind: MediaKind, providerId: string): ProvidersResponse {
    if (!isMediaKind(kind)) throw new Error(`Okänd mediesort: ${String(kind)}`);
    if (!isProviderId(providerId)) throw new Error(`Okänd provider: ${String(providerId)}`);
    if (!providerSupports(providerId, MEDIA_CAPABILITY[kind])) {
      throw new Error(`${providerId} kan inte generera ${kind}.`);
    }
    const preferences = this.preferences();
    this.options.writeSettings({
      providers: { ...preferences, [kind]: providerId as MediaProviderId },
    });
    return this.list();
  }

  /**
   * Svarar på vilken provider som ska användas för en capability, utan att anropa något API.
   *
   * Ordningen är: vald medieprovider först, därefter första lediga kandidat. Är molnet avstängt
   * får bild, video, ljud och vision koden `local_only` så att UI:t kan förklara varför – det är
   * ett medvetet läge, inte ett fel.
   */
  resolve(capability: ProviderCapability): ProviderResolution {
    const settings = this.options.readSettings();
    const preferences = this.preferences();
    const mediaKind = (Object.keys(MEDIA_CAPABILITY) as MediaKind[]).find(
      (kind) => MEDIA_CAPABILITY[kind] === capability,
    );

    if (!settings.allowCloudServices && capability !== 'text' && capability !== 'tools') {
      return { ok: false, code: 'local_only' };
    }

    const candidates = PROVIDER_CATALOG.filter((definition) =>
      definition.capabilities.includes(capability),
    );
    if (candidates.length === 0) return { ok: false, code: 'unsupported' };

    const available = candidates.filter(
      (definition) => preferences.enabled[definition.id] && this.isReady(definition),
    );
    if (available.length === 0) return { ok: false, code: 'not_configured' };

    const preferredId = mediaKind ? preferences[mediaKind] : undefined;
    const chosen = available.find((definition) => definition.id === preferredId) ?? available[0];
    if (!chosen) return { ok: false, code: 'not_configured' };
    const model =
      providerModelFor(chosen.id, capability)?.id ??
      (chosen.id === 'ollama' ? settings.defaultModel || DEFAULT_MODEL : '');

    return { ok: true, providerId: chosen.id, model, code: 'ok' };
  }

  resolveMedia(kind: MediaKind): ProviderResolution {
    return this.resolve(MEDIA_CAPABILITY[kind]);
  }

  private definition(id: ProviderId) {
    const found = PROVIDER_CATALOG.find((provider) => provider.id === id);
    if (!found) throw new Error(`Okänd provider: ${String(id)}`);
    return found;
  }
}
