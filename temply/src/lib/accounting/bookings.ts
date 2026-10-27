import { db } from "../db";
import { accountingConfig, round2, sekRate, vatRateFor, type AccountingConfig } from "./config";

/**
 * Bokföringsunderlag från `payments`.
 *
 * Varje betalning blir en verifikation: kundfordran hos Stripe (1580) mot
 * försäljning (3041/3045) och utgående moms (2611). Stripe-avgiften bokförs
 * separat som inköp av tjänst från Irland med omvänd skattskyldighet
 * (4535/2614/2645), så momsen hamnar i ruta 21, 30 och 48.
 */

export const ACCOUNTS = {
  revenue25: "3041",
  revenueExport: "3045",
  vatOut25: "2611",
  vatReverseOut: "2614",
  vatReverseIn: "2645",
  euServices: "4535",
  bankFees: "6570",
} as const;

export const ACCOUNT_NAMES: Record<string, string> = {
  "1510": "Kundfordringar",
  "1580": "Fordringar hos betalningsförmedlare",
  "1930": "Företagskonto",
  "2010": "Eget kapital",
  "2091": "Balanserad vinst",
  "2440": "Leverantörsskulder",
  "2611": "Utgående moms 25 %",
  "2614": "Utgående moms, omvänd betalningsskyldighet",
  "2645": "Beräknad ingående moms",
  "3041": "Försäljning tjänster 25 %",
  "3045": "Försäljning tjänster utanför Sverige",
  "4535": "Inköp av tjänster från annat EU-land, 25 %",
  "6570": "Bankkostnader",
};

export type VoucherLine = { account: string; amount: number; text?: string };
export type Voucher = { series: string; number: number; date: string; text: string; lines: VoucherLine[] };

export type PaymentRow = {
  id: string;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: string;
  provider: string;
  email: string;
};

export type BookedPayment = {
  id: string;
  email: string;
  date: string;
  currency: string;
  /** Beloppet i kundens valuta, i hela enheter. */
  gross: number;
  /** Kursen som användes till SEK. */
  rate: number;
  grossSek: number;
  netSek: number;
  vatSek: number;
  vatRate: number;
  feeSek: number;
  feeVatSek: number;
  refund: boolean;
};

export type Period = { from: string; to: string };

function isoDate(value: string): string {
  return value.slice(0, 10);
}

export function paymentRows(period: Period): PaymentRow[] {
  const rows = db()
    .prepare(
      `SELECT p.id AS id, p.amount_cents AS amountCents, p.currency AS currency, p.status AS status,
        p.created_at AS createdAt, p.provider AS provider, u.email AS email
       FROM payments p JOIN users u ON u.id = p.user_id
       WHERE substr(p.created_at, 1, 10) >= ? AND substr(p.created_at, 1, 10) <= ?
         AND p.status IN ('paid', 'refunded', 'refund')
       ORDER BY p.created_at ASC`,
    )
    .all(period.from, period.to) as unknown as PaymentRow[];
  return rows.map((row) => ({
    id: String(row.id),
    amountCents: Number(row.amountCents),
    currency: String(row.currency).toUpperCase(),
    status: String(row.status),
    createdAt: String(row.createdAt),
    provider: String(row.provider),
    email: String(row.email),
  }));
}

/** Moms och avgift för en enskild betalning. */
export function bookPayment(row: PaymentRow, config: AccountingConfig): BookedPayment {
  const rate = sekRate(row.currency, config);
  const gross = round2(row.amountCents / 100);
  const grossSek = round2(gross * rate);
  const vatRate = vatRateFor(row.currency, config);
  const refund = row.status === "refunded" || row.status === "refund";

  let netSek: number;
  let vatSek: number;
  if (vatRate > 0) {
    if (config.pricesInclVat) {
      netSek = round2(grossSek / (1 + vatRate / 100));
      vatSek = round2(grossSek - netSek);
    } else {
      netSek = grossSek;
      vatSek = round2(netSek * (vatRate / 100));
    }
  } else {
    netSek = grossSek;
    vatSek = 0;
  }

  const stripe = row.provider.toLowerCase().includes("stripe");
  const feeSek = stripe ? round2(grossSek * (config.stripeFeePercent / 100) + config.stripeFeeFixedSek) : 0;
  const feeVatSek = stripe && config.stripeVat === "reverse" ? round2(feeSek * (config.vatRate / 100)) : 0;

  return {
    id: row.id,
    email: row.email,
    date: isoDate(row.createdAt),
    currency: row.currency,
    gross,
    rate,
    grossSek,
    netSek,
    vatSek,
    vatRate,
    feeSek,
    feeVatSek,
    refund,
  };
}

