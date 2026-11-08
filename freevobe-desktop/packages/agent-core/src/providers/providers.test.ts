import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AppSettings } from '@freevobe/protocol';
import {
  DEFAULT_PROVIDER_PREFERENCES,
  PROVIDER_CATALOG,
  PROVIDER_CAPABILITY_MATRIX,
  providerSupports,
  providersWithCapability,
  resolveProviderPreferences,
} from '@freevobe/protocol';
import { DEFAULT_SETTINGS } from '../store/repositories.js';
import { ProviderService } from './registry.js';

let home: string;
let settings: AppSettings;
let service: ProviderService;

const KEY = 'AIzaSyD-test-nyckel-1234567890';

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'freevobe-providers-'));
  settings = {
    ...DEFAULT_SETTINGS,
    providers: {
      ...DEFAULT_PROVIDER_PREFERENCES,
      enabled: { ...DEFAULT_PROVIDER_PREFERENCES.enabled },
    },
  };
  service = new ProviderService({
    home,
    readSettings: () => settings,
    writeSettings: (patch) => {
      settings = { ...settings, ...patch };
      return settings;
    },
  });
});

afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true });
});

describe('provider-katalogen', () => {
  it('innehåller Ollama, Claude, Gemini och Grok med rätt capabilities', () => {
    expect(PROVIDER_CATALOG.map((provider) => provider.id)).toEqual([
      'ollama',
      'anthropic',
      'google',
      'xai',
    ]);
    expect(providerSupports('ollama', 'text')).toBe(true);
    expect(providerSupports('ollama', 'image_gen')).toBe(false);
    expect(providerSupports('anthropic', 'vision')).toBe(true);
    expect(providerSupports('anthropic', 'image_gen')).toBe(false);
    expect(providerSupports('google', 'audio_gen')).toBe(true);
    expect(providerSupports('xai', 'image_gen')).toBe(true);
    expect(providerSupports('xai', 'audio_gen')).toBe(false);
  });

  it('har en routingtabell som stämmer med katalogen', () => {
    for (const provider of PROVIDER_CATALOG) {
      const row = PROVIDER_CAPABILITY_MATRIX[provider.id];
      expect(row.text, provider.id).toBe(providerSupports(provider.id, 'text'));
      expect(row.vision, provider.id).toBe(providerSupports(provider.id, 'vision'));
      expect(row.image, provider.id).toBe(providerSupports(provider.id, 'image_gen'));
      expect(row.video, provider.id).toBe(providerSupports(provider.id, 'video_gen'));
      expect(row.audio, provider.id).toBe(providerSupports(provider.id, 'audio_gen'));
    }
    // Bara Gemini kan göra ljud i den här versionen.
    expect(providersWithCapability('audio_gen')).toEqual(['google']);
  });
});

describe('ProviderService', () => {
  it('visar lokal-only och att Ollama är redo utan nyckel', () => {
    const list = service.list();
    expect(list.localOnly).toBe(true);
    const ollama = list.providers.find((provider) => provider.definition.id === 'ollama');
    expect(ollama?.enabled).toBe(true);
    expect(ollama?.ready).toBe(true);
    const google = list.providers.find((provider) => provider.definition.id === 'google');
    expect(google?.enabled).toBe(false);
    expect(google?.ready).toBe(false);
    expect(google?.keyHint).toBeUndefined();
  });

  it('en påslagen molnprovider utan nyckel är inte redo förrän nyckeln sparats', () => {
    service.setEnabled('google', true);
    expect(service.list().providers.find((p) => p.definition.id === 'google')?.ready).toBe(false);

    const { hint } = service.setKey('google', KEY);
    expect(hint).not.toContain(KEY);
    expect(hint.length).toBeLessThan(KEY.length);

    const view = service.list().providers.find((p) => p.definition.id === 'google');
    expect(view?.ready).toBe(true);
    expect(view?.keyHint).toBe(hint);
    // Nyckeln får aldrig följa med i svaret till UI:t.
    expect(JSON.stringify(service.list())).not.toContain(KEY);

    expect(service.clearKey('google')).toBe(true);
    expect(service.list().providers.find((p) => p.definition.id === 'google')?.ready).toBe(false);
  });

  it('vägrar spara en nyckel till Ollama och för korta nycklar', () => {
    expect(() => service.setKey('ollama', KEY)).toThrow(/Ollama/);
    expect(() => service.setKey('google', 'kort')).toThrow(/för kort/);
  });

  it('local-only blockerar bild, video och ljud med en tydlig kod', () => {
    expect(service.resolveMedia('image').code).toBe('local_only');
    expect(service.resolveMedia('video').code).toBe('local_only');
    expect(service.resolveMedia('audio').code).toBe('local_only');
    // Text och kod fungerar alltid lokalt.
    const text = service.resolve('text');
    expect(text.ok).toBe(true);
    expect(text.providerId).toBe('ollama');
  });

  it('routar media till vald provider när molnet är påslaget', () => {
    settings = { ...settings, allowCloudServices: true };
    expect(service.resolveMedia('image').code).toBe('not_configured');

    service.setEnabled('google', true);
    service.setKey('google', KEY);
    const google = service.resolveMedia('image');
    expect(google.ok).toBe(true);
    expect(google.providerId).toBe('google');
    expect(google.model).toBe('gemini-3.1-flash-image');

    service.setEnabled('xai', true);
    service.setKey('xai', 'xai-test-nyckel-1234567890');
    service.setMediaPreference('image', 'xai');
    const grok = service.resolveMedia('image');
    expect(grok.providerId).toBe('xai');
    expect(grok.model).toBe('grok-imagine-image-2.0');

    // Video finns hos båda: användarens val avgör, och ljud går alltid till Gemini.
    service.setMediaPreference('video', 'xai');
    expect(service.resolveMedia('video').providerId).toBe('xai');
    expect(service.resolveMedia('audio').providerId).toBe('google');
  });

  it('vägrar välja en provider som inte klarar mediesorten', () => {
    expect(() => service.setMediaPreference('audio', 'xai')).toThrow(/kan inte generera audio/);
    expect(() => service.setMediaPreference('image', 'anthropic')).toThrow();
  });

  it('fyller på gamla och halvskrivna preferenser med defaults', () => {
    expect(resolveProviderPreferences(undefined)).toEqual(DEFAULT_PROVIDER_PREFERENCES);
    const partial = resolveProviderPreferences({ enabled: { google: true }, image: 'xai' });
    expect(partial.enabled.google).toBe(true);
    expect(partial.enabled.ollama).toBe(true);
    expect(partial.enabled.anthropic).toBe(false);
    expect(partial.image).toBe('xai');
    expect(partial.video).toBe('google');
  });
});
