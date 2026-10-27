import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'VibeForge – lokal-first vibecoding med Ollama',
    template: '%s · VibeForge',
  },
  description:
    'VibeForge är en lokal-first AI-coding agent för skrivbordet. Anslut Ollama, välj modell och bygg mjukvara i naturligt språk – koden lämnar aldrig datorn.',
  metadataBase: new URL('https://vibeforge.dev'),
  openGraph: {
    title: 'VibeForge',
    description:
      'Lokal-first vibecoding med Ollama. Planera, koda, testa och committa – utan att koden lämnar datorn.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="sv">
      <body>
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-5 py-10">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
