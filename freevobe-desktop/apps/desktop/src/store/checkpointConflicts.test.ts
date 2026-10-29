// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup } from '@testing-library/react';
import type { CheckpointRestoreReport } from '@freevobe/protocol';
import type { AgentClient } from '../lib/agentClient';
import { useAppStore } from './appStore';

/** Låtsas-agent som svarar med ett förbestämt återställningsresultat. */
function fakeClient(report: CheckpointRestoreReport): AgentClient {
  return {
    post: async () => report,
    get: async () => ({}),
    put: async () => ({}),
    patch: async () => ({}),
    del: async () => ({}),
  } as unknown as AgentClient;
}

const noop = async () => undefined;

beforeEach(() => {
  useAppStore.setState({
    client: fakeClient({ checkpointId: 'cp_1', restored: [], deleted: [], skipped: [] }),
    logs: [],
    checkpoints: [],
    checkpointConflicts: null,
    loadTree: noop,
    refreshGit: noop,
    refreshCheckpoints: noop,
  });
});

afterEach(() => {
  cleanup();
  useAppStore.setState({ client: null, checkpointConflicts: null });
});

describe('restoreCheckpoint', () => {
  it('markerar filer som ändrats sedan checkpointen så att de kan tvingas fram', async () => {
    useAppStore.setState({
      client: fakeClient({
        checkpointId: 'cp_1',
        restored: ['src/annan.ts'],
        deleted: [],
        skipped: [{ path: 'src/halsa.ts', reason: 'changed-since' }],
      }),
    });

    await useAppStore.getState().restoreCheckpoint('cp_1');

    const state = useAppStore.getState();
    expect(state.checkpointConflicts).toEqual({
      checkpointId: 'cp_1',
      paths: ['src/halsa.ts'],
    });
    expect(state.logs.at(-1)?.level).toBe('warn');
    expect(state.checkpointBusy).toBeNull();
  });

  it('visar ingen konflikt när allt återställdes', async () => {
    useAppStore.setState({
      client: fakeClient({
        checkpointId: 'cp_1',
        restored: ['src/halsa.ts'],
        deleted: [],
        skipped: [],
      }),
    });

    await useAppStore.getState().restoreCheckpoint('cp_1');

    expect(useAppStore.getState().checkpointConflicts).toBeNull();
  });

  it('rensar markeringen när återställningen tvingas fram', async () => {
    useAppStore.setState({
      checkpointConflicts: { checkpointId: 'cp_1', paths: ['src/halsa.ts'] },
    });

    await useAppStore.getState().restoreCheckpoint('cp_1', true);

    expect(useAppStore.getState().checkpointConflicts).toBeNull();
  });

  it('påstår ingen konflikt för filer som hoppades över av andra skäl', async () => {
    useAppStore.setState({
      client: fakeClient({
        checkpointId: 'cp_1',
        restored: [],
        deleted: [],
        skipped: [{ path: '../utanför.ts', reason: 'outside-project' }],
      }),
    });

    await useAppStore.getState().restoreCheckpoint('cp_1');

    expect(useAppStore.getState().checkpointConflicts).toBeNull();
  });
});
