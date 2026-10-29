import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import sv from '../locales/sv.json';
import nb from '../locales/nb.json';
import da from '../locales/da.json';
import fi from '../locales/fi.json';
import de from '../locales/de.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import pl from '../locales/pl.json';
import ru from '../locales/ru.json';
import zhHans from '../locales/zh-Hans.json';
import zhHant from '../locales/zh-Hant.json';

/** Samma språklista som webbplatsen och mobilappen. Engelska är default. */
export const SUPPORTED_LOCALES = [
  'en',
  'sv',
  'nb',
  'da',
  'fi',
  'de',
  'es',
  'fr',
  'pl',
  'ru',
  'zh-Hans',
  'zh-Hant',
] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

/** Språknamnen står alltid på respektive språk – de översätts aldrig. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  sv: 'Svenska',
  nb: 'Norsk bokmål',
  da: 'Dansk',
  fi: 'Suomi',
  de: 'Deutsch',
  es: 'Español',
  fr: 'Français',
  pl: 'Polski',
  ru: 'Русский',
  'zh-Hans': '简体中文',
  'zh-Hant': '繁體中文',
};

export const LOCALE_STORAGE_KEY = 'freevobe.locale';

const RESOURCES = {
  en,
  sv,
  nb,
  da,
  fi,
  de,
  es,
  fr,
  pl,
  ru,
  'zh-Hans': zhHans,
  'zh-Hant': zhHant,
} as const;

/**
 * Tolkar en språktagg från webbläsaren, en cookie eller localStorage. Returnerar null när
 * taggen inte motsvarar något språk vi har – anroparen får då prova nästa kandidat.
 */
export function normalizeLocale(value: string | null | undefined): Locale | null {
  if (!value) return null;
  const lower = value.trim().toLowerCase();
  if (!lower) return null;

  const exact = SUPPORTED_LOCALES.find((locale) => locale.toLowerCase() === lower);
  if (exact) return exact;

  const [base] = lower.split(/[-_]/);
  if (base === 'zh') {
    // Kinesiska: traditionell för Taiwan/Hongkong/Macau, annars förenklad.
    return /hant|tw|hk|mo/.test(lower) ? 'zh-Hant' : 'zh-Hans';
  }
  return SUPPORTED_LOCALES.find((locale) => locale.toLowerCase() === base) ?? null;
}

/** Sparat val vinner, därefter webbläsarens språklista, annars engelska. */
export function detectLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;

  const stored = normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
  if (stored) return stored;

  const candidates = [...(window.navigator.languages ?? []), window.navigator.language ?? ''];
  for (const candidate of candidates) {
    const match = normalizeLocale(candidate);
    if (match) return match;
  }
  return DEFAULT_LOCALE;
}

/** Det språk som faktiskt används just nu (efter fallback). */
export function currentLocale(): Locale {
  return normalizeLocale(i18n.resolvedLanguage ?? i18n.language) ?? DEFAULT_LOCALE;
}

/** Byter språk direkt, sparar valet lokalt och uppdaterar <html lang>. */
export function applyLocale(locale: Locale): void {
  const next = normalizeLocale(locale) ?? DEFAULT_LOCALE;
  void i18n.changeLanguage(next);
  if (typeof document !== 'undefined') document.documentElement.lang = next;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
  }
}

void i18n.use(initReactI18next).init({
  resources: Object.fromEntries(
    Object.entries(RESOURCES).map(([locale, translation]) => [locale, { translation }]),
  ),
  lng: detectLocale(),
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: [...SUPPORTED_LOCALES],
  // Saknad nyckel i valt språk faller tillbaka till engelska i stället för att visas som en nyckel.
  returnNull: false,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

if (typeof document !== 'undefined') {
  document.documentElement.lang = currentLocale();
}

export default i18n;
