import Link from "next/link";
import { Brand } from "./Brand";
import { Icon } from "@/components/Icon";
import { LOCALES, LOCALE_META, type Dict } from "@/lib/content";
import { copyFor } from "@/lib/content";
import { getAgencyStrings } from "@/lib/i18n/agency";
import type { Locale } from "@/lib/theme/types";

function StripeBadge({ note, link, href }: { note: string; link: string; href: string }) {
  return (
    <div className="stripe-note">
      <span className="stripe-note__brand" aria-label="Stripe">
        <svg viewBox="0 0 48 20" height="18" aria-hidden="true" focusable="false">
          <text x="0" y="15.4" fill="currentColor" fontFamily="Inter Tight, Inter, sans-serif" fontSize="18" fontWeight="700" letterSpacing="-0.6">
            stripe
          </text>
        </svg>
      </span>
      <span className="stripe-note__text">
        {note}{" "}
        <Link href={href} className="stripe-note__link">
          {link}
          <Icon name="arrowRight" size="xs" strokeWidth={2} />
        </Link>
      </span>
      <span className="stripe-note__cards" aria-hidden="true">
        <i>VISA</i>
        <i>MC</i>
        <i>AMEX</i>
      </span>
    </div>
  );
}

export function SiteFooter({ locale, dict }: { locale: Locale; dict: Dict }) {
  const copy = copyFor(locale);
  const agency = getAgencyStrings(locale);

  return (
    <footer className="mkt-footer">
      <div className="wrap">
        <div className="mkt-footer__grid">
          <div>
            <Brand href={`/${locale}`} />
            <p>{dict.landing.footerTag}</p>
            <div className="mkt-footer__badge">
              <Icon name="shield" size="sm" tone="onDark" />
              <span>{dict.pricing.securedBy}</span>
            </div>
          </div>
          <div>
            <h4>{dict.landing.footerProduct}</h4>
            <Link href={`/${locale}#features`}>{dict.nav.features}</Link>
            <Link href={`/${locale}#how`}>{dict.nav.how}</Link>
            <Link href={`/${locale}/pricing`}>{dict.nav.pricing}</Link>
            <Link href={`/${locale}/agency`}>{agency.nav} · Partner</Link>
            <Link href={`/${locale}/signup`}>{dict.landing.finalCta}</Link>
          </div>
          <div>
            <h4>{dict.landing.footerCompany}</h4>
            <Link href={`/${locale}/contact`}>{copy.contact.eyebrow}</Link>
            <Link href={`/${locale}/login`}>{dict.nav.signIn}</Link>
            <Link href={`/${locale}/pricing`}>{dict.landing.planName}</Link>
          </div>
          <div>
            <h4>{dict.landing.footerLegal}</h4>
            <Link href={`/${locale}/terms`}>{copy.terms.title}</Link>
            <Link href={`/${locale}/privacy`}>{copy.privacy.title}</Link>
          </div>
        </div>

        <StripeBadge note={copy.stripe.note} link={copy.stripe.link} href={`/${locale}/pricing`} />

        <div className="mkt-footer__bottom">
          <span>© {new Date().getFullYear()} ThemeFold · {dict.landing.rights}</span>
          <div className="mkt-footer__langs">
            {LOCALES.map((code) => (
              <Link key={code} href={`/${code}`} className={code === locale ? "is-active" : undefined}>
                {LOCALE_META[code].name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
