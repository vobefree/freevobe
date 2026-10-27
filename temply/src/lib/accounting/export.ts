import { accountingConfig, round2, type AccountingConfig } from "./config";
import { ACCOUNT_NAMES, buildVouchers, paymentRows, bookPayment, vatReport, type Period, type Voucher } from "./bookings";

/**
 * Filer för svensk bokföring:
 *  - SIE4 (typ 4) att importera i Fortnox, Visma, Bokio, Björn Lundén m.fl.
 *  - verifikationslista som CSV för arkiv och granskning
 *  - momsrapport per månad med Skatteverkets rutor
 *
 * SIE-filen skrivs i ren ASCII (å/ä/ö translittereras) och deklarerar PC8, som
 * är den kodning SIE-standarden utgår från. CSV-filerna är UTF-8 med BOM och
 * semikolon, så de öppnas rakt i svensk Excel.
 */

const TRANSLITERATION: Record<string, string> = {
  å: "a",
  ä: "a",
  ö: "o",
  é: "e",
  è: "e",
  ü: "u",
  á: "a",
  à: "a",
  ç: "c",
  ø: "o",
  æ: "ae",
  Å: "A",
  Ä: "A",
  Ö: "O",
  "–": "-",
  "—": "-",
  "’": "'",
  "“": '"',
  "”": '"',
};

export function ascii(value: string): string {
  return value
    .replace(/[åäöéèüáàçøæÅÄÖ–—’”“]/g, (char) => TRANSLITERATION[char] ?? char)
    .replace(/[^\x20-\x7E]/g, "");
}

function ymd(date: string): string {
  return date.replace(/-/g, "");
}

