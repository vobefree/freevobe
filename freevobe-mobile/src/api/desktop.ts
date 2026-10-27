import type {
  AgentPhase,
  ApprovalRequest,
  ChatMessage,
  FileChange,
  Mission,
  MissionStatus,
  MissionStep,
  PermissionMode,
  ProjectSummary,
  TerminalEntry,
  ToolCallSummary,
} from './types';

/**
 * Skrivbordsappens råa svar plus översättningen till mobilens typer.
 *
 * Filen är ren (ingen nätverkskod) och därför enhetstestad: det är här en felaktig gissning om
 * skrivbords-API:t skulle märkas först, så den ska vara lätt att köra mot riktiga exempel.
 *
 * Skrivbords-API:t svarar med JSON som vi inte kan typa vid kompilering. Varje läsning går därför
 * genom `read*`-funktionerna nedan, som returnerar null i stället för att kasta: ett oväntat fält ska
 * ge en tom vy, inte en krasch på telefonen.
 */

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export interface DesktopSession {
  id: string;
  projectId: string;
  title: string;
  model: string;
  updatedAt: number;
  messageCount: number;
}

export interface DesktopTask {
  id: string;
  sessionId: string;
  title: string;
  status: 'todo' | 'doing' | 'blocked' | 'done';
}

export interface DesktopRun {
  runId: string;
  sessionId: string;
  projectId: string;
  startedAt: number;
  status: 'running' | 'finished' | string;
}

export interface DesktopProject {
  id: string;
  name: string;
  path: string;
  lastModel?: string;
  permissionMode: PermissionMode;
}

export interface DesktopMessage {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  createdAt: number;
  toolCalls?: { id: string; name: string; args: Record<string, unknown> }[];
  toolCallId?: string;
}

export function readHealth(value: unknown): { ok: boolean; name: string; protocol: number; port: number } | null {
  const record = asRecord(value);
  if (!record) return null;
  const name = asString(record.name) ?? 'Freevobe Desktop';
  return {
    ok: asBoolean(record.ok),
    name,
    protocol: asNumber(record.protocol) ?? 0,
    port: asNumber(record.port) ?? 0,
  };
}

export function readSessions(value: unknown): DesktopSession[] {
  return asArray(value).flatMap((entry) => {
    const record = asRecord(entry);
    const id = record && asString(record.id);
    if (!record || !id) return [];
    return [
      {
        id,
        projectId: asString(record.projectId) ?? '',
        title: asString(record.title) ?? 'Namnlös session',
        model: asString(record.model) ?? '',
        updatedAt: asNumber(record.updatedAt) ?? 0,
        messageCount: asNumber(record.messageCount) ?? 0,
      },
    ];
  });
}

export function readTasks(value: unknown): DesktopTask[] {
  return asArray(value).flatMap((entry) => {
    const record = asRecord(entry);
    const id = record && asString(record.id);
    if (!record || !id) return [];
    const status = asString(record.status);
    const allowed: DesktopTask['status'][] = ['todo', 'doing', 'blocked', 'done'];
    return [
      {
        id,
        sessionId: asString(record.sessionId) ?? '',
        title: asString(record.title) ?? '',
        status: (allowed.find((candidate) => candidate === status) ?? 'todo') as DesktopTask['status'],
      },
    ];
  });
}

export function readRuns(value: unknown): DesktopRun[] {
  return asArray(value).flatMap((entry) => {
    const record = asRecord(entry);
    const runId = record && asString(record.runId);
    if (!record || !runId) return [];
    return [
      {
        runId,
        sessionId: asString(record.sessionId) ?? '',
        projectId: asString(record.projectId) ?? '',
        startedAt: asNumber(record.startedAt) ?? 0,
        status: asString(record.status) ?? 'running',
      },
    ];
  });
}

export function readProjects(value: unknown): DesktopProject[] {
  return asArray(value).flatMap((entry) => {
    const record = asRecord(entry);
    const id = record && asString(record.id);
    if (!record || !id) return [];
    const mode = asString(record.permissionMode);
    const modes: PermissionMode[] = ['ask', 'auto-edit', 'auto-run', 'full-auto'];
    return [
      {
        id,
        name: asString(record.name) ?? asString(record.path) ?? id,
        path: asString(record.path) ?? '',
        ...(asString(record.lastModel) ? { lastModel: asString(record.lastModel) as string } : {}),
        permissionMode: (modes.find((candidate) => candidate === mode) ?? 'ask') as PermissionMode,
      },
    ];
  });
}

