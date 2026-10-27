import type { ContextFile, FileDiff, ToolCall, ToolResult } from './tools.js';

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
  | { type: 'tool_call'; runId: string; call: ToolCall }
  | { type: 'tool_result'; runId: string; result: ToolResult }
  | { type: 'context'; runId: string; files: ContextFile[]; chars: number; fromCache: boolean }
  | { type: 'approval_request'; runId: string; request: ApprovalRequest }
  | { type: 'approval_resolved'; runId: string; approvalId: string; decision: ApprovalDecision }
  | { type: 'diff'; runId: string; diff: FileDiff }
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
      reason: 'final' | 'aborted' | 'error' | 'loop_limit' | 'rejected';
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
  | 'internal_error';

export interface GitFileStatus {
  path: string;
  index: string;
  worktree: string;
  staged: boolean;
}
