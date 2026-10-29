import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * i18n:check – jämför varje språkfil med engelska, som är källan.
 *
 *  1. Saknade eller extra nycklar  -> fel (bygget ska inte gå igenom)
 *  2. Tomma strängar              -> fel
 *  3. Avvikande platshållare      -> fel ({repo}, {file} får aldrig byta namn)
 *  4. Oöversatt text (identisk med engelska) -> varning
 *
 * Inga maskinöversättningar kontrolleras här – bara att inget saknas eller tyst faller tillbaka.
 */

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const messagesDir = join(root, 'messages');
const source = 'en';

/** Varumärken och tekniska namn som med flit är identiska på alla språk. */
const IDENTICAL_ALLOWED = new Set([
  'GitHub',
  'Discord',
  'Windows',
  'Linux',
  'macOS',
  'macOS Intel',
  'Android',
  'Apple Silicon',
  'Intel',
  'Ollama',
  'Freevobe',
  'Freevobe Learn',
  'skills',
  'skill',
  'Skills',
  'MCP',
  'Git',
  'Learn',
  'Learn How to Vobe',
  'Gives Back',
  'X',
  'MIT',
  'Kiva',
  'UNICEF',
  'WWF',
  'macOS/Linux',
  'Ctrl+C',
  'mm',
]);

/**
 * Nycklar vars värde aldrig ska översättas: kod, ikonnamn, id:n, URL:er och tekniska tangenter.
 * De jämförs ändå på platshållare och tomhet – bara “identisk med engelska”-varningen hoppas över.
 */
const SKIP_IDENTICAL = [
  '.icon',
  '.url',
  '.id',
  '.body',
  '.copyKey',
  '.titleTemplate',
  '.copyright',
  '.footnoteLink',
  '.platformMacLinux',
  '.platformWindows',
];

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    console.error(`Kunde inte läsa ${file}: ${error.message}`);
    process.exit(1);
  }
}

function flatten(value, prefix = '', out = new Map()) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => flatten(entry, `${prefix}[${index}]`, out));
    return out;
  }
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      flatten(entry, prefix ? `${prefix}.${key}` : key, out);
    }
    return out;
  }
  out.set(prefix, value);
  return out;
}

function placeholders(text) {
  return [...String(text).matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

const locales = readdirSync(messagesDir)
  .filter((file) => file.endsWith('.json'))
  .map((file) => file.replace(/\.json$/, ''));

if (!locales.includes(source)) {
  console.error(`Källfilen messages/${source}.json saknas.`);
  process.exit(1);
}

const english = flatten(readJson(join(messagesDir, `${source}.json`)));
const problems = [];
const warnings = [];

for (const locale of locales) {
  if (locale === source) continue;
  const other = flatten(readJson(join(messagesDir, `${locale}.json`)));

  for (const key of english.keys()) {
    if (!other.has(key)) problems.push(`[${locale}] saknar nyckeln "${key}"`);
  }
  for (const key of other.keys()) {
    if (!english.has(key)) problems.push(`[${locale}] har nyckeln "${key}" som inte finns i ${source}`);
  }

  for (const [key, value] of other) {
    if (typeof value !== 'string') continue;
    if (value.trim() === '') {
      problems.push(`[${locale}] "${key}" är tom`);
      continue;
    }

    const expected = english.get(key);
    if (typeof expected !== 'string') continue;

    const wanted = placeholders(expected).join(',');
    const found = placeholders(value).join(',');
    if (wanted !== found) {
      problems.push(`[${locale}] "${key}" har platshållarna {${found}} men ska ha {${wanted}}`);
    }

    const skippable = SKIP_IDENTICAL.some((suffix) => key.endsWith(suffix));
    if (!skippable && value === expected && !IDENTICAL_ALLOWED.has(value) && value.length > 3) {
      warnings.push(`[${locale}] "${key}" är identisk med engelska – kanske oöversatt`);
    }
  }
}

for (const problem of problems) console.error(`FEL   ${problem}`);
for (const warning of warnings) console.warn(`VARN  ${warning}`);

const translated = locales.length - 1;
console.log(
  `\ni18n: ${locales.length} språk (${source} + ${translated} översättningar), ` +
    `${english.size} nycklar per språk, ${problems.length} fel, ${warnings.length} varningar.`,
);

if (problems.length > 0) process.exit(1);
