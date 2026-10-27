import path from 'node:path';
import type {
  AppSettings,
  ChatMessage,
  PermissionMode,
  Project,
  Session,
  TaskItem,
} from '@vibeforge/protocol';
import {
  AD_INTERVAL_PROMPTS,
  DEFAULT_CONTEXT_BUDGET_CHARS,
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_MODEL,
  DEFAULT_OLLAMA_URL,
} from '@vibeforge/protocol';
import { createId } from '../util/ids.js';
import type { IndexedFile, IndexStore } from '../context/indexer.js';
import type { VibeForgeDatabase } from './db.js';

export const DEFAULT_SETTINGS: AppSettings = {
  ollamaBaseUrl: DEFAULT_OLLAMA_URL,
  defaultModel: DEFAULT_MODEL,
  permissionMode: 'ask',
  theme: 'dark',
  contextBudgetChars: DEFAULT_CONTEXT_BUDGET_CHARS,
  maxIterations: DEFAULT_MAX_ITERATIONS,
  telemetry: false,
  allowCloudServices: false,
  ads: { provider: 'none', everyNPrompts: AD_INTERVAL_PROMPTS, enabled: false },
  browserAutomationEnabled: false,
  updatedAt: 0,
};

interface ProjectRow {
  id: string;
  path: string;
  name: string;
  last_model: string | null;
  permission_mode: string;
  created_at: number;
  last_opened_at: number;
}

interface SessionRow {
  id: string;
  project_id: string;
  title: string;
  mode: string;
  model: string;
  created_at: number;
  updated_at: number;
  message_count: number;
}

interface MessageRow {
  id: string;
  session_id: string;
  role: string;
  content: string;
  reasoning: string | null;
  model: string | null;
  tool_call_id: string | null;
  tool_calls: string | null;
  context_files: string | null;
  created_at: number;
}

export class ProjectRepository {
  private readonly db: VibeForgeDatabase;

  constructor(db: VibeForgeDatabase) {
    this.db = db;
  }

  upsert(projectPath: string, name?: string): Project {
    const absolute = path.resolve(projectPath);
    const existing = this.findByPath(absolute);
    const now = Date.now();

    if (existing) {
      this.db.db
        .prepare('UPDATE projects SET last_opened_at = ?, name = COALESCE(?, name) WHERE id = ?')
        .run(now, name ?? null, existing.id);
      return { ...existing, lastOpenedAt: now, ...(name ? { name } : {}) };
    }

    const project: Project = {
      id: createId('proj'),
      path: absolute,
      name: name ?? path.basename(absolute),
      permissionMode: 'ask',
      createdAt: now,
      lastOpenedAt: now,
    };
    this.db.db
      .prepare(
        'INSERT INTO projects (id, path, name, permission_mode, created_at, last_opened_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(
        project.id,
        project.path,
        project.name,
        project.permissionMode,
        project.createdAt,
        project.lastOpenedAt,
      );
    return project;
  }

  findByPath(projectPath: string): Project | null {
    const row = this.db.db
      .prepare('SELECT * FROM projects WHERE path = ?')
      .get(path.resolve(projectPath)) as ProjectRow | undefined;
    return row ? mapProject(row) : null;
  }

  findById(id: string): Project | null {
    const row = this.db.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as
      ProjectRow | undefined;
    return row ? mapProject(row) : null;
  }

  list(): Project[] {
    const rows = this.db.db
      .prepare('SELECT * FROM projects ORDER BY last_opened_at DESC LIMIT 50')
      .all() as unknown as ProjectRow[];
    return rows.map(mapProject);
  }

  setLastModel(id: string, model: string): void {
    this.db.db.prepare('UPDATE projects SET last_model = ? WHERE id = ?').run(model, id);
  }

  setPermissionMode(id: string, mode: PermissionMode): void {
    this.db.db.prepare('UPDATE projects SET permission_mode = ? WHERE id = ?').run(mode, id);
  }
}

function mapProject(row: ProjectRow): Project {
  return {
    id: row.id,
    path: row.path,
    name: row.name,
    permissionMode: row.permission_mode as PermissionMode,
    createdAt: row.created_at,
    lastOpenedAt: row.last_opened_at,
    ...(row.last_model ? { lastModel: row.last_model } : {}),
  };
}

export class SessionRepository {
  private readonly db: VibeForgeDatabase;

  constructor(db: VibeForgeDatabase) {
    this.db = db;
  }

  create(input: {
    projectId: string;
    title: string;
    model: string;
    mode?: 'plan' | 'execute';
  }): Session {
    const session: Session = {
      id: createId('sess'),
      projectId: input.projectId,
      title: input.title,
      mode: input.mode ?? 'execute',
      model: input.model,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0,
    };
    this.db.db
      .prepare(
        'INSERT INTO sessions (id, project_id, title, mode, model, created_at, updated_at, message_count) VALUES (?, ?, ?, ?, ?, ?, ?, 0)',
      )
      .run(
        session.id,
        session.projectId,
        session.title,
        session.mode,
        session.model,
        session.createdAt,
        session.updatedAt,
      );
    return session;
  }

