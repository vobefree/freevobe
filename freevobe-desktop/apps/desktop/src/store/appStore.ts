import {
  clampShare,
  readQoderMode,
  readThemeMode,
  saveQoderMode,
  saveThemeMode,
  systemPrefersDark,
  type ResolvedTheme,
  type ThemeMode,
} from '../lib/theme';
import { readViewMode, saveViewMode, type ViewMode } from '../lib/viewMode';
import { readPaneLayout, savePaneLayout } from '../lib/paneLayout';
import { create } from 'zustand';
import type {
  AgentEvent,
  AppSettings,
  ApprovalAnswer,
  ApprovalCategory,
  ApprovalRequest,
  ChatMessage,
  Checkpoint,
  CheckpointRestoreReport,
  ConnectorDisconnectResult,
  ConnectorSecretStorageInfo,
  ConnectorsResponse,
  ConnectorView,
  ContextFile,
  Contribution,
  DoctorReport,
  GivesBackSummary,
  FileDiff,
  McpServerConfig,
  McpServerStatus,
  MediaAsset,
  MediaKind,
  MediaLibraryResponse,
  OllamaModel,
  OllamaProbeResult,
  OutputType,
  PermissionMode,
  Plan,
  PlanStatus,
  PreviewStatus,
  RouterDecision,
  PullProgress,
  ModelPullResult,
  ProviderId,
  ProvidersResponse,
  Project,
  Session,
  SkillImportApplyItem,
  SkillImportApplyResult,
  SkillImportScan,
  SkillSummary,
  SubagentStatus,
  TaskItem,
  VerificationCheckResult,
  VerificationCommand,
  VerificationReport,
} from '@freevobe/protocol';
import { readStorage, writeStorage } from '../lib/storage';
import {
  AgentClient,
  AgentRequestError,
  resolveConnection,
  type AgentConnection,
} from '../lib/agentClient';
import i18n from '../i18n';
import { AUTO_APPROVE_LABELS } from '../lib/format';

export type RightTab =
  | 'diff'
  | 'terminal'
  | 'logs'
  | 'tests'
  | 'verify'
  | 'approvals'
  | 'checkpoints'
  | 'mcp'
  | 'gives'
  | 'media'
  | 'control';
export type CenterTab = 'editor' | 'preview' | 'search' | 'context';

export type TimelineKind =
  | 'run'
  | 'phase'
  | 'route'
  | 'tool'
  | 'result'
  | 'approval'
  | 'diff'
  | 'verify'
  | 'preview'
  | 'checkpoint'
  | 'error'
  | 'pull';

/** En rad i Control Room. Byggs från händelserna som redan strömmar genom agenten. */
export interface TimelineEntry {
  id: string;
  at: number;
  kind: TimelineKind;
  text: string;
  detail?: string;
}

export interface LogEntry {
  id: string;
  at: number;
  level: 'info' | 'warn' | 'error';
  text: string;
}

export interface TerminalLine {
  id: string;
  stream: 'stdout' | 'stderr' | 'system';
  text: string;
}

export interface EditorFile {
  path: string;
  content: string;
  original: string;
  dirty: boolean;
}

export interface PendingApproval extends ApprovalRequest {
  answered?: boolean;
}

export interface AppState {
  // anslutning
  connection: AgentConnection | null;
  client: AgentClient | null;
  connectionStatus: 'idle' | 'connecting' | 'ready' | 'error';
  connectionError: string | null;
  agentHelpUrl: string | null;

  // onboarding och inställningar
  onboardingComplete: boolean;
  onboardingStep: number;
  consentLocalData: boolean;
  consentGivesBack: boolean;
  settings: AppSettings | null;
  ollama: OllamaProbeResult | null;
  models: OllamaModel[];
  selectedModel: string;

  // projekt
  project: Project | null;
  projects: Project[];
  permissionMode: PermissionMode;

  // sessioner och chatt
  sessions: Session[];
  sessionId: string | null;
  messages: ChatMessage[];
  streamingText: string;
  reasoningText: string;
  phase: string;
  runId: string | null;
  isRunning: boolean;

  // verktyg och sidoeffekter
  diffs: FileDiff[];
  activeDiffId: string | null;
  terminal: TerminalLine[];
  logs: LogEntry[];
  approvals: PendingApproval[];
  subagents: SubagentStatus[];
  tasks: TaskItem[];
  /** Planer i den valda sessionen, nyast först. En godkänd plan är kontraktet. */
  plans: Plan[];
  checkpoints: Checkpoint[];
  checkpointBusy: string | null;
  /** Filer som hoppades över vid en återställning för att de ändrats sedan checkpointen. */
  checkpointConflicts: { checkpointId: string; paths: string[] } | null;
  testResult: { command: string; passed: number; failed: number; output: string } | null;
  /** Gives Back: användarens egna, lokala påverkanslogg. Inga betalningar, inget konto. */
  contributions: Contribution[];
  contributionsSummary: GivesBackSummary;
  /** Verifieringsmotorn: senaste rapporten, stegen som finns och pågående körning. */
  verification: VerificationReport | null;
  verificationCommands: VerificationCommand[];
  verificationProgress: VerificationCheckResult[];
  verificationRunning: boolean;
  /** Live-preview: dev-servern eller de statiska filerna, alltid på loopback. */
  preview: PreviewStatus | null;
  previewBusy: boolean;
  /** Control Room: allt som hänt i körningen, i ordning. */
  timeline: TimelineEntry[];
  /** Routerns svar för den senaste beställningen, när ingen modell duger. */
  routerDecision: RouterDecision | null;
  routerBusy: boolean;
  pullProgress: PullProgress | null;
  pullResult: ModelPullResult | null;
  pullBusy: boolean;
  contextFiles: ContextFile[];
  contextChars: number;
  gitStatus: {
    branch: string;
    files: { path: string; index: string; worktree: string }[];
    ahead: number;
    behind: number;
  } | null;

  // filer och editor
  tree: Array<{ path: string; size: number; lines: number; language: string; symbols: string[] }>;
  editorFile: EditorFile | null;
  pinnedFiles: string[];
  filesInContext: string[];

  // skills, MCP, minne, hooks, doctor
  skills: SkillSummary[];
  mcpServers: McpServerConfig[];
  mcpStatuses: McpServerStatus[];
  mcpExamples: McpServerConfig[];
  memory: string;
  doctor: DoctorReport | null;

  // connectors: opt-in-bryggor till externa tjänster
  connectors: ConnectorView[];
  connectorStorage: ConnectorSecretStorageInfo | null;
  connectorBusy: string | null;
  connectorMessage: string | null;

  // providers: katalogen över modellkällor och användarens val
  providers: ProvidersResponse | null;
  providerMessage: string | null;
  /** Beställning som kräver en provider som inte är påslagen – visas som en banner i chatten. */
  providerNotice: {
    outputType: OutputType;
    providers: ProviderId[];
    reason: 'local_only' | 'not_configured';
  } | null;

  // media: bilder, videor och ljud som agenten skapat i projektet
  mediaAssets: MediaAsset[];
  mediaLoading: boolean;
  mediaError: string | null;
  /** Media som skapades av en verktygskörning – visas som kort i chatten. */
  mediaResults: { id: string; at: number; files: string[] }[];

  // gränssnitt
  leftOpen: boolean;
  rightOpen: boolean;
  rightTab: RightTab;
  centerTab: CenterTab;
  paletteOpen: boolean;
  settingsOpen: boolean;
  skillsOpen: boolean;
  skillImportOpen: boolean;
  mcpOpen: boolean;
  doctorOpen: boolean;
  memoryOpen: boolean;
  searchQuery: string;
  searchResults: string[];
  mode: 'plan' | 'execute';
  treeOpen: boolean;

  // utseende och lägen
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  viewMode: ViewMode;
  qoderMode: boolean;
  /** Sant när chatten ligger ovanför editorn. */
  chatFirst: boolean;
  /** Hur stor del av höjden chatten får (0.2–0.8). */
  chatShare: number;
  sideChatOpen: boolean;
  sideChatSessionId: string | null;
  sideChatMessages: ChatMessage[];
  sideChatStreaming: string;
  sideChatBusy: boolean;

  // åtgärder
  bootstrap(): Promise<void>;
  connect(): Promise<void>;
  /** Öppnar senast använda projekt och ser till att en chatt finns, så chatten aldrig står död. */
  ensureWorkspace(): Promise<void>;
  refreshOllama(baseUrl?: string): Promise<void>;
  selectModel(model: string): void;
  updateSettings(patch: Partial<AppSettings>): Promise<void>;
  setAutoApprove(category: ApprovalCategory, enabled: boolean): Promise<void>;
  finishOnboarding(): void;
  setOnboardingStep(step: number): void;
  setConsent(patch: { localData?: boolean; givesBack?: boolean }): void;
  loadContributions(): Promise<void>;
  logContribution(input: { causeId: string; amountSek?: number; note?: string }): Promise<void>;
  deleteContribution(id: string): Promise<void>;