export function readMessages(value: unknown): DesktopMessage[] {
  return asArray(value).flatMap((entry) => {
    const record = asRecord(entry);
    const id = record && asString(record.id);
    if (!record || !id) return [];
    const role = asString(record.role);
    const roles: DesktopMessage['role'][] = ['system', 'user', 'assistant', 'tool'];
    const toolCalls = asArray(record.toolCalls).flatMap((call) => {
      const parsed = asRecord(call);
      const callId = parsed && asString(parsed.id);
      if (!parsed || !callId) return [];
      return [
        {
          id: callId,
          name: asString(parsed.name) ?? 'verktyg',
          args: asRecord(parsed.args) ?? {},
        },
      ];
    });
    return [
      {
        id,
        role: (roles.find((candidate) => candidate === role) ?? 'assistant') as DesktopMessage['role'],
        content: asString(record.content) ?? '',
        createdAt: asNumber(record.createdAt) ?? 0,
        ...(toolCalls.length > 0 ? { toolCalls } : {}),
      },
    ];
  });
}

export function readApprovals(value: unknown): ApprovalRequest[] {
  return asArray(value).flatMap((entry) => {
    const record = asRecord(entry);
    const id = record && asString(record.id);
    const runId = record && asString(record.runId);
    if (!record || !id || !runId) return [];
    const risk = asString(record.risk);
    const risks = ['low', 'medium', 'high'] as const;
    const diff = readFileDiff(record.diff);
    return [
      {
        id,
        runId,
        kind: (asString(record.kind) ?? 'file_write') as ApprovalRequest['kind'],
        title: asString(record.title) ?? 'Godkännande krävs',
        detail: asString(record.detail) ?? '',
        risk: (risks.find((candidate) => candidate === risk) ?? 'medium') as ApprovalRequest['risk'],
        reason: asString(record.reason) ?? '',
        hardBlock: asBoolean(record.hardBlock),
        createdAt: asNumber(record.createdAt) ?? 0,
        ...(asString(record.path) ? { path: asString(record.path) as string } : {}),
        ...(asString(record.command) ? { command: asString(record.command) as string } : {}),
        ...(asString(record.cwd) ? { cwd: asString(record.cwd) as string } : {}),
        ...(asString(record.url) ? { url: asString(record.url) as string } : {}),
        ...(Array.isArray(record.args)
          ? { args: record.args.filter((arg): arg is string => typeof arg === 'string') }
          : {}),
        ...(diff ? { diff } : {}),
      },
    ];
  });
}

export function readFileDiff(value: unknown): import('./types').FileDiff | null {
  const record = asRecord(value);
  if (!record) return null;
  const path = asString(record.path);
  if (!path) return null;

  const hunks = asArray(record.hunks).flatMap((entry) => {
    const hunk = asRecord(entry);
    if (!hunk) return [];
    return [
      {
        oldStart: asNumber(hunk.oldStart) ?? 0,
        oldLines: asNumber(hunk.oldLines) ?? 0,
        newStart: asNumber(hunk.newStart) ?? 0,
        newLines: asNumber(hunk.newLines) ?? 0,
        lines: asArray(hunk.lines).filter((line): line is string => typeof line === 'string'),
      },
    ];
  });

  const kind = asString(record.kind);
  const kinds = ['create', 'update', 'delete'] as const;

  return {
    id: asString(record.id) ?? path,
    path,
    kind: (kinds.find((candidate) => candidate === kind) ?? 'update') as 'create' | 'update' | 'delete',
    hunks,
    oldContent: asString(record.oldContent) ?? '',
    newContent: asString(record.newContent) ?? '',
    additions: asNumber(record.additions) ?? 0,
    deletions: asNumber(record.deletions) ?? 0,
    ...(asBoolean(record.binary) ? { binary: true } : {}),
  };
}

// ---------------------------------------------------------------------------
// Översättning till mobilens typer
// ---------------------------------------------------------------------------

