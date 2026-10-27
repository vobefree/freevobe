import type { Locale } from "@/lib/theme/types";
import { en, type Dict } from "./en";
import { sv } from "./sv";
import { nb } from "./nb";
import { fi } from "./fi";
import { da } from "./da";
import { fr } from "./fr";
import { de } from "./de";
import { es } from "./es";

export type { Dict };
export { LOCALES, DEFAULT_LOCALE, isLocale } from "@/lib/theme/types";

export const DICTS: Record<Locale, Dict> = { sv, nb, fi, da, en, fr, de, es };

export const LOCALE_META: Record<
  Locale,
  {
    name: string;
    short: string;
    currency: string;
    /** Belopp i öre/cent som motsvarar 2 USD i lokala valutan. */
    amountCents: number;
    /** Pris med valutakod, t.ex. "21 SEK" eller "$2" – används i all prisinformation. */
    price: string;
    /** Kort variant för språkraden, t.ex. "21 kr". */
    stripPrice: string;
    /** Landskod för flaggan i språkväljaren. */
    country: string;
    /** Länder som ska landa i språket vid geo-detektering. */
    countries: string[];
    stripeLocale: string;
    htmlLang: string;
  }
> = {
  sv: { name: "Svenska", short: "SV", currency: "SEK", amountCents: 2100, price: "21 SEK", stripPrice: "21 kr", country: "SE", countries: ["SE", "AX"], stripeLocale: "sv", htmlLang: "sv-SE" },
  nb: { name: "Norsk", short: "NO", currency: "NOK", amountCents: 2200, price: "22 NOK", stripPrice: "22 kr", country: "NO", countries: ["NO", "SJ", "BV"], stripeLocale: "nb", htmlLang: "nb-NO" },
  fi: { name: "Suomi", short: "FI", currency: "EUR", amountCents: 185, price: "1,85 €", stripPrice: "1,85 €", country: "FI", countries: ["FI"], stripeLocale: "fi", htmlLang: "fi-FI" },
  da: { name: "Dansk", short: "DA", currency: "DKK", amountCents: 1500, price: "15 DKK", stripPrice: "15 kr", country: "DK", countries: ["DK", "GL", "FO"], stripeLocale: "da", htmlLang: "da-DK" },
  en: { name: "English", short: "EN", currency: "USD", amountCents: 200, price: "$2", stripPrice: "$2", country: "GB", countries: ["GB", "IE", "US", "CA", "AU", "NZ", "IN", "SG", "ZA"], stripeLocale: "en", htmlLang: "en-US" },
  fr: { name: "Français", short: "FR", currency: "EUR", amountCents: 185, price: "1,85 €", stripPrice: "1,85 €", country: "FR", countries: ["FR", "MC", "LU", "BE"], stripeLocale: "fr", htmlLang: "fr-FR" },
  de: { name: "Deutsch", short: "DE", currency: "EUR", amountCents: 185, price: "1,85 €", stripPrice: "1,85 €", country: "DE", countries: ["DE", "AT", "CH", "LI"], stripeLocale: "de", htmlLang: "de-DE" },
  es: { name: "Español", short: "ES", currency: "EUR", amountCents: 185, price: "1,85 €", stripPrice: "1,85 €", country: "ES", countries: ["ES", "MX", "AR", "CO", "CL", "PE"], stripeLocale: "es", htmlLang: "es-ES" },
};

export { COUNTRY_LOCALE, localeForCountry } from "./countries";

export function getDict(locale: string): Dict {
  return DICTS[(locale as Locale) in DICTS ? (locale as Locale) : "en"];
}

export function localPrice(locale: Locale): string {
  return LOCALE_META[locale].price;
}

export function localPlan(locale: Locale): { currency: string; amountCents: number } {
  return { currency: LOCALE_META[locale].currency.toLowerCase(), amountCents: LOCALE_META[locale].amountCents };
}

export function formatDate(locale: Locale, iso: string): string {
  return new Intl.DateTimeFormat(LOCALE_META[locale].htmlLang, { day: "numeric", month: "short" }).format(new Date(iso));
}

export function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));
}
