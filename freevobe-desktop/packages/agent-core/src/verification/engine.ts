import type {
  VerificationCheckResult,
  VerificationCommand,
  VerificationReport,
  VerificationReportStatus,
} from '@freevobe/protocol';
import { hasVerificationChecks } from '@freevobe/protocol';
import { createId } from '../util/ids.js';
import { parseTestCounts } from '../tools/tests.js';

/** Standardtidsgräns per steg. Typkontroll på stora projekt kan behöva mer. */
export const DEFAULT_VERIFICATION_TIMEOUT_MS = 180_000;

/** Hur mycket av varje kommandos utdata som sparas i rapporten. */
export const VERIFICATION_OUTPUT_CHARS = 8_000;

export interface VerificationCommandResult {
  output: string;
  exitCode: number | null;
  timedOut: boolean;
}

export type VerificationCommandRunner = (
  command: string,
  options: { cwd: string; timeoutMs: number },
) => Promise<VerificationCommandResult>;

export interface RunVerificationInput {
  root: string;
  projectId: string;
  commands: VerificationCommand[];
  /** Kör ett kommando. Injiceras så att motorn kan testas utan att starta processer. */
  run: VerificationCommandRunner;
  timeoutMs?: number;
  signal?: AbortSignal;
  trigger?: VerificationReport['trigger'];
  sessionId?: string;
  runId?: string;
  onCheck?: (check: VerificationCheckResult) => void;
  now?: () => number;
  createReportId?: () => string;
}

function truncateTail(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `…${text.slice(-maxChars)}`;
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1_000) return `${durationMs} ms`;
  return `${(durationMs / 1_000).toFixed(1).replace('.', ',')} s`;
}

/** Svensk sammanfattning: vad som kördes, vad som gick fel och hur lång tid det tog. */
export function summarizeReport(checks: VerificationCheckResult[], durationMs: number): string {
  const ran = checks.filter((check) => check.status !== 'skipped');
  if (ran.length === 0) {
    return 'Inga verifieringssteg hittades i projektet.';
  }

  const problems = ran.filter((check) => check.status !== 'passed');
  const duration = formatDuration(durationMs);
  if (problems.length === 0) {
    return `${ran.length} av ${ran.length} steg gröna (${duration}).`;
  }
  const names = problems.map((check) => check.label).join(', ');
  return `${problems.length} av ${ran.length} steg röda: ${names} (${duration}).`;
}

function statusFor(result: VerificationCommandResult): VerificationCheckResult['status'] {
  if (result.timedOut) return 'timeout';
  return (result.exitCode ?? 1) === 0 ? 'passed' : 'failed';
}

/**
 * Kör verifieringsstegen i ordning och stannar inte vid första felet – en rapport med alla
 * problem är mer användbar än bara det första. Vid avbrott markeras resten som överhoppade.
 */
export async function runVerification(input: RunVerificationInput): Promise<VerificationReport> {
  const now = input.now ?? (() => Date.now());
  const timeoutMs = input.timeoutMs ?? DEFAULT_VERIFICATION_TIMEOUT_MS;
  const startedAt = now();
  const checks: VerificationCheckResult[] = [];
  let aborted = false;

  for (const command of input.commands) {
    if (aborted || input.signal?.aborted) {
      aborted = true;
      const skipped: VerificationCheckResult = {
        ...command,
        status: 'skipped',
        exitCode: null,
        durationMs: 0,
        output: '',
      };
      checks.push(skipped);
      input.onCheck?.(skipped);
      continue;
    }

    const checkStarted = now();
    let result: VerificationCommandResult;
    try {
      result = await input.run(command.command, { cwd: input.root, timeoutMs });
    } catch (error) {
      result = {
        output: error instanceof Error ? error.message : String(error),
        exitCode: 1,
        timedOut: false,
      };
    }
    const durationMs = Math.max(0, now() - checkStarted);
    const status = statusFor(result);
    const counts = command.kind === 'test' ? parseTestCounts(result.output) : null;

    const check: VerificationCheckResult = {
      ...command,
      status,
      exitCode: result.exitCode,
      durationMs,
      output: status === 'skipped' ? '' : truncateTail(result.output, VERIFICATION_OUTPUT_CHARS),
      ...(counts ? { passed: counts.passed, failed: counts.failed } : {}),
    };
    checks.push(check);
    input.onCheck?.(check);
  }

  const finishedAt = now();
  const durationMs = Math.max(0, finishedAt - startedAt);

  let status: VerificationReportStatus;
  if (!hasVerificationChecks({ checks })) {
    status = 'skipped';
  } else if (checks.some((check) => check.status === 'failed' || check.status === 'timeout')) {
    status = 'failed';
  } else {
    status = 'passed';
  }

  const report: VerificationReport = {
    id: input.createReportId?.() ?? createId('verify'),
    projectId: input.projectId,
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    ...(input.runId ? { runId: input.runId } : {}),
    trigger: input.trigger ?? 'manual',
    status,
    startedAt,
    finishedAt,
    durationMs,
    checks,
    summary: status === 'skipped' ? summarizeReport([], 0) : summarizeReport(checks, durationMs),
  };

  return report;
}