  openProject(path: string, name?: string): Promise<void>;
  refreshProjects(): Promise<void>;
  setPermissionMode(mode: PermissionMode): Promise<void>;
  setMode(mode: 'plan' | 'execute'): Promise<void>;

  newSession(): Promise<void>;
  loadSessions(): Promise<void>;
  selectSession(id: string): Promise<void>;
  deleteSession(id: string): Promise<void>;
  loadPlans(): Promise<void>;
  /**
   * Godkänner eller avvisar en plan. Ett godkännande växlar till Execute-läget; med `run: true`
   * skickas också "utför planen" som nästa prompt så att arbetet startar direkt.
   */
  decidePlan(
    planId: string,
    decision: 'approved' | 'rejected',
    options?: { run?: boolean },
  ): Promise<void>;

  sendPrompt(prompt: string): Promise<void>;
  abort(): Promise<void>;
  resolveApproval(
    id: string,
    decision: ApprovalAnswer['decision'],
    answers?: Record<string, string[]>,
  ): Promise<void>;

  loadTree(): Promise<void>;
  openFile(path: string, options?: { previewOnly?: boolean }): Promise<void>;
  updateEditorContent(content: string): void;
  saveEditorFile(): Promise<void>;
  togglePin(path: string): void;
  runSearch(query: string): Promise<void>;

  refreshSkills(): Promise<void>;
  copyBuiltinSkills(): Promise<void>;
  saveSkill(draft: {
    name: string;
    description: string;
    triggers?: string[];
    body?: string;
  }): Promise<void>;
  deleteSkill(name: string): Promise<void>;
  exportSkill(name: string): Promise<string>;
  importSkills(contents: string[]): Promise<number>;
  scanSkillImport(target?: string): Promise<SkillImportScan>;
  applySkillImport(items: SkillImportApplyItem[]): Promise<SkillImportApplyResult>;

  refreshMcp(): Promise<void>;
  saveMcpServers(servers: McpServerConfig[]): Promise<void>;
  connectMcp(serverId: string): Promise<void>;
  disconnectMcp(serverId: string): Promise<void>;

  refreshConnectors(): Promise<void>;
  connectConnector(id: string, secret: string, accountLabel?: string): Promise<void>;
  disconnectConnector(id: string): Promise<string[]>;
  setConnectorEnabled(id: string, enabled: boolean): Promise<void>;

  refreshProviders(): Promise<void>;
  setProviderEnabled(id: ProviderId, enabled: boolean): Promise<void>;
  saveProviderKey(id: ProviderId, key: string): Promise<void>;
  clearProviderKey(id: ProviderId): Promise<void>;
  setProviderMediaPreference(kind: MediaKind, providerId: string): Promise<void>;
  dismissProviderNotice(): void;
  /** Läser om projektets media-mapp. */
  loadMedia(): Promise<void>;

  refreshMemory(): Promise<void>;
  saveMemory(content: string): Promise<void>;
  runDoctor(): Promise<void>;

  refreshGit(): Promise<void>;
  refreshCheckpoints(): Promise<void>;
  createCheckpoint(label?: string): Promise<void>;
  showCheckpointDiff(id: string): Promise<void>;
  restoreCheckpoint(id: string, force?: boolean): Promise<void>;
  discardCheckpoint(id: string): Promise<void>;
  commitCheckpoint(id: string, message?: string): Promise<void>;
  runTests(): Promise<void>;
  refreshVerification(): Promise<void>;
  runVerification(kinds?: string[]): Promise<void>;
  /** Läser av preview-läget utan att starta något. */
  refreshPreview(): Promise<void>;
  startPreview(): Promise<void>;
  stopPreview(): Promise<void>;
  clearTimeline(): void;
  /** Frågar routern vad som behövs för en uppgift. Hämtar aldrig något. */
  checkModelFit(prompt: string): Promise<void>;
  /** Hämtar modellen i rekommendationen – bara efter ett tryck på knappen. */
  pullRecommendedModel(): Promise<void>;
  dismissRouterRecommendation(): void;
  commitAll(message: string): Promise<void>;
  suggestCommitMessage(): Promise<string>;
  runSubagent(kind: string, task: string): Promise<void>;

  clearTerminal(): void;
  toggleLeft(): void;
  toggleTree(): void;
  toggleRight(): void;
  setRightTab(tab: RightTab): void;
  setCenterTab(tab: CenterTab): void;
  setPalette(open: boolean): void;
  setSettingsOpen(open: boolean): void;
  setSkillsOpen(open: boolean): void;
  setSkillImportOpen(open: boolean): void;
  setMcpOpen(open: boolean): void;
  setDoctorOpen(open: boolean): void;
  setMemoryOpen(open: boolean): void;
  setActiveDiff(id: string): void;

  // utseende, vyläge och qoder
  setThemeMode(mode: ThemeMode): void;
  setResolvedTheme(theme: ResolvedTheme): void;
  setViewMode(mode: ViewMode): void;
  setQoder(enabled: boolean): void;
  toggleQoder(): void;
  setChatFirst(first: boolean): void;
  setChatShare(share: number): void;

  // sidchatt: en egen session vid sidan av huvudtråden
  ensureSideChatSession(): Promise<string | null>;
  toggleSideChat(): Promise<void>;
  closeSideChat(): void;
  sendSideChat(prompt: string): Promise<void>;
}

const LOG_LIMIT = 400;
const TERMINAL_LIMIT = 2_000;

/** Byter ut en connector i listan utan att röra ordningen (katalogen äger ordningen). */
function replaceConnector(connectors: ConnectorView[], view: ConnectorView): ConnectorView[] {
  return connectors.map((entry) => (entry.definition.id === view.definition.id ? view : entry));
}

function sideChatMessage(role: 'user' | 'assistant', content: string): ChatMessage {
  return {
    id: `side-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    createdAt: Date.now(),
  };
}

function logEntry(text: string, level: LogEntry['level'] = 'info'): LogEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    level,
    text,
  };
}

/**
 * Fel som avslutar hela körningen. De måste synas i chatten, inte bara i loggen: annars står
 * bubblan tom och det ser ut som att inget producerades, fast något gick fel.
 */
const FATAL_ERROR_CODES: ReadonlySet<string> = new Set([
  'ollama_unavailable',
  'model_missing',
  'transport_error',
  'empty_response',
  'no_deliverable',
  'internal_error',
  'loop_limit',
]);

/** Felmeddelandet i chatten. Rollen är assistent så att det hamnar i samtalet där svaret väntades. */
function failureMessage(text: string): ChatMessage {
  return {
    id: `error_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    role: 'assistant',
    content: `⚠️ ${text}`,
    createdAt: Date.now(),
  };
}

const TIMELINE_LIMIT = 400;

function timelineEntry(kind: TimelineKind, text: string, detail?: string): TimelineEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    kind,
    text,
    ...(detail ? { detail } : {}),
  };
}

/** Översätter en AgentEvent till en rad i Control Room. Okända händelser ger ingen rad. */
function timelineFor(event: AgentEvent): TimelineEntry | null {
  switch (event.type) {
    case 'run_started':
      return timelineEntry('run', `Körning startad med ${event.model}`, event.mode);
    case 'tool_call':
      return timelineEntry(
        'tool',
        `→ ${event.call.name}`,
        JSON.stringify(event.call.args).slice(0, 240),
      );
    case 'tool_result':
      return timelineEntry(
        'result',
        `← ${event.result.name} (${event.result.ok ? 'ok' : 'fel'}, ${event.result.durationMs} ms)`,
      );
    case 'approval_request':
      return timelineEntry('approval', `Godkännande: ${event.request.title}`, event.request.reason);
    case 'diff':
      return timelineEntry(
        'diff',
        `${event.diff.path} (+${event.diff.additions}/-${event.diff.deletions})`,
      );
    case 'verification':
      return timelineEntry('verify', `Verifiering: ${event.report.summary}`);
    case 'harness_phase':
      return timelineEntry('phase', `Fas: ${event.phase}`);
    case 'harness_preview':
      return timelineEntry('preview', `Preview: ${event.preview.url ?? 'ingen adress'}`);
    case 'harness_route':
      return timelineEntry(
        'route',
        event.route
          ? `Modell: ${event.route.model} (${event.route.reason})`
          : `Rekommendation: ${event.recommendation?.preview.name ?? 'okänd'}`,
      );
    case 'checkpoint':
      return timelineEntry('checkpoint', `Checkpoint: ${event.checkpoint.label}`);
    case 'error':
      return timelineEntry('error', `${event.code}: ${event.message}`);
    case 'tests':
      return timelineEntry('verify', `Tester: ${event.passed} gröna, ${event.failed} röda`);
    case 'run_finished':
      return timelineEntry('run', `Körning klar (${event.reason})`);
    default:
      return null;
  }
}

