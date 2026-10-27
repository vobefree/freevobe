import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,

  // Projektmappen ligger under en katalog med andra projekt och lockfiler.
  // Utan detta letar Turbopack uppåt och varnar.
  turbopack: {
    root: path.resolve(process.cwd()),
  },
};

export default nextConfig;
