"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOCALES, LOCALE_META } from "@/lib/i18n";
import { Icon } from "@/components/Icon";
import type { Locale } from "@/lib/theme/types";

export function LanguageMenu({ locale, label }: { locale: Locale; label: string }) {
  const pathname = usePathname() || `/${locale}`;
  const rest = pathname.split("/").slice(2).join("/");

  const remember = (code: Locale) => {
    document.cookie = `temply_locale=${code}; path=/; max-age=31536000; samesite=lax`;
  };

  return (
    <details className="lang">
      <summary className="lang__trigger" aria-label={`${label}: ${LOCALE_META[locale].name}`}>
        <span>{LOCALE_META[locale].short}</span>
        <Icon name="chevronDown" size="xs" strokeWidth={2} />
      </summary>
      <div className="lang__menu">
        {LOCALES.map((code) => (
          <Link
            key={code}
            className={`lang__item${code === locale ? " is-active" : ""}`}
            href={`/${code}${rest ? `/${rest}` : ""}`}
            onClick={() => remember(code)}
            aria-current={code === locale ? "true" : undefined}
          >
            <span className="lang__name">{LOCALE_META[code].name}</span>
            {code === locale && <Icon name="check" size="xs" strokeWidth={2.2} />}
          </Link>
        ))}
      </div>
    </details>
  );
}
