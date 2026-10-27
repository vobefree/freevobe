import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Symmetrisk kryptering (AES-256-GCM) för hemligheter i databasen: API-nycklar,
 * TOTP-hemligheter och engångskoder. Nyckeln härleds från SETTINGS_SECRET (eller
 * SHOPIFY_API_SECRET) så att samma värde kan läsas av alla processer.
 */

const PREFIX = "v1:";

function secret(): string {
  return process.env.SETTINGS_SECRET || process.env.SHOPIFY_API_SECRET || "themefold-local-settings";
}

function key(): Buffer {
  return createHash("sha256").update(`themefold:${secret()}`).digest();
}

export function seal(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${PREFIX}${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${encrypted.toString("base64")}`;
}

export function open(payload: string): string {
  if (!payload.startsWith(PREFIX)) return payload;
  const [iv, tag, data] = payload.slice(PREFIX.length).split(":");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

/** Kort hash för engångskoder – de behöver bara kunna jämföras, inte läsas tillbaka. */
export function hashToken(value: string): string {
  return createHash("sha256").update(`${secret()}:${value.trim().toUpperCase()}`).digest("hex");
}
