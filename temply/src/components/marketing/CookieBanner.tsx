"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import type { SiteCopy } from "@/lib/i18n/site";
import type { Locale } from "@/lib/theme/types";

const STORAGE_KEY = "themefold_cookie_choice";

export function CookieBanner({ copy, locale }: { copy: SiteCopy["cookie"]; locale: Locale }) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      saved = null;
    }
    if (!saved) setVisible(true);
  }, []);

  const choose = (value: "all" | "essential") => {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* private mode – valet gäller bara den här fliken */
    }
    document.cookie = `themefold_cookies=${value}; path=/; max-age=31536000; samesite=lax`;
    setLeaving(true);
    window.setTimeout(() => setVisible(false), 260);
  };

  if (!visible) return null;

  return (
    <div className={`cookie-banner${leaving ? " is-leaving" : ""}`} role="dialog" aria-modal="false" aria-labelledby="cookie-title">
      <div className="cookie-banner__art" aria-hidden="true">
        <span className="cookie-banner__jar">
          <i className="cookie-banner__cookie cookie-banner__cookie--a" />
          <i className="cookie-banner__cookie cookie-banner__cookie--b" />
          <i className="cookie-banner__cookie cookie-banner__cookie--c" />
        </span>
      </div>

      <div className="cookie-banner__body">
        <span className="cookie-banner__badge">
          <i className="dot" /> {copy.badge}
        </span>
        <h2 id="cookie-title">{copy.title}</h2>
        <p>{copy.body}</p>

        <div className="cookie-banner__actions">
          <button className="ui-btn ui-btn--accent ui-btn--sm" type="button" onClick={() => choose("all")}>
            <Icon name="check" size="sm" strokeWidth={2.2} /> {copy.accept}
          </button>
          <button className="ui-btn ui-btn--ghost ui-btn--sm" type="button" onClick={() => choose("essential")}>
            {copy.essential}
          </button>
          <Link className="cookie-banner__link" href={`/${locale}/privacy`}>
            {copy.learnMore}
            <Icon name="arrowRight" size="xs" strokeWidth={2} />
          </Link>
        </div>
      </div>
    </div>
  );
}