export const useAppStore = create<AppState>((set, get) => {
  /** Hanterar varje AgentEvent från körningen och lägger det på rätt plats i UI:t. */
  function handleEvent(event: AgentEvent): void {
    set((state) => {
      const partial = ((): Partial<AppState> => {
        switch (event.type) {
          case 'run_started':
            return {
              isRunning: true,
              streamingText: '',
              reasoningText: '',
              phase: 'thinking',
              providerNotice: null,
              logs: [
                ...state.logs,
                logEntry(`Körning startad med ${event.model} (${event.mode}).`),
              ].slice(-LOG_LIMIT),
            };
          case 'status':
            return { phase: event.phase };
          case 'assistant_delta':
            return { streamingText: state.streamingText + event.text };
          case 'reasoning_delta':
            return { reasoningText: state.reasoningText + event.text };
          case 'plan_proposed':
            return {
              plans: [event.plan, ...state.plans.filter((plan) => plan.id !== event.plan.id)],
              logs: [
                ...state.logs,
                logEntry(
                  `Plan framlagd: ${event.plan.title} (${event.plan.steps.length} steg, väntar på beslut).`,
                ),
              ].slice(-LOG_LIMIT),
            };
          case 'plan_decided':
            return {
              plans: state.plans.map((plan) =>
                plan.id === event.planId
                  ? { ...plan, status: event.status, decidedAt: Date.now() }
                  : event.status === 'approved' && plan.status === 'approved'
                    ? { ...plan, status: 'superseded' as PlanStatus }
                    : plan,
              ),
              logs: [
                ...state.logs,
                logEntry(`Planen ${event.status === 'approved' ? 'godkändes' : 'avvisades'}.`),
              ].slice(-LOG_LIMIT),
            };
          case 'assistant_reset':
            // Den strömmade texten var ett verktygsanrop, inte ett svar.
            return { streamingText: '' };
          case 'assistant_message':
            return {
              streamingText: '',
              reasoningText: '',
              messages: [
                ...state.messages,
                {
                  id: event.messageId,
                  role: 'assistant',
                  content: event.text,
                  createdAt: Date.now(),
                  ...(state.reasoningText ? { reasoning: state.reasoningText } : {}),
                },
              ],
            };
          case 'tool_call':
            return {
              logs: [
                ...state.logs,
                logEntry(`→ ${event.call.name} ${JSON.stringify(event.call.args).slice(0, 300)}`),
              ].slice(-LOG_LIMIT),
            };
          case 'tool_result': {
            // Medieverktygen returnerar filerna i `data.files`; de ska synas i chatten direkt.
            const rawFiles = event.result.data?.files;
            const files = Array.isArray(rawFiles)
              ? rawFiles.filter((entry): entry is string => typeof entry === 'string')
              : [];
            return {
              logs: [
                ...state.logs,
                logEntry(
                  `← ${event.result.name} (${event.result.durationMs} ms, ${event.result.ok ? 'ok' : 'fel'})`,
                  event.result.ok ? 'info' : 'warn',
                ),
              ].slice(-LOG_LIMIT),
              ...(files.length > 0
                ? {
                    mediaResults: [
                      ...state.mediaResults,
                      { id: event.result.callId, at: Date.now(), files },
                    ].slice(-20),
                  }
                : {}),
            };
          }
          case 'context':
            return {
              contextFiles: event.files,
              contextChars: event.chars,
              filesInContext: event.files.map((file) => file.path),
              logs: [
                ...state.logs,
                logEntry(`Kontext: ${event.files.length} filer, ${event.chars} tecken.`),
              ].slice(-LOG_LIMIT),
            };
          case 'diff':
            return {
              diffs: [event.diff, ...state.diffs.filter((diff) => diff.id !== event.diff.id)].slice(
                0,
                40,
              ),
              activeDiffId: event.diff.id,
              rightTab: 'diff',
              rightOpen: true,
            };
          case 'file_changed': {
            const editorFile = state.editorFile?.path === event.path ? null : state.editorFile;
            return {
              editorFile,
              logs: [
                ...state.logs,
                logEntry(
                  `${event.kind === 'delete' ? 'Tog bort' : event.kind === 'create' ? 'Skapade' : 'Ändrade'} ${event.path}`,
                ),
              ].slice(-LOG_LIMIT),
            };
          }
          case 'terminal':
            return {
              terminal: [
                ...state.terminal,
                {
                  id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  stream: event.chunk.stream,
                  text: event.chunk.text,
                },
              ].slice(-TERMINAL_LIMIT),
            };
          case 'approval_request':
            return {
              approvals: [event.request, ...state.approvals],
              rightTab: 'approvals',
              rightOpen: true,
            };
          case 'approval_resolved':
            return {
              approvals: state.approvals.filter((approval) => approval.id !== event.approvalId),
            };
          case 'subagent':
            return {
              subagents: [
                event.subagent,
                ...state.subagents.filter((entry) => entry.id !== event.subagent.id),
              ].slice(0, 20),
            };
          case 'verification_started':
            return {
              verificationRunning: true,
              verificationProgress: [],
              logs: [
                ...state.logs,
                logEntry(
                  `Verifiering startad (${event.trigger}): ${event.commands.map((command) => command.label).join(', ') || 'inga steg'}.`,
                ),
              ].slice(-LOG_LIMIT),
            };
          case 'verification_check':
            return {
              verificationProgress: [
                ...state.verificationProgress.filter((check) => check.id !== event.check.id),
                event.check,
              ],
              logs: [
                ...state.logs,
                logEntry(
                  `${event.check.label}: ${event.check.status} (${event.check.durationMs} ms)`,
                  event.check.status === 'passed' ? 'info' : 'warn',
                ),
              ].slice(-LOG_LIMIT),
            };
          case 'verification':
            return {
              verification: event.report,
              verificationRunning: false,
              verificationProgress: [],
              // Panelen öppnas bara när något är rött – ett grönt resultat ska inte stjäla fokus.
              ...(event.report.status === 'failed'
                ? { rightTab: 'verify' as RightTab, rightOpen: true }
                : {}),
              logs: [
                ...state.logs,
                logEntry(
                  `Verifiering: ${event.report.summary}`,
                  event.report.status === 'failed' ? 'warn' : 'info',
                ),
              ].slice(-LOG_LIMIT),
            };
          case 'harness_phase':
            return {
              phase:
                event.phase === 'gather'
                  ? 'building-context'
                  : event.phase === 'verify'
                    ? 'testing'
                    : event.phase === 'deliver'
                      ? 'done'
                      : 'thinking',
            };
          case 'harness_preview':
            return {
              preview: event.preview,
              // Resultatet ska synas direkt, utan att användaren letar reda på fliken.
              centerTab: 'preview' as CenterTab,
              logs: [
                ...state.logs,
                logEntry(
                  `Preview: ${event.preview.url ?? 'ingen adress'} (${event.preview.kind ?? 'okänd'})`,
                ),
              ].slice(-LOG_LIMIT),
            };
          case 'harness_route':
            return {
              logs: [
                ...state.logs,
                logEntry(
                  event.route
                    ? `Router: ${event.route.model} (${event.route.reason}).`
                    : `Router: ingen modell duger (${
                        event.recommendation?.preview.name ?? 'okänd'
                      } rekommenderas).`,
                ),
              ].slice(-LOG_LIMIT),
            };
          case 'tests':
            return {
              testResult: {
                command: event.command,
                passed: event.passed,
                failed: event.failed,
                output: event.output,
              },
              rightTab: 'tests',
              logs: [
                ...state.logs,
                logEntry(
                  `Tester: ${event.passed} godkända, ${event.failed} underkända.`,
                  event.failed > 0 ? 'warn' : 'info',
                ),
              ].slice(-LOG_LIMIT),
            };
          case 'git':
            return {
              gitStatus: {
                branch: event.branch,
                files: event.files,
                ahead: event.ahead ?? 0,
                behind: event.behind ?? 0,
              },
            };
          case 'checkpoint':
            return {
              checkpoints: [
                event.checkpoint,
                ...state.checkpoints.filter((entry) => entry.id !== event.checkpoint.id),
              ].sort((a, b) => b.createdAt - a.createdAt),
            };
          case 'usage':
            return state;
          case 'hook':
            return {
              logs: [
                ...state.logs,
                logEntry(`Hook ${event.hook.name}: ${event.hook.blocked ? 'blockerade' : 'körde'}`),
              ].slice(-LOG_LIMIT),
            };
          case 'error': {
            const visible = FATAL_ERROR_CODES.has(event.code)
              ? [failureMessage(`${event.message}${event.detail ? `\n\n${event.detail}` : ''}`)]
              : [];
            return {
              logs: [...state.logs, logEntry(`${event.code}: ${event.message}`, 'error')].slice(
                -LOG_LIMIT,
              ),
              ...(visible.length > 0 ? { messages: [...state.messages, ...visible] } : {}),
              phase: event.code === 'ollama_unavailable' ? 'idle' : state.phase,
              agentHelpUrl:
                event.code === 'ollama_unavailable'
                  ? (state.agentHelpUrl ?? 'https://freevobe.dev/docs/ollama')
                  : state.agentHelpUrl,
            };
          }
          case 'provider_required':
            return {
              isRunning: false,
              streamingText: '',
              phase: 'idle',
              providerNotice: {
                outputType: event.outputType,
                providers: event.providers,
                reason: event.reason,
              },
              logs: [
                ...state.logs,
                logEntry(`Provider krävs för ${event.outputType} (${event.reason}).`),
              ].slice(-LOG_LIMIT),
            };
          case 'run_finished':
            return {
              isRunning: false,
              streamingText: '',
              phase: event.reason === 'final' ? 'done' : 'idle',
              logs: [...state.logs, logEntry(`Körning avslutad (${event.reason}).`)].slice(
                -LOG_LIMIT,
              ),
            };
          default:
            return state;
        }
      })();
      const entry = timelineFor(event);
      return entry
        ? { ...partial, timeline: [...state.timeline, entry].slice(-TIMELINE_LIMIT) }
        : partial;
    });
  }

  const ONBOARDING_KEY = 'freevobe.onboardingComplete';
  // Panelayouten läses en gång vid start; sedan äger storen värdet och sparar varje ändring.
  const paneLayout = readPaneLayout();

  return {
    connection: null,
    client: null,
    connectionStatus: 'idle',
    connectionError: null,
    agentHelpUrl: null,

    onboardingComplete: readStorage(ONBOARDING_KEY) === '1',
    onboardingStep: 0,
    consentLocalData: false,
    consentGivesBack: false,
    settings: null,
    ollama: null,
    models: [],
    selectedModel: '',

    project: null,
    projects: [],
    permissionMode: 'ask',

    sessions: [],
    sessionId: null,
    messages: [],
    streamingText: '',
    reasoningText: '',
    phase: 'idle',
    runId: null,
    isRunning: false,

    diffs: [],
    activeDiffId: null,
    terminal: [],
    logs: [],
    approvals: [],
    subagents: [],
    tasks: [],
    plans: [],
    checkpoints: [],
    checkpointBusy: null,
    checkpointConflicts: null,
    testResult: null,
    contributions: [],
    contributionsSummary: { count: 0, totalSek: 0, causeCount: 0 },
    verification: null,
    verificationCommands: [],
    verificationProgress: [],
    verificationRunning: false,
    preview: null,
    previewBusy: false,
    timeline: [],
    routerDecision: null,
    routerBusy: false,
    pullProgress: null,
    pullResult: null,
    pullBusy: false,
    contextFiles: [],
    contextChars: 0,
    gitStatus: null,

    tree: [],
    editorFile: null,
    pinnedFiles: [],
    filesInContext: [],

    skills: [],
    mcpServers: [],
    mcpStatuses: [],
    mcpExamples: [],
    memory: '',
    doctor: null,
    connectors: [],
    connectorStorage: null,
    connectorBusy: null,
    connectorMessage: null,
    providers: null,
    providerMessage: null,
    mediaAssets: [],
    mediaLoading: false,
    mediaError: null,
    mediaResults: [],
    providerNotice: null,

    leftOpen: true,
    rightOpen: true,
    rightTab: 'diff',
    centerTab: 'editor',
    paletteOpen: false,
    settingsOpen: false,
    skillsOpen: false,
    skillImportOpen: false,
    mcpOpen: false,
    doctorOpen: false,
    memoryOpen: false,
    searchQuery: '',
    searchResults: [],
    mode: 'execute',
    treeOpen: true,
    themeMode: readThemeMode(),
    resolvedTheme: 'dark',
    viewMode: readViewMode(),
    qoderMode: readQoderMode(),
    chatFirst: paneLayout.chatFirst,
    chatShare: paneLayout.chatShare,
    sideChatOpen: false,
    sideChatSessionId: null,
    sideChatMessages: [],
    sideChatStreaming: '',
    sideChatBusy: false,

    async bootstrap() {
      await get().connect();
    },

    async connect() {
      set({ connectionStatus: 'connecting', connectionError: null });
      try {
        const connection = await resolveConnection();
        const client = new AgentClient({ connection });
        const health = await client.get<{ name: string; protocol: number }>('/api/health');
        const settings = await client.get<AppSettings>('/api/settings');
        set({
          connection,
          client,
          connectionStatus: 'ready',
          settings,
          selectedModel: settings.defaultModel,
          permissionMode: settings.permissionMode,
          connectionError: null,
        });
        void client.get<{ name: string }>('/api/health').catch(() => undefined);
        void health;
        await get().refreshOllama();
        set({ consentGivesBack: settings.givesBack.enabled });
        await get().loadContributions();
        // Vilket projekt som var öppet sparas inte mellan omstarter. Utan den här raden startade
        // appen utan projekt och utan chatt: inmatningsrutan fanns inte ens, så ingenting kunde
        // levereras hur man än skrev.
        await get().ensureWorkspace();
      } catch (error) {
        set({
          connectionStatus: 'error',
          connectionError: error instanceof AgentRequestError ? error.message : String(error),
          agentHelpUrl: 'https://freevobe.dev/docs/agent',
        });
      }
    },

    async refreshOllama(baseUrl) {
      const { client } = get();
      if (!client) return;
      try {
        const probe = await client.get<OllamaProbeResult>(
          `/api/ollama${baseUrl ? `?baseUrl=${encodeURIComponent(baseUrl)}` : ''}`,
        );
        set({
          ollama: probe,
          models: probe.models,
          selectedModel: get().selectedModel || probe.models[0]?.name || '',
          agentHelpUrl: probe.available ? null : probe.helpUrl,
        });
      } catch (error) {
        set({ logs: [...get().logs, logEntry(String(error), 'error')].slice(-LOG_LIMIT) });
      }
    },

    selectModel(model) {
      set({ selectedModel: model });
      const { client, project } = get();
      if (client && project)
        void client.patch(`/api/projects/${project.id}`, {}).catch(() => undefined);
    },

    async updateSettings(patch) {
      const { client } = get();
      if (!client) return;
      const settings = await client.patch<AppSettings>('/api/settings', patch);
      set({ settings, consentGivesBack: settings.givesBack.enabled });
    },

    async setAutoApprove(category, enabled) {
      const { settings } = get();
      if (!settings) return;
      await get().updateSettings({
        autoApprove: { ...settings.autoApprove, [category]: enabled },
      });
      set({
        logs: [
          ...get().logs,
          logEntry(
            i18n.t(enabled ? 'log.autoApproveOn' : 'log.autoApproveOff', {
              category: AUTO_APPROVE_LABELS[category],
            }),
          ),
        ].slice(-LOG_LIMIT),
      });
    },

    finishOnboarding() {
      writeStorage(ONBOARDING_KEY, '1');
      set({ onboardingComplete: true });
    },

    setOnboardingStep(step) {
      set({ onboardingStep: step });
    },

    setConsent(patch) {
      set({
        ...(patch.localData === undefined ? {} : { consentLocalData: patch.localData }),
        ...(patch.givesBack === undefined ? {} : { consentGivesBack: patch.givesBack }),
      });
    },

    async loadContributions() {
      const { client } = get();
      if (!client) return;
      try {
        const payload = await client.get<{
          entries: Contribution[];
          summary: GivesBackSummary;
        }>('/api/gives-back?limit=200');
        set({ contributions: payload.entries, contributionsSummary: payload.summary });
      } catch (error) {
        set({
          logs: [...get().logs, logEntry(`Gives Back: ${String(error)}`, 'error')].slice(
            -LOG_LIMIT,
          ),
        });
      }
    },

    async logContribution(input) {
      const { client } = get();
      if (!client) return;
      try {
        const payload = await client.post<{
          entries: Contribution[];
          summary: GivesBackSummary;
        }>('/api/gives-back', input);
        set({
          contributions: payload.entries,
          contributionsSummary: payload.summary,
          logs: [...get().logs, logEntry(i18n.t('log.contributionSaved'))].slice(-LOG_LIMIT),
        });
      } catch (error) {
        set({
          logs: [...get().logs, logEntry(`Gives Back: ${String(error)}`, 'error')].slice(
            -LOG_LIMIT,
          ),
        });
        throw error;
      }
    },

    async deleteContribution(id) {
      const { client } = get();
      if (!client) return;
      const payload = await client.del<{
        entries: Contribution[];
        summary: GivesBackSummary;
      }>(`/api/gives-back/${id}`);
      set({ contributions: payload.entries, contributionsSummary: payload.summary });
    },

    async openProject(path, name) {
      const { client } = get();
      if (!client) return;
      try {
        const result = await client.post<{ project: Project; indexed: number }>('/api/projects', {
          path,
          name,
          index: true,
        });
        set({
          project: result.project,
          permissionMode: result.project.permissionMode,
          logs: [
            ...get().logs,
            logEntry(`Öppnade ${result.project.name} (${result.indexed} filer indexerade).`),
          ].slice(-LOG_LIMIT),
        });
        await Promise.all([
          get().loadTree(),
          get().loadSessions(),
          get().refreshSkills(),
          get().refreshMcp(),
          get().refreshConnectors(),
          get().refreshMemory(),
          get().refreshGit(),
          get().refreshCheckpoints(),
          get().refreshVerification(),
          get().refreshPreview(),
        ]);
      } catch (error) {
        set({ logs: [...get().logs, logEntry(String(error), 'error')].slice(-LOG_LIMIT) });
      }
    },

    async refreshProjects() {
      const { client } = get();
      if (!client) return;
      set({ projects: await client.get<Project[]>('/api/projects') });
    },

    async setPermissionMode(mode) {
      const { client, project } = get();
      set({ permissionMode: mode });
      if (client && project) {
        await client.patch<Project>(`/api/projects/${project.id}`, { permissionMode: mode });
      }
    },

    async setMode(mode) {
      const { client, sessionId } = get();
      set({ mode });
      if (client && sessionId) await client.patch(`/api/sessions/${sessionId}`, { mode });
    },

    /**
     * Gör appen redo för en prompt: öppnar det senast använda projektet och skapar en chatt om det
     * inte finns någon. Tidigare stannade appen på "Ingen chatt vald" utan inmatningsruta.
     */
    async ensureWorkspace() {
      const { client } = get();
      if (!client) return;
      try {
        if (!get().project) {
          const projects = await client.get<Project[]>('/api/projects');
          set({ projects });
          const last = projects[0];
          if (last) {
            set({ project: last, permissionMode: last.permissionMode });
            await Promise.all([
              get().loadTree(),
              get().refreshSkills(),
              get().refreshMcp(),
              get().refreshConnectors(),
              get().refreshMemory(),
              get().refreshGit(),
              get().refreshCheckpoints(),
              get().refreshVerification(),
            ]);
          }
        }
        await get().loadSessions();
        if (!get().sessionId && get().project) await get().newSession();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        set({
          messages: [...get().messages, failureMessage(`Kunde inte öppna en chatt: ${message}`)],
          logs: [...get().logs, logEntry(message, 'error')].slice(-LOG_LIMIT),
        });
      }
    },

    async newSession() {
      const { client, project } = get();
      if (!client || !project) return;
      const session = await client.post<Session>('/api/sessions', {
        projectId: project.id,
        title: 'Ny chatt',
        model: get().selectedModel,
        mode: get().mode,
      });
      set({
        sessionId: session.id,
        messages: [],
        diffs: [],
        plans: [],
        streamingText: '',
        logs: [logEntry(i18n.t('log.newChat'))],
      });
      await get().loadSessions();
    },

    async loadSessions() {
      const { client, project } = get();
      if (!client || !project) return;
      const sessions = await client.get<Session[]>(`/api/sessions?projectId=${project.id}`);
      set({ sessions });
      const current = get().sessionId;
      if (!current && sessions[0]) await get().selectSession(sessions[0].id);
    },

    async selectSession(id) {
      const { client } = get();
      if (!client) return;
      const session = await client.get<Session | null>(`/api/sessions/${id}`);
      const messages = await client.get<ChatMessage[]>(`/api/sessions/${id}/messages`);
      const tasks = await client.get<TaskItem[]>(`/api/sessions/${id}/tasks`);
      const plans = await client.get<Plan[]>(`/api/sessions/${id}/plans`);
      set({
        sessionId: id,
        messages,
        tasks,
        plans,
        streamingText: '',
        diffs: [],
        ...(session ? { mode: session.mode, selectedModel: session.model } : {}),
      });
    },

    async loadPlans() {
      const { client, sessionId } = get();
      if (!client || !sessionId) return;
      set({ plans: await client.get<Plan[]>(`/api/sessions/${sessionId}/plans`) });
    },

    async decidePlan(planId, decision, options) {
      const { client } = get();
      if (!client) return;
      const plan = await client.post<Plan>(`/api/plans/${planId}/decision`, { decision });
      set({
        plans: get().plans.map((entry) => {
          if (entry.id === plan.id) return plan;
          // En ny godkänd plan ersätter den gamla i servern; spegla det direkt i listan.
          if (decision === 'approved' && entry.status === 'approved') {
            return { ...entry, status: 'superseded' as PlanStatus };
          }
          return entry;
        }),
        // Servern växlar sessionen till Execute vid godkännande – håll gränssnittet i synk.
        ...(decision === 'approved' ? { mode: 'execute' as const } : {}),
        logs: [
          ...get().logs,
          logEntry(
            decision === 'approved'
              ? `Planen godkänd: ${plan.title}. Agenten får nu ändra filerna i planen.`
              : `Planen avvisad: ${plan.title}.`,
          ),
        ].slice(-LOG_LIMIT),
      });
      await get().loadSessions();
      if (decision === 'approved' && options?.run) {
        await get().sendPrompt('Utför den godkända planen.');
      }
    },

    async deleteSession(id) {
      const { client, sessionId } = get();
      if (!client) return;
      await client.del(`/api/sessions/${id}`);
      if (sessionId === id) set({ sessionId: null, messages: [] });
      await get().loadSessions();
    },

    async sendPrompt(prompt) {
      if (get().isRunning) return;

      // Här får det aldrig bli en tyst retur: förut hände ingenting alls när anslutningen eller
      // chatten saknades, hur man än skrev.
      if (!get().client) {
        set({
          messages: [
            ...get().messages,
            failureMessage(
              'Ingen anslutning till agenten. Starta om appen så försöker den ansluta igen.',
            ),
          ],
        });
        return;
      }
      if (!get().sessionId) await get().ensureWorkspace();
      const { client, sessionId } = get();
      if (!client || !sessionId) {
        set({
          messages: [
            ...get().messages,
            failureMessage(
              'Ingen chatt kunde skapas. Öppna ett projekt i vänsterpanelen och försök igen.',
            ),
          ],
        });
        return;
      }

      const userMessage: ChatMessage = {
        id: `local_${Date.now()}`,
        role: 'user',
        content: prompt,
        createdAt: Date.now(),
      };
      set({
        messages: [...get().messages, userMessage],
        streamingText: '',
        reasoningText: '',
        isRunning: true,
        phase: 'thinking',
        logs: [...get().logs, logEntry(`Du: ${prompt.slice(0, 200)}`)].slice(-LOG_LIMIT),
      });

      // Saknar den valda modellen verktygsstöd är det ingen idé att köra först och fråga sedan:
      // routern får svara direkt, och kortet visar vad som bör hämtas.
      const chosen = get().models.find((model) => model.name === get().selectedModel);
      if (!chosen || !chosen.supportsTools) void get().checkModelFit(prompt);

      try {
        const started = await client.post<{ runId: string }>('/api/chat', {
          sessionId,
          prompt,
          model: get().selectedModel,
          mode: get().mode,
          permissionMode: get().permissionMode,
          pinnedFiles: get().pinnedFiles,
        });
        set({ runId: started.runId });
        // Stäng prenumerationen först när körningen är klar, annars tappar vi sista händelsen.
        const unsubscribe = client.subscribe(
          started.runId,
          (event) => {
            handleEvent(event);
            if (event.type === 'run_finished') unsubscribe();
          },
          () => set({ isRunning: false }),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        set({
          isRunning: false,
          phase: 'idle',
          // Utan det här blev ett misslyckat anrop helt tyst i chatten.
          messages: [...get().messages, failureMessage(message)],
          logs: [...get().logs, logEntry(message, 'error')].slice(-LOG_LIMIT),
        });
      }
    },

    async abort() {
      const { client, runId } = get();
      if (!client || !runId) return;
      await client.post(`/api/runs/${runId}/abort`);
      set({
        isRunning: false,
        phase: 'idle',
        logs: [...get().logs, logEntry(i18n.t('log.aborted'))].slice(-LOG_LIMIT),
      });
    },

    async resolveApproval(id, decision, answers) {
      const { client } = get();
      if (!client) return;
      await client.post(`/api/approvals/${id}`, { decision, ...(answers ? { answers } : {}) });
      set({ approvals: get().approvals.filter((approval) => approval.id !== id) });
    },

    async loadTree() {
      const { client, project } = get();
      if (!client || !project) return;
      set({ tree: await client.get(`/api/projects/${project.id}/tree`) });
    },

    async openFile(path, options) {
      const { client, project } = get();
      if (!client || !project) return;
      const file = await client.get<{ path: string; content: string }>(
        `/api/projects/${project.id}/file?path=${encodeURIComponent(path)}`,
      );
      set({
        editorFile: {
          path: file.path,
          content: file.content,
          original: file.content,
          dirty: false,
        },
        centerTab: options?.previewOnly ? 'preview' : 'editor',
      });
    },

    updateEditorContent(content) {
      const editorFile = get().editorFile;
      if (!editorFile) return;
      set({ editorFile: { ...editorFile, content, dirty: content !== editorFile.original } });
    },

    async saveEditorFile() {
      const { client, project, editorFile } = get();
      if (!client || !project || !editorFile) return;
      await client.put(`/api/projects/${project.id}/file`, {
        path: editorFile.path,
        content: editorFile.content,
      });
      set({
        editorFile: { ...editorFile, original: editorFile.content, dirty: false },
        logs: [...get().logs, logEntry(`Sparade ${editorFile.path}.`)].slice(-LOG_LIMIT),
      });
      await get().loadTree();
    },

    togglePin(path) {
      const pinned = get().pinnedFiles;
      set({
        pinnedFiles: pinned.includes(path)
          ? pinned.filter((entry) => entry !== path)
          : [...pinned, path],
      });
    },

    async runSearch(query) {
      const { client, project } = get();
      set({ searchQuery: query });
      if (!client || !project) return;
      const result = await client.post<{ results?: string[] }>(
        `/api/projects/${project.id}/context`,
        {},
      );
      void result;
      // Sökningen går via kontextlistan och filnamn – snabbt och utan att bygga ett eget index i UI:t.
      const matches = get()
        .tree.filter((entry) => entry.path.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 60)
        .map((entry) => `${entry.path} (${entry.lines} rader)`);
      set({ searchResults: matches, centerTab: 'search' });
    },

    setSkillImportOpen: (open) => set({ skillImportOpen: open }),

    async refreshSkills() {
      const { client, project } = get();
      if (!client || !project) return;
      set({ skills: await client.get<SkillSummary[]>(`/api/projects/${project.id}/skills`) });
    },

    async copyBuiltinSkills() {
      const { client, project } = get();
      if (!client || !project) return;
      await client.post(`/api/projects/${project.id}/skills/copy-builtin`);
      await get().refreshSkills();
    },

    async saveSkill(draft) {
      const { client, project } = get();
      if (!client || !project) return;
      await client.post(`/api/projects/${project.id}/skills`, draft);
      await get().refreshSkills();
    },

    async deleteSkill(name) {
      const { client, project } = get();
      if (!client || !project) return;
      await client.del(`/api/projects/${project.id}/skills/${encodeURIComponent(name)}`);
      await get().refreshSkills();
    },

    async exportSkill(name) {
      const { client, project } = get();
      if (!client || !project) return '';
      const payload = await client.get<{ markdown: string }>(
        `/api/projects/${project.id}/skills/${encodeURIComponent(name)}/export`,
      );
      return payload.markdown;
    },

    async scanSkillImport(target) {
      const { client, project } = get();
      if (!client || !project) throw new Error('Inget projekt är öppet.');
      return client.post<SkillImportScan>(`/api/projects/${project.id}/skills/import/scan`, {
        ...(target && target.trim() !== '' ? { target: target.trim() } : {}),
      });
    },

    async applySkillImport(items) {
      const { client, project } = get();
      if (!client || !project) throw new Error('Inget projekt är öppet.');
      const payload = await client.post<SkillImportApplyResult>(
        `/api/projects/${project.id}/skills/import/apply`,
        { items },
      );
      await get().refreshSkills();
      return payload;
    },

    async importSkills(contents) {
      const { client, project } = get();
      if (!client || !project) return 0;
      const payload = await client.post<{ created: number }>(
        `/api/projects/${project.id}/skills/import`,
        { contents },
      );
      await get().refreshSkills();
      return payload.created;
    },

    async refreshMcp() {
      const { client, project } = get();
      if (!client || !project) return;
      const payload = await client.get<{
        servers: McpServerConfig[];
        statuses: McpServerStatus[];
        examples: McpServerConfig[];
      }>(`/api/projects/${project.id}/mcp`);
      set({
        mcpServers: payload.servers,
        mcpStatuses: payload.statuses,
        mcpExamples: payload.examples,
      });
    },

    async saveMcpServers(servers) {
      const { client, project } = get();
      if (!client || !project) return;
      await client.put(`/api/projects/${project.id}/mcp`, { servers });
      await get().refreshMcp();
    },

    async connectMcp(serverId) {
      const { client, project } = get();
      if (!client || !project) return;
      await client.post(`/api/projects/${project.id}/mcp/${serverId}/connect`);
      await get().refreshMcp();
    },

    async disconnectMcp(serverId) {
      const { client, project } = get();
      if (!client || !project) return;
      await client.del(`/api/projects/${project.id}/mcp/${serverId}`);
      await get().refreshMcp();
    },

    async refreshConnectors() {
      const { client, project } = get();
      if (!client || !project) return;
      try {
        const payload = await client.get<ConnectorsResponse>(
          `/api/projects/${project.id}/connectors`,
        );
        set({ connectors: payload.connectors, connectorStorage: payload.storage });
      } catch (error) {
        set({
          logs: [...get().logs, logEntry(String(error), 'error')].slice(-LOG_LIMIT),
        });
      }
    },

    async connectConnector(id, secret, accountLabel) {
      const { client, project, connectors } = get();
      if (!client || !project) return;
      set({ connectorBusy: id });
      try {
        const view = await client.post<ConnectorView>(
          `/api/projects/${project.id}/connectors/${id}/connect`,
          { secret, ...(accountLabel?.trim() ? { accountLabel: accountLabel.trim() } : {}) },
        );
        set({
          connectors: replaceConnector(connectors, view),
          connectorMessage: i18n.t('connectors.toast.connected', {
            name: i18n.t(`connectors.${id}.name`),
          }),
        });
      } finally {
        set({ connectorBusy: null });
      }
    },

    async disconnectConnector(id) {
      const { client, project, connectors } = get();
      if (!client || !project) return [];
      set({ connectorBusy: id });
      try {
        const result = await client.del<ConnectorDisconnectResult>(
          `/api/projects/${project.id}/connectors/${id}`,
        );
        set({
          connectors: replaceConnector(connectors, result.view),
          connectorMessage: i18n.t('connectors.toast.disconnected', {
            name: i18n.t(`connectors.${id}.name`),
          }),
        });
        return result.revokedScopes;
      } finally {
        set({ connectorBusy: null });
      }
    },

    async setConnectorEnabled(id, enabled) {
      const { client, project, connectors } = get();
      if (!client || !project) return;
      set({ connectorBusy: id });
      try {
        const view = await client.patch<ConnectorView>(
          `/api/projects/${project.id}/connectors/${id}`,
          { enabled },
        );
        set({
          connectors: replaceConnector(connectors, view),
          connectorMessage: i18n.t(
            enabled ? 'connectors.toast.enabled' : 'connectors.toast.disabled',
            { name: i18n.t(`connectors.${id}.name`) },
          ),
        });
      } finally {
        set({ connectorBusy: null });
      }
    },

    dismissProviderNotice() {
      set({ providerNotice: null });
    },

    async refreshProviders() {
      const { client } = get();
      if (!client) return;
      try {
        set({ providers: await client.get<ProvidersResponse>('/api/providers') });
      } catch (error) {
        set({ logs: [...get().logs, logEntry(String(error), 'error')].slice(-LOG_LIMIT) });
      }
    },

    async setProviderEnabled(id, enabled) {
      const { client } = get();
      if (!client) return;
      try {
        set({
          providers: await client.patch<ProvidersResponse>(`/api/providers/${id}`, { enabled }),
        });
      } catch (error) {
        set({ providerMessage: String(error) });
      }
    },

    async saveProviderKey(id, key) {
      const { client } = get();
      if (!client) return;
      try {
        await client.post<{ hint: string }>(`/api/providers/${id}/key`, { key });
        await get().refreshProviders();
        set({ providerMessage: i18n.t('settings.providers.keySaved') });
      } catch (error) {
        set({ providerMessage: String(error) });
      }
    },

    async clearProviderKey(id) {
      const { client } = get();
      if (!client) return;
      try {
        await client.del<{ cleared: boolean }>(`/api/providers/${id}/key`);
        await get().refreshProviders();
        set({ providerMessage: i18n.t('settings.providers.keyCleared') });
      } catch (error) {
        set({ providerMessage: String(error) });
      }
    },

    async setProviderMediaPreference(kind, providerId) {
      const { client } = get();
      if (!client) return;
      try {
        set({
          providers: await client.patch<ProvidersResponse>('/api/providers/preferences', {
            kind,
            providerId,
          }),
        });
      } catch (error) {
        set({ providerMessage: String(error) });
      }
    },

    async loadMedia() {
      const { client, project } = get();
      if (!client || !project) {
        set({ mediaAssets: [], mediaLoading: false, mediaError: null });
        return;
      }
      set({ mediaLoading: true, mediaError: null });
      try {
        const library = await client.get<MediaLibraryResponse>(
          `/api/projects/${encodeURIComponent(project.id)}/media`,
        );
        set({ mediaAssets: library.assets, mediaLoading: false });
      } catch (error) {
        set({ mediaLoading: false, mediaError: String(error) });
      }
    },

    async refreshMemory() {
      const { client, project } = get();
      if (!client || !project) return;
      const payload = await client.get<{ content: string }>(`/api/projects/${project.id}/memory`);
      set({ memory: payload.content });
    },

    async saveMemory(content) {
      const { client, project } = get();
      if (!client || !project) return;
      await client.put(`/api/projects/${project.id}/memory`, { content });
      set({ memory: content });
    },

    async runDoctor() {
      const { client, project } = get();
      if (!client) return;
      const report = await client.get<DoctorReport>(
        `/api/doctor${project ? `?projectId=${project.id}` : ''}`,
      );
      set({ doctor: report, doctorOpen: true });
    },

    async refreshGit() {
      const { client, project } = get();
      if (!client || !project) return;
      try {
        const status = await client.get<{
          branch: string;
          files: { path: string; index: string; worktree: string }[];
          ahead: number;
          behind: number;
        }>(`/api/projects/${project.id}/git/status`);
        set({ gitStatus: status });
      } catch {
        set({ gitStatus: null });
      }
    },

    async refreshCheckpoints() {
      const { client, project } = get();
      if (!client || !project) return;
      try {
        set({
          checkpoints: await client.get<Checkpoint[]>(`/api/projects/${project.id}/checkpoints`),
        });
      } catch {
        // Projektet kan sakna checkpoints helt – tidslinjen visas då tom.
        set({ checkpoints: [] });
      }
    },

    async createCheckpoint(label) {
      const { client, project } = get();
      if (!client || !project) return;
      set({ checkpointBusy: 'manual' });
      try {
        const checkpoint = await client.post<Checkpoint>(
          `/api/projects/${project.id}/checkpoints`,
          label ? { label } : {},
        );
        set({
          checkpoints: [
            checkpoint,
            ...get().checkpoints.filter((entry) => entry.id !== checkpoint.id),
          ],
          rightTab: 'checkpoints',
          rightOpen: true,
          logs: [
            ...get().logs,
            logEntry(`Checkpoint sparad: ${checkpoint.label} (${checkpoint.files.length} filer).`),
          ].slice(-LOG_LIMIT),
        });
      } catch (error) {
        set({
          logs: [
            ...get().logs,
            logEntry(`Kunde inte spara checkpoint: ${String(error)}`, 'error'),
          ].slice(-LOG_LIMIT),
        });
      } finally {
        set({ checkpointBusy: null });
      }
    },

    async showCheckpointDiff(id) {
      const { client } = get();
      if (!client) return;
      try {
        const diff = await client.get<{ files: FileDiff[] }>(`/api/checkpoints/${id}/diff`);
        if (diff.files.length === 0) {
          set({
            logs: [...get().logs, logEntry(i18n.t('log.checkpointSame'))].slice(-LOG_LIMIT),
          });
          return;
        }
        set({
          diffs: diff.files.slice(0, 40),
          activeDiffId: diff.files[0]?.id ?? null,
          rightTab: 'diff',
          rightOpen: true,
        });
      } catch (error) {
        set({
          logs: [...get().logs, logEntry(String(error), 'error')].slice(-LOG_LIMIT),
        });
      }
    },

    async restoreCheckpoint(id, force) {
      const { client } = get();
      if (!client) return;
      set({ checkpointBusy: id });
      try {
        const report = await client.post<CheckpointRestoreReport>(
          `/api/checkpoints/${id}/restore`,
          { force: force === true },
        );
        const changed = report.restored.length + report.deleted.length;
        const skipped = report.skipped.map((entry) => entry.path);
        const conflicts = report.skipped
          .filter((entry) => entry.reason === 'changed-since')
          .map((entry) => entry.path);
        set({
          editorFile: null,
          // Bara filer som ändrats sedan checkpointen går att tvinga fram – andra skäl att hoppa
          // över (t.ex. sökväg utanför projektet) löses inte av en tvingad återställning.
          checkpointConflicts:
            conflicts.length > 0 && force !== true ? { checkpointId: id, paths: conflicts } : null,
          logs: [
            ...get().logs,
            logEntry(`Checkpoint återställd: ${changed} filer tillbaka.`),
            ...(skipped.length > 0
              ? [
                  logEntry(
                    `Hoppade över ${skipped.length} filer som ändrats sedan checkpointen: ${skipped.join(', ')}`,
                    'warn',
                  ),
                ]
              : []),
          ].slice(-LOG_LIMIT),
        });
        await Promise.all([get().loadTree(), get().refreshGit(), get().refreshCheckpoints()]);
      } catch (error) {
        set({
          logs: [...get().logs, logEntry(String(error), 'error')].slice(-LOG_LIMIT),
        });
      } finally {
        set({ checkpointBusy: null });
      }
    },

    async discardCheckpoint(id) {
      const { client } = get();
      if (!client) return;
      await client.del(`/api/checkpoints/${id}`);
      await get().refreshCheckpoints();
    },

    async commitCheckpoint(id, message) {
      const { client } = get();
      if (!client) return;
      set({ checkpointBusy: id });
      try {
        const result = await client.post<{ hash: string; message: string }>(
          `/api/checkpoints/${id}/commit`,
          message ? { message } : {},
        );
        set({
          logs: [
            ...get().logs,
            logEntry(`Checkpoint committad som ${result.hash}: ${result.message}`),
          ].slice(-LOG_LIMIT),
        });
        await Promise.all([get().refreshCheckpoints(), get().refreshGit()]);
      } catch (error) {
        set({
          logs: [
            ...get().logs,
            logEntry(`Commit från checkpoint misslyckades: ${String(error)}`, 'error'),
          ].slice(-LOG_LIMIT),
        });
      } finally {
        set({ checkpointBusy: null });
      }
    },

    async runTests() {
      const { client, project, sessionId } = get();
      if (!client || !project || !sessionId) return;
      await get().sendPrompt('Kör testerna och sammanfatta resultatet.');
    },

    async refreshVerification() {
      const { client, project } = get();
      if (!client || !project) return;
      try {
        const [reports, detected] = await Promise.all([
          client.get<VerificationReport[]>(`/api/projects/${project.id}/verifications?limit=1`),
          client.get<{ commands: VerificationCommand[] }>(
            `/api/projects/${project.id}/verification`,
          ),
        ]);
        set({
          verification: reports[0] ?? null,
          verificationCommands: detected.commands ?? [],
        });
      } catch (error) {
        set({
          logs: [...get().logs, logEntry(`Verifiering: ${String(error)}`, 'error')].slice(
            -LOG_LIMIT,
          ),
        });
      }
    },

    async runVerification(kinds) {
      const { client, project } = get();
      if (!client || !project) return;
      set({
        verificationRunning: true,
        verificationProgress: [],
        rightTab: 'verify',
        rightOpen: true,
        logs: [
          ...get().logs,
          logEntry(`Kör verifieringen manuellt${kinds?.length ? ` (${kinds.join(', ')})` : ''}.`),
        ].slice(-LOG_LIMIT),
      });
      try {
        const report = await client.post<VerificationReport>(
          `/api/projects/${project.id}/verification`,
          kinds && kinds.length > 0 ? { kinds } : {},
        );
        set({ verification: report, verificationRunning: false, verificationProgress: [] });
        await get().refreshVerification();
      } catch (error) {
        set({
          verificationRunning: false,
          logs: [
            ...get().logs,
            logEntry(`Verifieringen misslyckades: ${String(error)}`, 'error'),
          ].slice(-LOG_LIMIT),
        });
      }
    },

    async refreshPreview() {
      const { client, project } = get();
      if (!client || !project) return;
      try {
        set({ preview: await client.get<PreviewStatus>(`/api/projects/${project.id}/preview`) });
      } catch {
        // Ingen preview är inget fel: projektet kan sakna dev-server.
      }
    },

    async startPreview() {
      const { client, project } = get();
      if (!client || !project) return;
      set({ previewBusy: true });
      try {
        const payload = await client.post<{ preview: PreviewStatus }>(
          `/api/projects/${project.id}/preview`,
        );
        set({
          preview: payload.preview,
          centerTab: 'preview',
          previewBusy: false,
          logs: [
            ...get().logs,
            logEntry(`Preview startad på ${payload.preview.url ?? 'okänd adress'}.`),
          ].slice(-LOG_LIMIT),
        });
      } catch (error) {
        set({
          previewBusy: false,
          messages: [
            ...get().messages,
            failureMessage(`Kunde inte starta preview: ${String(error)}`),
          ],
          logs: [...get().logs, logEntry(String(error), 'error')].slice(-LOG_LIMIT),
        });
      }
    },

    async stopPreview() {
      const { client, project } = get();
      if (!client || !project) return;
      try {
        await client.del(`/api/projects/${project.id}/preview`);
      } finally {
        set({
          preview: null,
          logs: [...get().logs, logEntry('Preview stoppad.')].slice(-LOG_LIMIT),
        });
      }
    },

    clearTimeline() {
      set({ timeline: [] });
    },

    async checkModelFit(prompt) {
      const { client } = get();
      if (!client) return;
      set({ routerBusy: true });
      try {
        const decision = await client.get<RouterDecision>(
          `/api/router?prompt=${encodeURIComponent(prompt)}`,
        );
        set({
          routerDecision: decision,
          routerBusy: false,
          pullProgress: null,
          pullResult: null,
          logs: [
            ...get().logs,
            logEntry(
              decision.ok
                ? `Router: ${decision.route?.model ?? 'okänd'} (${decision.route?.reason ?? ''}).`
                : `Router: ingen modell duger – ${decision.recommendation?.preview.name ?? 'okänd'} rekommenderas.`,
            ),
          ].slice(-LOG_LIMIT),
        });
      } catch (error) {
        set({
          routerBusy: false,
          logs: [...get().logs, logEntry(`Router: ${String(error)}`, 'error')].slice(-LOG_LIMIT),
        });
      }
    },

    async pullRecommendedModel() {
      const { client, routerDecision } = get();
      const recommendation = routerDecision?.recommendation;
      if (!client || !recommendation) return;

      set({ pullBusy: true, pullProgress: null, pullResult: null });
      try {
        await client.streamPost(
          '/api/models/pull',
          {
            model: recommendation.preview.name,
            // Knappen är det uttryckliga ja som servern kräver.
            approved: true,
            ...(recommendation.preview.checksum
              ? { expectedDigest: recommendation.preview.checksum }
              : {}),
          },
          (name, data) => {
            if (name === 'progress') {
              set({ pullProgress: data as PullProgress });
              return;
            }
            if (name === 'done') {
              const result = data as ModelPullResult;
              set({
                pullResult: result,
                pullBusy: false,
                timeline: [
                  ...get().timeline,
                  timelineEntry(
                    'pull',
                    `Modell hämtad: ${result.model} (${result.verification.status})`,
                  ),
                ].slice(-TIMELINE_LIMIT),
              });
              if (result.ok && result.verification.status !== 'mismatch') {
                get().selectModel(result.model);
                set({
                  logs: [
                    ...get().logs,
                    logEntry(`Modellen ${result.model} är klar att använda.`),
                  ].slice(-LOG_LIMIT),
                });
              }
              return;
            }
            if (name === 'error') {
              const message = (data as { message?: string }).message ?? 'Hämtningen misslyckades.';
              set({
                pullBusy: false,
                logs: [...get().logs, logEntry(message, 'error')].slice(-LOG_LIMIT),
              });
            }
          },
        );
        set({ pullBusy: false });
      } catch (error) {
        set({
          pullBusy: false,
          logs: [...get().logs, logEntry(String(error), 'error')].slice(-LOG_LIMIT),
        });
      }
    },

    dismissRouterRecommendation() {
      set({ routerDecision: null, pullProgress: null, pullResult: null });
    },

    async commitAll(message) {
      const { client, project } = get();
      if (!client || !project) return;
      const result = await client.post<{ hash: string; message: string }>(
        `/api/projects/${project.id}/git/commit`,
        { message },
      );
      set({ logs: [...get().logs, logEntry(`Commit ${result.hash} skapad.`)].slice(-LOG_LIMIT) });
      await get().refreshGit();
    },

    async suggestCommitMessage() {
      const { client, project } = get();
      if (!client || !project) return '';
      const result = await client.post<{ message: string }>(
        `/api/projects/${project.id}/git/commit-message`,
        {},
      );
      return result.message;
    },

    async runSubagent(kind, task) {
      const { client, project, sessionId } = get();
      if (!client || !project) return;
      set({
        subagents: [
          {
            id: `pending_${kind}`,
            runId: 'panel',
            kind: kind as never,
            label: kind,
            status: 'running',
            startedAt: Date.now(),
          },
          ...get().subagents,
        ],
      });
      try {
        const result = await client.post<{ summary: string; status: string }>(
          '/api/subagents/run',
          {
            projectId: project.id,
            kind,
            task,
            sessionId: sessionId ?? 'panel',
          },
        );
        set({
          subagents: [
            {
              id: `${kind}_${Date.now()}`,
              runId: 'panel',
              kind: kind as never,
              label: kind,
              status: 'done',
              summary: result.summary,
              startedAt: Date.now(),
              finishedAt: Date.now(),
            },
            ...get().subagents.filter((entry) => entry.id !== `pending_${kind}`),
          ],
          logs: [
            ...get().logs,
            logEntry(`Subagent ${kind}: ${result.summary.slice(0, 200)}`),
          ].slice(-LOG_LIMIT),
        });
      } catch (error) {
        set({
          logs: [
            ...get().logs,
            logEntry(`Subagent ${kind} misslyckades: ${String(error)}`, 'error'),
          ].slice(-LOG_LIMIT),
        });
      }
    },

    clearTerminal() {
      set({ terminal: [] });
    },

    setThemeMode(mode) {
      saveThemeMode(mode);
      set({
        themeMode: mode,
        resolvedTheme: mode === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : mode,
      });
    },

    setResolvedTheme(theme) {
      if (get().resolvedTheme !== theme) set({ resolvedTheme: theme });
    },

    setViewMode(mode) {
      saveViewMode(mode);
      set({ viewMode: mode });
    },

    setQoder(enabled) {
      saveQoderMode(enabled);
      set({ qoderMode: enabled });
    },

    toggleQoder() {
      get().setQoder(!get().qoderMode);
    },

    setChatFirst(first) {
      savePaneLayout({ chatFirst: first, chatShare: get().chatShare });
      set({ chatFirst: first });
    },

    setChatShare(share) {
      const next = clampShare(share);
      savePaneLayout({ chatFirst: get().chatFirst, chatShare: next });
      set({ chatShare: next });
    },

    async ensureSideChatSession() {
      const { client, project } = get();
      if (!client || !project) return null;
      const existing = get().sideChatSessionId;
      if (existing) return existing;
      try {
        const session = await client.post<Session>('/api/sessions', {
          projectId: project.id,
          title: 'Side chat',
          model: get().selectedModel,
          mode: get().mode,
        });
        set({ sideChatSessionId: session.id, sideChatMessages: [] });
        return session.id;
      } catch (error) {
        set({
          logs: [...get().logs, logEntry(`Sidchatt: ${String(error)}`, 'error')].slice(-LOG_LIMIT),
        });
        return null;
      }
    },

    async toggleSideChat() {
      const open = !get().sideChatOpen;
      set({ sideChatOpen: open });
      if (open) await get().ensureSideChatSession();
    },

    closeSideChat() {
      set({ sideChatOpen: false });
    },

    async sendSideChat(prompt) {
      const { client } = get();
      if (!client || get().sideChatBusy) return;
      const sessionId = get().sideChatSessionId ?? (await get().ensureSideChatSession());
      if (!sessionId) return;

      set({
        sideChatMessages: [...get().sideChatMessages, sideChatMessage('user', prompt)],
        sideChatStreaming: '',
        sideChatBusy: true,
      });
      try {
        const started = await client.post<{ runId: string }>('/api/chat', {
          sessionId,
          prompt,
          model: get().selectedModel,
          mode: get().mode,
          permissionMode: get().permissionMode,
          pinnedFiles: get().pinnedFiles,
        });
        const unsubscribe = client.subscribe(
          started.runId,
          (event) => {
            if (event.type === 'approval_request') {
              handleEvent(event);
              return;
            }
            if (event.type === 'assistant_delta') {
              set({ sideChatStreaming: get().sideChatStreaming + event.text });
              return;
            }
            if (event.type === 'assistant_message') {
              set({
                sideChatMessages: [
                  ...get().sideChatMessages,
                  {
                    ...sideChatMessage('assistant', event.text),
                    id: event.messageId,
                    model: get().selectedModel,
                  },
                ],
                sideChatStreaming: '',
              });
              return;
            }
            if (event.type === 'error') {
              set({
                sideChatMessages: [
                  ...get().sideChatMessages,
                  sideChatMessage('assistant', `${event.code}: ${event.message}`),
                ],
                sideChatStreaming: '',
              });
              return;
            }
            if (event.type === 'run_finished') {
              unsubscribe();
              set({ sideChatBusy: false, sideChatStreaming: '' });
            }
          },
          () => set({ sideChatBusy: false }),
        );
      } catch (error) {
        set({
          sideChatBusy: false,
          sideChatStreaming: '',
          sideChatMessages: [
            ...get().sideChatMessages,
            sideChatMessage('assistant', String(error)),
          ],
        });
      }
    },

    toggleLeft() {
      set({ leftOpen: !get().leftOpen });
    },
    toggleTree() {
      set({ treeOpen: !get().treeOpen });
    },
    toggleRight() {
      set({ rightOpen: !get().rightOpen });
    },
    setRightTab(tab) {
      set({ rightTab: tab, rightOpen: true });
    },
    setCenterTab(tab) {
      set({ centerTab: tab });
    },
    setPalette(open) {
      set({ paletteOpen: open });
    },
    setSettingsOpen(open) {
      set({ settingsOpen: open });
    },
    setSkillsOpen(open) {
      set({ skillsOpen: open });
    },
    setMcpOpen(open) {
      set({ mcpOpen: open });
    },
    setDoctorOpen(open) {
      set({ doctorOpen: open });
    },
    setMemoryOpen(open) {
      set({ memoryOpen: open });
      if (open) set({ memory: get().memory });
    },
    setActiveDiff(id) {
      set({ activeDiffId: id, rightTab: 'diff', rightOpen: true });
    },
  };
});
