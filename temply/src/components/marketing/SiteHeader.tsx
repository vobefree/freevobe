import Link from "next/link";
import { Brand } from "./Brand";
import { LanguageMenu } from "./LanguageMenu";
import type { Dict } from "@/lib/content";
import { copyFor } from "@/lib/content";
import { getAgencyStrings } from "@/lib/i18n/agency";
import type { Locale } from "@/lib/theme/types";

export function SiteHeader({ locale, dict, loggedIn }: { locale: Locale; dict: Dict; loggedIn: boolean }) {
  return (
    <header className="mkt-header">
      <div className="wrap mkt-header__inner">
        <Brand href={`/${locale}`} />
        <nav className="mkt-nav" aria-label="Main">
          <Link href={`/${locale}#features`}>{dict.nav.features}</Link>
          <Link href={`/${locale}#how`}>{dict.nav.how}</Link>
          <Link href={`/${locale}/pricing`}>{dict.nav.pricing}</Link>
          <Link href={`/${locale}/agency`}>{getAgencyStrings(locale).nav}</Link>
          <Link href={`/${locale}/contact`}>{copyFor(locale).contact.eyebrow}</Link>
        </nav>
        <div className="mkt-actions">
          <LanguageMenu locale={locale} label={dict.common.language} />
          {loggedIn ? (
            <Link className="ui-btn ui-btn--sm" href={`/${locale}/dashboard`}>
              {dict.nav.dashboard}
            </Link>
          ) : (
            <>
              <Link className="ui-btn ui-btn--ghost ui-btn--sm" href={`/${locale}/login`}>
                {dict.nav.signIn}
              </Link>
              <Link className="ui-btn ui-btn--accent ui-btn--sm" href={`/${locale}/signup`}>
                {dict.nav.start}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
