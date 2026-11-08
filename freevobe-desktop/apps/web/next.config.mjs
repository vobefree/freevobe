import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Håll spårningen inom den här appen – monorepot har sin egen lockfil.
  outputFileTracingRoot: here,
  // Sajten är helt statisk: den kan publiceras på vilken värd som helst utan server.
  output: 'export',
  reactStrictMode: true,
  trailingSlash: true,
  images: { unoptimized: true },
  // Protokollet importeras som TypeScript-källa (exports -> ./src/index.ts) och använder
  // `.js` i importvägarna, vilket TypeScript löser men webpack inte gör av sig själv.
  transpilePackages: ['@freevobe/protocol'],
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
};

export default nextConfig;
