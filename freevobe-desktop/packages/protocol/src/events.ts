import type { Checkpoint } from './checkpoints.js';
import type { Plan } from './plans.js';
import type { ContextFile, FileDiff, ToolCall, ToolResult } from './tools.js';
import type {
  VerificationCheckResult,
  VerificationCommand,
  VerificationReport,
} from './verification.js';

export type AgentPhase =
  | 'idle'
  | 'connecting'
  | 'building-context'
  | 'thinking'
  /** Första token dröjer: Ollama laddar in modellen i minnet. */
  | 'loading-model'
  | 'waiting-approval'
  | 'executing-tool'
  | 'reflecting'
  | 'writing'
  | 'testing'
  | 'done';

export type PermissionMode = 'ask' | 'auto-edit' | 'auto-run' | 'full-auto';

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

/**
 * Kategorier som behörighetspolicyn delar in verktygsanrop i. Användaren kan auto-godkänna en
 * kategori i taget, oavsett behörighetsläge – men aldrig hårda block (farliga kommandon,
 * webbläsarautomation och icke-godkända MCP-servrar).
 */
export type ApprovalCategory =
  'file_write' | 'command' | 'test' | 'git' | 'network' | 'mcp' | 'browser' | 'other';

export interface ApprovalRequest {
  id: string;
  runId: string;
  kind: ApprovalKind;
  title: string;
  detail: string;
  risk: RiskLevel;
  /** Varför godkännande krävs (t.ex. "behörighetsläge: ask"). Visas för användaren. */
  reason: string;
  /** Sant när policyn vägrar även i full-auto och användaren måste svara personligen. */
  hardBlock: boolean;
  path?: string;
  command?: string;
  args?: string[];
  cwd?: string;
  url?: string;
  diff?: FileDiff;
  /** Frågor från `ask_user`-verktyget. */
  questions?: ApprovalQuestion[];
  createdAt: number;
}

export interface ApprovalQuestion {
  id: string;
  header: string;
  question: string;
  options: { label: string; description?: string }[];
  multiSelect?: boolean;
}

export type ApprovalDecision = 'approved' | 'rejected';

export interface ApprovalAnswer {
  approvalId: string;
  decision: ApprovalDecision;
  /** Fritextsvar eller valda alternativ per fråga (för `ask_user`). */
  answers?: Record<string, string[]>;
  rememberForSession?: boolean;
}

export interface SubagentStatus {
  id: string;
  runId: string;
  kind: SubagentKind;
  label: string;
  status: 'queued' | 'running' | 'done' | 'failed' | 'aborted';
  summary?: string;
  startedAt: number;
  finishedAt?: number;
}

export type SubagentKind = 'explorer' | 'implementer' | 'tester' | 'reviewer' | 'documenter';

export interface HookEvent {
  name: HookName;
  matched: boolean;
  blocked: boolean;
  output?: string;
}

export type HookName =
  | 'on_session_start'
  | 'before_file_edit'
  | 'after_file_edit'
  | 'before_terminal_command'
  | 'after_terminal_command'
  | 'before_test_run'
  | 'after_test_run'
  | 'before_commit'
  | 'after_commit';

export interface TerminalChunk {
  stream: 'stdout' | 'stderr' | 'system';
  text: string;
}

/** Händelser som agent-loopen strömmar. UI:t ritar allt utifrån dessa. */
export type AgentEvent =
  | { type: 'run_started'; runId: string; sessionId: string; model: string; mode: PermissionMode }
  | { type: 'status'; runId: string; phase: AgentPhase; message?: string }
  | { type: 'assistant_delta'; runId: string; text: string }
  | { type: 'reasoning_delta'; runId: string; text: string }
  | { type: 'assistant_message'; runId: string; text: string; messageId: string }
  | {
      type: 'plan';
      runId: string;
      steps: { id: string; title: string; status: 'pending' | 'active' | 'done' }[];
    }
  /** En plan har lagts fram och väntar på användarens beslut. */
  | { type: 'plan_proposed'; runId: string; plan: Plan }
  /** Användaren godkände eller avvisade planen. */
  | { type: 'plan_decided'; runId: string; planId: string; status: Plan['status'] }
  | { type: 'tool_call'; runId: string; call: ToolCall }
  | { type: 'tool_result'; runId: string; result: ToolResult }
  | { type: 'context'; runId: string; files: ContextFile[]; chars: number; fromCache: boolean }
  | { type: 'approval_request'; runId: string; request: ApprovalRequest }
  | { type: 'approval_resolved'; runId: string; approvalId: string; decision: ApprovalDecision }
  | { type: 'diff'; runId: string; diff: FileDiff }
  | { type: 'checkpoint'; runId: string; checkpoint: Checkpoint }
  | { type: 'file_changed'; runId: string; path: string; kind: 'create' | 'update' | 'delete' }
  | { type: 'terminal'; runId: string; chunk: TerminalChunk }
  | { type: 'subagent'; runId: string; subagent: SubagentStatus }
  | { type: 'hook'; runId: string; hook: HookEvent }
  | {
      type: 'tests';
      runId: string;
      passed: number;
      failed: number;
      command: string;
      output: string;
    }
  /** Verifieringen startar: vilka steg som ska köras och varför. */
  | {
      type: 'verification_started';
      runId: string;
      trigger: VerificationReport['trigger'];
      commands: VerificationCommand[];
    }
  /** Ett verifieringssteg är klart. */
  | { type: 'verification_check'; runId: string; check: VerificationCheckResult }
  /** Hela rapporten. Skickas också när verifieringen hoppades över. */
  | { type: 'verification'; runId: string; report: VerificationReport }
  | {
      type: 'git';
      runId: string;
      branch: string;
      ahead?: number;
      behind?: number;
      files: GitFileStatus[];
    }
  | { type: 'usage'; runId: string; promptTokens: number; completionTokens: number }
  | { type: 'error'; runId: string; code: AgentErrorCode; message: string; detail?: string }
  | {
      type: 'run_finished';
      runId: string;
      reason: 'final' | 'aborted' | 'error' | 'loop_limit' | 'rejected' | 'plan-ready';
      summary?: string;
    };

export type AgentErrorCode =
  | 'ollama_unavailable'
  | 'model_missing'
  | 'tool_not_found'
  | 'tool_invalid_args'
  | 'tool_failed'
  | 'policy_blocked'
  | 'approval_rejected'
  | 'loop_limit'
  | 'aborted'
  | 'context_budget_exceeded'
  | 'transport_error'
  | 'verification_failed'
  | 'internal_error';

export interface GitFileStatus {
  path: string;
  index: string;
  worktree: string;
  staged: boolean;
}
