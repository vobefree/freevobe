import type { JsonSchema } from './json-schema.js';

/** Alla inbyggda verktyg Freevobe-agenten kan anropa. MCP-verktyg har formen `mcp__<server>__<tool>`. */
export type BuiltinToolName =
  | 'list_files'
  | 'read_file'
  | 'search_files'
  | 'write_file'
  | 'edit_file'
  | 'create_file'
  | 'delete_file'
  | 'run_terminal_command'
  | 'run_tests'
  | 'git_status'
  | 'git_diff'
  | 'git_commit'
  | 'git_branch'
  | 'web_fetch'
  | 'browser_open'
  | 'browser_read'
  | 'browser_screenshot'
  | 'browser_click'
  | 'browser_fill'
  | 'ask_user'
  | 'propose_plan'
  | 'run_verification';

export type ToolName = BuiltinToolName | (string & {});

/** Hur farligt ett verktyg är. `execute`, `write` och `network` kräver godkännande som standard. */
export type ToolDanger = 'safe' | 'write' | 'execute' | 'network';

export type ToolSource = 'builtin' | 'mcp' | 'skill' | 'connector';

export interface McpToolOrigin {
  server: string;
  originalName: string;
}

export interface ToolSpec {
  name: string;
  description: string;
  parameters: JsonSchema;
  danger: ToolDanger;
  source: ToolSource;
  /** Sant när verktyget inte får köras utan att användaren klickat ja (oavsett behörighetsläge). */
  alwaysRequiresApproval?: boolean;
  origin?: McpToolOrigin;
  /** Id för connectorn som äger verktyget, t.ex. "vercel". Utelämnas för inbyggda verktyg. */
  connectorId?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  /** Rå argumentsträng som modellen skickade – används för felsökning och loggar. */
  rawArguments?: string;
}

export interface ToolResult {
  callId: string;
  name: string;
  ok: boolean;
  /** Text som skickas tillbaka till modellen. Alltid trunkerad till maxToolOutputChars. */
  content: string;
  /** Strukturerad extra data för UI:t (t.ex. changedFiles, exitCode, diffId). */
  data?: Record<string, unknown>;
  error?: string;
  durationMs: number;
}

/** Filändringstyper som agenten kan föreslå. */
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
  absolutePath: string;
  kind: FileChangeKind;
  hunks: FileDiffHunk[];
  /** Fullständigt nytt filinnehåll efter ändringen. */
  newContent: string;
  /** Fullständigt innehåll före ändringen (tom sträng för nya filer). */
  oldContent: string;
  additions: number;
  deletions: number;
  binary?: boolean;
}

export interface ContextFile {
  path: string;
  reason: 'pinned' | 'recent-diff' | 'keyword' | 'embedding' | 'import-neighbour' | 'explicit';
  chars: number;
  truncated: boolean;
}

export interface ProjectRepoMapEntry {
  path: string;
  size: number;
  lines: number;
  language: string;
  symbols: string[];
  imports: string[];
}
