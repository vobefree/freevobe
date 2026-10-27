// Kontrollerar alla interna länkar på de publika sidorna.
// Användning: node scripts/audit-links.mjs [bas-url]
const BASE = process.argv[2] ?? "http://127.0.0.1:3110";
const LOCALES = ["sv", "nb", "fi", "da", "en", "fr", "de", "es"];
const PAGES = ["", "/pricing", "/contact", "/privacy", "/terms", "/agency", "/agency/pricing", "/login", "/signup"];

const seen = new Map();
const broken = [];

function internal(href) {
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return null;
  if (href.startsWith("http") && !href.startsWith(BASE)) return null;
  try {
    const url = new URL(href, BASE);
    if (url.origin !== BASE) return null;
    return url.pathname + url.search;
  } catch {
    return null;
  }
}

for (const locale of LOCALES) {
  for (const page of PAGES) {
    const path = `/${locale}${page}`;
    const res = await fetch(BASE + path, { redirect: "manual" });
    const html = await res.text();
    if (res.status !== 200) {
      broken.push(`${res.status} ${path} (sidan själv)`);
      continue;
    }
    for (const match of html.matchAll(/href="([^"]+)"/g)) {
      const target = internal(match[1]);
      if (!target) continue;
      if (!seen.has(target)) seen.set(target, path);
    }
  }
}

for (const [target, source] of seen) {
  const res = await fetch(BASE + target, { redirect: "manual" });
  if (res.status >= 400) {
    broken.push(`${res.status} ${target} (länkad från ${source})`);
  }
}

console.log(`Kontrollerade ${seen.size} unika interna länkar.`);
if (broken.length === 0) {
  console.log("Inga trasiga länkar.");
  process.exit(0);
}
console.log(`Trasiga länkar: ${broken.length}`);
for (const row of broken) console.log(`  ${row}`);
process.exit(1);
