/**
 * Protokollet mellan Freevobe Mobile och Freevobe Desktop.
 *
 * Typerna speglar skrivbordsappens egna typer (vibeforge/packages/protocol) så att HTTP-adaptern blir
 * en tunn översättning i stället för en gissning. Mobilappen lägger bara till de aggregerade vyer den
 * visar: missions, loggrader och en snapshot av datorns status.
 */

// ---------------------------------------------------------------------------
// Anslutning
// ---------------------------------------------------------------------------

/** Svaret från `GET /api/health`. */
export interface DesktopHealth {
  ok: boolean;
  name: string;
  protocol: number;
  port: number;
  node?: string;
  uptimeSeconds?: number;
}

/** En sparad dator. `token` ligger i nyckelringen, aldrig i vanlig lagring. */
export interface SavedDesktop {
  id: string;
  label: string;
  /** Basadress utan avslutande snedstreck, t.ex. http://192.168.1.20:4319 */
  url: string;
  token: string;
  addedAt: number;
  lastConnectedAt?: number;
}

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'unauthorized'
  | 'unreachable';

export interface DesktopSnapshot {
  health: DesktopHealth;
  /** Namnet på den modell som är vald i skrivbordsappen. */
  activeModel: string | null;
  projects: ProjectSummary[];
  activeSessions: number;
  pendingApprovals: number;
}

export interface ProjectSummary {
  id: string;
  name: string;
  path: string;
  permissionMode: PermissionMode;
}

export type PermissionMode = 'ask' | 'auto-edit' | 'auto-run' | 'full-auto';

// ---------------------------------------------------------------------------
// Missions (mobilens vy över sessioner och körningar)
// ---------------------------------------------------------------------------

export type AgentPhase =
  | 'idle'
  | 'connecting'
  | 'building-context'
  | 'thinking'
  | 'waiting-approval'
  | 'executing-tool'
  | 'reflecting'
  | 'writing'
  | 'testing'
  | 'done';

export type MissionStatus =
  | 'running'
  | 'waiting-approval'
  | 'done'
  | 'failed'
  | 'aborted'
  | 'idle';

export interface MissionStep {
  id: string;
  title: string;
  status: 'pending' | 'active' | 'done' | 'failed';
}

export interface FileChange {
  path: string;
  kind: FileChangeKind;
  additions: number;
  deletions: number;
}

export interface Mission {
  /** Sessionens id i skrivbordsappen. */
  id: string;
  projectId: string;
  title: string;
  status: MissionStatus;
  phase: AgentPhase;
  steps: MissionStep[];
  files: FileChange[];
  needsApproval: boolean;
  model: string | null;
  updatedAt: number;
}

export interface MissionDetail extends Mission {
  approvals: ApprovalRequest[];
  logs: TerminalEntry[];
  messages: ChatMessage[];
  diff: FileDiff | null;
  tests: TestSummary | null;
}

// ---------------------------------------------------------------------------
// Chatt och verktyg
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  createdAt: number;
  toolCalls?: ToolCallSummary[];
}

export interface ToolCallSummary {
  id: string;
  name: string;
  status: 'running' | 'ok' | 'failed';
  /** Kort mänsklig sammanfattning, t.ex. "read_file src/app.tsx". */
  summary: string;
  durationMs?: number;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  callId: string;
  name: string;
  ok: boolean;
  content: string;
  error?: string;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Godkännanden och diffar
// ---------------------------------------------------------------------------

export type ApprovalKind =
  | 'file_write'
  | 'file_delete'
  | 'terminal'
  | 'browser'
  | 'network'
  | 'mcp'
  | 'git_commit'
  | 'user_question';

export type RiskLevel = 'low' | 'medium' | 'high';

export type ApprovalDecision = 'approved' | 'rejected';

export interface ApprovalRequest {
  id: string;
  runId: string;
  kind: ApprovalKind;
  title: string;
  detail: string;
  risk: RiskLevel;
  reason: string;
  /** Sant när policyn vägrar även i full-auto – måste alltid godkännas separat på telefonen. */
  hardBlock: boolean;
  path?: string;
  command?: string;
  args?: string[];
  cwd?: string;
  url?: string;
  diff?: FileDiff;
  createdAt: number;
}

export interface ApprovalAnswer {
  decision: ApprovalDecision;
  answers?: Record<string, string[]>;
  rememberForSession?: boolean;
}

export type FileChangeKind = 'create' | 'update' | 'delete';

export interface FileDiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

export interface FileDiff {
  id: string;
  path: string;
  kind: FileChangeKind;
  hunks: FileDiffHunk[];
  oldContent: string;
  newContent: string;
  additions: number;
  deletions: number;
  binary?: boolean;
}

export interface GitFileStatus {
  path: string;
  index: string;
  worktree: string;
  staged: boolean;
}

export interface GitStatus {
  branch: string;
  ahead?: number;
  behind?: number;
  files: GitFileStatus[];
}

// ---------------------------------------------------------------------------
// Körningar, loggar och tester
// ---------------------------------------------------------------------------

export interface TerminalEntry {
  id: string;
  runId?: string;
  kind: 'command' | 'stdout' | 'stderr' | 'system' | 'test';
  text: string;
  command?: string;
  exitCode?: number;
  createdAt: number;
}

export interface TestSummary {
  passed: number;
  failed: number;
  command: string;
  output: string;
  createdAt: number;
}

/** Händelser som skrivbordsappen strömmar över `GET /api/runs/:runId/events`. */
export type AgentEvent =
  | { type: 'run_started'; runId: string; sessionId: string; model: string }
  | { type: 'status'; runId: string; phase: AgentPhase; message?: string }
  | { type: 'assistant_delta'; runId: string; text: string }
  | { type: 'assistant_message'; runId: string; text: string; messageId: string }
  | { type: 'plan'; runId: string; steps: MissionStep[] }
  | { type: 'tool_call'; runId: string; call: ToolCall }
  | { type: 'tool_result'; runId: string; result: ToolResult }
  | { type: 'approval_request'; runId: string; request: ApprovalRequest }
  | { type: 'approval_resolved'; runId: string; approvalId: string; decision: ApprovalDecision }
  | { type: 'diff'; runId: string; diff: FileDiff }
  | { type: 'file_changed'; runId: string; path: string; kind: FileChangeKind }
  | { type: 'terminal'; runId: string; entry: TerminalEntry }
  | { type: 'tests'; runId: string; tests: TestSummary }
  | { type: 'error'; runId: string; code: string; message: string }
  | {
      type: 'run_finished';
      runId: string;
      reason: 'final' | 'aborted' | 'error' | 'loop_limit' | 'rejected';
      summary?: string;
    };

/** Allt mobilappen behöver skicka för att starta en körning. */
export interface SendPromptInput {
  sessionId: string;
  prompt: string;
  model?: string;
}

export interface StartRunResult {
  runId: string;
  eventsUrl: string;
}
