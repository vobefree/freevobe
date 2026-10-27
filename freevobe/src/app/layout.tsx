import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import { Footer } from '@/components/site/footer';
import { Navbar } from '@/components/site/navbar';
import { themeBootstrapScript } from '@/components/theme-toggle';
import { site } from '@/lib/site';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: 'Freevobe – vobe with Ollama, locally and without token limits',
    template: '%s · Freevobe',
  },
  description: site.description,
  applicationName: site.name,
  keywords: [
    'Ollama',
    'local AI coding agent',
    'vibecoding',
    'vibe coding',
    'local-first',
    'Qwen coder',
    'MCP',
    'open source coding agent',
  ],
  authors: [{ name: 'Freevobe' }],
  creator: 'Freevobe',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: site.url,
    siteName: site.name,
    title: 'Freevobe – vobe with Ollama',
    description: site.shortDescription,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Freevobe – vobe with Ollama',
    description: site.shortDescription,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  category: 'developer tools',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#050505' },
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
  ],
  colorScheme: 'dark light',
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: site.name,
  applicationCategory: 'DeveloperApplication',
  operatingSystem: site.platforms.join(', '),
  description: site.shortDescription,
  url: site.url,
  downloadUrl: site.download,
  license: `${site.github}/blob/main/LICENSE`,
  softwareVersion: site.version,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  featureList: [
    'Local Ollama connection',
    'Claude-like workspace with chat, diff and terminal',
    'Diff review and command approval',
    'Markdown skills and templates',
    'Git and terminal integration',
    'MCP integrations',
  ],
  sameAs: [site.github, site.x, site.discord],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        {/* Scroll-animationerna sätter opacity via JavaScript. Utan JS ska all text synas direkt. */}
        <noscript>
          <style>{`[data-reveal] { opacity: 1 !important; transform: none !important; }`}</style>
        </noscript>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2 focus:text-sm"
        >
          Skip to content
        </a>
        <Navbar />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
