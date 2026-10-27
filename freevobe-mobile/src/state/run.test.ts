import { describe, expect, it } from 'vitest';
import type { AgentEvent } from '@/api/types';
import { emptyRunView, reduceRun } from './run';

/**
 * Händelsereduceringen är kärnan i chatten: den avgör vad användaren ser medan agenten arbetar.
 */
function applyAll(events: AgentEvent[]) {
  return events.reduce(reduceRun, emptyRunView());
}

describe('reduceRun', () => {
  it('nollställer vyn när en körning startar', () => {
    const view = reduceRun(
      { ...emptyRunView(), error: 'gammalt fel', messages: [] },
      { type: 'run_started', runId: 'r1', sessionId: 's1', model: 'qwen' },
    );
    expect(view.runId).toBe('r1');
    expect(view.running).toBe(true);
    expect(view.error).toBeNull();
    expect(view.phase).toBe('connecting');
  });

  it('bygger upp ett svar av strömmande text och avslutar med ett meddelande', () => {
    const view = applyAll([
      { type: 'assistant_delta', runId: 'r1', text: 'Jag ' },
      { type: 'assistant_delta', runId: 'r1', text: 'fixar det.' },
    ]);
    expect(view.streamingText).toBe('Jag fixar det.');

    const done = reduceRun(view, {
      type: 'assistant_message',
      runId: 'r1',
      messageId: 'm1',
      text: 'Jag fixar det.',
    });
    expect(done.streamingText).toBe('');
    expect(done.messages[0]?.text).toBe('Jag fixar det.');
  });

  it('markerar verktygsanrop som klara och lägger resultatet i loggen', () => {
    const afterCall = reduceRun(emptyRunView(), {
      type: 'tool_call',
      runId: 'r1',
      call: { id: 'c1', name: 'read_file', args: { path: 'src/a.ts' } },
    });
    expect(afterCall.toolCalls[0]?.summary).toBe('read_file src/a.ts');
    expect(afterCall.toolCalls[0]?.status).toBe('running');

    const afterResult = reduceRun(afterCall, {
      type: 'tool_result',
      runId: 'r1',
      result: { callId: 'c1', name: 'read_file', ok: false, content: '', error: 'finns inte', durationMs: 12 },
    });
    expect(afterResult.toolCalls[0]?.status).toBe('failed');
    expect(afterResult.toolCalls[0]?.durationMs).toBe(12);
    expect(afterResult.logs[0]?.kind).toBe('stderr');
    expect(afterResult.logs[0]?.text).toBe('finns inte');
  });

  it('sätter och rensar väntande godkännande', () => {
    const request = {
      id: 'a1',
      runId: 'r1',
      kind: 'terminal' as const,
      title: 'Kör tester',
      detail: 'npm test',
      risk: 'medium' as const,
      reason: 'policy',
      hardBlock: false,
      createdAt: 0,
    };
    const waiting = reduceRun(emptyRunView(), { type: 'approval_request', runId: 'r1', request });
    expect(waiting.pendingApproval?.id).toBe('a1');
    expect(waiting.phase).toBe('waiting-approval');

    const resolved = reduceRun(waiting, {
      type: 'approval_resolved',
      runId: 'r1',
      approvalId: 'a1',
      decision: 'approved',
    });
    expect(resolved.pendingApproval).toBeNull();
  });

  it('samlar tester, diffar och filändringar', () => {
    const view = applyAll([
      {
        type: 'diff',
        runId: 'r1',
        diff: {
          id: 'd1',
          path: 'src/a.ts',
          kind: 'update',
          hunks: [],
          oldContent: '',
          newContent: '',
          additions: 1,
          deletions: 0,
        },
      },
      { type: 'file_changed', runId: 'r1', path: 'src/a.ts', kind: 'update' },
      {
        type: 'tests',
        runId: 'r1',
        tests: { passed: 4, failed: 1, command: 'npm test', output: '', createdAt: 0 },
      },
    ]);
    expect(view.diff?.path).toBe('src/a.ts');
    expect(view.logs.some((entry) => entry.text.includes('Ändrade src/a.ts'))).toBe(true);
    expect(view.tests?.failed).toBe(1);
    expect(view.logs.some((entry) => entry.kind === 'test')).toBe(true);
  });

  it('avslutar körningen med rätt fas och förklaring', () => {
    const final = reduceRun(emptyRunView(), {
      type: 'run_finished',
      runId: 'r1',
      reason: 'final',
      summary: 'Allt grönt.',
    });
    expect(final.running).toBe(false);
    expect(final.phase).toBe('done');
    expect(final.summary).toBe('Allt grönt.');

    const rejected = reduceRun(emptyRunView(), { type: 'run_finished', runId: 'r1', reason: 'rejected' });
    expect(rejected.error).toContain('avböjde');

    const errored = reduceRun(emptyRunView(), { type: 'run_finished', runId: 'r1', reason: 'error' });
    expect(errored.error).toContain('fel');
  });

  it('följer fasen i status-händelser', () => {
    const view = reduceRun(emptyRunView(), { type: 'status', runId: 'r1', phase: 'testing' });
    expect(view.phase).toBe('testing');
    expect(view.running).toBe(true);

    const idle = reduceRun(view, { type: 'status', runId: 'r1', phase: 'done' });
    expect(idle.running).toBe(false);
  });
});
