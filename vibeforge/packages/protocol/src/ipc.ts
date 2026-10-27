import type { ContextFile, ProjectRepoMapEntry } from './tools.js';
import type { AgentPhase, PermissionMode } from './events.js';

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

export interface SkillSummary {
  name: string;
  description: string;
  tools: string[];
  triggers: string[];
  source: 'builtin' | 'project' | 'user';
  path?: string;
  chars: number;
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

export interface AdsConfig {
  provider: 'none' | 'custom' | 'adsense';
  everyNPrompts: number;
  enabled: boolean;
  consentedAt?: number;
  custom?: {
    headline: string;
    body: string;
    ctaLabel: string;
    ctaUrl: string;
    imageUrl?: string;
  };
}

export interface AppSettings {
  ollamaBaseUrl: string;
  defaultModel: string;
  permissionMode: PermissionMode;
  theme: 'dark' | 'light';
  contextBudgetChars: number;
  maxIterations: number;
  telemetry: false;
  allowCloudServices: boolean;
  ads: AdsConfig;
  browserAutomationEnabled: boolean;
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
