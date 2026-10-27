import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './client';
import { createMockApi } from './mock';
import type { AgentEvent } from './types';

/**
 * Mock-API:t är det som gör appen körbar utan en dator, så det ska bete sig som skrivbordet: samma
 * händelser i samma ordning, godkännanden som stoppar körningen och ett avbrott som avslutar den.
 */
function createApi() {
  return createMockApi({ latencyMs: 0, approvalTimeoutMs: 60_000 });
}

afterEach(() => {
  vi.useRealTimers();
});

describe('mock: läsning', () => {
  it('svarar på hälsa och snapshot', async () => {
    const api = createApi();
    const health = await api.health();
    expect(health.ok).toBe(true);
    expect(health.name).toBe('studio-pc');

    const snapshot = await api.snapshot();
    expect(snapshot.activeModel).toBe('qwen2.5-coder:7b');
    expect(snapshot.projects[0]?.id).toBe('project.freevobe');
  });

  it('listar missions sorterade på senaste aktivitet', async () => {
    const api = createApi();
    const missions = await api.missions();
    expect(missions.length).toBeGreaterThanOrEqual(4);
    expect(missions[0]?.id).toBe('session.pricing');
    expect(missions[0]?.status).toBe('waiting-approval');
    expect(missions.some((mission) => mission.status === 'failed')).toBe(true);
  });

  it('ger en mission i detalj med steg, loggar och diff', async () => {
    const api = createApi();
    const mission = await api.mission('session.pricing');
    expect(mission.steps).toHaveLength(4);
    expect(mission.approvals.length).toBeGreaterThan(0);
    expect(mission.logs.length).toBeGreaterThan(0);
    expect(mission.approvals[0]?.diff?.hunks.length).toBeGreaterThan(0);
  });

  it('kastar ApiError för en okänd session', async () => {
    const api = createApi();
    await expect(api.mission('finns.inte')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('mock: godkännanden', () => {
  it('tar bort godkännandet när det besvaras och vägrar svara två gånger', async () => {
    const api = createApi();
    const before = await api.approvals();
    expect(before.length).toBe(3);

    await api.resolveApproval('approval.diff', { decision: 'approved' });
    const after = await api.approvals();
    expect(after.map((approval) => approval.id)).not.toContain('approval.diff');

    await expect(api.resolveApproval('approval.diff', { decision: 'approved' })).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it('återanvänder ett godkännande som redan väntar i stället för att skapa en dubblett', async () => {
    vi.useFakeTimers();
    const api = createApi();
    const events: AgentEvent[] = [];
    const { runId } = await api.sendPrompt({ sessionId: 'session.pricing', prompt: 'Räkna med antal' });
    api.subscribeToRun(runId, (event) => events.push(event));

    await vi.advanceTimersByTimeAsync(2000);

    const requests = events.filter((event) => event.type === 'approval_request');
    expect(requests).toHaveLength(1);
    // En dubblett skulle ha fått id:t mock.session.pricing.file.
    expect(requests[0]).toMatchObject({ request: { id: 'approval.diff' } });

    const waiting = (await api.approvals()).filter((approval) =>
      approval.path?.endsWith('calculate.ts'),
    );
    expect(waiting).toHaveLength(1);
  });

  it('sätter körningen i rörelse när det redan synliga kortet besvaras', async () => {
    vi.useFakeTimers();
    const api = createApi();
    const events: AgentEvent[] = [];
    const { runId } = await api.sendPrompt({ sessionId: 'session.pricing', prompt: 'Räkna med antal' });
    api.subscribeToRun(runId, (event) => events.push(event));

    await vi.advanceTimersByTimeAsync(2000);
    await api.resolveApproval('approval.diff', { decision: 'approved' });
    await vi.advanceTimersByTimeAsync(1000);
    expect(events.some((event) => event.type === 'diff')).toBe(true);

    // Testkörningen väntade redan i sessionen, så körningen frågar inte om samma sak igen.
    const requests = events.filter((event) => event.type === 'approval_request');
    expect(requests).toHaveLength(2);
    expect(requests[1]).toMatchObject({ request: { id: 'approval.terminal' } });

    await api.resolveApproval('approval.terminal', { decision: 'approved' });
    await vi.advanceTimersByTimeAsync(2000);
    expect(events.some((event) => event.type === 'tests')).toBe(true);

    const finished = events.find((event) => event.type === 'run_finished');
    expect(finished?.type === 'run_finished' && finished.reason).toBe('final');
  });
});

describe('mock: körning', () => {
  it('spelar upp plan, godkännande, diff, tester och avslut', async () => {
    vi.useFakeTimers();
    const api = createApi();
    const events: AgentEvent[] = [];

    const { runId } = await api.sendPrompt({ sessionId: 'session.login', prompt: 'Fixa buggen' });
    const unsubscribe = api.subscribeToRun(runId, (event) => events.push(event));

    await vi.advanceTimersByTimeAsync(2000);
    const firstApproval = events.find((event) => event.type === 'approval_request');
    expect(firstApproval).toBeDefined();
    expect(events.some((event) => event.type === 'plan')).toBe(true);

    // Körningen står still tills godkännandet besvaras.
    await vi.advanceTimersByTimeAsync(5000);
    expect(events.filter((event) => event.type === 'approval_request')).toHaveLength(1);

    const fileApproval = events.find((event) => event.type === 'approval_request');
    if (fileApproval?.type !== 'approval_request') throw new Error('inget godkännande');
    await api.resolveApproval(fileApproval.request.id, { decision: 'approved' });

    await vi.advanceTimersByTimeAsync(2000);
    const second = events.filter((event) => event.type === 'approval_request');
    expect(second).toHaveLength(2);

    const terminalApproval = second[1];
    if (terminalApproval?.type !== 'approval_request') throw new Error('inget andra godkännande');
    await api.resolveApproval(terminalApproval.request.id, { decision: 'approved' });

    await vi.advanceTimersByTimeAsync(3000);
    expect(events.some((event) => event.type === 'diff')).toBe(true);
    expect(events.some((event) => event.type === 'terminal')).toBe(true);
    expect(events.some((event) => event.type === 'tests')).toBe(true);

    const finished = events.find((event) => event.type === 'run_finished');
    expect(finished).toBeDefined();
    if (finished?.type === 'run_finished') {
      expect(finished.reason).toBe('final');
      expect(finished.summary).toContain('test');
    }

    unsubscribe();
  });

  it('avbryter körningen när användaren begär det', async () => {
    vi.useFakeTimers();
    const api = createApi();
    const { runId } = await api.sendPrompt({ sessionId: 'session.login', prompt: 'Fixa' });
    const events: AgentEvent[] = [];
    api.subscribeToRun(runId, (event) => events.push(event));

    await vi.advanceTimersByTimeAsync(300);
    const result = await api.abortRun(runId);
    expect(result.aborted).toBe(true);

    const finished = events.find((event) => event.type === 'run_finished');
    expect(finished?.type === 'run_finished' && finished.reason).toBe('aborted');

    // Ett avbrott av en redan avslutad körning gör ingenting.
    expect((await api.abortRun(runId)).aborted).toBe(false);
  });

  it('spelar upp det som redan hänt för en sen prenumerant', async () => {
    vi.useFakeTimers();
    const api = createApi();
    const { runId } = await api.sendPrompt({ sessionId: 'session.login', prompt: 'Fixa' });
    await vi.advanceTimersByTimeAsync(700);

    const late: AgentEvent[] = [];
    api.subscribeToRun(runId, (event) => late.push(event));
    expect(late.some((event) => event.type === 'run_started')).toBe(true);
    expect(late.some((event) => event.type === 'status')).toBe(true);
  });

  it('lägger användarens prompt i sessionens historik', async () => {
    vi.useFakeTimers();
    const api = createApi();
    await api.sendPrompt({ sessionId: 'session.login', prompt: 'Skriv ett test' });
    const messages = await api.messages('session.login');
    expect(messages[messages.length - 1]?.text).toBe('Skriv ett test');
    expect(messages[messages.length - 1]?.role).toBe('user');
  });
});
