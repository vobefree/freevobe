import type {
  ApprovalRequest,
  ChatMessage,
  FileDiff,
  GitStatus,
  MissionStep,
  TerminalEntry,
} from './types';

/**
 * Exempeldata för mock-läget. Allt här är påhittat men formatmässigt identiskt med vad Freevobe
 * Desktop skickar, så att gränssnittet kan byggas och granskas utan en dator på nätet.
 */

export const MOCK_DESKTOP = {
  name: 'studio-pc',
  protocol: 1,
  port: 4319,
  model: 'qwen2.5-coder:7b',
  project: {
    id: 'project.freevobe',
    name: 'freevobe',
    path: '~/dev/freevobe',
  },
} as const;

/** Bygger en hunk med tre rader kontext runt ändringen, som en riktig diff. */
export function makeDiff(input: {
  id: string;
  path: string;
  kind: FileDiff['kind'];
  oldLines: string[];
  newLines: string[];
}): FileDiff {
  const lines = [
    ...input.oldLines.map((line) => `-${line}`),
    ...input.newLines.map((line) => `+${line}`),
  ];
  return {
    id: input.id,
    path: input.path,
    kind: input.kind,
    hunks: [
      {
        oldStart: 12,
        oldLines: input.oldLines.length,
        newStart: 12,
        newLines: input.newLines.length,
        lines,
      },
    ],
    oldContent: input.oldLines.join('\n'),
    newContent: input.newLines.join('\n'),
    additions: input.newLines.length,
    deletions: input.oldLines.length,
  };
}

export const approveDiff = makeDiff({
  id: 'diff.price-calc',
  path: 'src/pricing/calculate.ts',
  kind: 'update',
  oldLines: [
    'export function total(items: Item[]) {',
    '  return items.reduce((sum, item) => sum + item.price, 0);',
    '}',
  ],
  newLines: [
    'export function total(items: Item[]) {',
    '  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);',
    '}',
  ],
});

export function seedApprovals(): ApprovalRequest[] {
  const now = Date.now();
  return [
    {
      id: 'approval.diff',
      runId: 'run.session.pricing',
      kind: 'file_write',
      title: 'Skriv över src/pricing/calculate.ts',
      detail:
        'Agenten vill räkna med antal i stället för att bara summera priset. Två rader ändras.',
      risk: 'low',
      reason: 'Behörighetsläget är "ask".',
      hardBlock: false,
      path: 'src/pricing/calculate.ts',
      diff: approveDiff,
      createdAt: now - 60_000,
    },
    {
      id: 'approval.terminal',
      runId: 'run.session.pricing',
      kind: 'terminal',
      title: 'Kör tester',
      detail: 'npm test -- --run pricing',
      risk: 'medium',
      reason: 'Terminalkommandon kräver godkännande i detta projekt.',
      hardBlock: false,
      command: 'npm',
      args: ['test', '--', '--run', 'pricing'],
      cwd: '~/dev/freevobe',
      createdAt: now - 40_000,
    },
    {
      id: 'approval.destructive',
      runId: 'run.session.pricing',
      kind: 'file_delete',
      title: 'Ta bort src/legacy/pricing-old.ts',
      detail: 'Filen ersätts helt av den nya beräkningen och importeras inte längre någonstans.',
      risk: 'high',
      reason: 'Borttagning av fil går alltid via personligt godkännande.',
      hardBlock: true,
      path: 'src/legacy/pricing-old.ts',
      createdAt: now - 20_000,
    },
  ];
}

export interface MockMissionSeed {
  id: string;
  title: string;
  updatedAtOffsetMs: number;
  model: string;
  steps: MissionStep[];
}

