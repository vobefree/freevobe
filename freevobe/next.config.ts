import type { NextConfig } from 'next';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  trailingSlash: true,
  images: { unoptimized: true },
  // Sidan är helt statisk – exporten kan hostas var som helst (Sites, Pages, CDN).
  output: 'export',
  // Appen är sin egen arbetsyta även om mappen ovanför har en package-lock.json.
  outputFileTracingRoot: dirname(fileURLToPath(import.meta.url)),
};

export default nextConfig;
