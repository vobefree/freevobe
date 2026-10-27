import { create } from 'zustand';
import type {
  AgentEvent,
  AppSettings,
  ApprovalAnswer,
  ApprovalRequest,
  ChatMessage,
  ContextFile,
  DoctorReport,
  FileDiff,
  McpServerConfig,
  McpServerStatus,
  OllamaModel,
  OllamaProbeResult,
  PermissionMode,
  Project,
  Session,
  SkillSummary,
  SubagentStatus,
  TaskItem,
} from '@vibeforge/protocol';
import {
  AgentClient,
  AgentRequestError,
  resolveConnection,
  type AgentConnection,
} from '../lib/agentClient';

export type RightTab = 'diff' | 'terminal' | 'logs' | 'tests' | 'approvals' | 'mcp';
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
  consentAds: boolean;
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
  testResult: { command: string; passed: number; failed: number; output: string } | null;
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
  finishOnboarding(): void;
  setOnboardingStep(step: number): void;
  setConsent(patch: { localData?: boolean; ads?: boolean }): void;

  openProject(path: string, name?: string): Promise<void>;
  refreshProjects(): Promise<void>;
  setPermissionMode(mode: PermissionMode): Promise<void>;
  setMode(mode: 'plan' | 'execute'): Promise<void>;

  newSession(): Promise<void>;
  loadSessions(): Promise<void>;
  selectSession(id: string): Promise<void>;
  deleteSession(id: string): Promise<void>;

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

  refreshMemory(): Promise<void>;
  saveMemory(content: string): Promise<void>;
  runDoctor(): Promise<void>;

  refreshGit(): Promise<void>;
  runTests(): Promise<void>;
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
                ? (state.agentHelpUrl ?? 'https://vibeforge.dev/docs/ollama')
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

  const ONBOARDING_KEY = 'vibeforge.onboardingComplete';

  return {
    connection: null,
    client: null,
    connectionStatus: 'idle',
    connectionError: null,
    agentHelpUrl: null,

    onboardingComplete: window.localStorage.getItem(ONBOARDING_KEY) === '1',
    onboardingStep: 0,
    consentLocalData: false,
    consentAds: false,
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
    testResult: null,
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
        set({ consentAds: settings.ads.enabled });
      } catch (error) {
        set({
          connectionStatus: 'error',
          connectionError: error instanceof AgentRequestError ? error.message : String(error),
          agentHelpUrl: 'https://vibeforge.dev/docs/agent',
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
      set({ settings, consentAds: settings.ads.enabled });
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
        ...(patch.ads === undefined ? {} : { consentAds: patch.ads }),
      });
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
          get().refreshMemory(),
          get().refreshGit(),
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
        streamingText: '',
        logs: [logEntry('Ny chatt startad.')],
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
      set({
        sessionId: id,
        messages,
        tasks,
        streamingText: '',
        diffs: [],
        ...(session ? { mode: session.mode, selectedModel: session.model } : {}),
      });
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
        logs: [...get().logs, logEntry('Du avbröt körningen.')].slice(-LOG_LIMIT),
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

    async runTests() {
      const { client, project, sessionId } = get();
      if (!client || !project || !sessionId) return;
      await get().sendPrompt('Kör testerna och sammanfatta resultatet.');
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
