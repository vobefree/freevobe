import type { Locale } from "@/lib/theme/types";

/** Landskod (ISO 3166-1 alpha-2) -> språk. Används av geo-detekteringen. */
export const COUNTRY_LOCALE: Record<string, Locale> = {
  SE: "sv",
  AX: "sv",
  NO: "nb",
  SJ: "nb",
  BV: "nb",
  FI: "fi",
  DK: "da",
  GL: "da",
  FO: "da",
  GB: "en",
  IE: "en",
  US: "en",
  CA: "en",
  AU: "en",
  NZ: "en",
  IN: "en",
  SG: "en",
  ZA: "en",
  FR: "fr",
  MC: "fr",
  LU: "fr",
  BE: "fr",
  DE: "de",
  AT: "de",
  CH: "de",
  LI: "de",
  ES: "es",
  MX: "es",
  AR: "es",
  CO: "es",
  CL: "es",
  PE: "es",
};

export function localeForCountry(country: string | null | undefined): Locale | null {
  if (!country) return null;
  return COUNTRY_LOCALE[country.toUpperCase()] ?? null;
}