  list(projectId: string, limit = 50): Session[] {
    const rows = this.db.db
      .prepare('SELECT * FROM sessions WHERE project_id = ? ORDER BY updated_at DESC LIMIT ?')
      .all(projectId, limit) as unknown as SessionRow[];
    return rows.map(mapSession);
  }

  get(id: string): Session | null {
    const row = this.db.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as
      SessionRow | undefined;
    return row ? mapSession(row) : null;
  }

  update(id: string, patch: { title?: string; mode?: 'plan' | 'execute'; model?: string }): void {
    const session = this.get(id);
    if (!session) return;
    this.db.db
      .prepare('UPDATE sessions SET title = ?, mode = ?, model = ?, updated_at = ? WHERE id = ?')
      .run(
        patch.title ?? session.title,
        patch.mode ?? session.mode,
        patch.model ?? session.model,
        Date.now(),
        id,
      );
  }

  delete(id: string): void {
    this.db.db.prepare('DELETE FROM messages WHERE session_id = ?').run(id);
    this.db.db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  }

  touch(id: string): void {
    this.db.db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(Date.now(), id);
  }
}

function mapSession(row: SessionRow): Session {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    mode: row.mode === 'plan' ? 'plan' : 'execute',
    model: row.model,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    messageCount: row.message_count,
  };
}

export class MessageRepository {
  private readonly db: VibeForgeDatabase;

  constructor(db: VibeForgeDatabase) {
    this.db = db;
  }

  append(message: ChatMessage & { sessionId: string }): void {
    this.db.db
      .prepare(
        'INSERT INTO messages (id, session_id, role, content, reasoning, model, tool_call_id, tool_calls, context_files, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        message.id,
        message.sessionId,
        message.role,
        message.content,
        message.reasoning ?? null,
        message.model ?? null,
        message.toolCallId ?? null,
        message.toolCalls ? JSON.stringify(message.toolCalls) : null,
        message.contextFiles ? JSON.stringify(message.contextFiles) : null,
        message.createdAt,
      );
    this.db.db
      .prepare('UPDATE sessions SET message_count = message_count + 1, updated_at = ? WHERE id = ?')
      .run(message.createdAt, message.sessionId);
  }

  list(sessionId: string, limit = 200): ChatMessage[] {
    const rows = this.db.db
      .prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC LIMIT ?')
      .all(sessionId, limit) as unknown as MessageRow[];
    return rows.map((row) => {
      const message: ChatMessage = {
        id: row.id,
        role: row.role as ChatMessage['role'],
        content: row.content,
        createdAt: row.created_at,
      };
      if (row.reasoning) message.reasoning = row.reasoning;
      if (row.model) message.model = row.model;
      if (row.tool_call_id) message.toolCallId = row.tool_call_id;
      if (row.tool_calls) {
        try {
          message.toolCalls = JSON.parse(row.tool_calls) as ChatMessage['toolCalls'];
        } catch {
          // Trasig rad – hoppa över anropen.
        }
      }
      return message;
    });
  }

  countUserMessages(sessionId: string): number {
    const row = this.db.db
      .prepare("SELECT COUNT(*) AS count FROM messages WHERE session_id = ? AND role = 'user'")
      .get(sessionId) as { count: number } | undefined;
    return row?.count ?? 0;
  }
}

export class SettingsRepository {
  private readonly db: VibeForgeDatabase;

  constructor(db: VibeForgeDatabase) {
    this.db = db;
  }

  get(): AppSettings {
    const rows = this.db.db.prepare('SELECT key, value FROM settings').all() as {
      key: string;
      value: string;
    }[];
    const stored: Record<string, unknown> = {};
    for (const row of rows) {
      try {
        stored[row.key] = JSON.parse(row.value);
      } catch {
        // Ogiltigt värde – ignorera nyckeln.
      }
    }
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      ads: {
        ...DEFAULT_SETTINGS.ads,
        ...(typeof stored.ads === 'object' && stored.ads !== null ? (stored.ads as object) : {}),
      },
      telemetry: false,
      updatedAt: typeof stored.updatedAt === 'number' ? stored.updatedAt : 0,
    };
  }

  set(patch: Partial<AppSettings>): AppSettings {
    const statement = this.db.db.prepare(
      'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
    );
    this.db.transaction(() => {
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) continue;
        statement.run(key, JSON.stringify(value), Date.now());
      }
      statement.run('updatedAt', JSON.stringify(Date.now()), Date.now());
    });
    return this.get();
  }
}

/** SQLite som lager för projektindexet. */
export class SqliteIndexStore implements IndexStore {
  private readonly db: VibeForgeDatabase;

  constructor(db: VibeForgeDatabase) {
    this.db = db;
  }

