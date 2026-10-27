import { notFound } from "next/navigation";
import { LocaleProvider } from "@/components/LocaleProvider";
import { CookieBanner } from "@/components/marketing/CookieBanner";
import { copyFor, dictFor } from "@/lib/content";
import { isLocale, LOCALES, type Locale } from "@/lib/theme/types";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <LocaleProvider locale={locale as Locale} dict={dictFor(locale)}>
      {children}
      <CookieBanner copy={copyFor(locale).cookie} locale={locale as Locale} />
    </LocaleProvider>
  );
}