export const seedMissions: MockMissionSeed[] = [
  {
    id: 'session.pricing',
    title: 'Räkna med antal i prisberäkningen',
    updatedAtOffsetMs: -60_000,
    model: 'qwen2.5-coder:7b',
    steps: [
      { id: 'step.1', title: 'Läs igenom pricing-modulen', status: 'done' },
      { id: 'step.2', title: 'Uppdatera total()', status: 'active' },
      { id: 'step.3', title: 'Kör pristesterna', status: 'pending' },
      { id: 'step.4', title: 'Commit', status: 'pending' },
    ],
  },
  {
    id: 'session.login',
    title: 'Fixa inloggningsbuggen på iOS',
    updatedAtOffsetMs: -4 * 60_000,
    model: 'qwen2.5-coder:7b',
    steps: [
      { id: 'step.1', title: 'Reproducera felet', status: 'done' },
      { id: 'step.2', title: 'Isolera orsaken', status: 'done' },
      { id: 'step.3', title: 'Skriv ett test som failar', status: 'active' },
    ],
  },
  {
    id: 'session.readme',
    title: 'Uppdatera README med mobilstöd',
    updatedAtOffsetMs: -90 * 60_000,
    model: 'llama3.1:8b',
    steps: [
      { id: 'step.1', title: 'Läs nuvarande README', status: 'done' },
      { id: 'step.2', title: 'Skriv avsnittet', status: 'done' },
      { id: 'step.3', title: 'Rätta stavfel', status: 'done' },
    ],
  },
  {
    id: 'session.migrate',
    title: 'Migrera databasen till SQLite',
    updatedAtOffsetMs: -26 * 60 * 60_000,
    model: 'deepseek-r1:8b',
    steps: [
      { id: 'step.1', title: 'Läs schemat', status: 'done' },
      { id: 'step.2', title: 'Skriv migrationen', status: 'done' },
      { id: 'step.3', title: 'Kör migrationen', status: 'failed' },
    ],
  },
];

export function seedChat(sessionId: string): ChatMessage[] {
  const now = Date.now();
  return [
    {
      id: `${sessionId}.m1`,
      role: 'user',
      text: 'Prisberäkningen ignorerar antal. Räkna med antal i stället.',
      createdAt: now - 6 * 60_000,
    },
    {
      id: `${sessionId}.m2`,
      role: 'assistant',
      text: 'Jag läser pricing-modulen först och ändrar sedan total() så att antal räknas in.',
      createdAt: now - 5 * 60_000,
      toolCalls: [{ id: 'tool.1', name: 'read_file', status: 'ok', summary: 'read_file src/pricing/calculate.ts', durationMs: 42 }],
    },
    {
      id: `${sessionId}.m3`,
      role: 'assistant',
      text: 'Ändringen är två rader. Jag behöver ditt godkännande innan jag skriver filen.',
      createdAt: now - 60_000,
    },
  ];
}

export function seedLogs(sessionId: string): TerminalEntry[] {
  const now = Date.now();
  return [
    {
      id: `${sessionId}.l1`,
      kind: 'command',
      command: 'npm test -- --run pricing',
      text: '> vitest run --run pricing\n',
      createdAt: now - 3 * 60_000,
    },
    {
      id: `${sessionId}.l2`,
      kind: 'stdout',
      text: '✓ pricing/total.test.ts (4 tests) 12ms\n',
      createdAt: now - 2 * 60_000,
    },
    {
      id: `${sessionId}.l3`,
      kind: 'stderr',
      text: 'FAIL pricing/quantity.test.ts > räknar antal\nExpected: 300\nReceived: 100\n',
      createdAt: now - 90_000,
      exitCode: 1,
    },
    {
      id: `${sessionId}.l4`,
      kind: 'system',
      text: 'Agenten väntar på godkännande innan den skriver om calculate.ts.',
      createdAt: now - 55_000,
    },
  ];
}

export const mockGitStatus: GitStatus = {
  branch: 'main',
  ahead: 1,
  files: [
    { path: 'src/pricing/calculate.ts', index: ' ', worktree: 'M', staged: false },
    { path: 'src/pricing/quantity.test.ts', index: 'A', worktree: ' ', staged: true },
    { path: 'README.md', index: ' ', worktree: 'M', staged: false },
  ],
};
