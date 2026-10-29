import { defineRouting } from 'next-intl/routing';

/**
 * Alla språk Freevobe finns på. `en` är standard, och varje språk har en egen URL-prefix
 * (`/sv/…`, `/zh-Hans/…`) så att varje sida går att länka till och indexera för sig.
 *
 * Ordningen är den som språkväljaren visar: engelska först, sedan de nordiska, sedan resten.
 */
export const routing = defineRouting({
  locales: ['en', 'sv', 'nb', 'da', 'fi', 'de', 'es', 'fr', 'pl', 'ru', 'zh-Hans', 'zh-Hant'],
  defaultLocale: 'en',
  localePrefix: 'always',
});

export type Locale = (typeof routing.locales)[number];
