import type { Metadata } from "next";
import "./globals.css";
import "./storefront.css";
import "./site.css";
import "./advanced.css";

export const metadata: Metadata = {
  title: { default: "ThemeFold — Shopify-teman i världsklass", template: "%s · ThemeFold" },
  description: "Beskriv din butik, dra i ett hörn, tryck A+. ThemeFold bygger ett riktigt Shopify-tema. 3 dagar gratis, sedan 21 SEK/månad.",
  applicationName: "ThemeFold",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "ThemeFold — A world-class Shopify theme, before nap time",
    description: "Drag, drop, prompt. Build and publish a real Shopify theme in minutes.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
