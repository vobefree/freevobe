import type { MetadataRoute } from 'next';
import { site } from '@/lib/site';

// Krävs för statisk export (output: 'export') – filen genereras vid bygget, inte per anrop.
export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
