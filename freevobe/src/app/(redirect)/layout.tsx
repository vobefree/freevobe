import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { site } from '@/lib/site';
import '../globals.css';

/**
 * `/` finns bara för att skicka vidare till rätt språk. Den har ingen egen text, så språket är
 * satt till engelska – sidan hinner aldrig visas innan omdirigeringen sker.
 */
export const metadata: Metadata = {
  // Utan metadataBase blir den generiska og-bilden `http://localhost:0/opengraph-image`, vilket
  // syns om någon delar `/`. Sidan indexeras inte, men den ska inte läcka en påhittad adress.
  metadataBase: new URL(site.url),
  robots: { index: false, follow: false },
};

export default function RedirectLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
