/** Tidsformatering. Allt visas i svensk tid (Europe/Stockholm). */

const TZ = "Europe/Stockholm";

export function nowISO(): string {
  return new Date().toISOString();
}

/** Lokalt datum (YYYY-MM-DD) just nu i Stockholm. */
export function today(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Lokal klockslag (HH:MM) just nu i Stockholm. */
export function nowClock(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
}

/** "YYYY-MM" för innevarande månad. */
export function currentMonth(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
}

/** YYYY-MM-DD -> Date (UTC-middag, så datumet aldrig rör sig). */
function dateOnly(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

/** "mån 5 okt" osv. */
export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }): string {
  return new Intl.DateTimeFormat("sv-SE", { ...opts, timeZone: "UTC" }).format(dateOnly(iso));
}

/** "lördag 5 oktober 2026" */
export function formatDateLong(iso: string): string {
  return formatDate(iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function formatNumber(iso: string): string {
  return formatDate(iso, { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** "oktober 2026" */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("sv-SE", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
}

export function monthLabelShort(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const label = new Intl.DateTimeFormat("sv-SE", { month: "short", year: "2-digit", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
  return label.replace(".", "");
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Alla datum i en månad, t.ex. 2026-10-01 ... 2026-10-31. */
export function daysInMonth(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const out: string[] = [];
  const d = new Date(Date.UTC(y, m - 1, 1));
  while (d.getUTCMonth() === m - 1) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/** Månadsgrid: veckor av 7 dagar, måndag först, med tomma rutor före/efter. */
export function monthGrid(month: string): (string | null)[][] {
  const days = daysInMonth(month);
  const first = new Date(`${days[0]}T12:00:00Z`);
  const offset = (first.getUTCDay() + 6) % 7; // måndag = 0
  const cells: (string | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  cells.push(...days);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Timmar mellan två ISO-tidsstämplar. */
export function hoursBetween(fromISO: string, toISO: string): number {
  const ms = new Date(toISO).getTime() - new Date(fromISO).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return ms / 3_600_000;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** 7.5 -> "7,50" */
export function fmtHours(h: number): string {
  return new Intl.NumberFormat("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(round2(h));
}

/** 1234.5 -> "1 234,50 kr" */
export function fmtSEK(n: number): string {
  return new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK" }).format(n);
}

export function fmtRate(n: number): string {
  return `${new Intl.NumberFormat("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} kr`;
}

/** "09:15" från "09:15" (loggning skrivs redan som HH:MM). */
export function fmtClock(v: string | null | undefined): string {
  return v ?? "–";
}

/** "2 tim 15 min" för visning av pågående pass. */
export function fmtDuration(hours: number): string {
  const total = Math.max(0, Math.round(hours * 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} tim`;
  return `${h} tim ${m} min`;
}
