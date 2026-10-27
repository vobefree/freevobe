/**
 * Prissättning för Xfinder.
 *
 * Samma regler finns som check-villkor och triggers i databasen
 * (supabase/migrations/20261027120000_xfinder_schema.sql och ...0120100).
 * Databasen är alltid den som bestämmer – funktionerna här används för att visa
 * priset och för att upptäcka om de två skulle glida isär (se pricing.test.ts).
 *
 * Alla belopp är i HELA KRONOR. × 100 (öre) sker först i Stripe-lagret.
 */

/** Uppstartsavgift – spamfilter, betalas en gång per konto. */
export const REGISTRATION_FEE_SEK = 19;

/** Engångsavgift som läggs på användarens första bokning. */
export const FIRST_BOOKING_FEE_SEK = 49;

/** Serviceavgift på varje bokning, andel av kompanjörens belopp. */
export const SERVICE_FEE_RATE = 0.1;

export const MIN_BOOKING_MINUTES = 30;
export const MAX_BOOKING_MINUTES = 480;
export const MIN_HOURLY_RATE_SEK = 100;
export const MAX_HOURLY_RATE_SEK = 5000;

/** Kompanjörens belopp för en bokning: timpris × längd. */
export function companionAmountSek(hourlyRateSek: number, durationMinutes: number): number {
  return Math.round((hourlyRateSek * durationMinutes) / 60);
}

/** Serviceavgift = 10 % av kompanjörens belopp. */
export function serviceFeeSek(companionAmount: number): number {
  return Math.round(companionAmount * SERVICE_FEE_RATE);
}

export type BookingQuote = {
  hourlyRateSek: number;
  durationMinutes: number;
  companionAmountSek: number;
  serviceFeeSek: number;
  firstBookingFeeSek: number;
  totalSek: number;
  currency: "SEK";
};

/**
 * Räknar fram exakt samma kvitto som databasfunktionen quote_booking() gör.
 * `isFirstBooking` styr om 49 kr läggs på.
 */
export function quoteBooking(input: {
  hourlyRateSek: number;
  durationMinutes: number;
  isFirstBooking: boolean;
}): BookingQuote {
  const companionAmount = companionAmountSek(input.hourlyRateSek, input.durationMinutes);
  const fee = serviceFeeSek(companionAmount);
  const firstFee = input.isFirstBooking ? FIRST_BOOKING_FEE_SEK : 0;

  return {
    hourlyRateSek: input.hourlyRateSek,
    durationMinutes: input.durationMinutes,
    companionAmountSek: companionAmount,
    serviceFeeSek: fee,
    firstBookingFeeSek: firstFee,
    totalSek: companionAmount + fee + firstFee,
    currency: "SEK",
  };
}

/** Formaterar kronor på svenskt vis: 495 -> "495 kr". */
export function formatSek(amount: number): string {
  return `${new Intl.NumberFormat("sv-SE").format(amount)} kr`;
}
