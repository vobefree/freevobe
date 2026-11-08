// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ProvidersResponse } from '@freevobe/protocol';
import { DEFAULT_PROVIDER_PREFERENCES } from '@freevobe/protocol';
import i18n from '../i18n';
import { ProvidersSection } from './ProvidersSection';
import { useAppStore } from '../store/appStore';

const base: ProvidersResponse = {
  providers: [
    {
      definition: {
        id: 'ollama',
        icon: 'OL',
        authType: 'local',
        baseUrl: '',
        capabilities: ['text', 'tools'],
        models: [],
      },
      enabled: true,
      ready: true,
    },
    {
      definition: {
        id: 'anthropic',
        icon: 'AN',
        authType: 'api_key',
        baseUrl: 'https://api.anthropic.com',
        capabilities: ['text', 'vision', 'tools'],
        models: [],
      },
      enabled: false,
      ready: false,
    },
    {
      definition: {
        id: 'google',
        icon: 'GE',
        authType: 'api_key',
        baseUrl: 'https://generativelanguage.googleapis.com',
        capabilities: ['text', 'vision', 'image_gen', 'video_gen', 'audio_gen'],
        models: [],
      },
      enabled: true,
      ready: true,
      keyHint: 'AIza…cdef',
    },
    {
      definition: {
        id: 'xai',
        icon: 'XA',
        authType: 'api_key',
        baseUrl: 'https://api.x.ai',
        capabilities: ['text', 'image_gen', 'video_gen'],
        models: [],
      },
      enabled: false,
      ready: false,
    },
  ],
  preferences: {
    ...DEFAULT_PROVIDER_PREFERENCES,
    enabled: { ollama: true, anthropic: false, google: true, xai: false },
  },
  localOnly: true,
  keyStorage: {
    backend: 'encrypted-file',
    cipher: 'aes-256-gcm',
    path: '/home/u/.freevobe/connectors.vault.json',
  },
};

const refreshProviders = vi.fn(async () => undefined);
const setProviderEnabled = vi.fn(async () => undefined);
const saveProviderKey = vi.fn(async () => undefined);
const clearProviderKey = vi.fn(async () => undefined);
const setProviderMediaPreference = vi.fn(async () => undefined);

beforeEach(async () => {
  await i18n.changeLanguage('en');
  useAppStore.setState({
    providers: base,
    providerMessage: null,
    refreshProviders,
    setProviderEnabled,
    saveProviderKey,
    clearProviderKey,
    setProviderMediaPreference,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ProvidersSection', () => {
  it('visar alla fyra providers med capability-badges', () => {
    render(<ProvidersSection />);
    expect(screen.getByTestId('provider-card-ollama')).toBeTruthy();
    expect(screen.getByTestId('provider-card-anthropic')).toBeTruthy();
    expect(screen.getByTestId('provider-card-google')).toBeTruthy();
    expect(screen.getByTestId('provider-card-xai')).toBeTruthy();

    expect(screen.getByTestId('provider-card-google').textContent).toContain('Gemini (Google)');
    expect(screen.getByTestId('provider-card-anthropic').textContent).toContain(
      'Claude (Anthropic)',
    );
    // Gemini kan bild, video och ljud – Claude kan bara text, vision och verktyg.
    const google = screen.getByTestId('provider-card-google');
    expect(google.textContent).toContain('Images');
    expect(google.textContent).toContain('Video');
    expect(google.textContent).toContain('Audio');
    const claude = screen.getByTestId('provider-card-anthropic');
    expect(claude.textContent).toContain('Vision');
    expect(claude.textContent).not.toContain('Images');
  });

  it('förklarar lokal-only-läget', () => {
    render(<ProvidersSection />);
    expect(screen.getByText(/Local only/)).toBeTruthy();
  });

  it('slår på och av en provider', () => {
    render(<ProvidersSection />);
    const card = screen.getByTestId('provider-card-xai');
    const toggle = card.querySelector('input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(toggle);
    expect(setProviderEnabled).toHaveBeenCalledWith('xai', true);
  });

  it('sparar en nyckel och visar bara en maskerad ledtråd', () => {
    render(<ProvidersSection />);
    const input = screen.getByTestId('provider-key-anthropic') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'sk-ant-hemlig-nyckel' } });
    fireEvent.click(screen.getByTestId('provider-save-anthropic'));
    expect(saveProviderKey).toHaveBeenCalledWith('anthropic', 'sk-ant-hemlig-nyckel');

    // Google har redan en nyckel: ledtråden visas och nyckelfältet är borta.
    expect(screen.getByText('AIza…cdef')).toBeTruthy();
    expect(screen.queryByTestId('provider-key-google')).toBeNull();
  });

  it('tar bort en sparad nyckel', () => {
    render(<ProvidersSection />);
    fireEvent.click(screen.getByTestId('provider-clear-google'));
    expect(clearProviderKey).toHaveBeenCalledWith('google');
  });

  it('byter provider för bild, video och ljud', () => {
    render(<ProvidersSection />);
    fireEvent.change(screen.getByTestId('provider-pref-image'), { target: { value: 'xai' } });
    expect(setProviderMediaPreference).toHaveBeenCalledWith('image', 'xai');

    // Bara Gemini kan ljud, så listan har ett enda val.
    const audio = screen.getByTestId('provider-pref-audio') as HTMLSelectElement;
    expect(audio.options.length).toBe(1);
    expect(audio.options[0]?.value).toBe('google');
  });
});
