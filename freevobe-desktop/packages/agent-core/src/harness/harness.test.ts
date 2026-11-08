import { describe, expect, it, vi } from 'vitest';
import type {
  AgentEvent,
  PreviewStatus,
  VerificationCheckResult,
  VerificationReport,
} from '@freevobe/protocol';
import { runHarness, type HarnessStreamEvent } from './harness.js';

function report(status: VerificationReport['status']): VerificationReport {
  const check: VerificationCheckResult = {
    id: 'typecheck',
    label: 'Typkontroll',
    kind: 'typecheck',
    command: 'npm run typecheck',
    source: 'package.json',
    status: status === 'failed' ? 'failed' : 'passed',
    exitCode: status === 'failed' ? 1 : 0,
    durationMs: 10,
    output: '',
  };
  return {
    id: 'report',
    projectId: 'p',
    trigger: 'run',
    status,
    startedAt: 1,
    finishedAt: 2,
    durationMs: 1,
    checks: status === 'skipped' ? [] : [check],
    summary: 'ok',
  };
}

function loopOf(events: AgentEvent[]): () => AsyncGenerator<AgentEvent> {
  return async function* run() {
    for (const event of events) yield event;
  };
}

const runStarted: AgentEvent = {
  type: 'run_started',
  runId: 'r',
  sessionId: 's',
  model: 'm',
  mode: 'ask',
};

const finished: AgentEvent = { type: 'run_finished', runId: 'r', reason: 'final' };

const preview: PreviewStatus = {
  status: 'running',
  kind: 'static',
  command: null,
  url: 'http://127.0.0.1:4000/',
  port: 4000,
  logTail: [],
};

async function collect(
  generator: AsyncGenerator<HarnessStreamEvent>,
): Promise<HarnessStreamEvent[]> {
  const events: HarnessStreamEvent[] = [];
  for await (const event of generator) events.push(event);
  return events;
}

describe('harness-faser', () => {
  it('går gather → act → verify → deliver och avslutar sist', async () => {
    const verify = vi.fn(async () => report('passed'));
    const startPreview = vi.fn(async () => preview);
    const events = await collect(
      runHarness({
        runId: 'r',
        loop: loopOf([
          runStarted,
          { type: 'status', runId: 'r', phase: 'building-context' },
          { type: 'assistant_delta', runId: 'r', text: 'hej' },
          { type: 'file_changed', runId: 'r', path: 'index.html', kind: 'create' },
          finished,
        ]),
        verify,
        preview: startPreview,
      }),
    );

    const phases = events
      .filter((event) => event.type === 'harness_phase')
      .map((event) => (event as { phase: string }).phase);
    expect(phases).toEqual(['gather', 'act', 'verify', 'deliver']);
    expect(verify).toHaveBeenCalledWith({ changedFiles: ['index.html'] });
    expect(events.some((event) => event.type === 'verification')).toBe(true);
    expect(events.some((event) => event.type === 'harness_preview')).toBe(true);
    expect(events.at(-1)?.type).toBe('run_finished');
  });

  it('verifierar inte när inga filer ändrades', async () => {
    const verify = vi.fn(async () => report('passed'));
    const events = await collect(
      runHarness({
        runId: 'r',
        loop: loopOf([runStarted, { type: 'assistant_delta', runId: 'r', text: 'svar' }, finished]),
        verify,
        preview: async () => preview,
      }),
    );
    expect(verify).not.toHaveBeenCalled();
    expect(events.some((event) => event.type === 'verification')).toBe(false);
  });

  it('startar ingen preview när verifieringen är röd', async () => {
    const startPreview = vi.fn(async () => preview);
    const events = await collect(
      runHarness({
        runId: 'r',
        loop: loopOf([
          runStarted,
          { type: 'file_changed', runId: 'r', path: 'a.ts', kind: 'update' },
          finished,
        ]),
        verify: async () => report('failed'),
        preview: startPreview,
      }),
    );
    expect(startPreview).not.toHaveBeenCalled();
    expect(events.some((event) => event.type === 'harness_preview')).toBe(false);
  });

  it('visar routerns beslut och tål att preview saknas', async () => {
    const events = await collect(
      runHarness({
        runId: 'r',
        loop: loopOf([runStarted, finished]),
        route: {
          ok: false,
          taskKind: 'code',
          route: null,
          reason: 'no-tool-model',
          recommendation: {
            preview: {
              name: 'qwen2.5-coder:7b',
              registry: 'registry.ollama.ai/library/qwen2.5-coder',
              source: 'official',
              warnings: ['missing_checksum'],
              sizeBytes: 4_000_000_000,
              checksum: null,
              requiresApproval: true,
            },
            reasons: ['no_tool_model'],
            fitsHardware: true,
            alternatives: [],
          },
        },
      }),
    );
    const route = events.find((event) => event.type === 'harness_route');
    expect(route).toBeDefined();
    expect(
      (route as { recommendation: { preview: { name: string } } }).recommendation.preview.name,
    ).toBe('qwen2.5-coder:7b');
  });
});
