import type {
  AgentEvent,
  ApprovalKind,
  ApprovalQuestion,
  FileChangeKind,
  FileDiff,
  RiskLevel,
  ToolResult,
  ToolSpec,
} from '@freevobe/protocol';
import type { BrowserDriver } from './browser.js';

/** Hur ett verktyg ska hantera godkännande, enligt policyn som loopen redan kört. */
export interface ApprovalPolicy {
  required: boolean;
  risk: RiskLevel;
  reason: string;
  hardBlock: boolean;
}

export interface ApprovalOutcome {
  approved: boolean;
  answers?: Record<string, string[]>;
}

export interface ProposedChange {
  /** Projektrelativ sökväg. */
  path: string;
  kind: FileChangeKind;
  /** Nytt innehåll för create/update. Utelämnas för delete. */
  newContent?: string;
}

export interface ChangeResult {
  diff: FileDiff;
  applied: boolean;
  /** Text som skickas tillbaka till modellen. */
  summary: string;
}

/** Resultat av ett skal-kommando. `passed`/`failed` fylls i när kommandot tolkats som en testkörning. */
export interface CommandResult {
  command: string;
  exitCode: number | null;
  passed: number;
  failed: number;
  output: string;
  timedOut: boolean;
}

export interface ToolContext {
  /** Absolut sökväg till projektroten. Alla filsökvägar är relativa till denna. */
  root: string;
  projectId: string;
  sessionId: string;
  runId: string;
  signal: AbortSignal;
  approval: ApprovalPolicy;
  emit(event: AgentEvent): void;
  /** Ber användaren om godkännande (visas i UI:t, oavsett behörighetsläge när policyn kräver det). */
  requestApproval(request: {
    kind: ApprovalKind;
    title: string;
    detail: string;
    reason: string;
    risk: RiskLevel;
    hardBlock: boolean;
    path?: string;
    command?: string;
    args?: string[];
    cwd?: string;
    url?: string;
    diff?: FileDiff;
    questions?: ApprovalQuestion[];
  }): Promise<ApprovalOutcome>;
  /** Diffar, godkänner, kör hooks och skriver filen. Returnerar diffen. */
  proposeChange(change: ProposedChange): Promise<ChangeResult>;
  /** Kör en hook-kedja (t.ex. before_file_edit) och returnerar om den blockerade. */
  runHooks(
    name: string,
    payload: Record<string, unknown>,
  ): Promise<{ blocked: boolean; output: string }>;
  /** Kör ett skal-kommando med strömmande utdata. Används av terminal-, test- och git-verktyg. */
  exec(
    command: string,
    options?: { cwd?: string; timeoutMs?: number; env?: Record<string, string> },
  ): Promise<CommandResult>;
  /** Hittar projektets testkommando (package.json, pytest, cargo eller projektminne). */
  detectTestCommand(): Promise<string | null>;
  /** Låter modellen föreslå ett commit-meddelande utifrån diffen. */
  generateCommitMessage?: (diff: string) => Promise<string>;
  browser?: BrowserDriver;
  fetchImpl: typeof fetch;
  /** Standard för bentid och utdatatak, delas av alla verktyg. */
  limits: { terminalTimeoutMs: number; maxOutputChars: number };
}

export type ToolHandler = (
  args: Record<string, unknown>,
  ctx: ToolContext,
) => Promise<Omit<ToolResult, 'callId' | 'name' | 'durationMs'>>;

export interface RegisteredTool {
  spec: ToolSpec;
  handler: ToolHandler | null;
  /** MCP-verktyg körs via en extern klient i stället för en lokal handler. */
  remote?: (
    name: string,
    args: Record<string, unknown>,
    ctx: ToolContext,
  ) => Promise<Omit<ToolResult, 'callId' | 'name' | 'durationMs'>>;
}

export function ok(
  content: string,
  data?: Record<string, unknown>,
): Omit<ToolResult, 'callId' | 'name' | 'durationMs'> {
  return data ? { ok: true, content, data } : { ok: true, content };
}

export function fail(
  error: string,
  data?: Record<string, unknown>,
): Omit<ToolResult, 'callId' | 'name' | 'durationMs'> {
  return data ? { ok: false, content: error, error, data } : { ok: false, content: error, error };
}

/** Läser ett obligatoriskt strängargument utan att kasta – felet går tillbaka till modellen. */
export function stringArg(args: Record<string, unknown>, key: string): string | null {
  const value = args[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function numberArg(args: Record<string, unknown>, key: string, fallback: number): number {
  const value = args[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)))
    return Number(value);
  return fallback;
}

export function booleanArg(args: Record<string, unknown>, key: string, fallback = false): boolean {
  const value = args[key];
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true';
  return fallback;
}
