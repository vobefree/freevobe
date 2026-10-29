import path from 'node:path';
import type {
  AppSettings,
  ChatMessage,
  Contribution,
  GivesBackConfig,
  GivesBackSummary,
  PermissionMode,
  Plan,
  PlanStatus,
  Project,
  Session,
  TaskItem,
  VerificationReport,
} from '@freevobe/protocol';
import {
  DEFAULT_AUTO_APPROVE,
  DEFAULT_CONTEXT_BUDGET_CHARS,
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_MODEL,
  DEFAULT_OLLAMA_URL,
  GIVES_BACK_INTERVAL_PROMPTS,
  MAX_CONTRIBUTION_NOTE_CHARS,
  findCause,
  isValidAmountSek,
  summarizeContributions,
} from '@freevobe/protocol';
import { createId } from '../util/ids.js';
import type { IndexedFile, IndexStore } from '../context/indexer.js';
import type { FreevobeDatabase } from './db.js';

export const DEFAULT_SETTINGS: AppSettings = {
  ollamaBaseUrl: DEFAULT_OLLAMA_URL,
  defaultModel: DEFAULT_MODEL,
  permissionMode: 'ask',
  autoApprove: { ...DEFAULT_AUTO_APPROVE },
  theme: 'dark',
  contextBudgetChars: DEFAULT_CONTEXT_BUDGET_CHARS,
  maxIterations: DEFAULT_MAX_ITERATIONS,
  telemetry: false,
  allowCloudServices: false,
  givesBack: {
    enabled: false,
    everyNPrompts: GIVES_BACK_INTERVAL_PROMPTS,
    causeIds: [],
  },
  browserAutomationEnabled: false,
  verifyAfterRun: true,
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
  private readonly db: FreevobeDatabase;

  constructor(db: FreevobeDatabase) {
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
  private readonly db: FreevobeDatabase;

  constructor(db: FreevobeDatabase) {
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
  private readonly db: FreevobeDatabase;

  constructor(db: FreevobeDatabase) {
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

/**
 * Läser Gives Back-inställningen och migrerar den gamla annonsplatsen.
 *
 * Den som hade annonsplatsen påslagen behåller en plats i chatten, men den är nu välgörenhet.
 * Den som hade den avstängd får den avstängd – ett samtycke till reklam är inte ett samtycke
 * till något annat, så ett gammalt `false` vinner alltid.
 */
function resolveGivesBack(stored: Record<string, unknown>): GivesBackConfig {
  const clampInterval = (value: unknown): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return GIVES_BACK_INTERVAL_PROMPTS;
    return Math.min(200, Math.max(1, Math.round(parsed)));
  };

  const current = stored.givesBack;
  if (typeof current === 'object' && current !== null) {
    const candidate = current as Partial<GivesBackConfig>;
    return {
      enabled: candidate.enabled === true,
      everyNPrompts: clampInterval(candidate.everyNPrompts),
      causeIds: Array.isArray(candidate.causeIds)
        ? candidate.causeIds.filter(
            (id): id is string => typeof id === 'string' && findCause(id) !== undefined,
          )
        : [],
      ...(typeof candidate.consentedAt === 'number' ? { consentedAt: candidate.consentedAt } : {}),
    };
  }

  const legacy = stored.ads;
  if (typeof legacy === 'object' && legacy !== null) {
    const ads = legacy as { enabled?: unknown; everyNPrompts?: unknown; consentedAt?: unknown };
    const enabled = ads.enabled === true;
    return {
      enabled,
      everyNPrompts: clampInterval(ads.everyNPrompts),
      causeIds: [],
      ...(enabled && typeof ads.consentedAt === 'number' ? { consentedAt: ads.consentedAt } : {}),
    };
  }

  return { ...DEFAULT_SETTINGS.givesBack, causeIds: [] };
}

export class SettingsRepository {
  private readonly db: FreevobeDatabase;

  constructor(db: FreevobeDatabase) {
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
      givesBack: resolveGivesBack(stored),
      // Kategorier som sparades innan auto-godkännande fanns (eller av en äldre version) får
      // defaultvärdet i stället för att bli odefinierade.
      autoApprove: {
        ...DEFAULT_SETTINGS.autoApprove,
        ...(typeof stored.autoApprove === 'object' && stored.autoApprove !== null
          ? (stored.autoApprove as Partial<AppSettings['autoApprove']>)
          : {}),
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
  private readonly db: FreevobeDatabase;

  constructor(db: FreevobeDatabase) {
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
  private readonly db: FreevobeDatabase;

  constructor(db: FreevobeDatabase) {
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
  private readonly db: FreevobeDatabase;

  constructor(db: FreevobeDatabase) {
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

interface PlanRow {
  id: string;
  session_id: string;
  run_id: string;
  title: string;
  summary: string;
  steps: string;
  files: string;
  status: string;
  created_at: number;
  decided_at: number | null;
}

/**
 * Plan/Act: planerna sparas per session. En session har som mest en godkänd plan åt gången –
 * när en ny godkänns markeras den gamla som ersatt.
 */
export class PlanRepository {
  private readonly db: FreevobeDatabase;

  constructor(db: FreevobeDatabase) {
    this.db = db;
  }

  create(plan: Plan): Plan {
    this.db.db
      .prepare(
        'INSERT INTO plans (id, session_id, run_id, title, summary, steps, files, status, created_at, decided_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        plan.id,
        plan.sessionId,
        plan.runId,
        plan.title,
        plan.summary,
        JSON.stringify(plan.steps),
        JSON.stringify(plan.files),
        plan.status,
        plan.createdAt,
        plan.decidedAt ?? null,
      );
    return plan;
  }

  get(id: string): Plan | null {
    const row = this.db.db.prepare('SELECT * FROM plans WHERE id = ?').get(id) as
      PlanRow | undefined;
    return row ? mapPlan(row) : null;
  }

  listBySession(sessionId: string, limit = 20): Plan[] {
    const rows = this.db.db
      .prepare('SELECT * FROM plans WHERE session_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(sessionId, limit) as unknown as PlanRow[];
    return rows.map(mapPlan);
  }

  /** Den plan som gäller som kontrakt just nu, om någon. */
  active(sessionId: string): Plan | null {
    const row = this.db.db
      .prepare(
        "SELECT * FROM plans WHERE session_id = ? AND status = 'approved' ORDER BY decided_at DESC, created_at DESC LIMIT 1",
      )
      .get(sessionId) as PlanRow | undefined;
    return row ? mapPlan(row) : null;
  }

  /**
   * Sätter planens status. En godkänd plan ersätter tidigare godkända planer i sessionen, så att
   * det alltid finns exakt ett gällande kontrakt.
   */
  decide(id: string, status: Extract<PlanStatus, 'approved' | 'rejected'>): Plan | null {
    const plan = this.get(id);
    if (!plan) return null;

    const now = Date.now();
    this.db.transaction(() => {
      if (status === 'approved') {
        this.db.db
          .prepare(
            "UPDATE plans SET status = 'superseded', decided_at = ? WHERE session_id = ? AND status = 'approved' AND id != ?",
          )
          .run(now, plan.sessionId, id);
      }
      this.db.db
        .prepare('UPDATE plans SET status = ?, decided_at = ? WHERE id = ?')
        .run(status, now, id);
    });

    return this.get(id);
  }
}

function mapPlan(row: PlanRow): Plan {
  return {
    id: row.id,
    sessionId: row.session_id,
    runId: row.run_id,
    title: row.title,
    summary: row.summary,
    steps: safeParse<Plan['steps']>(row.steps, []),
    files: safeParse<string[]>(row.files, []),
    status: row.status as PlanStatus,
    createdAt: row.created_at,
    ...(row.decided_at ? { decidedAt: row.decided_at } : {}),
  };
}

interface VerificationRow {
  id: string;
  project_id: string;
  session_id: string | null;
  run_id: string | null;
  trigger: string;
  status: string;
  summary: string;
  checks: string;
  started_at: number;
  finished_at: number;
  duration_ms: number;
}

/** Verifieringsrapporter per projekt. Den senaste är den panelen visar. */
export class VerificationRepository {
  private readonly db: FreevobeDatabase;

  constructor(db: FreevobeDatabase) {
    this.db = db;
  }

  create(report: VerificationReport): VerificationReport {
    this.db.db
      .prepare(
        'INSERT INTO verifications (id, project_id, session_id, run_id, trigger, status, summary, checks, started_at, finished_at, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        report.id,
        report.projectId,
        report.sessionId ?? null,
        report.runId ?? null,
        report.trigger,
        report.status,
        report.summary,
        JSON.stringify(report.checks),
        report.startedAt,
        report.finishedAt,
        report.durationMs,
      );
    return report;
  }

  get(id: string): VerificationReport | null {
    const row = this.db.db.prepare('SELECT * FROM verifications WHERE id = ?').get(id) as
      VerificationRow | undefined;
    return row ? mapVerification(row) : null;
  }

  list(projectId: string, limit = 20): VerificationReport[] {
    const rows = this.db.db
      .prepare('SELECT * FROM verifications WHERE project_id = ? ORDER BY started_at DESC LIMIT ?')
      .all(projectId, limit) as unknown as VerificationRow[];
    return rows.map(mapVerification);
  }

  latest(projectId: string): VerificationReport | null {
    const row = this.db.db
      .prepare('SELECT * FROM verifications WHERE project_id = ? ORDER BY started_at DESC LIMIT 1')
      .get(projectId) as VerificationRow | undefined;
    return row ? mapVerification(row) : null;
  }
}

function mapVerification(row: VerificationRow): VerificationReport {
  return {
    id: row.id,
    projectId: row.project_id,
    ...(row.session_id ? { sessionId: row.session_id } : {}),
    ...(row.run_id ? { runId: row.run_id } : {}),
    trigger: row.trigger as VerificationReport['trigger'],
    status: row.status as VerificationReport['status'],
    summary: row.summary,
    checks: safeParse<VerificationReport['checks']>(row.checks, []),
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationMs: row.duration_ms,
  };
}

interface GivesBackRow {
  id: string;
  cause_id: string;
  amount_sek: number;
  note: string | null;
  created_at: number;
}

/**
 * Användarens egen påverkanslogg.
 *
 * Tabellen innehåller bara det användaren själv skrivit in: ändamål, belopp och en anteckning.
 * Det finns ingen koppling till en betalning, inget kontonummer och inget som skickas vidare.
 */
export class GivesBackRepository {
  private readonly db: FreevobeDatabase;

  constructor(db: FreevobeDatabase) {
    this.db = db;
  }

  list(limit = 200): Contribution[] {
    const rows = this.db.db
      .prepare('SELECT * FROM gives_back_entries ORDER BY created_at DESC LIMIT ?')
      .all(limit) as unknown as GivesBackRow[];
    return rows.map(mapContribution);
  }

  get(id: string): Contribution | null {
    const row = this.db.db.prepare('SELECT * FROM gives_back_entries WHERE id = ?').get(id) as
      GivesBackRow | undefined;
    return row ? mapContribution(row) : null;
  }

  add(input: {
    causeId: string;
    amountSek?: number;
    note?: string;
    createdAt?: number;
  }): Contribution {
    if (!findCause(input.causeId)) {
      throw new Error(`Ändamålet "${input.causeId}" finns inte i katalogen.`);
    }
    const amountSek = input.amountSek ?? 0;
    if (!isValidAmountSek(amountSek)) {
      throw new Error('Beloppet måste vara ett heltal i kronor, mellan 0 och 1 000 000.');
    }
    const note = input.note?.trim();
    if (note && note.length > MAX_CONTRIBUTION_NOTE_CHARS) {
      throw new Error(`Anteckningen får vara högst ${MAX_CONTRIBUTION_NOTE_CHARS} tecken.`);
    }

    const entry: Contribution = {
      id: createId('give'),
      causeId: input.causeId,
      amountSek,
      ...(note ? { note } : {}),
      createdAt: input.createdAt ?? Date.now(),
      source: 'self-reported',
    };
    this.db.db
      .prepare(
        'INSERT INTO gives_back_entries (id, cause_id, amount_sek, note, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(entry.id, entry.causeId, entry.amountSek, entry.note ?? null, entry.createdAt);
    return entry;
  }

  remove(id: string): boolean {
    const result = this.db.db.prepare('DELETE FROM gives_back_entries WHERE id = ?').run(id);
    return Number(result.changes) > 0;
  }

  /** Sammanställningen räknas i SQL så att panelen inte behöver läsa hela historiken. */
  summary(): GivesBackSummary {
    const row = this.db.db
      .prepare(
        'SELECT COUNT(*) AS count, COALESCE(SUM(amount_sek), 0) AS total, COUNT(DISTINCT cause_id) AS causes, MAX(created_at) AS last FROM gives_back_entries',
      )
      .get() as { count: number; total: number; causes: number; last: number | null };
    return {
      count: row.count,
      totalSek: row.total,
      causeCount: row.causes,
      ...(row.last === null ? {} : { lastAt: row.last }),
    };
  }

  /** Används av testerna och av sammanställningen i UI:t när listan redan är hämtad. */
  summaryOf(entries: readonly Contribution[]): GivesBackSummary {
    return summarizeContributions(entries);
  }
}

function mapContribution(row: GivesBackRow): Contribution {
  return {
    id: row.id,
    causeId: row.cause_id,
    amountSek: row.amount_sek,
    ...(row.note ? { note: row.note } : {}),
    createdAt: row.created_at,
    source: 'self-reported',
  };
}

/** Ett projekts val för en connector. Token ligger inte här – bara läget och en felorsak. */
export interface ConnectorProjectState {
  connectorId: string;
  enabled: boolean;
  accountLabel?: string;
  lastError?: string;
  updatedAt: number;
}

interface ConnectorRow {
  project_id: string;
  connector_id: string;
  enabled: number;
  account_label: string | null;
  last_error: string | null;
  updated_at: number;
}

export class ConnectorRepository {
  private readonly db: FreevobeDatabase;

  constructor(db: FreevobeDatabase) {
    this.db = db;
  }

  list(projectId: string): ConnectorProjectState[] {
    const rows = this.db.db
      .prepare('SELECT * FROM connectors WHERE project_id = ? ORDER BY connector_id')
      .all(projectId) as unknown as ConnectorRow[];
    return rows.map(mapConnectorRow);
  }

  get(projectId: string, connectorId: string): ConnectorProjectState | null {
    const row = this.db.db
      .prepare('SELECT * FROM connectors WHERE project_id = ? AND connector_id = ?')
      .get(projectId, connectorId) as ConnectorRow | undefined;
    return row ? mapConnectorRow(row) : null;
  }

  upsert(
    projectId: string,
    input: {
      connectorId: string;
      enabled?: boolean;
      accountLabel?: string | null;
      lastError?: string | null;
    },
  ): ConnectorProjectState {
    const previous = this.get(projectId, input.connectorId);
    const enabled = input.enabled ?? previous?.enabled ?? true;
    const accountLabel =
      input.accountLabel === undefined ? (previous?.accountLabel ?? null) : input.accountLabel;
    const lastError =
      input.lastError === undefined ? (previous?.lastError ?? null) : input.lastError;
    this.db.db
      .prepare(
        `INSERT INTO connectors (project_id, connector_id, enabled, account_label, last_error, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(project_id, connector_id) DO UPDATE SET
           enabled = excluded.enabled,
           account_label = excluded.account_label,
           last_error = excluded.last_error,
           updated_at = excluded.updated_at`,
      )
      .run(projectId, input.connectorId, enabled ? 1 : 0, accountLabel, lastError, Date.now());
    return this.get(projectId, input.connectorId) as ConnectorProjectState;
  }

  remove(projectId: string, connectorId: string): boolean {
    const result = this.db.db
      .prepare('DELETE FROM connectors WHERE project_id = ? AND connector_id = ?')
      .run(projectId, connectorId);
    return Number(result.changes) > 0;
  }
}

function mapConnectorRow(row: ConnectorRow): ConnectorProjectState {
  return {
    connectorId: row.connector_id,
    enabled: row.enabled === 1,
    ...(row.account_label ? { accountLabel: row.account_label } : {}),
    ...(row.last_error ? { lastError: row.last_error } : {}),
    updatedAt: row.updated_at,
  };
}

export interface Repositories {
  projects: ProjectRepository;
  sessions: SessionRepository;
  messages: MessageRepository;
  settings: SettingsRepository;
  index: SqliteIndexStore;
  tasks: TaskRepository;
  approvals: ApprovalLogRepository;
  plans: PlanRepository;
  verifications: VerificationRepository;
  givesBack: GivesBackRepository;
  connectors: ConnectorRepository;
}

export function createRepositories(db: FreevobeDatabase): Repositories {
  return {
    projects: new ProjectRepository(db),
    sessions: new SessionRepository(db),
    messages: new MessageRepository(db),
    settings: new SettingsRepository(db),
    index: new SqliteIndexStore(db),
    tasks: new TaskRepository(db),
    approvals: new ApprovalLogRepository(db),
    plans: new PlanRepository(db),
    verifications: new VerificationRepository(db),
    givesBack: new GivesBackRepository(db),
    connectors: new ConnectorRepository(db),
  };
}
