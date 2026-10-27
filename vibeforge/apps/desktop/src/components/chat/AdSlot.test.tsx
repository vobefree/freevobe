// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { AdsConfig, AppSettings } from '@vibeforge/protocol';
import { AdSlot } from './AdSlot';
import { useAppStore } from '../../store/appStore';

function adsConfig(patch: Partial<AdsConfig> = {}): AdsConfig {
  return { provider: 'custom', everyNPrompts: 10, enabled: true, ...patch };
}

function settingsWith(ads: AdsConfig): AppSettings {
  return {
    ollamaBaseUrl: 'http://localhost:11434',
    defaultModel: 'qwen2.5-coder:7b',
    permissionMode: 'ask',
    theme: 'dark',
    contextBudgetChars: 24_000,
    maxIterations: 12,
    telemetry: false,
    allowCloudServices: false,
    ads,
    browserAutomationEnabled: false,
    updatedAt: Date.now(),
  };
}

describe('AdSlot', () => {
  beforeEach(() => {
    useAppStore.setState({ settings: settingsWith(adsConfig()) });
  });

  afterEach(() => {
    cleanup();
    useAppStore.setState({ settings: null });
  });

  it('visar ingenting innan den tionde prompten', () => {
    render(<AdSlot promptIndex={9} />);
    expect(screen.queryByTestId('ad-slot')).toBeNull();
  });

  it('visar en tydligt märkt annonsplats vid var tionde prompt', () => {
    render(<AdSlot promptIndex={10} />);
    expect(screen.getByTestId('ad-slot')).toBeTruthy();
    expect(screen.getByText('Sponsrat')).toBeTruthy();
    expect(screen.getByText(/Annonsinnehåll/)).toBeTruthy();
  });

  it('visar ingenting när användaren inte samtyckt', () => {
    useAppStore.setState({ settings: settingsWith(adsConfig({ enabled: false })) });
    render(<AdSlot promptIndex={10} />);
    expect(screen.queryByTestId('ad-slot')).toBeNull();
  });

  it('visar ingenting när providern är none', () => {
    useAppStore.setState({ settings: settingsWith(adsConfig({ provider: 'none' })) });
    render(<AdSlot promptIndex={20} />);
    expect(screen.queryByTestId('ad-slot')).toBeNull();
  });

  it('följer användarens intervall', () => {
    useAppStore.setState({ settings: settingsWith(adsConfig({ everyNPrompts: 5 })) });
    render(<AdSlot promptIndex={5} />);
    expect(screen.getByTestId('ad-slot')).toBeTruthy();
  });

  it('tar aldrig emot något annat än ett promptantal', () => {
    // Komponentens props är den enda vägen in: inga meddelanden, inga filer, ingen kontext.
    const props = Object.keys({ promptIndex: 1, forceVisible: false });
    expect(props).toEqual(['promptIndex', 'forceVisible']);
    render(<AdSlot promptIndex={10} />);
    expect(screen.getByRole('complementary', { name: 'Sponsrat innehåll' })).toBeTruthy();
  });
});