  all(): IndexedFile[] {
    const rows = this.db.db.prepare('SELECT * FROM index_files').all() as Array<{
      path: string;
      hash: string;
      bytes: number;
      lines: number;
      language: string;
      symbols: string;
      imports: string;
      vector: string;
      updated_at: number;
    }>;

    return rows.map((row) => ({
      path: row.path,
      hash: row.hash,
      bytes: row.bytes,
      lines: row.lines,
      language: row.language,
      symbols: safeParse<string[]>(row.symbols, []),
      imports: safeParse<string[]>(row.imports, []),
      vector: safeParse<number[]>(row.vector, []),
      updatedAt: row.updated_at,
    }));
  }

  putMany(files: IndexedFile[]): void {
    const statement = this.db.db.prepare(
      `INSERT INTO index_files (path, hash, bytes, lines, language, symbols, imports, vector, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(path) DO UPDATE SET hash = excluded.hash, bytes = excluded.bytes, lines = excluded.lines,
         language = excluded.language, symbols = excluded.symbols, imports = excluded.imports,
         vector = excluded.vector, updated_at = excluded.updated_at`,
    );
    this.db.transaction(() => {
      for (const file of files) {
        statement.run(
          file.path,
          file.hash,
          file.bytes,
          file.lines,
          file.language,
          JSON.stringify(file.symbols),
          JSON.stringify(file.imports),
          // Vektorn avrundas till tre decimaler: mindre data, ingen mätbar skillnad i ranking.
          JSON.stringify(file.vector.map((value) => Math.round(value * 1000) / 1000)),
          file.updatedAt,
        );
      }
    });
  }

  remove(paths: string[]): void {
    const statement = this.db.db.prepare('DELETE FROM index_files WHERE path = ?');
    this.db.transaction(() => {
      for (const path of paths) statement.run(path);
    });
  }

  clear(): void {
    this.db.db.exec('DELETE FROM index_files');
  }
}

export class TaskRepository {
  private readonly db: VibeForgeDatabase;

  constructor(db: VibeForgeDatabase) {
    this.db = db;
  }

  create(sessionId: string, title: string): TaskItem {
    const task: TaskItem = {
      id: createId('task'),
      sessionId,
      title,
      status: 'todo',
      createdAt: Date.now(),
    };
    this.db.db
      .prepare(
        'INSERT INTO tasks (id, session_id, title, status, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(task.id, task.sessionId, task.title, task.status, task.createdAt);
    return task;
  }

  list(sessionId: string): TaskItem[] {
    const rows = this.db.db
      .prepare('SELECT * FROM tasks WHERE session_id = ? ORDER BY created_at ASC')
      .all(sessionId) as Array<{
      id: string;
      session_id: string;
      title: string;
      status: string;
      created_at: number;
    }>;
    return rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      title: row.title,
      status: row.status as TaskItem['status'],
      createdAt: row.created_at,
    }));
  }

  setStatus(id: string, status: TaskItem['status']): void {
    this.db.db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run(status, id);
  }

  remove(id: string): void {
    this.db.db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  }
}

export class ApprovalLogRepository {
  private readonly db: VibeForgeDatabase;

  constructor(db: VibeForgeDatabase) {
    this.db = db;
  }

  record(input: {
    id: string;
    sessionId: string;
    kind: string;
    target?: string;
    decision: 'approved' | 'rejected';
  }): void {
    this.db.db
      .prepare(
        'INSERT INTO approvals_log (id, session_id, kind, target, decision, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(input.id, input.sessionId, input.kind, input.target ?? null, input.decision, Date.now());
  }

  list(
    sessionId: string,
    limit = 100,
  ): Array<{ kind: string; target: string | null; decision: string; createdAt: number }> {
    const rows = this.db.db
      .prepare(
        'SELECT kind, target, decision, created_at FROM approvals_log WHERE session_id = ? ORDER BY created_at DESC LIMIT ?',
      )
      .all(sessionId, limit) as Array<{
      kind: string;
      target: string | null;
      decision: string;
      created_at: number;
    }>;
    return rows.map((row) => ({
      kind: row.kind,
      target: row.target,
      decision: row.decision,
      createdAt: row.created_at,
    }));
  }
}

function safeParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export interface Repositories {
  projects: ProjectRepository;
  sessions: SessionRepository;
  messages: MessageRepository;
  settings: SettingsRepository;
  index: SqliteIndexStore;
  tasks: TaskRepository;
  approvals: ApprovalLogRepository;
}

export function createRepositories(db: VibeForgeDatabase): Repositories {
  return {
    projects: new ProjectRepository(db),
    sessions: new SessionRepository(db),
    messages: new MessageRepository(db),
    settings: new SettingsRepository(db),
    index: new SqliteIndexStore(db),
    tasks: new TaskRepository(db),
    approvals: new ApprovalLogRepository(db),
  };
}
