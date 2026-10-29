// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18n, { LOCALE_STORAGE_KEY, SUPPORTED_LOCALES, normalizeLocale } from './index';
import { applyLocale, detectLocale } from './index';
import { LanguageSelect } from '../components/LanguageSelect';
import { Onboarding } from '../components/Onboarding';
import { useAppStore } from '../store/appStore';

afterEach(async () => {
  cleanup();
  window.localStorage.clear();
  await i18n.changeLanguage('sv');
});

describe('normalizeLocale', () => {
  it('matchar exakta taggar och språkvarianter', () => {
    expect(normalizeLocale('sv')).toBe('sv');
    expect(normalizeLocale('sv-SE')).toBe('sv');
    expect(normalizeLocale('nb-NO')).toBe('nb');
    expect(normalizeLocale('de-AT')).toBe('de');
  });

  it('väljer rätt kinesisk variant', () => {
    expect(normalizeLocale('zh')).toBe('zh-Hans');
    expect(normalizeLocale('zh-CN')).toBe('zh-Hans');
    expect(normalizeLocale('zh-TW')).toBe('zh-Hant');
    expect(normalizeLocale('zh-HK')).toBe('zh-Hant');
  });

  it('returnerar null för språk vi inte har', () => {
    expect(normalizeLocale('ja-JP')).toBeNull();
    expect(normalizeLocale('')).toBeNull();
    expect(normalizeLocale(null)).toBeNull();
  });
});

describe('detectLocale', () => {
  it('låter ett sparat val vinna över webbläsaren', () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'pl');
    expect(detectLocale()).toBe('pl');
  });

  it('faller tillbaka på engelska när webbläsaren saknar språk vi har', () => {
    window.localStorage.clear();
    const original = Object.getOwnPropertyDescriptor(window.navigator, 'languages');
    Object.defineProperty(window.navigator, 'languages', { value: ['ja-JP'], configurable: true });
    Object.defineProperty(window.navigator, 'language', { value: 'ja-JP', configurable: true });
    try {
      expect(detectLocale()).toBe('en');
    } finally {
      if (original) Object.defineProperty(window.navigator, 'languages', original);
    }
  });
});

describe('applyLocale', () => {
  it('byter språk direkt, sparar valet och sätter html lang', async () => {
    applyLocale('de');
    await i18n.changeLanguage('de');
    expect(i18n.t('chat.send')).toBe('Senden');
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('de');
    expect(document.documentElement.lang).toBe('de');
  });

  it('faller tillbaka på engelska när en nyckel saknas i valt språk', async () => {
    // Simulerar en ny nyckel som ännu bara finns på engelska (så fungerar varje ny sträng).
    const original = JSON.parse(JSON.stringify(i18n.getResourceBundle('en', 'translation')));
    i18n.addResource('en', 'translation', 'test.onlyEnglish', 'Only in English');
    try {
      await i18n.changeLanguage('de');
      expect(i18n.getResource('de', 'translation', 'test.onlyEnglish')).toBeUndefined();
      expect(i18n.t('test.onlyEnglish')).toBe('Only in English');
      expect(i18n.t('chat.send')).toBe('Senden');
    } finally {
      i18n.removeResourceBundle('en', 'translation');
      i18n.addResourceBundle('en', 'translation', original);
    }
  });

  it('har samma nyckeluppsättning i alla språk', () => {
    const base = Object.keys(i18n.getResourceBundle('en', 'translation')).sort();
    for (const locale of SUPPORTED_LOCALES) {
      const keys = Object.keys(i18n.getResourceBundle(locale, 'translation')).sort();
      expect(keys, locale).toEqual(base);
    }
  });
});

describe('språkväxlaren', () => {
  it('visar alla språk och byter till valt språk när användaren väljer', async () => {
    await i18n.changeLanguage('en');
    render(<LanguageSelect />);
    const select = screen.getByTestId('language-select') as HTMLSelectElement;
    expect(select.options.length).toBe(SUPPORTED_LOCALES.length);
    expect(select.value).toBe('en');

    fireEvent.change(select, { target: { value: 'de' } });

    expect(i18n.language).toBe('de');
    expect(select.value).toBe('de');
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('de');
    expect(i18n.t('chat.send')).toBe('Senden');
  });
});

describe('onboarding på olika språk', () => {
  it('renderar engelska som default och svenska efter byte', async () => {
    useAppStore.setState({ onboardingStep: 0 });
    await i18n.changeLanguage('en');
    render(<Onboarding />);
    expect(screen.getByText('How it works')).toBeTruthy();
    expect(screen.getByText('Next')).toBeTruthy();
    cleanup();

    await i18n.changeLanguage('sv');
    render(<Onboarding />);
    expect(screen.getByText('Så fungerar det')).toBeTruthy();
    expect(screen.getByText('Nästa')).toBeTruthy();
  });

  it('visar översatt text på flera språk', async () => {
    useAppStore.setState({ onboardingStep: 0 });
    for (const [locale, title] of [
      ['de', 'So funktioniert es'],
      ['es', 'Cómo funciona'],
      ['fr', 'Comment ça marche'],
      ['pl', 'Jak to działa'],
      ['ru', 'Как это работает'],
      ['zh-Hans', '工作原理'],
      ['zh-Hant', '運作方式'],
      ['fi', 'Näin se toimii'],
      ['da', 'Sådan virker det'],
      ['nb', 'Slik fungerer det'],
    ] as const) {
      await i18n.changeLanguage(locale);
      render(<Onboarding />);
      expect(screen.getByText(title), locale).toBeTruthy();
      cleanup();
    }
  });
});
