import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Freevobe – lokal-first vibecoding med Ollama',
    template: '%s · Freevobe',
  },
  description:
    'Freevobe är en lokal-first AI-coding agent för skrivbordet. Anslut Ollama, välj modell och bygg mjukvara i naturligt språk – och skapa bild, video och ljud med egna nycklar när du själv slagit på det.',
  metadataBase: new URL('https://freevobe.dev'),
  openGraph: {
    title: 'Freevobe',
    description:
      'Lokal-first vibecoding med Ollama. Planera, koda, testa och committa – och skapa bild, video och ljud när du själv godkänt det.',
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