/** Räkenskapsåret som perioden ligger i, enligt inställningarna. */
export function fiscalYear(period: Period, config: AccountingConfig): { start: string; end: string } {
  const from = new Date(`${period.from}T12:00:00Z`);
  const startYear = from.getUTCMonth() + 1 >= config.fiscalStart.month ? from.getUTCFullYear() : from.getUTCFullYear() - 1;
  const start = new Date(Date.UTC(startYear, config.fiscalStart.month - 1, config.fiscalStart.day));
  const end = new Date(Date.UTC(startYear + 1, config.fiscalStart.month - 1, config.fiscalStart.day - 1));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function amount(value: number): string {
  return round2(value).toFixed(2);
}

export type SieOptions = { period: Period; config?: AccountingConfig; generatedAt?: string };

export function sie4({ period, config = accountingConfig(), generatedAt }: SieOptions): string {
  const { vouchers } = buildVouchers(period, config);
  const year = fiscalYear(period, config);

  const balances = new Map<string, number>();
  for (const voucher of vouchers) {
    for (const line of voucher.lines) {
      balances.set(line.account, round2((balances.get(line.account) ?? 0) + line.amount));
    }
  }

  const accounts = [...balances.keys()].sort();
  const names = new Map(accounts.map((account) => [account, ACCOUNT_NAMES[account] ?? `Konto ${account}`]));
  if (!names.has(config.bankAccount)) names.set(config.bankAccount, ACCOUNT_NAMES[config.bankAccount] ?? "Bankkonto");
  if (!names.has(config.clearingAccount)) names.set(config.clearingAccount, ACCOUNT_NAMES[config.clearingAccount] ?? "Stripe-saldo");

  const isBalance = (account: string) => /^[12]/.test(account);
  const isResult = (account: string) => /^[3-8]/.test(account);
  const stamp = (generatedAt ?? new Date().toISOString()).slice(0, 10);

  const lines: string[] = [];
  lines.push("#FLAGGA 0");
  lines.push('#PROGRAM "ThemeFold" "1.0"');
  lines.push("#FORMAT PC8");
  lines.push(`#GEN ${ymd(stamp)}`);
  lines.push("#SIETYP 4");
  lines.push(`#FNAMN "${ascii(config.companyName)}"`);
  if (config.orgNumber) lines.push(`#ORGNR ${config.orgNumber.replace(/\D/g, "")}`);
  if (config.address) lines.push(`#FADRAD "${ascii(config.address)}"`);
  lines.push(`#RAR 0 ${ymd(year.start)} ${ymd(year.end)}`);
  for (const account of [...names.keys()].sort()) {
    lines.push(`#KONTO ${account} "${ascii(names.get(account) ?? account)}"`);
  }
  for (const account of [...names.keys()].sort()) {
    if (isBalance(account)) lines.push(`#IB 0 ${account} ${amount(0)}`);
  }
  for (const account of [...names.keys()].sort()) {
    if (isBalance(account)) lines.push(`#UB 0 ${account} ${amount(balances.get(account) ?? 0)}`);
  }
  for (const account of accounts) {
    if (isResult(account)) lines.push(`#RES 0 ${account} ${amount(balances.get(account) ?? 0)}`);
  }
  vouchers.forEach((voucher) => lines.push(...renderVoucher(voucher)));
  return `${lines.join("\n")}\n`;
}

function renderVoucher(voucher: Voucher): string[] {
  const head = `#VER ${voucher.series} ${voucher.number} ${ymd(voucher.date)} "${ascii(voucher.text).slice(0, 80)}"`;
  const rows = voucher.lines
    .filter((line) => Math.abs(line.amount) >= 0.005)
    .map((line) => `#TRANS ${line.account} {} ${amount(line.amount)}`);
  return [head, "{", ...rows, "}"];
}

function csvCell(value: string | number): string {
  // Heltal (verifikationsnummer, antal) skrivs utan decimaler – belopp med komma.
  const text =
    typeof value === "number" ? (Number.isInteger(value) ? String(value) : value.toFixed(2).replace(".", ",")) : String(value);
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csv(rows: (string | number)[][]): string {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}\r\n`;
}

/** Verifikationslista: en rad per kontorad, med debet och kredit. */
export function vouchersCsv(period: Period, config = accountingConfig()): string {
  const { vouchers } = buildVouchers(period, config);
  const rows: (string | number)[][] = [["Serie", "Nummer", "Datum", "Konto", "Kontonamn", "Text", "Debet", "Kredit"]];
  for (const voucher of vouchers) {
    for (const line of voucher.lines) {
      rows.push([
        voucher.series,
        voucher.number,
        voucher.date,
        line.account,
        ACCOUNT_NAMES[line.account] ?? "",
        line.text ?? voucher.text,
        line.amount > 0 ? line.amount : 0,
        line.amount < 0 ? Math.abs(line.amount) : 0,
      ]);
    }
  }
  return csv(rows);
}

/** Avstämning mot Stripe: varje betalning med kurs, moms och avgift. */
export function paymentsCsv(period: Period, config = accountingConfig()): string {
  const rows: (string | number)[][] = [
    ["Datum", "Kund", "Leverantör", "Status", "Valuta", "Belopp", "Kurs", "Belopp SEK", "Netto SEK", "Moms SEK", "Moms %", "Stripe-avgift SEK"],
  ];
  for (const payment of paymentRows(period)) {
    const booked = bookPayment(payment, config);
    rows.push([
      booked.date,
      booked.email,
      payment.provider,
      payment.status,
      booked.currency,
      booked.gross,
      booked.rate,
      booked.grossSek,
      booked.refund ? -booked.netSek : booked.netSek,
      booked.refund ? -booked.vatSek : booked.vatSek,
      booked.vatRate,
      booked.refund ? 0 : booked.feeSek,
    ]);
  }
  return csv(rows);
}

/** Momsrapport med en rad per ruta och månad. */
export function vatCsv(period: Period, config = accountingConfig()): string {
  const report = vatReport(period, config);
  const rows: (string | number)[][] = [["Period", "Ruta", "Beskrivning", "Belopp SEK"]];
  for (const month of report.months) {
    for (const box of month.boxes) {
      if (box.value === 0 && !["05", "10", "49"].includes(box.code)) continue;
      rows.push([month.month, box.code, box.label, box.value]);
    }
  }
  rows.push([]);
  rows.push(["SUMMA", "", "", ""]);
  for (const box of report.boxes) {
    if (box.value === 0 && !["05", "10", "49"].includes(box.code)) continue;
    rows.push([`${period.from} – ${period.to}`, box.code, box.label, box.value]);
  }
  return csv(rows);
}

export function fileName(prefix: string, period: Period, extension: string): string {
  return `${prefix}_${period.from}_${period.to}.${extension}`;
}
