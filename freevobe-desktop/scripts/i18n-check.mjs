#!/usr/bin/env node
/**
 * i18n-kontroll för skrivbordsappen (och de locale-filer mobilappen synkar från).
 *
 *   node scripts/i18n-check.mjs          # fel + varningar
 *   node scripts/i18n-check.mjs --strict # varningar räknas som fel (CI)
 *
 * Kontrollerar:
 *   1. Alla språk har exakt samma nycklar som en.json.
 *   2. Inga nycklar används i koden utan att finnas i en.json.
 *   3. Inga onödiga nycklar (oanvända) i en.json.
 *   4. Platzhållare ({{name}}) stämmer mellan engelska och varje översättning.
 *   5. Varnar när en sträng är identisk med engelska (kan vara oöversatt).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const localeDir = join(root, 'apps/desktop/src/locales');
const sourceDirs = [join(root, 'apps/desktop/src')];
const strict = process.argv.includes('--strict');

const errors = [];
const warnings = [];

const locales = readdirSync(localeDir)
  .filter((file) => file.endsWith('.json'))
  .map((file) => ({ locale: file.replace(/\.json$/, ''), data: JSON.parse(readFileSync(join(localeDir, file), 'utf8')) }));

const base = locales.find((entry) => entry.locale === 'en');
if (!base) {
  console.error('Saknar en.json – engelska är default och måste finnas.');
  process.exit(1);
}
const baseKeys = Object.keys(base.data);
const baseSet = new Set(baseKeys);

for (const { locale, data } of locales) {
  const keys = new Set(Object.keys(data));
  const missing = baseKeys.filter((key) => !keys.has(key));
  const extra = [...keys].filter((key) => !baseSet.has(key));
  if (missing.length) errors.push(`[${locale}] saknar ${missing.length} nycklar: ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? '…' : ''}`);
  if (extra.length) errors.push(`[${locale}] har ${extra.length} nycklar som inte finns i en: ${extra.slice(0, 8).join(', ')}${extra.length > 8 ? '…' : ''}`);

  for (const key of baseKeys) {
    const value = data[key];
    if (typeof value !== 'string') continue;
    const expected = placeholders(base.data[key]);
    const actual = placeholders(value);
    if (expected.join(',') !== actual.join(',')) {
      errors.push(`[${locale}] "${key}" har platzhållarna ${actual.join(', ') || '–'} men engelska har ${expected.join(', ') || '–'}`);
    }
    // Korta etiketter ("Skills", "Plan", "Editor", "MCP") är varumärken eller tekniska termer som
    // medvetet inte översätts. Längre texter som är identiska är däremot troligen oöversatta.
    if (locale !== 'en' && value === base.data[key] && value.trim().split(/\s+/).length >= 3) {
      warnings.push(`[${locale}] "${key}" är identisk med engelska – kanske oöversatt`);
    }
  }
}

// Nycklar som används i koden men saknas i en.json.
const used = new Set();
// Alla nycklar som nämns någonstans i koden (även i konstanter) – underlag för oanvända nycklar.
const referenced = new Set();
for (const dir of sourceDirs) {
  for (const file of walk(dir)) {
    if (!/\.(ts|tsx)$/.test(file)) continue;
    // Tester får använda tillfälliga nycklar som bara finns i testet.
    if (/\.test\.(ts|tsx)$/.test(file)) continue;
    if (file.includes(`${join('src', 'locales')}`) || file.endsWith('test-setup.ts')) continue;
    const code = readFileSync(file, 'utf8');
    for (const match of code.matchAll(/\bt\(\s*'([a-zA-Z0-9_.-]+)'/g)) used.add(match[1]);
    for (const match of code.matchAll(/\bi18n\.t\(\s*'([a-zA-Z0-9_.-]+)'/g)) used.add(match[1]);
    // Nycklar som listas i konstanter (t.ex. statusetiketter) räknas också som använda.
    for (const match of code.matchAll(/'([a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)+)'/g)) {
      if (baseSet.has(match[1])) referenced.add(match[1]);
    }
  }
}

for (const key of used) referenced.add(key);

for (const key of used) {
  // i18next-plural: basnyckeln finns som <key>_one / <key>_other.
  const exists = baseSet.has(key) || baseSet.has(`${key}_one`) || baseSet.has(`${key}_other`);
  if (!exists) errors.push(`Nyckeln "${key}" används i koden men saknas i en.json`);
}

// Dynamiska nycklar (t.ex. `phase.${phase}`) kan inte läsas statiskt – de vitlistas per prefix.
const dynamicPrefixes = ['phase.', 'permission.', 'permission.desc.', 'autoApprove.', 'autoApprove.desc.', 'risk.', 'error.', 'time.'];
const unused = baseKeys.filter(
  (key) =>
    !referenced.has(key) &&
    !referenced.has(key.replace(/_(one|other)$/, '')) &&
    !dynamicPrefixes.some((prefix) => key.startsWith(prefix)),
);
if (unused.length) warnings.push(`${unused.length} nycklar i en.json används inte i koden: ${unused.slice(0, 10).join(', ')}${unused.length > 10 ? '…' : ''}`);

function placeholders(value) {
  return [...String(value).matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((match) => match[1]).sort();
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      yield* walk(full);
    } else {
      yield full;
    }
  }
}

for (const warning of warnings) console.log(`VARN  ${warning}`);
for (const error of errors) console.log(`FEL   ${error}`);

const warningCount = strict ? warnings.length : 0;
console.log(
  `\ni18n: ${locales.length} språk, ${baseKeys.length} nycklar per språk, ${errors.length} fel, ${warnings.length} varningar.`,
);

if (errors.length || warningCount) process.exit(1);
