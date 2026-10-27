import type { MetadataRoute } from 'next';
import { site } from '@/lib/site';

// Krävs för statisk export (output: 'export') – filen genereras vid bygget, inte per anrop.
export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${site.url}/`, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${site.url}/download/`, lastModified, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${site.url}/privacy`, lastModified, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${site.url}/terms`, lastModified, changeFrequency: 'yearly', priority: 0.4 },
  ];
}
