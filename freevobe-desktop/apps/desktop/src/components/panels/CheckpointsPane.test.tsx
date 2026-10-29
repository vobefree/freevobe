// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Checkpoint } from '@freevobe/protocol';
import { CheckpointsPane } from './CheckpointsPane';
import { useAppStore } from '../../store/appStore';

const checkpoint: Checkpoint = {
  id: 'cp_1',
  projectId: 'proj_1',
  sessionId: 'sess_1',
  label: 'Uppdatera hälsningen i src/halsa.ts.',
  reason: 'agent-run',
  status: 'open',
  testStatus: 'failed',
  testSummary: '3 godkända, 1 underkända · npm test',
  files: [
    { path: 'src/halsa.ts', changeKind: 'update', additions: 2, deletions: 1, snapshot: true },
    { path: 'src/ny.ts', changeKind: 'create', additions: 4, deletions: 0, snapshot: true },
  ],
  createdAt: Date.now() - 60_000,
};

const calls: string[] = [];

beforeEach(() => {
  calls.length = 0;
  useAppStore.setState({
    checkpoints: [],
    checkpointBusy: null,
    showCheckpointDiff: async (id: string) => {
      calls.push(`diff:${id}`);
    },
    restoreCheckpoint: async (id: string, force?: boolean) => {
      calls.push(force === true ? `restore:${id}:force` : `restore:${id}`);
    },
    discardCheckpoint: async (id: string) => {
      calls.push(`discard:${id}`);
    },
    commitCheckpoint: async (id: string, message?: string) => {
      calls.push(`commit:${id}:${message ?? ''}`);
    },
    createCheckpoint: async () => {
      calls.push('create');
    },
    refreshCheckpoints: async () => {
      calls.push('refresh');
    },
  });
});

afterEach(() => {
  cleanup();
});

describe('CheckpointsPane', () => {
  it('visar en tom tidslinje innan något sparats', () => {
    render(<CheckpointsPane />);
    expect(screen.getByText('Inga checkpoints än')).toBeTruthy();
  });

  it('visar tid, filer och teststatus för en checkpoint', () => {
    useAppStore.setState({ checkpoints: [checkpoint] });
    render(<CheckpointsPane />);

    expect(screen.getByText(checkpoint.label)).toBeTruthy();
    expect(screen.getByText('Öppen')).toBeTruthy();
    expect(screen.getByText('tester röda')).toBeTruthy();
    expect(screen.getByText('src/halsa.ts')).toBeTruthy();
    expect(screen.getByText('src/ny.ts')).toBeTruthy();
    expect(screen.getByText(/\+2 −1/)).toBeTruthy();
  });

  it('återställer först efter ett tydligt bekräftelsesteg', () => {
    useAppStore.setState({ checkpoints: [checkpoint] });
    render(<CheckpointsPane />);

    fireEvent.click(screen.getByTestId('checkpoint-restore'));
    expect(calls).toEqual([]);

    fireEvent.click(screen.getByTestId('checkpoint-confirm-restore'));
    expect(calls).toEqual(['restore:cp_1']);
  });

  it('visar hoppade filer och låter användaren tvinga fram en återställning', () => {
    useAppStore.setState({
      checkpoints: [checkpoint],
      checkpointConflicts: { checkpointId: 'cp_1', paths: ['src/halsa.ts'] },
    });
    render(<CheckpointsPane />);

    expect(screen.getByTestId('checkpoint-conflicts').textContent).toContain('src/halsa.ts');

    fireEvent.click(screen.getByTestId('checkpoint-force'));
    expect(calls).toEqual([]);

    fireEvent.click(screen.getByTestId('checkpoint-confirm-force'));
    expect(calls).toEqual(['restore:cp_1:force']);
  });

  it('visar inga konflikter för en annan checkpoint', () => {
    useAppStore.setState({
      checkpoints: [checkpoint],
      checkpointConflicts: { checkpointId: 'cp_2', paths: ['src/halsa.ts'] },
    });
    render(<CheckpointsPane />);

    expect(screen.queryByTestId('checkpoint-conflicts')).toBeNull();
  });

  it('öppnar diffen, committar med meddelande och kastar checkpointen', () => {
    useAppStore.setState({ checkpoints: [checkpoint] });
    render(<CheckpointsPane />);

    fireEvent.click(screen.getByTestId('checkpoint-diff'));
    expect(calls).toContain('diff:cp_1');

    fireEvent.click(screen.getByTestId('checkpoint-commit'));
    const input = screen.getByTestId('checkpoint-commit-input') as HTMLInputElement;
    expect(input.value).toContain('Checkpoint:');
    fireEvent.change(input, { target: { value: 'Checkpoint: hälsningen' } });
    fireEvent.click(screen.getByTestId('checkpoint-commit-send'));
    expect(calls).toContain('commit:cp_1:Checkpoint: hälsningen');

    fireEvent.click(screen.getByTestId('checkpoint-discard'));
    expect(calls).toContain('discard:cp_1');
  });

  it('sparar en ny checkpoint från panelen', () => {
    render(<CheckpointsPane />);
    fireEvent.click(screen.getByTestId('new-checkpoint'));
    expect(calls).toEqual(['create']);
  });
});
