import Link from "next/link";
import { Icon } from "@/components/Icon";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import type { Dict } from "@/lib/i18n";
import type { LegalDoc, SiteCopy } from "@/lib/i18n/site";
import type { Locale } from "@/lib/theme/types";

export function LegalPage({
  locale,
  dict,
  copy,
  doc,
  loggedIn,
  other,
}: {
  locale: Locale;
  dict: Dict;
  copy: SiteCopy;
  doc: LegalDoc;
  loggedIn: boolean;
  other: { href: string; title: string };
}) {
  const current = doc.sections[0]?.title;

  return (
    <>
      <SiteHeader locale={locale} dict={dict} loggedIn={loggedIn} />
      <main className="section-mkt legal-page">
        <div className="wrap legal-wrap">
          <p className="eyebrow-mkt">{doc.eyebrow}</p>
          <h1>{doc.title}</h1>
          <p className="legal-updated">
            <Icon name="history" size="xs" /> {doc.updated}
          </p>
          <p className="legal-intro">{doc.intro}</p>

          <div className="legal-layout">
            <nav className="legal-toc" aria-label={current}>
              {doc.sections.map((section) => (
                <a key={section.title} href={`#${slug(section.title)}`}>
                  {section.title}
                </a>
              ))}
            </nav>

            <article className="legal-body">
              {doc.sections.map((section) => (
                <section key={section.title} id={slug(section.title)}>
                  <h2>{section.title}</h2>
                  <p>{section.body}</p>
                </section>
              ))}

              <p className="legal-note">{doc.footerNote}</p>

              <div className="legal-actions">
                <Link className="ui-btn ui-btn--ghost ui-btn--sm" href={other.href}>
                  {other.title} <Icon name="arrowRight" size="xs" strokeWidth={2} />
                </Link>
                <Link className="ui-btn ui-btn--sm" href={`/${locale}/contact`}>
                  {copy.contact.eyebrow}
                </Link>
              </div>
            </article>
          </div>
        </div>
      </main>
      <SiteFooter locale={locale} dict={dict} />
    </>
  );
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/^\d+\.\s*/, "")
    .replace(/[^a-z0-9åäöæø]+/gi, "-")
    .replace(/(^-|-$)/g, "");
}
