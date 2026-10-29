import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Pluginet pekar ut src/i18n/request.ts, som avgör vilken meddelandefil en route läser.
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  trailingSlash: true,
  images: { unoptimized: true },
  // Sidan är helt statisk – exporten kan hostas var som helst (Sites, Pages, CDN).
  // Varje språk blir egna filer under /en/, /sv/, /de/ osv.
  output: 'export',
  // Appen är sin egen arbetsyta även om mappen ovanför har en package-lock.json.
  outputFileTracingRoot: dirname(fileURLToPath(import.meta.url)),
};

export default withNextIntl(nextConfig);
