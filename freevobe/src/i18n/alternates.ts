import { routing } from './routing';

/** Sidor som finns på alla språk. Sökvägen skrivs utan språkprefix och utan avslutande snedstreck. */
export type LocalizedPath = '' | '/download' | '/privacy' | '/terms';

/**
 * `hreflang` för en sida: varje språk pekar på sin egen URL, och `x-default` pekar på
 * språkvalsomdirigeringen så att en sökmotor som inte känner igen språket hamnar rätt.
 */
export function alternatesFor(path: LocalizedPath, locale: string) {
  const languages: Record<string, string> = {};
  for (const candidate of routing.locales) {
    languages[candidate] = `/${candidate}${path}/`;
  }
  languages['x-default'] = '/';

  return {
    canonical: `/${locale}${path}/`,
    languages,
  };
}
