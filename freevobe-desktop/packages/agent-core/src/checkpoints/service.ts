import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  Checkpoint,
  CheckpointDiff,
  CheckpointFile,
  CheckpointRestoreReport,
  CheckpointTestStatus,
} from '@freevobe/protocol';
import { CHECKPOINT_LIMIT } from '@freevobe/protocol';
import { createFileDiff, formatUnifiedDiff } from '../diff/engine.js';
import type { FreevobeDatabase } from '../store/db.js';
import { createId, hashSha256 } from '../util/ids.js';
import { normalizeSlashes } from '../util/text.js';

/** En fil som är på väg att ändras. `null` i innehåll betyder att filen inte fanns. */
export interface RecordedChange {
  path: string;
  beforeContent: string | null;
  afterContent: string | null;
  additions: number;
  deletions: number;
  changeKind: CheckpointFile['changeKind'];
}

export interface CheckpointDraft {
  /** Null tills den första filen har spelats in – en körning utan filändringar ger ingen checkpoint. */
  readonly id: string | null;
  readonly checkpoint: Checkpoint | null;
  record(change: RecordedChange): Promise<void>;
  setTests(result: {
    status: Exclude<CheckpointTestStatus, 'unknown'>;
    summary?: string;
  }): Promise<void>;
  finish(): Promise<Checkpoint | null>;
}

export interface BeginCheckpointInput {
  projectId: string;
  sessionId?: string;
  runId?: string;
  label: string;
  reason: Checkpoint['reason'];
  onChange?: (checkpoint: Checkpoint) => void;
}

export interface CheckpointServiceOptions {
  db: FreevobeDatabase;
  /** Projektrot. Alla sökvägar i en checkpoint är relativa till den. */
  root: string;
  /** Freevobe-home; snapshotfilerna hamnar under `<home>/checkpoints/<projekt>/`. */
  home: string;
}

interface SnapshotEntry {
  path: string;
  /** Innehållet att återställa till, eller null när filen ska tas bort. */
  content: string | null;
  /** Hash av innehållet efter ändringen, för att upptäcka nya ändringar före en återställning. */
  afterHash: string | null;
  changeKind: CheckpointFile['changeKind'];
  additions: number;
  deletions: number;
}

interface Snapshot {
  version: 1;
  files: SnapshotEntry[];
}

interface CheckpointRow {
  id: string;
  project_id: string;
  session_id: string | null;
  run_id: string | null;
  label: string;
  reason: string;
  status: string;
  test_status: string;
  test_summary: string | null;
  file_count: number;
  files: string;
  committed_hash: string | null;
  created_at: number;
  restored_at: number | null;
}

function mapCheckpoint(row: CheckpointRow): Checkpoint {
  return {
    id: row.id,
    projectId: row.project_id,
    ...(row.session_id ? { sessionId: row.session_id } : {}),
    ...(row.run_id ? { runId: row.run_id } : {}),
    label: row.label,
    reason: row.reason === 'manual' ? 'manual' : 'agent-run',
    status: row.status as Checkpoint['status'],
    testStatus: row.test_status as CheckpointTestStatus,
    ...(row.test_summary ? { testSummary: row.test_summary } : {}),
    files: parseFiles(row.files),
    createdAt: row.created_at,
    ...(row.restored_at ? { restoredAt: row.restored_at } : {}),
    ...(row.committed_hash ? { committedHash: row.committed_hash } : {}),
  };
}

function parseFiles(raw: string): CheckpointFile[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return [];
      const file = entry as Record<string, unknown>;
      if (typeof file.path !== 'string') return [];
      const kind = file.changeKind;
      return [
        {
          path: file.path,
          changeKind: kind === 'create' || kind === 'delete' || kind === 'update' ? kind : 'update',
          additions: typeof file.additions === 'number' ? file.additions : 0,
          deletions: typeof file.deletions === 'number' ? file.deletions : 0,
          snapshot: file.snapshot !== false,
        },
      ];
    });
  } catch {
    return [];
  }
}

