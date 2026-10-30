import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { Footer } from '@/components/site/footer';
import { Navbar } from '@/components/site/navbar';
import { themeBootstrapScript } from '@/components/theme-toggle';
import { alternatesFor } from '@/i18n/alternates';
import { routing } from '@/i18n/routing';
import { site } from '@/lib/site';
import '../globals.css';

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

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#050505' },
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
  ],
  colorScheme: 'dark light',
};

/** Alla språk byggs som egna filer – det är därför exporten fungerar utan server. */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'meta' });

  return {
    metadataBase: new URL(site.url),
    title: {
      default: t('title'),
      template: t('titleTemplate'),
    },
    description: t('description'),
    applicationName: site.name,
    keywords: t('keywords')
      .split(',')
      .map((keyword) => keyword.trim()),
    authors: [{ name: 'Freevobe' }],
    creator: 'Freevobe',
    alternates: alternatesFor('', locale),
    openGraph: {
      type: 'website',
      url: `${site.url}/${locale}/`,
      siteName: site.name,
      locale,
      title: t('ogTitle'),
      description: t('shortDescription'),
    },
    twitter: {
      card: 'summary_large_image',
      title: t('ogTitle'),
      description: t('shortDescription'),
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
    },
    category: t('category'),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Gör locale känd för serverkomponenterna under den här layouten (krävs vid statisk export).
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'meta' });
  const common = await getTranslations({ locale, namespace: 'common' });
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: site.name,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: site.platforms.join(', '),
    description: t('shortDescription'),
    url: `${site.url}/${locale}/`,
    downloadUrl: site.download,
    license: `${site.github}/blob/main/LICENSE`,
    softwareVersion: site.version,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    featureList: t('featureList').split(';'),
    sameAs: [site.github, site.x, site.discord],
  };

  return (
    // `themeBootstrapScript` lägger till klassen `light` på <html> innan React hydrerar, så att
    // sidan aldrig blinkar vitt. Skillnaden mot serverns HTML är avsiktlig – utan den här raden
    // rapporterar React den som en hydreringsfel i konsolen.
    <html
      lang={locale}
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
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
        <NextIntlClientProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2 focus:text-sm"
          >
            {common('skipToContent')}
          </a>
          <Navbar />
          <main id="main">{children}</main>
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