/** Bygger verifikationer med löpnummer per serie. */
export function buildVouchers(period: Period, config = accountingConfig()): { vouchers: Voucher[]; bookings: BookedPayment[] } {
  const bookings = paymentRows(period).map((row) => bookPayment(row, config));
  const vouchers: Voucher[] = [];
  let saleNo = 0;
  let feeNo = 0;
  const clearing = config.clearingAccount;

  for (const booking of bookings) {
    // Nollbelopp (t.ex. en testbetalning) hör inte hemma i bokföringen.
    if (booking.grossSek < 0.01) continue;
    const sign = booking.refund ? -1 : 1;
    const label = booking.refund ? "Återbetalning" : "Prenumeration";
    saleNo += 1;
    vouchers.push({
      series: "S",
      number: saleNo,
      date: booking.date,
      text: `${label} ${booking.email} (${booking.currency} ${booking.gross.toFixed(2)})`,
      lines: [
        { account: clearing, amount: round2(sign * booking.grossSek), text: "Betalning via Stripe" },
        {
          account: booking.vatRate > 0 ? ACCOUNTS.revenue25 : ACCOUNTS.revenueExport,
          amount: round2(-sign * booking.netSek),
          text: booking.vatRate > 0 ? "Försäljning 25 % moms" : "Försäljning utanför Sverige",
        },
        ...(booking.vatRate > 0
          ? [{ account: ACCOUNTS.vatOut25, amount: round2(-sign * booking.vatSek), text: "Utgående moms 25 %" }]
          : []),
      ],
    });

    if (booking.feeSek <= 0) continue;
    feeNo += 1;
    const lines: VoucherLine[] = config.stripeVat === "reverse"
      ? [
          { account: ACCOUNTS.euServices, amount: booking.feeSek, text: "Stripe-avgift, tjänst från Irland" },
          { account: ACCOUNTS.vatReverseIn, amount: booking.feeVatSek, text: "Beräknad ingående moms" },
          { account: ACCOUNTS.vatReverseOut, amount: -booking.feeVatSek, text: "Utgående moms, omvänd betalningsskyldighet" },
          { account: clearing, amount: -booking.feeSek, text: "Avgift dragen av Stripe" },
        ]
      : [
          { account: ACCOUNTS.bankFees, amount: booking.feeSek, text: "Stripe-avgift" },
          { account: clearing, amount: -booking.feeSek, text: "Avgift dragen av Stripe" },
        ];
    vouchers.push({
      series: "B",
      number: feeNo,
      date: booking.date,
      text: `Stripe-avgift ${booking.email}`,
      lines,
    });
  }

  return { vouchers, bookings };
}

export type VatBox = { code: string; label: string; value: number; note?: string };

export type VatMonth = {
  month: string;
  salesNetSek: number;
  salesVatSek: number;
  exportSek: number;
  feeNetSek: number;
  feeVatSek: number;
  vatToPay: number;
  boxes: VatBox[];
};

export type VatReport = {
  period: Period;
  boxes: VatBox[];
  months: VatMonth[];
  totals: {
    salesGrossSek: number;
    salesNetSek: number;
    salesVatSek: number;
    exportNetSek: number;
    feeNetSek: number;
    feeVatSek: number;
    vatToPay: number;
    payments: number;
    refunds: number;
  };
  /** Valutor som saknar växelkurs – de kan inte bokföras korrekt. */
  missingRates: string[];
};

