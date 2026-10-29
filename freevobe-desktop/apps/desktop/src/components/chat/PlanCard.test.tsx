// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Plan } from '@freevobe/protocol';
import { PlanCard } from './PlanCard';
import { useAppStore } from '../../store/appStore';

const proposed: Plan = {
  id: 'plan_1',
  sessionId: 'sess_1',
  runId: 'run_1',
  title: 'Uppdatera hälsningen',
  summary: 'Byt texten i src/halsa.ts.',
  steps: [
    { id: 'step_1', title: 'Läs filen', files: ['src/halsa.ts'] },
    { id: 'step_2', title: 'Byt hälsningen', files: ['src/halsa.ts'] },
  ],
  files: ['src/halsa.ts'],
  status: 'proposed',
  createdAt: 1_700_000_000_000,
};

function fakeClient() {
  return {
    post: vi.fn(async (url: string) => {
      if (url.startsWith('/api/plans/')) {
        return { ...proposed, status: 'approved', decidedAt: Date.now() } as never;
      }
      if (url === '/api/chat') return { runId: 'run_2' } as never;
      return {} as never;
    }),
    get: vi.fn(async () => [] as never),
    patch: vi.fn(async () => ({}) as never),
    del: vi.fn(async () => ({}) as never),
    subscribe: vi.fn(() => () => undefined),
  };
}

describe('PlanCard', () => {
  afterEach(() => {
    cleanup();
    useAppStore.setState({
      plans: [],
      client: null,
      sessionId: null,
      mode: 'plan',
      isRunning: false,
      messages: [],
      runId: null,
    });
  });

  it('visar stegen och vilka filer kontraktet omfattar', () => {
    render(<PlanCard plan={proposed} />);
    expect(screen.getByTestId('plan-title').textContent).toBe('Uppdatera hälsningen');
    expect(screen.getByTestId('plan-steps').textContent).toContain('Läs filen');
    expect(screen.getByTestId('plan-steps').textContent).toContain('Byt hälsningen');
    expect(screen.getByText(/Kontrakt: 1 fil/)).toBeTruthy();
    expect(screen.getByText(/Ingenting skrivs förrän du godkänt planen/)).toBeTruthy();
    expect(screen.getByTestId('approve-plan')).toBeTruthy();
  });

  it('godkänner planen utan att starta en körning', async () => {
    const client = fakeClient();
    useAppStore.setState({ client: client as never, sessionId: 'sess_1', mode: 'plan' });
    render(<PlanCard plan={proposed} />);

    fireEvent.click(screen.getByTestId('approve-plan-only'));

    await waitFor(() =>
      expect(client.post).toHaveBeenCalledWith('/api/plans/plan_1/decision', {
        decision: 'approved',
      }),
    );
    // Godkännandet växlar chatten till Execute, men skickar ingen prompt.
    expect(useAppStore.getState().mode).toBe('execute');
    expect(client.post).not.toHaveBeenCalledWith('/api/chat', expect.anything());
  });

  it('godkänner och startar körningen när man väljer "Godkänn & utför"', async () => {
    const client = fakeClient();
    useAppStore.setState({ client: client as never, sessionId: 'sess_1', mode: 'plan' });
    render(<PlanCard plan={proposed} />);

    fireEvent.click(screen.getByTestId('approve-plan'));

    await waitFor(() =>
      expect(client.post).toHaveBeenCalledWith(
        '/api/chat',
        expect.objectContaining({ prompt: 'Utför den godkända planen.' }),
      ),
    );
    expect(useAppStore.getState().mode).toBe('execute');
  });

  it('avvisar planen utan att växla läge', async () => {
    const client = fakeClient();
    client.post.mockImplementation(async (url: string) => {
      if (url.startsWith('/api/plans/')) {
        return { ...proposed, status: 'rejected', decidedAt: Date.now() } as never;
      }
      return {} as never;
    });
    useAppStore.setState({ client: client as never, sessionId: 'sess_1', mode: 'plan' });
    render(<PlanCard plan={proposed} />);

    fireEvent.click(screen.getByTestId('reject-plan'));

    await waitFor(() =>
      expect(client.post).toHaveBeenCalledWith('/api/plans/plan_1/decision', {
        decision: 'rejected',
      }),
    );
    expect(useAppStore.getState().mode).toBe('plan');
  });

  it('visar en godkänd plan som kontrakt utan knappar', () => {
    render(<PlanCard plan={{ ...proposed, status: 'approved', decidedAt: Date.now() }} />);
    expect(screen.getByText(/Godkänd – gäller som kontrakt/)).toBeTruthy();
    expect(screen.queryByTestId('approve-plan')).toBeNull();
  });
});
