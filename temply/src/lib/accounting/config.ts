import { envValue } from "../settings";

/**
 * Underlag för svensk bokföring.
 *
 * Allt som behövs för att bokföra prenumerationerna enligt svenska regler:
 * företagsuppgifter till SIE-filen, momssats per valuta, växelkurser till SEK
 * och hur Stripe-avgiften ska behandlas. Standardvärdena är valda för ett
 * svenskt SaaS-bolag som säljer till konsumenter.
 */

export type AccountingConfig = {
  companyName: string;
  orgNumber: string;
  vatNumber: string;
  address: string;
  fiscalStart: { month: number; day: number };
  /** true när beloppet i Stripe är konsumentpris inklusive moms. */
  pricesInclVat: boolean;
  /** Svensk momssats i procent. */
  vatRate: number;
  /** Valuta → momssats. 25 = svensk moms, 0 = ingen svensk moms (export). */
  vatByCurrency: Record<string, number>;
  /** Valuta → hur många SEK en enhet är värd. */
  fx: Record<string, number>;
  stripeFeePercent: number;
  stripeFeeFixedSek: number;
  stripeVat: "reverse" | "none";
  bankAccount: string;
  clearingAccount: string;
};

const FALLBACK_FX: Record<string, number> = {
  SEK: 1,
  EUR: 11.2,
  USD: 10.6,
  NOK: 0.95,
  DKK: 1.47,
  GBP: 12.6,
  CHF: 11.8,
};

const FALLBACK_VAT: Record<string, number> = {
  SEK: 25,
  EUR: 25,
  DKK: 25,
  NOK: 0,
  USD: 0,
  GBP: 0,
  CHF: 0,
};

function numberFrom(raw: string, fallback: number): number {
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

/** Tolkar "USD:10.60,EUR:11.20" eller "USD=10,60; EUR=11,20". */
function parsePairs(raw: string, fallback: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = { ...fallback };
  for (const part of raw.split(/[,;]+/)) {
    const [key, value] = part.split(/[:=]/);
    if (!key || !value) continue;
    const currency = key.trim().toUpperCase();
    const parsed = Number(value.trim().replace(",", "."));
    if (currency.length === 3 && Number.isFinite(parsed) && parsed >= 0) result[currency] = parsed;
  }
  return result;
}

function fiscalStart(raw: string): { month: number; day: number } {
  const match = /^(\d{1,2})-(\d{1,2})$/.exec(raw.trim());
  if (!match) return { month: 1, day: 1 };
  const month = Math.min(12, Math.max(1, Number(match[1])));
  const day = Math.min(28, Math.max(1, Number(match[2])));
  return { month, day };
}

export function accountingConfig(): AccountingConfig {
  return {
    companyName: envValue("ACCOUNTING_COMPANY_NAME") || "ThemeFold AB",
    orgNumber: envValue("ACCOUNTING_ORG_NUMBER") || "",
    vatNumber: envValue("ACCOUNTING_VAT_NUMBER") || "",
    address: envValue("ACCOUNTING_ADDRESS") || "",
    fiscalStart: fiscalStart(envValue("ACCOUNTING_FISCAL_START") || "01-01"),
    pricesInclVat: envValue("ACCOUNTING_PRICES_INCL_VAT") !== "0",
    vatRate: numberFrom(envValue("ACCOUNTING_VAT_RATE") || "25", 25),
    vatByCurrency: parsePairs(envValue("ACCOUNTING_VAT_BY_CURRENCY") || "", FALLBACK_VAT),
    fx: parsePairs(envValue("ACCOUNTING_FX_RATES") || "", FALLBACK_FX),
    stripeFeePercent: numberFrom(envValue("ACCOUNTING_STRIPE_FEE_PERCENT") || "1.5", 1.5),
    stripeFeeFixedSek: numberFrom(envValue("ACCOUNTING_STRIPE_FEE_FIXED_SEK") || "1.80", 1.8),
    stripeVat: envValue("ACCOUNTING_STRIPE_VAT") === "none" ? "none" : "reverse",
    bankAccount: envValue("ACCOUNTING_BANK_ACCOUNT") || "1930",
    clearingAccount: envValue("ACCOUNTING_CLEARING_ACCOUNT") || "1580",
  };
}

export function sekRate(currency: string, config: AccountingConfig): number {
  const code = currency.toUpperCase();
  if (code === "SEK") return 1;
  // Stripe-beloppen är i minsta enhet (öre/cent). Kursen är per hel enhet.
  const rate = config.fx[code];
  return Number.isFinite(rate) && rate > 0 ? rate : 0;
}

export function vatRateFor(currency: string, config: AccountingConfig): number {
  const code = currency.toUpperCase();
  const rate = config.vatByCurrency[code];
  return Number.isFinite(rate) ? Math.max(0, Math.min(25, rate)) : 0;
}

/** Öresavrundning – bokföringen förs i två decimaler. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
