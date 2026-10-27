import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { dictFor, isLocale } from "@/lib/content";
import { copyFor } from "@/lib/content";
import { LegalPage } from "@/components/marketing/LegalPage";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return { title: copyFor(locale).terms.title };
}

export default async function TermsPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = copyFor(locale);
  const user = await getCurrentUser();

  return (
    <LegalPage
      locale={locale}
      dict={dictFor(locale)}
      copy={copy}
      doc={copy.terms}
      loggedIn={Boolean(user)}
      other={{ href: `/${locale}/privacy`, title: copy.privacy.title }}
    />
  );
}
