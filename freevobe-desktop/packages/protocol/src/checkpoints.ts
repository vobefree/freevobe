import type { FileChangeKind, FileDiff } from './tools.js';

/**
 * Checkpoints ägs av appen, inte av Git: de sparar innehållet i de filer en körning är på väg att
 * ändra, så att användaren kan backa till läget före ändringen utan att röra historiken. En
 * checkpoint kan därefter committas till Git om användaren vill.
 */
export type CheckpointStatus = 'open' | 'restored' | 'committed' | 'discarded';

/** Resultatet av den senaste testkörningen i körningen som skapade checkpointen. */
export type CheckpointTestStatus = 'unknown' | 'passed' | 'failed';

export interface CheckpointFile {
  path: string;
  /** Vad agenten gjorde med filen när checkpointen skapades. */
  changeKind: FileChangeKind;
  additions: number;
  deletions: number;
  /** Sant när innehållet att återställa finns i checkpointens snapshot. */
  snapshot: boolean;
}

export interface Checkpoint {
  id: string;
  projectId: string;
  sessionId?: string;
  runId?: string;
  /** Kort beskrivning, t.ex. promptens första rad. */
  label: string;
  /** Varför checkpointen skapades: en agentkörning eller användarens eget val. */
  reason: 'agent-run' | 'manual';
  status: CheckpointStatus;
  testStatus: CheckpointTestStatus;
  testSummary?: string;
  files: CheckpointFile[];
  createdAt: number;
  restoredAt?: number;
  committedHash?: string;
}

export interface CheckpointRestoreReport {
  checkpointId: string;
  restored: string[];
  deleted: string[];
  skipped: { path: string; reason: 'changed-since' | 'missing-snapshot' | 'outside-project' }[];
}

export interface CheckpointDiff {
  checkpointId: string;
  /** Skillnaden mellan checkpointens innehåll och filerna på disk just nu. */
  files: FileDiff[];
  /** Samma skillnad som unified diff-text, redo att kopiera eller spara. */
  text: string;
}

/** Fler checkpoints än så här per projekt prunas bort, äldst först. */
export const CHECKPOINT_LIMIT = 50;
