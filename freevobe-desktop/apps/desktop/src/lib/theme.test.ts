// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  QODER_STORAGE_KEY,
  THEME_STORAGE_KEY,
  applyQoder,
  applyTheme,
  clampShare,
  monacoThemeFor,
  nextThemeMode,
  readQoderMode,
  readThemeMode,
  resolveTheme,
  saveQoderMode,
  saveThemeMode,
} from './theme';

afterEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.qoder;
});

describe('tema', () => {
  it('följer systemet till användaren väljer', () => {
    expect(readThemeMode()).toBe('system');
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('sparar valet och läser tillbaka det', () => {
    saveThemeMode('light');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(readThemeMode()).toBe('light');
  });

  it('cyklar ljust → mörkt → system', () => {
    expect(nextThemeMode('light')).toBe('dark');
    expect(nextThemeMode('dark')).toBe('system');
    expect(nextThemeMode('system')).toBe('light');
  });

  it('sätter data-attribut som CSS:t lyssnar på', () => {
    applyTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});

describe('qoder-läge', () => {
  it('sparas som en flagga', () => {
    expect(readQoderMode()).toBe(false);
    saveQoderMode(true);
    expect(window.localStorage.getItem(QODER_STORAGE_KEY)).toBe('true');
    expect(readQoderMode()).toBe(true);
  });

  it('markerar dokumentet så att CSS:t kan växla', () => {
    applyQoder(true);
    expect(document.documentElement.dataset.qoder).toBe('true');
    applyQoder(false);
    expect(document.documentElement.dataset.qoder).toBe('false');
  });
});

describe('kodeditorns tema', () => {
  it('följer appens ljusa och mörka läge', () => {
    expect(monacoThemeFor('light')).toBe('freevobe-light');
    expect(monacoThemeFor('dark')).toBe('freevobe-dark');
  });
});

describe('delning av panehöjd', () => {
  it('håller sig mellan 20 och 80 procent', () => {
    expect(clampShare(0.5)).toBe(0.5);
    expect(clampShare(0.05)).toBe(0.2);
    expect(clampShare(0.95)).toBe(0.8);
    expect(clampShare(Number.NaN)).toBe(0.5);
  });
});
