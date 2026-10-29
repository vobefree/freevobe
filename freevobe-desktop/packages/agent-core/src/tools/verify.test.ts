import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentEvent } from '@freevobe/protocol';
import { runVerificationTool } from './verify.js';
import type { CommandResult, ToolContext } from './types.js';

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-verify-tool-'));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

function context(
  events: AgentEvent[],
  exec: (command: string) => Partial<CommandResult> = () => ({}),
): ToolContext {
  return {
    root,
    projectId: 'proj',
    sessionId: 'sess',
    runId: 'run_1',
    signal: new AbortController().signal,
    approval: { required: false, risk: 'low', reason: 'Tillåtet.', hardBlock: false },
    emit: (event: AgentEvent) => events.push(event),
    requestApproval: async () => ({ approved: true }),
    proposeChange: async () => {
      throw new Error('används inte');
    },
    runHooks: async () => ({ blocked: false, output: '' }),
    exec: async (command: string) => ({
      command,
      exitCode: 0,
      passed: 0,
      failed: 0,
      output: 'ok',
      timedOut: false,
      ...exec(command),
    }),
    detectTestCommand: async () => null,
    fetchImpl: fetch,
    limits: { terminalTimeoutMs: 2_000, maxOutputChars: 10_000 },
  };
}

async function writeManifest(scripts: Record<string, string>): Promise<void> {
  await fs.writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'verify-projekt', scripts }),
  );
}

describe('run_verification', () => {
  it('säger ifrån när projektet saknar verifieringssteg', async () => {
    const events: AgentEvent[] = [];
    const result = await runVerificationTool.handler?.({}, context(events));

    expect(result?.ok).toBe(false);
    expect(result?.content).toContain('Hittade inga verifieringssteg');
    expect(events).toHaveLength(0);
  });

  it('kör stegen och skickar händelser för start, varje steg och rapporten', async () => {
    await writeManifest({ test: 'vitest run' });
    const events: AgentEvent[] = [];

    const result = await runVerificationTool.handler?.(
      {},
      context(events, () => ({
        output: 'Tests  4 passed (4)',
      })),
    );

    expect(result?.ok).toBe(true);
    expect(result?.content).toContain('gröna');
    expect(events.map((event) => event.type)).toEqual([
      'verification_started',
      'verification_check',
      'verification',
    ]);

    const report = events.at(-1);
    expect(report?.type === 'verification' && report.report.trigger).toBe('tool');
    expect(report?.type === 'verification' && report.report.checks[0]?.passed).toBe(4);
  });

  it('returnerar fel när ett steg är rött, med utdata för modellen', async () => {
    await writeManifest({ typecheck: 'tsc --noEmit' });
    const events: AgentEvent[] = [];

    const result = await runVerificationTool.handler?.(
      {},
      context(events, () => ({ exitCode: 1, output: 'src/a.ts(1,1): error TS1005' })),
    );

    expect(result?.ok).toBe(false);
    expect(result?.error).toContain('Typkontroll');
    expect(result?.content).toContain('error TS1005');
  });

  it('begär godkännande när policyn kräver det', async () => {
    await writeManifest({ test: 'node -e "console.log(1)"' });
    const events: AgentEvent[] = [];
    const ctx = context(events);
    ctx.approval = {
      required: true,
      risk: 'medium',
      reason: 'Behörighetsläget är "Fråga alltid".',
      hardBlock: false,
    };
    const requestApproval = vi.fn(async () => ({ approved: false }));
    ctx.requestApproval = requestApproval;

    const result = await runVerificationTool.handler?.({}, ctx);

    expect(requestApproval).toHaveBeenCalledTimes(1);
    expect(result?.ok).toBe(false);
    expect(result?.content).toContain('avvisade');
    expect(events).toHaveLength(0);
  });
});
