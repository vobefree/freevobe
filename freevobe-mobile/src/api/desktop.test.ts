import { describe, expect, it } from 'vitest';
import {
  readApprovals,
  readFileDiff,
  readHealth,
  readMessages,
  readProjects,
  readRuns,
  readSessions,
  readTasks,
  toChatMessage,
  toFileChanges,
  toMission,
  toMissionStatus,
  toMissionSteps,
  toTerminalEntry,
} from './desktop';

describe('readHealth', () => {
  it('läser namnet och faller tillbaka på ett standardnamn', () => {
    expect(readHealth({ ok: true, name: 'studio-pc', protocol: 1, port: 4319 })).toEqual({
      ok: true,
      name: 'studio-pc',
      protocol: 1,
      port: 4319,
    });
    expect(readHealth({ ok: true })?.name).toBe('Freevobe Desktop');
  });

  it('ger null för skräp', () => {
    expect(readHealth(null)).toBeNull();
    expect(readHealth('inte ett objekt')).toBeNull();
  });
});

describe('readSessions / readTasks / readRuns / readProjects', () => {
  it('läser sessioner och hoppar över poster utan id', () => {
    const sessions = readSessions([
      { id: 's1', projectId: 'p1', title: 'Fix', model: 'qwen', updatedAt: 5, messageCount: 3 },
      { projectId: 'p1' },
      'skräp',
    ]);
    expect(sessions).toEqual([
      { id: 's1', projectId: 'p1', title: 'Fix', model: 'qwen', updatedAt: 5, messageCount: 3 },
    ]);
  });

  it('normaliserar okända uppgiftsstatusar till todo', () => {
    const tasks = readTasks([
      { id: 't1', sessionId: 's1', title: 'Ett', status: 'doing' },
      { id: 't2', sessionId: 's1', title: 'Två', status: 'konstigt' },
    ]);
    expect(tasks.map((task) => task.status)).toEqual(['doing', 'todo']);
  });

  it('läser körningar och projekt', () => {
    expect(readRuns([{ runId: 'r1', sessionId: 's1', projectId: 'p1', startedAt: 1, status: 'running' }])).toHaveLength(1);
    expect(readProjects([{ id: 'p1', path: '~/dev', permissionMode: 'ask' }])[0]?.name).toBe('~/dev');
  });
});

describe('readMessages', () => {
  it('behåller verktygsanrop och normaliserar rollen', () => {
    const [message] = readMessages([
      {
        id: 'm1',
        role: 'tool',
        content: 'ok',
        createdAt: 3,
        toolCalls: [{ id: 'c1', name: 'read_file', args: { path: 'a.ts' } }],
      },
    ]);
    expect(message?.role).toBe('tool');
    expect(message?.toolCalls?.[0]?.name).toBe('read_file');
  });
});

describe('readApprovals', () => {
  it('läser ett godkännande med diff och risknivå', () => {
    const [approval] = readApprovals([
      {
        id: 'a1',
        runId: 'r1',
        kind: 'file_write',
        title: 'Skriv fil',
        detail: 'detalj',
        risk: 'high',
        reason: 'policy',
        hardBlock: true,
        path: 'src/a.ts',
        createdAt: 7,
        diff: {
          id: 'd1',
          path: 'src/a.ts',
          kind: 'update',
          hunks: [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: ['-a', '+b'] }],
          oldContent: 'a',
          newContent: 'b',
          additions: 1,
          deletions: 1,
        },
      },
    ]);
    expect(approval?.risk).toBe('high');
    expect(approval?.hardBlock).toBe(true);
    expect(approval?.diff?.hunks[0]?.lines).toEqual(['-a', '+b']);
  });

  it('hoppar över objekt utan id eller runId', () => {
    expect(readApprovals([{ id: 'a1' }, null])).toEqual([]);
  });

  it('ger null för en diff utan sökväg', () => {
    expect(readFileDiff({ hunks: [] })).toBeNull();
  });
});

