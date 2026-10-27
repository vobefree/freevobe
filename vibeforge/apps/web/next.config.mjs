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
};

export default nextConfig;
