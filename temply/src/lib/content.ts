import { db } from "./db";
import { DICTS, getDict, type Dict } from "./i18n";
import { SITE_COPY, siteCopy, type SiteCopy } from "./i18n/site";
import { isLocale, LOCALES, type Locale } from "./theme/types";

// Serverkod kan importera allt härifrån: originaltexter, typer och överskrivningar.
export * from "./i18n";
export * from "./i18n/site";
export type { Locale } from "./theme/types";

/**
 * Redigerbara sajttexter.
 *
 * Grundtexterna finns kvar i `lib/i18n` som typer och reservvärden. Här ligger
 * ett tunt lager ovanpå: varje text är adresserad med en punktad nyckel
 * (`hero.title`, `site.terms.sections.0.body`) och kan skrivas över per språk
 * från adminpanelen. Saknas en överskrivning används originaltexten, så nya
 * texter i koden fungerar direkt utan migrering.
 *
 * Modulen läser databasen och importeras därför bara av serverkod.
 */

export const CONTENT_LOCALES: readonly Locale[] = LOCALES;

export type ContentScope = "dict" | "site";

export const SCOPE_LABELS: Record<ContentScope, string> = {
  dict: "Gränssnitt",
  site: "Sajttexter",
};

export type ContentEntry = {
  /** Full nyckel, till exempel `site.contact.title`. */
  key: string;
  scope: ContentScope;
  /** Första nyckelledet efter omfånget, används för gruppering. */
  group: string;
  /** Texten som visas på sajten just nu. */
  value: string;
  /** Originaltexten i koden. */
  base: string;
  overridden: boolean;
};

type Json = unknown;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function flatten(value: Json, prefix: string, out: Map<string, string>): void {
  if (typeof value === "string") {
    out.set(prefix, value);
    return;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    out.set(prefix, String(value));
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => flatten(item, `${prefix}.${index}`, out));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value as Record<string, Json>)) {
      flatten(item, prefix ? `${prefix}.${key}` : key, out);
    }
  }
}

function setPath(target: Json, path: string[], raw: string): void {
  if (path.length === 0) return;
  let cursor = target as Record<string, unknown>;
  for (let index = 0; index < path.length - 1; index += 1) {
    const next = cursor[path[index]];
    if (!next || typeof next !== "object") return;
    cursor = next as Record<string, unknown>;
  }
  const leaf = path[path.length - 1];
  const current = cursor[leaf];
  if (typeof current === "number") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) cursor[leaf] = parsed;
    return;
  }
  if (typeof current === "boolean") {
    cursor[leaf] = raw === "true";
    return;
  }
  if (typeof current === "string") cursor[leaf] = raw;
}

function localeKey(locale: string): Locale {
  return isLocale(locale) ? locale : "en";
}

function overrideRows(locale: string, scope?: ContentScope): { key: string; value: string }[] {
  try {
    const statement = scope
      ? db().prepare("SELECT key, value FROM content_overrides WHERE locale = ? AND key LIKE ? ORDER BY key")
      : db().prepare("SELECT key, value FROM content_overrides WHERE locale = ? ORDER BY key");
    const rows = (scope ? statement.all(locale, `${scope}.%`) : statement.all(locale)) as unknown as {
      key: string;
      value: string;
    }[];
    return rows.map((row) => ({ key: String(row.key), value: String(row.value) }));
  } catch {
    // Låst eller oinitierad databas: originaltexterna duger, sajten ska aldrig stå still.
    return [];
  }
}

function merged<T>(base: T, locale: string, scope: ContentScope): T {
  const copy = clone(base);
  for (const row of overrideRows(locale, scope)) {
    setPath(copy, row.key.slice(scope.length + 1).split("."), row.value);
  }
  return copy;
}

/** Gränssnittstexter med adminpanelens överskrivningar. */
export function dictFor(locale: string): Dict {
  return merged(getDict(locale), localeKey(locale), "dict");
}

/** Sajttexter (juridik, kontakt, cookies, fot) med överskrivningar. */
export function copyFor(locale: string): SiteCopy {
  return merged(siteCopy(locale), localeKey(locale), "site");
}

export function baseDict(locale: string): Dict {
  return DICTS[localeKey(locale)];
}

export function baseCopy(locale: string): SiteCopy {
  return SITE_COPY[localeKey(locale)];
}

/** Alla texter för ett språk, med värde, original och om de är ändrade. */
export function contentEntries(locale: string): ContentEntry[] {
  const key = localeKey(locale);
  const overrides = new Map(overrideRows(key).map((row) => [row.key, row.value]));
  const result: ContentEntry[] = [];

  const collect = (scope: ContentScope, base: Json) => {
    const flattened = new Map<string, string>();
    flatten(base, scope, flattened);
    for (const [fullKey, baseValue] of flattened) {
      const override = overrides.get(fullKey);
      const rest = fullKey.slice(scope.length + 1);
      result.push({
        key: fullKey,
        scope,
        group: rest.split(".")[0] || "root",
        value: override ?? baseValue,
        base: baseValue,
        overridden: override !== undefined,
      });
    }
  };

  collect("dict", DICTS[key]);
  collect("site", SITE_COPY[key]);
  return result;
}

export function overrideCount(locale: string): number {
  const key = localeKey(locale);
  try {
    const row = db().prepare("SELECT COUNT(*) AS count FROM content_overrides WHERE locale = ?").get(key) as unknown as {
      count: number;
    };
    return Number(row?.count ?? 0);
  } catch {
    return 0;
  }
}

export function saveContentValues(locale: string, values: Record<string, string>, actor: string): { saved: number; removed: number; skipped: string[] } {
  const key = localeKey(locale);
  const known = new Set(contentEntries(key).map((entry) => entry.key));
  const base = new Map(contentEntries(key).map((entry) => [entry.key, entry.base]));
  const upsert = db().prepare(
    "INSERT INTO content_overrides (locale, key, value, updated_by, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(locale, key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at",
  );
  const remove = db().prepare("DELETE FROM content_overrides WHERE locale = ? AND key = ?");
  const stamp = new Date().toISOString();
  const skipped: string[] = [];
  let saved = 0;
  let removed = 0;

  for (const [name, raw] of Object.entries(values)) {
    if (!known.has(name)) {
      skipped.push(name);
      continue;
    }
    const value = String(raw ?? "");
    // Tillbaka till originaltexten: ta bort överskrivningen i stället för att spara en kopia.
    if (!value.trim() || value === base.get(name)) {
      remove.run(key, name);
      removed += 1;
      continue;
    }
    upsert.run(key, name, value, actor, stamp);
    saved += 1;
  }
  return { saved, removed, skipped };
}

export function resetContent(locale: string, onlyKey?: string): number {
  const key = localeKey(locale);
  const statement = onlyKey
    ? db().prepare("DELETE FROM content_overrides WHERE locale = ? AND key = ?")
    : db().prepare("DELETE FROM content_overrides WHERE locale = ?");
  const result = onlyKey ? statement.run(key, onlyKey) : statement.run(key);
  return Number(result.changes ?? 0);
}

/** Kopierar alla ändringar från ett språk till ett annat – praktiskt när en text först skrivs på svenska. */
export function copyOverrides(from: string, to: string, actor: string): number {
  const source = overrideRows(localeKey(from));
  const target = localeKey(to);
  const upsert = db().prepare(
    "INSERT INTO content_overrides (locale, key, value, updated_by, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(locale, key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at",
  );
  const stamp = new Date().toISOString();
  source.forEach((row) => upsert.run(target, row.key, row.value, actor, stamp));
  return source.length;
}
