import type { Locale } from './routing';

/**
 * Språkens namn på sig själva. Ett språkval ska aldrig kräva att man förstår engelska, därför
 * står varje språk med sin egen stavning – “Svenska”, inte “Swedish”.
 */
/**
 * Kort etikett till språkknappen, där det inte finns plats för hela namnet. Kinesiska skrivs med
 * sitt eget tecken i stället för "ZH", eftersom två teckenvariant annars ser likadana ut.
 */
export const LOCALE_SHORT: Record<Locale, string> = {
  en: 'EN',
  sv: 'SV',
  nb: 'NB',
  da: 'DA',
  fi: 'FI',
  de: 'DE',
  es: 'ES',
  fr: 'FR',
  pl: 'PL',
  ru: 'RU',
  'zh-Hans': '简',
  'zh-Hant': '繁',
};

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
