import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { dictFor, isLocale } from "@/lib/content";
import { copyFor } from "@/lib/content";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { ContactForm } from "@/components/marketing/ContactForm";
import { Icon } from "@/components/Icon";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const copy = copyFor(locale);
  return { title: copy.contact.eyebrow, description: copy.contact.sub };
}

export default async function ContactPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = dictFor(locale);
  const copy = copyFor(locale);
  const user = await getCurrentUser();

  return (
    <>
      <SiteHeader locale={locale} dict={dict} loggedIn={Boolean(user)} />
      <main className="section-mkt contact-page">
        <div className="wrap">
          <div className="contact-head">
            <p className="eyebrow-mkt">{copy.contact.eyebrow}</p>
            <h1>{copy.contact.title}</h1>
            <p>{copy.contact.sub}</p>
          </div>

          <div className="contact-grid">
            <ContactForm copy={copy.contact} locale={locale} />

            <aside className="contact-aside">
              <div className="contact-card contact-card--dark">
                <span className="contact-card__icon"><Icon name="mail" size="md" tone="onDark" /></span>
                <h3>{copy.contact.asideTitle}</h3>
                <p>{copy.contact.asideText}</p>
                <a className="contact-card__mail" href="mailto:hello@themefold.com">
                  hello@themefold.com
                  <Icon name="external" size="xs" strokeWidth={2} />
                </a>
                <span className="contact-card__meta">
                  <Icon name="history" size="xs" tone="onDark" /> {copy.contact.responseTime}
                </span>
              </div>

              <div className="contact-card">
                <h3>{copy.contact.faqTitle}</h3>
                <div className="contact-faq">
                  {copy.contact.faq.map((item) => (
                    <details key={item.q}>
                      <summary>{item.q}</summary>
                      <p>{item.a}</p>
                    </details>
                  ))}
                </div>
              </div>

              <Link className="contact-back" href={`/${locale}`}>
                <Icon name="arrowLeft" size="sm" /> {dict.common.back}
              </Link>
            </aside>
          </div>
        </div>
      </main>
      <SiteFooter locale={locale} dict={dict} />
    </>
  );
}