async function readOptional(file: string): Promise<string | null> {
  try {
    return await fs.readFile(file, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Checkpoints: en lokal papperskorg för agentens ändringar. Innehållet i filerna som är på väg att
 * ändras sparas till disk innan ändringen sker, och kan skrivas tillbaka när som helst. Det är
 * separat från Git – en checkpoint kan committas, men ingen commit skapas av sig själv.
 */
export class CheckpointService {
  private readonly db: FreevobeDatabase;
  private readonly root: string;
  private readonly directory: string;

  constructor(options: CheckpointServiceOptions) {
    this.db = options.db;
    this.root = path.resolve(options.root);
    this.directory = path.join(options.home, 'checkpoints');
  }

  // ---------------------------------------------------------------- läsning

  list(projectId: string): Checkpoint[] {
    const rows = this.db.db
      .prepare('SELECT * FROM checkpoints WHERE project_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(projectId, CHECKPOINT_LIMIT) as unknown as CheckpointRow[];
    return rows.map(mapCheckpoint);
  }

  get(id: string): Checkpoint | null {
    const row = this.db.db.prepare('SELECT * FROM checkpoints WHERE id = ?').get(id) as
      CheckpointRow | undefined;
    return row ? mapCheckpoint(row) : null;
  }

  /**
   * Vilket projekt checkpointen hör till. Databasen är delad mellan alla öppna projekt, så en rad
   * går att slå upp varifrån som helst – men filerna får bara läsas och skrivas i det projekt som
   * äger checkpointen.
   */
  projectIdOf(id: string): string | null {
    const row = this.db.db.prepare('SELECT project_id FROM checkpoints WHERE id = ?').get(id) as
      { project_id: string } | undefined;
    return row?.project_id ?? null;
  }

  /** Skillnaden mellan checkpointens innehåll och filerna som ligger på disk nu. */
  async diff(id: string): Promise<CheckpointDiff> {
    const checkpoint = this.get(id);
    if (!checkpoint) throw new Error(`Checkpointen ${id} finns inte.`);
    const snapshot = await this.readSnapshot(checkpoint.projectId, id);

    const files = [];
    const texts: string[] = [];
    for (const entry of snapshot.files) {
      const absolute = this.resolve(entry.path);
      if (!absolute) continue;
      const current = await readOptional(absolute);
      const before = entry.content ?? '';
      const after = current ?? '';
      if (before === after) continue;

      const diff = createFileDiff({
        path: entry.path,
        absolutePath: absolute,
        kind: entry.content === null ? 'create' : current === null ? 'delete' : 'update',
        oldContent: before,
        newContent: after,
      });
      files.push(diff);
      texts.push(formatUnifiedDiff(diff));
    }

    return { checkpointId: id, files, text: texts.join('\n\n') };
  }

  // ---------------------------------------------------------------- skapa

  /**
   * Startar en checkpoint som fylls på efter hand. Filerna sparas allteftersom de ändras, så att en
   * krasch eller ett avbrott inte förstör möjligheten att backa.
   */
  begin(input: BeginCheckpointInput): CheckpointDraft {
    const entries = new Map<string, SnapshotEntry>();
    let checkpoint: Checkpoint | null = null;
    let test: { status: CheckpointTestStatus; summary?: string } = { status: 'unknown' };

    const persist = async (): Promise<Checkpoint> => {
      const saved = await this.persist({
        id: checkpoint?.id ?? createId('cp'),
        projectId: input.projectId,
        ...(input.sessionId ? { sessionId: input.sessionId } : {}),
        ...(input.runId ? { runId: input.runId } : {}),
        label: input.label,
        reason: input.reason,
        createdAt: checkpoint?.createdAt ?? Date.now(),
        testStatus: test.status,
        ...(test.summary ? { testSummary: test.summary } : {}),
        entries,
      });
      checkpoint = saved;
      input.onChange?.(saved);
      return saved;
    };

    return {
      get id() {
        return checkpoint?.id ?? null;
      },
      get checkpoint() {
        return checkpoint;
      },

      async record(change) {
        const relative = normalizeSlashes(change.path);
        const existing = entries.get(relative);
        if (existing) {
          // Innehållet från den första ändringen behålls – det är dit vi vill tillbaka – men
          // hashen följer den senaste skrivningen, så konfliktkontrollen gäller filens nuvarande läge.
          existing.changeKind = change.changeKind;
          existing.additions += change.additions;
          existing.deletions += change.deletions;
          existing.afterHash =
            change.afterContent === null ? null : hashSha256(change.afterContent);
        } else {
          entries.set(relative, {
            path: relative,
            content: change.beforeContent,
            afterHash: change.afterContent === null ? null : hashSha256(change.afterContent),
            changeKind: change.changeKind,
            additions: change.additions,
            deletions: change.deletions,
          });
        }
        await persist();
      },

      async setTests(result) {
        test = result;
        if (checkpoint) await persist();
      },

      async finish() {
        if (entries.size === 0) return null;
        return persist();
      },
    };
  }

  /** En checkpoint som användaren själv skapar: nuvarande innehåll i de filer som ändrats. */
  async createManual(input: {
    projectId: string;
    sessionId?: string;
    label: string;
    files: RecordedChange[];
  }): Promise<Checkpoint> {
    const entries = new Map<string, SnapshotEntry>();
    for (const file of input.files) {
      const relative = normalizeSlashes(file.path);
      if (entries.has(relative)) continue;
      entries.set(relative, {
        path: relative,
        content: file.afterContent,
        afterHash: file.afterContent === null ? null : hashSha256(file.afterContent),
        changeKind: file.changeKind,
        additions: file.additions,
        deletions: file.deletions,
      });
    }
    if (entries.size === 0) {
      throw new Error('Inga ändrade filer att spara – checkpointen skulle bli tom.');
    }

    const checkpoint = await this.persist({
      id: createId('cp'),
      projectId: input.projectId,
      ...(input.sessionId ? { sessionId: input.sessionId } : {}),
      label: input.label,
      reason: 'manual',
      createdAt: Date.now(),
      testStatus: 'unknown',
      entries,
    });
    await this.prune(input.projectId);
    return checkpoint;
  }

  // ---------------------------------------------------------------- återställning

  /**
   * Skriver tillbaka filerna i checkpointen. Filer som ändrats efter checkpointen hoppas över
   * (såvida inte `force`), så att en återställning aldrig tyst kastar nyare arbete.
   */
  async restore(id: string, options: { force?: boolean } = {}): Promise<CheckpointRestoreReport> {
    const checkpoint = this.get(id);
    if (!checkpoint) throw new Error(`Checkpointen ${id} finns inte.`);
    const snapshot = await this.readSnapshot(checkpoint.projectId, id);
    const report: CheckpointRestoreReport = {
      checkpointId: id,
      restored: [],
      deleted: [],
      skipped: [],
    };

    for (const entry of snapshot.files) {
      const absolute = this.resolve(entry.path);
      if (!absolute) {
        report.skipped.push({ path: entry.path, reason: 'outside-project' });
        continue;
      }

      const current = await readOptional(absolute);
      const currentHash = current === null ? null : hashSha256(current);
      // Agentens checkpoints skyddar nyare arbete: har filen ändrats efter körningen krävs force.
      // En manuell checkpoint är däremot ett medvetet "tillbaka hit", så den får skriva över.
      if (checkpoint.reason === 'agent-run' && !options.force && entry.afterHash !== currentHash) {
        report.skipped.push({ path: entry.path, reason: 'changed-since' });
        continue;
      }

      try {
        if (entry.content === null) {
          if (current !== null) {
            await fs.rm(absolute, { force: true });
            report.deleted.push(entry.path);
          }
        } else {
          await fs.mkdir(path.dirname(absolute), { recursive: true });
          await fs.writeFile(absolute, entry.content, 'utf8');
          report.restored.push(entry.path);
        }
      } catch {
        report.skipped.push({ path: entry.path, reason: 'missing-snapshot' });
      }
    }

    this.db.db
      .prepare("UPDATE checkpoints SET status = 'restored', restored_at = ? WHERE id = ?")
      .run(Date.now(), id);
    return report;
  }

  async markCommitted(id: string, hash: string): Promise<void> {
    this.db.db
      .prepare("UPDATE checkpoints SET status = 'committed', committed_hash = ? WHERE id = ?")
      .run(hash, id);
  }

  /** Kastar bort checkpointen: snapshotfilen raderas, raden blir kvar som avförd i tidslinjen. */
  async discard(id: string): Promise<boolean> {
    const checkpoint = this.get(id);
    if (!checkpoint) return false;
    await fs.rm(this.snapshotFile(checkpoint.projectId, id), { force: true });
    this.db.db.prepare("UPDATE checkpoints SET status = 'discarded' WHERE id = ?").run(id);
    return true;
  }

  /** Håller tidslinjen hanterbar: äldsta checkpointen över gränsen tas bort. */
  async prune(projectId: string): Promise<void> {
    const rows = this.db.db
      .prepare(
        'SELECT id FROM checkpoints WHERE project_id = ? ORDER BY created_at DESC LIMIT -1 OFFSET ?',
      )
      .all(projectId, CHECKPOINT_LIMIT) as Array<{ id: string }>;
    for (const row of rows) {
      await fs.rm(this.snapshotFile(projectId, row.id), { force: true });
      this.db.db.prepare('DELETE FROM checkpoints WHERE id = ?').run(row.id);
    }
  }

  // ---------------------------------------------------------------- internt

  private async persist(input: {
    id: string;
    projectId: string;
    sessionId?: string;
    runId?: string;
    label: string;
    reason: Checkpoint['reason'];
    createdAt: number;
    testStatus: CheckpointTestStatus;
    testSummary?: string;
    entries: Map<string, SnapshotEntry>;
  }): Promise<Checkpoint> {
    const entries = [...input.entries.values()];
    const snapshot: Snapshot = { version: 1, files: entries };
    const file = this.snapshotFile(input.projectId, input.id);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(snapshot), 'utf8');

    const files: CheckpointFile[] = entries.map((entry) => ({
      path: entry.path,
      changeKind: entry.changeKind,
      additions: entry.additions,
      deletions: entry.deletions,
      snapshot: true,
    }));

    this.db.db
      .prepare(
        `INSERT INTO checkpoints (id, project_id, session_id, run_id, label, reason, status,
           test_status, test_summary, file_count, files, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET label = excluded.label, test_status = excluded.test_status,
           test_summary = excluded.test_summary, file_count = excluded.file_count,
           files = excluded.files`,
      )
      .run(
        input.id,
        input.projectId,
        input.sessionId ?? null,
        input.runId ?? null,
        input.label,
        input.reason,
        input.testStatus,
        input.testSummary ?? null,
        files.length,
        JSON.stringify(files),
        input.createdAt,
      );

    return this.get(input.id) as Checkpoint;
  }

  private async readSnapshot(projectId: string, id: string): Promise<Snapshot> {
    try {
      const raw = await fs.readFile(this.snapshotFile(projectId, id), 'utf8');
      const parsed = JSON.parse(raw) as Snapshot;
      return Array.isArray(parsed.files) ? parsed : { version: 1, files: [] };
    } catch {
      return { version: 1, files: [] };
    }
  }

  private snapshotFile(projectId: string, id: string): string {
    return path.join(this.directory, projectId, `${id}.json`);
  }

  /** Absolut sökväg, eller null när sökvägen skulle hamna utanför projektet. */
  private resolve(relative: string): string | null {
    const absolute = path.resolve(this.root, relative);
    const inside = path.relative(this.root, absolute);
    if (inside.startsWith('..') || path.isAbsolute(inside)) return null;
    return absolute;
  }
}
