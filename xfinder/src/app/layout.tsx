import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Xfinder – sällskap i din egen takt",
    template: "%s · Xfinder",
  },
  description:
    "Öva sociala situationer med en AI-coach och boka en verifierad person för platoniskt sällskap – fika, promenad, konsert eller middag.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  openGraph: {
    type: "website",
    locale: "sv_SE",
    siteName: "Xfinder",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#2f6f62",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
