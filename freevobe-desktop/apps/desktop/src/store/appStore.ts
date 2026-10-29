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
  OllamaModel,
  OllamaProbeResult,
  PermissionMode,
  Plan,
  PlanStatus,
  Project,
  Session,
  SkillSummary,
  SubagentStatus,
  TaskItem,
  VerificationCheckResult,
  VerificationCommand,
  VerificationReport,
} from '@freevobe/protocol';
import {
  AgentClient,
  AgentRequestError,
  resolveConnection,
  type AgentConnection,
} from '../lib/agentClient';
import i18n from '../i18n';
import { AUTO_APPROVE_LABELS } from '../lib/format';

export type RightTab =
  'diff' | 'terminal' | 'logs' | 'tests' | 'verify' | 'approvals' | 'checkpoints' | 'mcp' | 'gives';
export type CenterTab = 'editor' | 'preview' | 'search' | 'context';

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

  // gränssnitt
  leftOpen: boolean;
  rightOpen: boolean;
  rightTab: RightTab;
  centerTab: CenterTab;
  paletteOpen: boolean;
  settingsOpen: boolean;
  skillsOpen: boolean;
  mcpOpen: boolean;
  doctorOpen: boolean;
  memoryOpen: boolean;
  searchQuery: string;
  searchResults: string[];
  mode: 'plan' | 'execute';
  treeOpen: boolean;

  // åtgärder
  bootstrap(): Promise<void>;
  connect(): Promise<void>;
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

  refreshMcp(): Promise<void>;
  saveMcpServers(servers: McpServerConfig[]): Promise<void>;
  connectMcp(serverId: string): Promise<void>;
  disconnectMcp(serverId: string): Promise<void>;

  refreshConnectors(): Promise<void>;
  connectConnector(id: string, secret: string, accountLabel?: string): Promise<void>;
  disconnectConnector(id: string): Promise<string[]>;
  setConnectorEnabled(id: string, enabled: boolean): Promise<void>;

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
  setMcpOpen(open: boolean): void;
  setDoctorOpen(open: boolean): void;
  setMemoryOpen(open: boolean): void;
  setActiveDiff(id: string): void;
}

const LOG_LIMIT = 400;
const TERMINAL_LIMIT = 2_000;

/** Byter ut en connector i listan utan att röra ordningen (katalogen äger ordningen). */
function replaceConnector(connectors: ConnectorView[], view: ConnectorView): ConnectorView[] {
  return connectors.map((entry) => (entry.definition.id === view.definition.id ? view : entry));
}

function logEntry(text: string, level: LogEntry['level'] = 'info'): LogEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    level,
    text,
  };
}

export const useAppStore = create<AppState>((set, get) => {
  /** Hanterar varje AgentEvent från körningen och lägger det på rätt plats i UI:t. */
  function handleEvent(event: AgentEvent): void {
    set((state) => {
      switch (event.type) {
        case 'run_started':
          return {
            isRunning: true,
            streamingText: '',
            reasoningText: '',
            phase: 'thinking',
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
        case 'tool_result':
          return {
            logs: [
              ...state.logs,
              logEntry(
                `← ${event.result.name} (${event.result.durationMs} ms, ${event.result.ok ? 'ok' : 'fel'})`,
                event.result.ok ? 'info' : 'warn',
              ),
            ].slice(-LOG_LIMIT),
          };
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
        case 'error':
          return {
            logs: [...state.logs, logEntry(`${event.code}: ${event.message}`, 'error')].slice(
              -LOG_LIMIT,
            ),
            phase: event.code === 'ollama_unavailable' ? 'idle' : state.phase,
            agentHelpUrl:
              event.code === 'ollama_unavailable'
                ? (state.agentHelpUrl ?? 'https://freevobe.dev/docs/ollama')
                : state.agentHelpUrl,
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
    });
  }

  const ONBOARDING_KEY = 'freevobe.onboardingComplete';

  return {
    connection: null,
    client: null,
    connectionStatus: 'idle',
    connectionError: null,
    agentHelpUrl: null,

    onboardingComplete: window.localStorage.getItem(ONBOARDING_KEY) === '1',
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

    leftOpen: true,
    rightOpen: true,
    rightTab: 'diff',
    centerTab: 'editor',
    paletteOpen: false,
    settingsOpen: false,
    skillsOpen: false,
    mcpOpen: false,
    doctorOpen: false,
    memoryOpen: false,
    searchQuery: '',
    searchResults: [],
    mode: 'execute',
    treeOpen: true,

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
      window.localStorage.setItem(ONBOARDING_KEY, '1');
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
      const { client, sessionId } = get();
      if (!client || !sessionId) return;
      if (get().isRunning) return;

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
        set({
          isRunning: false,
          phase: 'idle',
          logs: [...get().logs, logEntry(String(error), 'error')].slice(-LOG_LIMIT),
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