/** Skrivbordets fasnamn är samma strängar som mobilen visar. */
export function toPhase(value: unknown): AgentPhase {
  const phases: AgentPhase[] = [
    'idle',
    'connecting',
    'building-context',
    'thinking',
    'waiting-approval',
    'executing-tool',
    'reflecting',
    'writing',
    'testing',
    'done',
  ];
  const phase = asString(value);
  return phases.find((candidate) => candidate === phase) ?? 'idle';
}

export function toMissionSteps(tasks: DesktopTask[]): MissionStep[] {
  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    status:
      task.status === 'done'
        ? 'done'
        : task.status === 'doing'
          ? 'active'
          : task.status === 'blocked'
            ? 'failed'
            : 'pending',
  }));
}

/**
 * Status för en mission. Godkännande går före allt annat: behöver agenten ett svar är det den
 * viktigaste upplysningen för användaren. Körningar ("running"/"finished") kommer därefter.
 */
export function toMissionStatus(input: {
  runs: DesktopRun[];
  approvals: ApprovalRequest[];
}): { status: MissionStatus; phase: AgentPhase } {
  if (input.approvals.length > 0) return { status: 'waiting-approval', phase: 'waiting-approval' };
  const running = input.runs.find((run) => run.status === 'running');
  if (running) return { status: 'running', phase: 'executing-tool' };
  if (input.runs.length > 0) {
    const last = input.runs[input.runs.length - 1];
    if (last && last.status !== 'running') return { status: 'idle', phase: 'idle' };
  }
  return { status: 'idle', phase: 'idle' };
}

export function toMission(
  session: DesktopSession,
  context: {
    tasks: DesktopTask[];
    runs: DesktopRun[];
    approvals: ApprovalRequest[];
    files: FileChange[];
  },
): Mission {
  const { status, phase } = toMissionStatus({
    runs: context.runs,
    approvals: context.approvals,
  });
  return {
    id: session.id,
    projectId: session.projectId,
    title: session.title,
    status,
    phase,
    steps: toMissionSteps(context.tasks),
    files: context.files,
    needsApproval: context.approvals.length > 0,
    model: session.model || null,
    updatedAt: session.updatedAt,
  };
}

/** Verktygsanrop i en chatt visas kompakt: namn, kort sammanfattning och status. */
export function toToolCallSummaries(message: DesktopMessage): ToolCallSummary[] {
  return (message.toolCalls ?? []).map((call) => {
    const target = firstStringArg(call.args);
    return {
      id: call.id,
      name: call.name,
      status: 'ok' as const,
      summary: target ? `${call.name} ${target}` : call.name,
    };
  });
}

function firstStringArg(args: Record<string, unknown>): string | null {
  for (const key of ['path', 'file', 'command', 'cmd', 'query', 'pattern', 'url']) {
    const value = args[key];
    if (typeof value === 'string' && value.trim() !== '') return value;
  }
  return null;
}

export function toChatMessage(message: DesktopMessage): ChatMessage {
  const toolCalls = toToolCallSummaries(message);
  return {
    id: message.id,
    role: message.role === 'tool' ? 'system' : message.role,
    text: message.content,
    createdAt: message.createdAt,
    ...(toolCalls.length > 0 ? { toolCalls } : {}),
  };
}

/** Terminal- och verktygsmeddelanden blir loggrader i mobilens loggflik. */
export function toTerminalEntry(message: DesktopMessage): TerminalEntry {
  const command = message.toolCalls?.find((call) => call.name === 'run_terminal_command');
  const fromCommand = command ? firstStringArg(command.args) : null;
  return {
    id: message.id,
    kind: fromCommand ? 'command' : message.role === 'tool' ? 'stdout' : 'system',
    text: message.content,
    ...(fromCommand ? { command: fromCommand } : {}),
    createdAt: message.createdAt,
  };
}

export function toProjectSummary(project: DesktopProject): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    path: project.path,
    permissionMode: project.permissionMode,
  };
}

/** Filändringar för en mission. Git-status är den enda listan skrivbordet har per projekt. */
export function toFileChanges(gitFiles: { path: string }[]): FileChange[] {
  return gitFiles.map((file) => ({ path: file.path, kind: 'update' as const, additions: 0, deletions: 0 }));
}
