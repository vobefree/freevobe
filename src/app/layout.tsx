import type { Metadata } from "next";
import { Open_Sans, Satisfy } from "next/font/google";
import ServiceWorker from "@/components/ServiceWorker";
import "./globals.css";

const sans = Open_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const script = Satisfy({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-script",
});

export const metadata: Metadata = {
  title: {
    default: "Forshems Gästgiveri – Inklockning",
    template: "%s – Forshems Gästgiveri",
  },
  description:
    "Inklockning, schema och månadsrapporter för Forshems Gästgiveri – Sveriges äldsta gästgivaregård.",
  applicationName: "Forshems Gästgiveri",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon.svg", apple: "/logo.png" },
  appleWebApp: {
    capable: true,
    title: "Forshems Gästgiveri",
    statusBarStyle: "default",
  },
  openGraph: {
    title: "Forshems Gästgiveri",
    siteName: "Forshems Gästgiveri",
    type: "website",
    locale: "sv_SE",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv" className={`${sans.variable} ${script.variable}`}>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
