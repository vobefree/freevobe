/**
 * Verification Engine: efter varje ändring kan Freevobe köra projektets egna kontroller –
 * typkontroll, lint, tester och bygge – och visa en rapport i stället för att agenten ska
 * påstå att allt fungerar. Typerna delas av agent-core, agent-server och gränssnittet.
 */

export type VerificationKind = 'typecheck' | 'lint' | 'test' | 'build' | 'custom';

export type VerificationCheckStatus = 'passed' | 'failed' | 'timeout' | 'skipped';

export type VerificationReportStatus = 'passed' | 'failed' | 'skipped';

/** Ett kommando som verifieringen kan köra. */
export interface VerificationCommand {
  /** Stabilt id, t.ex. `typecheck`. */
  id: string;
  label: string;
  kind: VerificationKind;
  command: string;
  /** Var kommandot hittades: `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`. */
  source: string;
}

export interface VerificationCheckResult extends VerificationCommand {
  status: VerificationCheckStatus;
  exitCode: number | null;
  durationMs: number;
  /** Slutet av kommandots utdata. Tom sträng när steget hoppades över. */
  output: string;
  /** Antal godkända tester, när kommandot är en testkörning. */
  passed?: number;
  /** Antal underkända tester, när kommandot är en testkörning. */
  failed?: number;
}

export interface VerificationReport {
  id: string;
  projectId: string;
  sessionId?: string;
  runId?: string;
  /** `run` = automatiskt efter en agentkörning, `manual` = användaren körde den, `tool` = agenten. */
  trigger: 'run' | 'manual' | 'tool';
  status: VerificationReportStatus;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  checks: VerificationCheckResult[];
  /** Kort svensk sammanfattning som visas i panelen och i chatten. */
  summary: string;
}

/**
 * Stegen som körs automatiskt efter en agentkörning som ändrat filer. Bygget är för tungt för
 * att köras varje gång och hoppas därför över tills användaren eller agenten ber om det.
 */
export const AUTO_VERIFICATION_KINDS = ['typecheck', 'lint', 'test'] as const;

/** Sant när rapporten innehåller minst ett kört steg. */
export function hasVerificationChecks(report: {
  checks: VerificationCheckResult[];
}): boolean {
  return report.checks.some((check) => check.status !== 'skipped');
}
