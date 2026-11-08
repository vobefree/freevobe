import type { ContextFile, ProjectRepoMapEntry } from './tools.js';
import type { AgentPhase, ApprovalCategory, PermissionMode } from './events.js';
import type { GivesBackConfig } from './gives-back.js';
import type { ProviderPreferences } from './providers.js';

export interface OllamaModel {
  name: string;
  sizeBytes: number;
  parameterSize: string;
  quantization?: string;
  family?: string;
  contextLength: number;
  supportsTools: boolean;
  modifiedAt?: string;
}

export interface OllamaProbeResult {
  available: boolean;
  baseUrl: string;
  version?: string;
  models: OllamaModel[];
  error?: string;
  helpUrl: string;
}

export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  createdAt: number;
  /** Anrop som modellen begärde i detta meddelande. */
  toolCalls?: { id: string; name: string; args: Record<string, unknown> }[];
  toolCallId?: string;
  reasoning?: string;
  model?: string;
  /** Används av UI:t för att visa vilka filer svaret byggde på. */
  contextFiles?: ContextFile[];
}

export interface Session {
  id: string;
  projectId: string;
  title: string;
  mode: 'plan' | 'execute';
  model: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export interface Project {
  id: string;
  path: string;
  name: string;
  lastModel?: string;
  permissionMode: PermissionMode;
  createdAt: number;
  lastOpenedAt: number;
}

export interface TaskItem {
  id: string;
  title: string;
  status: 'todo' | 'doing' | 'blocked' | 'done';
  sessionId: string;
  createdAt: number;
}

/**
 * Kända källor för importerade skills. Samma värden skrivs i frontmattern som `source:` så att
 * en ny import kan kännas igen och erbjudas som uppdatering i stället för dubblett.
 */
export type SkillFormatSource =
  | 'claude'
  | 'cursor'
  | 'agents_md'
  | 'copilot'
  | 'codex'
  | 'opencode'
  | 'windsurf'
  | 'cline'
  | 'generic';

export interface SkillSummary {
  name: string;
  description: string;
  tools: string[];
  triggers: string[];
  source: 'builtin' | 'project' | 'user';
  path?: string;
  chars: number;
  /** Filglobs från t.ex. Cursor-regler. Tom = ingen filbegränsning. */
  globs?: string[];
  /** Sant för regeldokument som AGENTS.md – skillen gäller alltid. */
  alwaysApply?: boolean;
  /** Var skillen kom ifrån när den importerats från en annan agent. */
  importedFrom?: SkillFormatSource;
  /** Repo som skillen importerades från, t.ex. `owner/repo`. */
  sourceRepo?: string;
  /** Författare från frontmattern eller repo-ägaren. */
  author?: string;
  /** Klickbar källa: repo-adress med filsökväg, eller lokal sökväg. */
  sourceUrl?: string;
  /** När skillen importerades, ISO-datum. */
  importedAt?: string;
}

export interface McpServerConfig {
  id: string;
  name: string;
  transport: 'stdio' | 'http' | 'sse';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  enabled: boolean;
  /** Kräver användarens godkännande innan verktyg från servern får köras. */
  requireApproval: boolean;
  /** Säkerhetsvarningar som visas i UI:t (t.ex. filsystem-åtkomst, nätverk, databas). */
  warnings: string[];
}

export interface McpServerStatus {
  id: string;
  connected: boolean;
  toolCount: number;
  resourceCount: number;
  promptCount: number;
  serverName?: string;
  serverVersion?: string;
  protocolVersion?: string;
  error?: string;
}

export interface HookConfig {
  name: string;
  event: string;
  command: string;
  /** Tom = alla filer. Globs matchas mot projektrelativa sökvägar. */
  filePattern?: string;
  /** Blockerar åtgärden om kommandot ger exit != 0. */
  blockOnFailure: boolean;
  enabled: boolean;
  timeoutMs: number;
}

export interface AppSettings {
  ollamaBaseUrl: string;
  defaultModel: string;
  permissionMode: PermissionMode;
  /** Auto-godkännande per kategori. Frånkopplade kategorier följer behörighetsläget. */
  autoApprove: Record<ApprovalCategory, boolean>;
  theme: 'dark' | 'light';
  contextBudgetChars: number;
  maxIterations: number;
  telemetry: false;
  allowCloudServices: boolean;
  /** Frivillig välgörenhetsplats i chatten. Ingen reklam, inga pengar genom appen. */
  givesBack: GivesBackConfig;
  browserAutomationEnabled: boolean;
  /** Kör typkontroll, lint och tester automatiskt efter en körning som ändrat filer. */
  verifyAfterRun: boolean;
  /** Vilka modellkällor som är påslagna och vem som genererar bild, video och ljud. */
  providers: ProviderPreferences;
  /** Dagligt tak för uppskattad mediekostnad i USD. 0 betyder ingen gräns. */
  mediaDailyBudgetUsd: number;
  updatedAt: number;
}

export interface DoctorCheck {
  id: string;
  label: string;
  status: 'ok' | 'warn' | 'fail';
  detail: string;
  fix?: string;
}

export interface DoctorReport {
  generatedAt: number;
  checks: DoctorCheck[];
  summary: { ok: number; warn: number; fail: number };
}

export interface RepoMapPayload {
  projectPath: string;
  generatedAt: number;
  entries: ProjectRepoMapEntry[];
  fileCount: number;
}

export interface AgentStatusPayload {
  runId?: string;
  phase: AgentPhase;
  model: string;
  sessionId?: string;
  projectId?: string;
}

export interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}
