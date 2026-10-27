import { describe, expect, it } from 'vitest';
import type { AgentEvent } from '@/api/types';
import { defaultNotifications, notificationFor, type NotificationPreferences } from './notify-rules';

const prefs: NotificationPreferences = defaultNotifications;

const approvalEvent: AgentEvent = {
  type: 'approval_request',
  runId: 'run.1',
  request: {
    id: 'approval.1',
    runId: 'run.1',
    kind: 'terminal',
    title: 'Kör tester',
    detail: 'npm test',
    risk: 'medium',
    reason: 'policy',
    hardBlock: false,
    command: 'npm',
    args: ['test'],
    createdAt: 0,
  },
};

describe('notificationFor', () => {
  it('notiserar när agenten behöver ett godkännande', () => {
    const decision = notificationFor(approvalEvent, prefs);
    expect(decision?.kind).toBe('approval');
    expect(decision?.body).toContain('npm test');
    expect(decision?.key).toBe('approval.approval.1');
  });

  it('notiserar om misslyckade tester, men inte om alla gick igenom', () => {
    const failing: AgentEvent = {
      type: 'tests',
      runId: 'run.1',
      tests: { passed: 3, failed: 2, command: 'npm test', output: '', createdAt: 5 },
    };
    const passing: AgentEvent = {
      type: 'tests',
      runId: 'run.1',
      tests: { passed: 5, failed: 0, command: 'npm test', output: '', createdAt: 6 },
    };
    expect(notificationFor(failing, prefs)?.kind).toBe('test-failure');
    expect(notificationFor(passing, prefs)).toBeNull();
  });

  it('notiserar när en mission är klar respektive när den avbröts', () => {
    const done: AgentEvent = { type: 'run_finished', runId: 'run.1', reason: 'final', summary: 'Klart.' };
    const aborted: AgentEvent = { type: 'run_finished', runId: 'run.1', reason: 'aborted' };
    expect(notificationFor(done, prefs)).toEqual({
      kind: 'mission-done',
      title: 'Missionen är klar',
      body: 'Klart.',
      key: 'done.run.1',
    });
    expect(notificationFor(aborted, prefs)).toBeNull();
  });

  it('notiserar vid agentfel', () => {
    const error: AgentEvent = { type: 'error', runId: 'run.1', code: 'ollama_unavailable', message: 'Ollama svarar inte' };
    expect(notificationFor(error, prefs)?.kind).toBe('error');
  });

  it('respekterar huvudbrytaren och varje enskild inställning', () => {
    expect(notificationFor(approvalEvent, { ...prefs, enabled: false })).toBeNull();
    expect(notificationFor(approvalEvent, { ...prefs, approvals: false })).toBeNull();
    expect(
      notificationFor(
        { type: 'error', runId: 'run.1', code: 'internal_error', message: 'fel' },
        { ...prefs, errors: false },
      ),
    ).toBeNull();
  });

  it('notiserar inte för händelser som inte är värda en notis', () => {
    expect(notificationFor({ type: 'assistant_delta', runId: 'run.1', text: 'hej' }, prefs)).toBeNull();
    expect(notificationFor({ type: 'status', runId: 'run.1', phase: 'thinking' }, prefs)).toBeNull();
  });
});
