import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { site } from '@/lib/site';

// Krävs för statisk export (output: 'export') – filen genereras vid bygget, inte per anrop.
export const dynamic = 'force-static';

const PATHS = [
  { path: '', changeFrequency: 'weekly' as const, priority: 1 },
  { path: '/download', changeFrequency: 'weekly' as const, priority: 0.9 },
  { path: '/privacy', changeFrequency: 'yearly' as const, priority: 0.4 },
  { path: '/terms', changeFrequency: 'yearly' as const, priority: 0.4 },
];

/**
 * Varje sida listas på alla språk, med `alternates.languages` så att sökmotorer förstår att
 * `/sv/download/` och `/de/download/` är samma innehåll på olika språk.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return PATHS.flatMap(({ path, changeFrequency, priority }) =>
    routing.locales.map((locale) => ({
      url: `${site.url}/${locale}${path}/`,
      lastModified,
      changeFrequency,
      priority,
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((candidate) => [candidate, `${site.url}/${candidate}${path}/`]),
        ),
      },
    })),
  );
}
