"use client";

import { createContext, useContext, useEffect } from "react";
import type { ReactNode } from "react";
import { LOCALE_META, type Dict } from "@/lib/i18n";
import type { Locale } from "@/lib/theme/types";

type LocaleContextValue = { locale: Locale; dict: Dict };

const LocaleContext = createContext<LocaleContextValue | null>(null);

/** Texterna kommer färdigblandade från servern så att adminpanelens ändringar slår igenom. */
export function LocaleProvider({ locale, dict, children }: { locale: Locale; dict: Dict; children: ReactNode }) {
  useEffect(() => {
    document.documentElement.lang = LOCALE_META[locale].htmlLang;
    document.cookie = `temply_locale=${locale}; path=/; max-age=31536000; samesite=lax`;
  }, [locale]);

  return <LocaleContext.Provider value={{ locale, dict }}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used inside LocaleProvider");
  return context;
}
