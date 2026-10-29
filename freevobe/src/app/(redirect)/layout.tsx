import type { ReactNode } from 'react';
import '../globals.css';

/**
 * `/` finns bara för att skicka vidare till rätt språk. Den har ingen egen text, så språket är
 * satt till engelska – sidan hinner aldrig visas innan omdirigeringen sker.
 */
export default function RedirectLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="robots" content="noindex" />
      </head>
      <body>{children}</body>
    </html>
  );
}