function boxesFor(input: { salesNet: number; salesVat: number; exportNet: number; feeNet: number; feeVat: number }): VatBox[] {
  const out25 = input.salesVat;
  const reverseOut = input.feeVat;
  const reverseIn = input.feeVat;
  return [
    { code: "05", label: "Skattepliktig försäljning 25 %", value: round2(input.salesNet) },
    { code: "10", label: "Utgående moms 25 %", value: round2(out25) },
    { code: "20", label: "Inköp av varor från annat EU-land", value: 0 },
    { code: "21", label: "Inköp av tjänster från annat EU-land", value: round2(input.feeNet), note: "Stripe-avgifter, omvänd skattskyldighet" },
    { code: "22", label: "Inköp av varor i Sverige (12%/6%)", value: 0 },
    { code: "23", label: "Inköp av tjänster i Sverige (12%/6%)", value: 0 },
    { code: "24", label: "Övriga inköp av varor och tjänster", value: 0 },
    { code: "30", label: "Utgående moms 25 % på ruta 21", value: round2(reverseOut) },
    { code: "39", label: "Försäljning av tjänster till annat EU-land (B2B)", value: 0 },
    { code: "40", label: "Försäljning av tjänster utanför Sverige", value: round2(input.exportNet), note: "0% moms" },
    { code: "48", label: "Ingående moms att dra av", value: round2(reverseIn) },
    { code: "49", label: "Moms att betala eller få tillbaka", value: round2(out25 + reverseOut - reverseIn) },
  ];
}

/** Momsrapport per månad med de rutor som Skatteverket efterfrågar. */
export function vatReport(period: Period, config = accountingConfig()): VatReport {
  const bookings = paymentRows(period).map((row) => bookPayment(row, config));
  const months = new Map<string, { salesNet: number; salesVat: number; exportNet: number; feeNet: number; feeVat: number }>();

  for (const booking of bookings) {
    const key = booking.date.slice(0, 7);
    const bucket = months.get(key) ?? { salesNet: 0, salesVat: 0, exportNet: 0, feeNet: 0, feeVat: 0 };
    const sign = booking.refund ? -1 : 1;
    if (booking.vatRate > 0) {
      bucket.salesNet += sign * booking.netSek;
      bucket.salesVat += sign * booking.vatSek;
    } else {
      bucket.exportNet += sign * booking.netSek;
    }
    // Stripe behåller sin avgift även när en betalning återbetalas.
    bucket.feeNet += booking.feeSek;
    bucket.feeVat += booking.feeVatSek;
    months.set(key, bucket);
  }

  const monthRows: VatMonth[] = [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, bucket]) => ({
      month,
      salesNetSek: round2(bucket.salesNet),
      salesVatSek: round2(bucket.salesVat),
      exportSek: round2(bucket.exportNet),
      feeNetSek: round2(bucket.feeNet),
      feeVatSek: round2(bucket.feeVat),
      // Momsen på Stripe-avgiften är både utgående och ingående och tar ut sig själv.
      vatToPay: round2(bucket.salesVat),
      boxes: boxesFor({
        salesNet: bucket.salesNet,
        salesVat: bucket.salesVat,
        exportNet: bucket.exportNet,
        feeNet: bucket.feeNet,
        feeVat: bucket.feeVat,
      }),
    }));

  const sum = (pick: (booking: BookedPayment) => number) => round2(bookings.reduce((total, booking) => total + pick(booking), 0));
  const totalsNet = sum((booking) => (booking.vatRate > 0 ? (booking.refund ? -booking.netSek : booking.netSek) : 0));
  const totalsVat = sum((booking) => (booking.vatRate > 0 ? (booking.refund ? -booking.vatSek : booking.vatSek) : 0));
  const exportNet = sum((booking) => (booking.vatRate === 0 ? (booking.refund ? -booking.netSek : booking.netSek) : 0));
  const feeNet = sum((booking) => booking.feeSek);
  const feeVat = sum((booking) => booking.feeVatSek);
  const gross = sum((booking) => (booking.refund ? -booking.grossSek : booking.grossSek));
  const missingRates = [...new Set(bookings.filter((booking) => booking.rate === 0).map((booking) => booking.currency))];

  return {
    period,
    boxes: boxesFor({ salesNet: totalsNet, salesVat: totalsVat, exportNet, feeNet, feeVat }),
    months: monthRows,
    totals: {
      salesGrossSek: gross,
      salesNetSek: round2(totalsNet + exportNet),
      salesVatSek: totalsVat,
      exportNetSek: exportNet,
      feeNetSek: feeNet,
      feeVatSek: feeVat,
      vatToPay: totalsVat,
      payments: bookings.filter((booking) => !booking.refund).length,
      refunds: bookings.filter((booking) => booking.refund).length,
    },
    missingRates,
  };
}
