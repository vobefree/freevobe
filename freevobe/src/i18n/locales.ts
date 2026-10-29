import type { Locale } from './routing';

/**
 * Språkens namn på sig själva. Ett språkval ska aldrig kräva att man förstår engelska, därför
 * står varje språk med sin egen stavning – “Svenska”, inte “Swedish”.
 */
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
