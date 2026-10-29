import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

/**
 * Läser meddelandefilen för den locale som routen pekar ut. Saknas översättningen helt faller
 * allt tillbaka på engelska, men en enskild nyckel som fattas syns som nyckelnamn i stället för
 * att tyst bli engelsk – `npm run i18n:check` hittar den innan den når användaren.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
