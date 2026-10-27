import { createHmac, randomBytes, randomInt } from "node:crypto";

/**
 * TOTP (RFC 6238) med SHA-1, 6 siffror och 30 sekunders steg – samma standard som
 * Google Authenticator, 1Password, Authy och Apple Lösenordshanterare.
 * Ingen extern kod behövs, så adminpanelen har inga fler beroenden än nödvändigt.
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_ISSUER = "ThemeFold";
export const TOTP_DIGITS = 6;
export const TOTP_PERIOD = 30;

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, "").toUpperCase().replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Ny hemlighet på 20 byte (160 bitar), som rekommenderat för SHA-1. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

function codeForStep(secret: string, step: number): string {
  const key = base32Decode(secret);
  const counter = Buffer.alloc(8);
  counter.writeUInt32BE(Math.floor(step / 2 ** 32), 0);
  counter.writeUInt32BE(step % 2 ** 32, 4);
  const digest = createHmac("sha1", key).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) | ((digest[offset + 1] & 0xff) << 16) | ((digest[offset + 2] & 0xff) << 8) | (digest[offset + 3] & 0xff);
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

export function currentStep(at = Date.now()): number {
  return Math.floor(at / 1000 / TOTP_PERIOD);
}

export function totpCode(secret: string, at = Date.now()): string {
  return codeForStep(secret, currentStep(at));
}

/** Tillåter en tidsruta före och efter för att hantera klockglidning. */
export function verifyTotp(secret: string, code: string, at = Date.now(), windowSteps = 1): boolean {
  const candidate = code.replace(/\D/g, "");
  if (candidate.length !== TOTP_DIGITS) return false;
  const step = currentStep(at);
  for (let offset = -windowSteps; offset <= windowSteps; offset += 1) {
    if (codeForStep(secret, step + offset) === candidate) return true;
  }
  return false;
}

export function otpauthUri(input: { secret: string; account: string; issuer?: string }): string {
  const issuer = input.issuer ?? TOTP_ISSUER;
  const label = encodeURIComponent(`${issuer}:${input.account}`);
  const params = new URLSearchParams({
    secret: input.secret,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Engångskoder att skriva ut och förvara säkert. */
export function generateRecoveryCodes(count = 8): string[] {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: count }, () => {
    const raw = Array.from({ length: 10 }, () => alphabet[randomInt(0, alphabet.length)]).join("");
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

/** Visar hemligheten i läsbara grupper för manuell inmatning. */
export function formatSecret(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}
