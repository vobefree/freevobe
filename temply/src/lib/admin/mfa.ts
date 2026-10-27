import { db, type UserRow } from "@/lib/db";
import { hashToken, open, seal } from "@/lib/secret-box";
import { envValue } from "@/lib/settings";
import { formatSecret, generateRecoveryCodes, generateTotpSecret, otpauthUri, verifyTotp } from "@/lib/totp";

/**
 * Tvåfaktorskydd för adminpanelen med TOTP (Google Authenticator m.fl.).
 *
 * Skyddet är påslaget som standard. Skulle ägaren bli utelåst (borttappad telefon
 * och slut på engångskoder) kan det stängas av med ADMIN_MFA_DISABLED=1 i miljön –
 * aldrig från panelen, eftersom panelen kräver koden.
 */

type MfaRow = {
  user_id: string;
  secret: string;
  recovery: string;
  confirmed_at: string | null;
  last_step: number | null;
  created_at: string;
};

const MAX_FAILURES = 5;
const LOCK_SECONDS = 600;
const failures = new Map<string, { fails: number; until: number }>();
/** Lösenordsgissningar bromsas per e-postadress, innan kontot ens är känt. */
const passwordFailures = new Map<string, { fails: number; until: number }>();
const MAX_PASSWORD_FAILURES = 8;
const PASSWORD_LOCK_SECONDS = 900;

export function mfaRequired(): boolean {
  return envValue("ADMIN_MFA_DISABLED") !== "1";
}

function row(userId: string): MfaRow | null {
  const found = db().prepare("SELECT * FROM mfa WHERE user_id = ?").get(userId) as unknown as MfaRow | undefined;
  return found ?? null;
}

function recoveryHashes(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export type MfaState = {
  required: boolean;
  enrolled: boolean;
  confirmedAt: string | null;
  recoveryLeft: number;
};

export function mfaState(userId: string): MfaState {
  const stored = row(userId);
  const hashes = stored ? recoveryHashes(stored.recovery) : [];
  return {
    required: mfaRequired(),
    enrolled: Boolean(stored?.confirmed_at),
    confirmedAt: stored?.confirmed_at ?? null,
    recoveryLeft: hashes.length,
  };
}

export function lockSecondsLeft(userId: string): number {
  const entry = failures.get(userId);
  if (!entry) return 0;
  if (entry.until <= Date.now()) {
    failures.delete(userId);
    return 0;
  }
  return Math.ceil((entry.until - Date.now()) / 1000);
}

export function registerFailure(userId: string): number {
  const entry = failures.get(userId) ?? { fails: 0, until: 0 };
  entry.fails += 1;
  if (entry.fails >= MAX_FAILURES) {
    entry.until = Date.now() + LOCK_SECONDS * 1000;
    entry.fails = 0;
  }
  failures.set(userId, entry);
  return lockSecondsLeft(userId);
}

export function clearFailures(userId: string): void {
  failures.delete(userId);
}

export function passwordLockSeconds(email: string): number {
  const entry = passwordFailures.get(email.toLowerCase());
  if (!entry) return 0;
  if (entry.until <= Date.now()) {
    passwordFailures.delete(email.toLowerCase());
    return 0;
  }
  return Math.ceil((entry.until - Date.now()) / 1000);
}

export function registerPasswordFailure(email: string): number {
  const key = email.toLowerCase();
  const entry = passwordFailures.get(key) ?? { fails: 0, until: 0 };
  entry.fails += 1;
  if (entry.fails >= MAX_PASSWORD_FAILURES) {
    entry.until = Date.now() + PASSWORD_LOCK_SECONDS * 1000;
    entry.fails = 0;
  }
  passwordFailures.set(key, entry);
  return passwordLockSeconds(key);
}

export function clearPasswordFailures(email: string): void {
  passwordFailures.delete(email.toLowerCase());
}

/** Steg 1: skapa en hemlighet som användaren skannar eller skriver in manuellt. */
export function startEnrolment(user: UserRow): { secret: string; formatted: string; uri: string } {
  const secret = generateTotpSecret();
  const existing = row(user.id);
  const stamp = new Date().toISOString();
  if (existing) {
    db().prepare("UPDATE mfa SET secret = ?, confirmed_at = NULL WHERE user_id = ?").run(seal(secret), user.id);
  } else {
    db().prepare("INSERT INTO mfa (user_id, secret, recovery, confirmed_at, created_at) VALUES (?, ?, '[]', NULL, ?)").run(user.id, seal(secret), stamp);
  }
  return { secret, formatted: formatSecret(secret), uri: otpauthUri({ secret, account: user.email }) };
}

/** Steg 2: bekräfta med en kod från appen och få engångskoder tillbaka. */
export function confirmEnrolment(user: UserRow, code: string): { ok: true; recoveryCodes: string[] } | { ok: false; error: string } {
  const stored = row(user.id);
  if (!stored) return { ok: false, error: "not_started" };
  const secret = open(stored.secret);
  if (!secret) return { ok: false, error: "broken_secret" };
  if (!verifyTotp(secret, code)) return { ok: false, error: "invalid_code" };
  const codes = generateRecoveryCodes();
  db()
    .prepare("UPDATE mfa SET recovery = ?, confirmed_at = ? WHERE user_id = ?")
    .run(JSON.stringify(codes.map((item) => hashToken(item))), new Date().toISOString(), user.id);
  clearFailures(user.id);
  return { ok: true, recoveryCodes: codes };
}

export type VerifyResult = { ok: boolean; error?: "locked" | "not_enrolled" | "invalid_code"; lockSeconds?: number; recoveryUsed?: boolean };

/** Verifierar en TOTP-kod eller en engångskod. */
export function verifyCode(user: UserRow, code: string): VerifyResult {
  const locked = lockSecondsLeft(user.id);
  if (locked > 0) return { ok: false, error: "locked", lockSeconds: locked };

  const stored = row(user.id);
  if (!stored?.confirmed_at) return { ok: false, error: "not_enrolled" };
  const secret = open(stored.secret);
  const entered = code.trim();

  if (secret && verifyTotp(secret, entered)) {
    clearFailures(user.id);
    return { ok: true };
  }

  const hashes = recoveryHashes(stored.recovery);
  const candidate = hashToken(entered);
  if (hashes.includes(candidate)) {
    const left = hashes.filter((item) => item !== candidate);
    db().prepare("UPDATE mfa SET recovery = ? WHERE user_id = ?").run(JSON.stringify(left), user.id);
    clearFailures(user.id);
    return { ok: true, recoveryUsed: true };
  }

  const lockLeft = registerFailure(user.id);
  return lockLeft > 0 ? { ok: false, error: "locked", lockSeconds: lockLeft } : { ok: false, error: "invalid_code" };
}

/**
 * Tar bort faktorn helt – används av ägaren vid byte av telefon. Alla sessioner
 * tappar sin verifiering, så att ingen gammal session fortsätter räknas som säker.
 */
export function resetMfa(userId: string): void {
  db().prepare("DELETE FROM mfa WHERE user_id = ?").run(userId);
  db().prepare("UPDATE sessions SET mfa_at = NULL WHERE user_id = ?").run(userId);
  clearFailures(userId);
}
