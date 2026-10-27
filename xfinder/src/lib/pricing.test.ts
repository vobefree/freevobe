import assert from "node:assert/strict";
import test from "node:test";

import {
  FIRST_BOOKING_FEE_SEK,
  REGISTRATION_FEE_SEK,
  companionAmountSek,
  formatSek,
  quoteBooking,
  serviceFeeSek,
} from "./pricing.ts";

test("uppstartsavgiften är 19 kr och första bokningen 49 kr", () => {
  assert.equal(REGISTRATION_FEE_SEK, 19);
  assert.equal(FIRST_BOOKING_FEE_SEK, 49);
});

test("kompanjörens belopp räknas per minut", () => {
  assert.equal(companionAmountSek(300, 60), 300);
  assert.equal(companionAmountSek(300, 90), 450);
  assert.equal(companionAmountSek(350, 30), 175);
});

test("serviceavgiften är 10 % av kompanjörens belopp", () => {
  assert.equal(serviceFeeSek(450), 45);
  assert.equal(serviceFeeSek(300), 30);
  assert.equal(serviceFeeSek(175), 18); // 17,5 avrundas uppåt, precis som round() i Postgres
});

test("totalpriset är summan av alla tre delar", () => {
  const quote = quoteBooking({ hourlyRateSek: 300, durationMinutes: 90, isFirstBooking: true });

  assert.deepEqual(quote, {
    hourlyRateSek: 300,
    durationMinutes: 90,
    companionAmountSek: 450,
    serviceFeeSek: 45,
    firstBookingFeeSek: 49,
    totalSek: 544,
    currency: "SEK",
  });
});

test("engångsavgiften försvinner på andra bokningen", () => {
  const quote = quoteBooking({ hourlyRateSek: 300, durationMinutes: 60, isFirstBooking: false });

  assert.equal(quote.firstBookingFeeSek, 0);
  assert.equal(quote.totalSek, 330);
});

test("kronor formateras på svenskt vis", () => {
  assert.equal(formatSek(544), "544 kr");
  // sv-SE använder hårt mellanslag (U+00A0) som tusentalsavgränsare.
  assert.equal(formatSek(1250), "1\u00a0250 kr");
});
