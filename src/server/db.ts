import { createClient, type Client, type InValue, type ResultSet } from "@libsql/client";

/**
 * Minimal databasskal för inklockningen.
 * - Lokalt:  DATABASE_URL=file:./data.db  (SQLite-fil)
 * - Vercel:  DATABASE_URL=libsql://... + TURSO_AUTH_TOKEN
 * Samma SQL fungerar i båda lägena.
 */

const DDL = `
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  hourly_rate REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  note TEXT
);
CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date);
CREATE INDEX IF NOT EXISTS idx_shifts_employee ON shifts(employee_id);

CREATE TABLE IF NOT EXISTS time_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  clock_in TEXT NOT NULL,
  clock_out TEXT,
  in_date TEXT NOT NULL,
  in_time TEXT NOT NULL,
  out_date TEXT,
  out_time TEXT
);
CREATE INDEX IF NOT EXISTS idx_entries_employee_date ON time_entries(employee_id, in_date);
`;

const globalForDb = globalThis as unknown as { __fgClient?: Client; __fgReady?: Promise<void> };

function makeClient(): Client {
  const url = process.env.DATABASE_URL?.trim() || "file:./data.db";
  if (process.env.VERCEL && url.startsWith("file:")) {
    throw new Error(
      "DATABASE_URL saknas eller pekar på en fil. På Vercel behövs en Turso/libSQL-databas: " +
        "sätt DATABASE_URL=libsql://… och TURSO_AUTH_TOKEN i projektets miljövariabler.",
    );
  }
  if (url.startsWith("file:")) {
    return createClient({ url });
  }
  const authToken = process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN;
  return createClient({ url, ...(authToken ? { authToken } : {}) });
}

function getClient(): Client {
  if (!globalForDb.__fgClient) globalForDb.__fgClient = makeClient();
  return globalForDb.__fgClient;
}

async function ready(): Promise<void> {
  if (!globalForDb.__fgReady) {
    globalForDb.__fgReady = getClient()
      .executeMultiple(DDL)
      .then(() => undefined)
      .catch((err: unknown) => {
        globalForDb.__fgReady = undefined;
        throw err;
      });
  }
  return globalForDb.__fgReady;
}

export async function query(sql: string, args: InValue[] = []): Promise<ResultSet> {
  await ready();
  return getClient().execute({ sql, args });
}

export async function all<T>(sql: string, args: InValue[] = []): Promise<T[]> {
  const rs = await query(sql, args);
  return rs.rows.map((row) => row as unknown as T);
}

export async function one<T>(sql: string, args: InValue[] = []): Promise<T | null> {
  const rows = await all<T>(sql, args);
  return rows.length > 0 ? rows[0] : null;
}

export async function run(sql: string, args: InValue[] = []): Promise<void> {
  await query(sql, args);
}