describe('toMissionSteps', () => {
  it('översätter skrivbordets statusar till stegstatusar', () => {
    expect(
      toMissionSteps([
        { id: '1', sessionId: 's', title: 'a', status: 'done' },
        { id: '2', sessionId: 's', title: 'b', status: 'doing' },
        { id: '3', sessionId: 's', title: 'c', status: 'blocked' },
        { id: '4', sessionId: 's', title: 'd', status: 'todo' },
      ]).map((step) => step.status),
    ).toEqual(['done', 'active', 'failed', 'pending']);
  });
});

describe('toMissionStatus', () => {
  it('låter ett godkännande gå före allt annat', () => {
    const status = toMissionStatus({
      runs: [{ runId: 'r1', sessionId: 's1', projectId: 'p1', startedAt: 0, status: 'running' }],
      approvals: [
        {
          id: 'a1',
          runId: 'r1',
          kind: 'file_write',
          title: 't',
          detail: 'd',
          risk: 'low',
          reason: 'r',
          hardBlock: false,
          createdAt: 0,
        },
      ],
    });
    expect(status).toEqual({ status: 'waiting-approval', phase: 'waiting-approval' });
  });

  it('visar körning när ingen väntar på svar', () => {
    const status = toMissionStatus({
      runs: [{ runId: 'r1', sessionId: 's1', projectId: 'p1', startedAt: 0, status: 'running' }],
      approvals: [],
    });
    expect(status.status).toBe('running');
  });

  it('är vilande utan körningar', () => {
    expect(toMissionStatus({ runs: [], approvals: [] }).status).toBe('idle');
  });
});

describe('toMission', () => {
  it('samlar titel, steg, filer och godkännandebehov', () => {
    const mission = toMission(
      { id: 's1', projectId: 'p1', title: 'Fixa priset', model: 'qwen', updatedAt: 10, messageCount: 2 },
      {
        tasks: [{ id: 't1', sessionId: 's1', title: 'Läs koden', status: 'done' }],
        runs: [],
        approvals: [],
        files: [{ path: 'src/a.ts', kind: 'update', additions: 1, deletions: 1 }],
      },
    );
    expect(mission.title).toBe('Fixa priset');
    expect(mission.steps).toHaveLength(1);
    expect(mission.files[0]?.path).toBe('src/a.ts');
    expect(mission.needsApproval).toBe(false);
    expect(mission.model).toBe('qwen');
  });
});

describe('toChatMessage / toTerminalEntry', () => {
  it('gör verktygsanrop läsbara i chatten', () => {
    const message = toChatMessage({
      id: 'm1',
      role: 'assistant',
      content: 'klart',
      createdAt: 1,
      toolCalls: [{ id: 'c1', name: 'read_file', args: { path: 'src/a.ts' } }],
    });
    expect(message.toolCalls?.[0]?.summary).toBe('read_file src/a.ts');
    expect(message.toolCalls?.[0]?.status).toBe('ok');
  });

  it('känner igen ett terminalkommando i en verktygsrad', () => {
    const entry = toTerminalEntry({
      id: 'm2',
      role: 'tool',
      content: 'utförande klar',
      createdAt: 2,
      toolCalls: [{ id: 'c2', name: 'run_terminal_command', args: { command: 'npm test' } }],
    });
    expect(entry.kind).toBe('command');
    expect(entry.command).toBe('npm test');
  });

  it('behandlar rollen tool utan kommando som utdata', () => {
    expect(toTerminalEntry({ id: 'm3', role: 'tool', content: 'x', createdAt: 3 }).kind).toBe('stdout');
  });
});

describe('toFileChanges', () => {
  it('mappar git-status till filändringar', () => {
    expect(toFileChanges([{ path: 'a.ts' }])).toEqual([
      { path: 'a.ts', kind: 'update', additions: 0, deletions: 0 },
    ]);
  });
});
