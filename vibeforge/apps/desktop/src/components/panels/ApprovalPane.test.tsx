// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ApprovalRequest } from '@vibeforge/protocol';
import { ApprovalPane } from './ApprovalPane';
import { useAppStore } from '../../store/appStore';

const approval: ApprovalRequest = {
  id: 'approval-1',
  runId: 'run-1',
  kind: 'file_write',
  title: 'Skriv fil: src/hello.ts',
  detail: 'Agenten vill skapa src/hello.ts.',
  risk: 'medium',
  reason: 'Behörighetsläge: ask',
  hardBlock: false,
  path: 'src/hello.ts',
  diff: {
    id: 'diff-1',
    path: 'src/hello.ts',
    absolutePath: 'C:/projekt/src/hello.ts',
    kind: 'create',
    hunks: [
      {
        oldStart: 0,
        oldLines: 0,
        newStart: 1,
        newLines: 2,
        lines: ['+export const hello = 1;', '+export const bye = 2;'],
      },
    ],
    newContent: 'export const hello = 1;\nexport const bye = 2;\n',
    oldContent: '',
    additions: 2,
    deletions: 0,
  },
  createdAt: Date.now(),
};

describe('ApprovalPane', () => {
  afterEach(() => {
    cleanup();
    useAppStore.setState({ approvals: [], client: null, permissionMode: 'ask' });
  });

  it('visar diffen innan något sparas', () => {
    useAppStore.setState({ approvals: [approval], permissionMode: 'ask' });
    render(<ApprovalPane />);
    expect(screen.getByTestId('approval-card')).toBeTruthy();
    expect(screen.getByText(/Skriv fil/)).toBeTruthy();
    expect(screen.getByText('export const hello = 1;')).toBeTruthy();
    expect(screen.getByText(/Behörighetsläge: ask/)).toBeTruthy();
  });

  it('skickar godkännandet till agenten och tar bort kortet', async () => {
    const post = vi.fn().mockResolvedValue({ ok: true });
    useAppStore.setState({
      approvals: [approval],
      client: { post } as never,
      permissionMode: 'ask',
    });
    render(<ApprovalPane />);
    fireEvent.click(screen.getByTestId('approve'));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/approvals/approval-1', { decision: 'approved' }),
    );
    expect(useAppStore.getState().approvals).toHaveLength(0);
  });

  it('markerar skyddade åtgärder som aldrig körs automatiskt', () => {
    useAppStore.setState({
      approvals: [{ ...approval, hardBlock: true, risk: 'high' }],
      permissionMode: 'full-auto',
    });
    render(<ApprovalPane />);
    expect(screen.getByText(/körs aldrig automatiskt/)).toBeTruthy();
  });

  it('visar frågor från ask_user-verktyget', () => {
    useAppStore.setState({
      approvals: [
        {
          ...approval,
          kind: 'user_question',
          title: 'Fråga från agenten',
          questions: [
            {
              id: 'q1',
              header: 'Testramverk',
              question: 'Vilket testramverk ska jag använda?',
              options: [{ label: 'Vitest', description: 'Redan installerat' }, { label: 'Jest' }],
            },
          ],
        },
      ],
    });
    render(<ApprovalPane />);
    expect(screen.getByText('Vilket testramverk ska jag använda?')).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Vitest/));
    expect((screen.getByLabelText(/Vitest/) as HTMLInputElement).checked).toBe(true);
  });
});
