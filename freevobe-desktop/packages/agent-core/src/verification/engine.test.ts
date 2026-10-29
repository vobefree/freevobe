import { describe, expect, it, vi } from 'vitest';
import type { VerificationCheckResult, VerificationCommand } from '@freevobe/protocol';
import { runVerification, summarizeReport } from './engine.js';

const commands: VerificationCommand[] = [
  { id: 'typecheck', label: 'Typkontroll', kind: 'typecheck', command: 'typ', source: 'test' },
  { id: 'test', label: 'Tester', kind: 'test', command: 'test', source: 'test' },
  { id: 'build', label: 'Bygge', kind: 'build', command: 'bygg', source: 'test' },
];

function runner(
  outputs: Record<string, { exitCode: number | null; output: string; timedOut?: boolean }>,
) {
  return vi.fn(async (command: string) => {
    const result = outputs[command];
    if (!result) throw new Error(`okänt kommando: ${command}`);
    return { output: result.output, exitCode: result.exitCode, timedOut: result.timedOut ?? false };
  });
}

function clock() {
  let time = 1_000;
  return () => {
    time += 100;
    return time;
  };
}

describe('runVerification', () => {
  it('kör alla steg och sammanfattar gröna resultat', async () => {
    const run = runner({
      typ: { exitCode: 0, output: 'inga typfel' },
      test: { exitCode: 0, output: 'Test Files  2 passed (2)\nTests  7 passed (7)' },
      bygg: { exitCode: 0, output: 'built' },
    });
    const checks: VerificationCheckResult[] = [];

    const report = await runVerification({
      root: '/projekt',
      projectId: 'proj',
      commands,
      run,
      now: clock(),
      createReportId: () => 'verify_1',
      onCheck: (check) => checks.push(check),
    });

    expect(run).toHaveBeenCalledTimes(3);
    expect(report.id).toBe('verify_1');
    expect(report.status).toBe('passed');
    expect(report.summary).toContain('3 av 3 steg gröna');
    expect(report.checks.map((check) => check.status)).toEqual(['passed', 'passed', 'passed']);
    // Teststeget får antal tester parsade ur utdata.
    expect(report.checks[1]?.passed).toBe(7);
    expect(report.checks[1]?.failed).toBe(0);
    expect(checks).toHaveLength(3);
    expect(report.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('fortsätter efter ett rött steg och namnger problemen', async () => {
    const run = runner({
      typ: { exitCode: 0, output: 'ok' },
      test: { exitCode: 1, output: 'Tests  1 failed | 4 passed' },
      bygg: { exitCode: 0, output: 'ok' },
    });

    const report = await runVerification({
      root: '/projekt',
      projectId: 'proj',
      commands,
      run,
      now: clock(),
    });

    expect(report.status).toBe('failed');
    expect(report.summary).toContain('1 av 3 steg röda: Tester');
    expect(report.checks[1]?.status).toBe('failed');
    expect(report.checks[1]?.exitCode).toBe(1);
    expect(report.checks[1]?.failed).toBe(1);
    // Alla steg kördes – rapporten ska visa hela bilden.
    expect(report.checks[2]?.status).toBe('passed');
  });

  it('markerar tidsgräns och kastade fel som misslyckade', async () => {
    const run = vi.fn(async (command: string) => {
      if (command === 'typ') return { output: '', exitCode: null, timedOut: true };
      if (command === 'test') throw new Error('kunde inte starta');
      return { output: 'ok', exitCode: 0, timedOut: false };
    });

    const report = await runVerification({
      root: '/projekt',
      projectId: 'proj',
      commands,
      run,
      now: clock(),
    });

    expect(report.checks[0]?.status).toBe('timeout');
    expect(report.checks[1]?.status).toBe('failed');
    expect(report.checks[1]?.output).toContain('kunde inte starta');
    expect(report.status).toBe('failed');
  });

  it('hoppar över resten när körningen avbryts', async () => {
    const controller = new AbortController();
    const run = vi.fn(async () => {
      controller.abort();
      return { output: 'ok', exitCode: 0, timedOut: false };
    });

    const report = await runVerification({
      root: '/projekt',
      projectId: 'proj',
      commands,
      run,
      now: clock(),
      signal: controller.signal,
    });

    expect(run).toHaveBeenCalledTimes(1);
    expect(report.checks.map((check) => check.status)).toEqual(['passed', 'skipped', 'skipped']);
    expect(report.status).toBe('passed');
  });

  it('rapporterar att inget fanns att köra', async () => {
    const report = await runVerification({
      root: '/projekt',
      projectId: 'proj',
      commands: [],
      run: runner({}),
      now: clock(),
    });

    expect(report.status).toBe('skipped');
    expect(report.summary).toContain('Inga verifieringssteg');
    expect(report.checks).toEqual([]);
  });

  it('kapar lång utdata till slutet', async () => {
    const long = `${'a'.repeat(20_000)}SLUT`;
    const report = await runVerification({
      root: '/projekt',
      projectId: 'proj',
      commands: [commands[0] as VerificationCommand],
      run: runner({ typ: { exitCode: 1, output: long } }),
      now: clock(),
    });

    expect(report.checks[0]?.output.endsWith('SLUT')).toBe(true);
    expect(report.checks[0]?.output.length).toBeLessThan(9_000);
  });
});

describe('summarizeReport', () => {
  it('formaterar varaktighet i sekunder', () => {
    const checks: VerificationCheckResult[] = [
      {
        ...(commands[0] as VerificationCommand),
        status: 'passed',
        exitCode: 0,
        durationMs: 1,
        output: '',
      },
    ];
    expect(summarizeReport(checks, 2_400)).toContain('2,4 s');
  });
});
