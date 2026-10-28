import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export interface DatabaseOptions {
  /** Sokväg till databasfilen, eller ':memory:' för tester. */
  file: string;
  /** Kör migreringar direkt vid öppning. */
  migrate?: boolean;
}

export interface Migration {
  version: number;
  name: string;
  statements: string[];
}

/**
 * Allt Freevobe sparar lokalt: sessioner, meddelanden, projekt, inställningar, projektminne,
 * uppgifter och filindex. Databasen är en enda fil i användarens Freevobe-home.
 *
 * Vi använder Node:s inbyggda `node:sqlite`, så inga native moduler behöver kompileras.
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial',
    statements: [
      `CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        last_model TEXT,
        permission_mode TEXT NOT NULL DEFAULT 'ask',
        created_at INTEGER NOT NULL,
        last_opened_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        mode TEXT NOT NULL DEFAULT 'execute',
        model TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        message_count INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        reasoning TEXT,
        model TEXT,
        tool_call_id TEXT,
        tool_calls TEXT,
        context_files TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      )`,
      `CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at)`,
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS index_files (
        path TEXT PRIMARY KEY,
        hash TEXT NOT NULL,
        bytes INTEGER NOT NULL,
        lines INTEGER NOT NULL,
        language TEXT NOT NULL,
        symbols TEXT NOT NULL,
        imports TEXT NOT NULL,
        vector TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS approvals_log (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        target TEXT,
        decision TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`,
    ],
  },
];

export class VibeForgeDatabase {
  readonly db: DatabaseSync;
  readonly file: string;
  private closed = false;

  constructor(options: DatabaseOptions) {
    this.file = options.file;
    if (options.file !== ':memory:') {
      fs.mkdirSync(path.dirname(options.file), { recursive: true });
    }
    this.db = new DatabaseSync(options.file);
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA foreign_keys = ON');
    if (options.migrate !== false) this.migrate();
  }

  migrate(): number {
    this.db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    )`);

    const applied = new Set(
      (this.db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map(
        (row) => row.version,
      ),
    );

    let count = 0;
    for (const migration of [...MIGRATIONS].sort((a, b) => a.version - b.version)) {
      if (applied.has(migration.version)) continue;
      this.db.exec('BEGIN');
      try {
        for (const statement of migration.statements) this.db.exec(statement);
        this.db
          .prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
          .run(migration.version, migration.name, Date.now());
        this.db.exec('COMMIT');
        count += 1;
      } catch (error) {
        this.db.exec('ROLLBACK');
        throw error;
      }
    }
    return count;
  }

  get schemaVersion(): number {
    const row = this.db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get() as
      { version: number | null } | undefined;
    return row?.version ?? 0;
  }

  transaction<T>(work: () => T): T {
    this.db.exec('BEGIN');
    try {
      const result = work();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    try {
      this.db.close();
    } catch {
      // Redan stängd.
    }
  }
}

/** Var Freevobe sparar sin lokala data. */
export function resolveVibeForgeHome(explicit?: string): string {
  if (explicit && explicit.trim() !== '') return path.resolve(explicit);
  const fromEnv = process.env.VIBEFORGE_HOME;
  if (fromEnv && fromEnv.trim() !== '') return path.resolve(fromEnv);
  const home = process.env.HOME ?? process.env.USERPROFILE ?? process.cwd();
  return path.join(home, '.vibeforge');
}

export function databasePath(home?: string): string {
  return path.join(resolveVibeForgeHome(home), 'vibeforge.db');
}
