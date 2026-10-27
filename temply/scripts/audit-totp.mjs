// Räknar ut en TOTP-kod (RFC 6238, SHA-1, 6 siffror, 30 s) för granskningens skull.
// Användning: node scripts/audit-totp.mjs <base32-hemlighet> [offset-steg]
import { createHmac } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function decode(input) {
  const clean = input.replace(/=+$/, "").toUpperCase().replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const bytes = [];
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

const secret = process.argv[2];
const offset = Number(process.argv[3] ?? 0);
if (!secret) {
  console.error("secret saknas");
  process.exit(1);
}
const step = Math.floor(Date.now() / 1000 / 30) + offset;
const counter = Buffer.alloc(8);
counter.writeUInt32BE(Math.floor(step / 2 ** 32), 0);
counter.writeUInt32BE(step % 2 ** 32, 4);
const digest = createHmac("sha1", decode(secret)).update(counter).digest();
const at = digest[digest.length - 1] & 0x0f;
const binary =
  ((digest[at] & 0x7f) << 24) | ((digest[at + 1] & 0xff) << 16) | ((digest[at + 2] & 0xff) << 8) | (digest[at + 3] & 0xff);
console.log(String(binary % 1_000_000).padStart(6, "0"));
