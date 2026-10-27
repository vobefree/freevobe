import fs from "node:fs";

const src = fs.readFileSync("src/lib/i18n/dna.ts", "utf8");
const body = src.split("const VALUES")[1].split("const FLAT_KEYS")[0];
const locales = ["sv", "nb", "fi", "da", "en", "fr", "de", "es"];
const expected = 119;

let ok = true;
for (const locale of locales) {
  const start = body.indexOf(`\n  ${locale}: [`);
  if (start < 0) {
    console.log(locale, "MISSING");
    ok = false;
    continue;
  }
  const end = body.indexOf("\n  ],", start + 1);
  const block = body.slice(start, end);
  const parts = block.split(/],\s*\[/);
  const counts = parts.map((part) => (part.match(/"/g) ?? []).length / 2);
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total !== expected) ok = false;
  console.log(locale, `groups=${parts.length}`, `strings=${total}`, total === expected ? "ok" : "MISMATCH");
}
process.exit(ok ? 0 : 1);
