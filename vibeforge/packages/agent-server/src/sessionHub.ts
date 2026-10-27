import { exec } from 'node:child_process';
import path from 'node:path';
import type {
  AgentEvent,
  AppSettings,
  ApprovalAnswer,
  ApprovalRequest,
  ChatMessage,
  DoctorReport,
  OllamaProbeResult,
  PermissionMode,
  Project,
  Session,
  SubagentKind,
  SubagentStatus,
} from '@vibeforge/protocol';
import {
  AgentLoop,
  ApprovalManager,
  HookRunner,
  OllamaClient,
  SubagentRunner,
  createId,
  createRepositories,
  createToolRuntime,
  databasePath,
  describeError,
  listSubagents,
  loadProjectRules,
  resolveVibeForgeHome,
  runDoctor,
  VibeForgeDatabase,
  buildCommitMessagePrompt,
  type BrowserDriver,
  type Repositories,
  type ChatTurnMessage,
} from '@vibeforge/agent-core';
import { ProjectWorkspace } from './projectService.js';

export interface HubOptions {
  home?: string;
  dbFile?: string;
  ollamaBaseUrl?: string;
  fetchImpl?: typeof fetch;
  /** Injicerbar webbläsardrivrutin (Playwright i produktion, fejk i tester). */
  createBrowserDriver?: () => BrowserDriver | undefined;
}

export type RunSubscriber = (event: AgentEvent) => void;

export interface ActiveRun {
  runId: string;
  sessionId: string;
  projectId: string;
  abort: AbortController;
  subscribers: Set<RunSubscriber>;
  buffer: AgentEvent[];
  pendingApprovals: Set<string>;
  status: 'running' | 'finished';
  startedAt: number;
}

export interface StartRunInput {
  sessionId: string;
  prompt: string;
  model?: string;
  mode?: 'plan' | 'execute';
  permissionMode?: PermissionMode;
  pinnedFiles?: string[];
  supportsTools?: boolean;
}

const MAX_BUFFERED_EVENTS = 2_000;

/**
 * Håller allt som lever längre än en HTTP-förfrågan: öppna projekt, sessioner, pågående
 * agentkörningar, väntande godkännanden och subagenter. En process, många samtidiga körmingar.
 */
export class AgentSessionHub {
  readonly db: VibeForgeDatabase;
  readonly repositories: Repositories;
  readonly home: string;

  private readonly options: HubOptions;
  private readonly workspaces = new Map<string, ProjectWorkspace>();
  private readonly runs = new Map<string, ActiveRun>();
  private readonly approvalOwners = new Map<
    string,
    { runId: string; manager: ApprovalManager; request: ApprovalRequest }
  >();
  private readonly subagentRunner: SubagentRunner | null = null;
  /** Cachad transport. Byggs om när användaren byter bas-URL i inställningarna. */
  private ollamaClient: OllamaClient | null = null;
  private ollamaClientBaseUrl: string | null = null;

  constructor(options: HubOptions = {}) {
    this.options = options;
    this.home = resolveVibeForgeHome(options.home);
    this.db = new VibeForgeDatabase({ file: options.dbFile ?? databasePath(this.home) });
    this.repositories = createRepositories(this.db);
  }

  /**
   * Transporten mot Ollama. Läser alltid den aktuella bas-URL:en, så att ett byte i
   * inställningarna (eller en sparad adress från en tidigare körning) får effekt direkt –
   * annars skulle körningarna fortsätta mot den gamla adressen.
   */
  private resolveOllamaClient(): OllamaClient {
    const baseUrl = this.settings().ollamaBaseUrl;
    if (!this.ollamaClient || this.ollamaClientBaseUrl !== baseUrl) {
      this.ollamaClient = new OllamaClient({
        baseUrl,
        ...(this.options.fetchImpl ? { fetchImpl: this.options.fetchImpl } : {}),
      });
      this.ollamaClientBaseUrl = baseUrl;
    }
    return this.ollamaClient;
  }

  get databaseFile(): string {
    return this.db.file;
  }

  // ---------------------------------------------------------------- inställningar

  settings(): AppSettings {
    const stored = this.repositories.settings.get();
    return { ...stored, ollamaBaseUrl: this.options.ollamaBaseUrl ?? stored.ollamaBaseUrl };
  }

  updateSettings(patch: Partial<AppSettings>): AppSettings {
    const saved = this.repositories.settings.set(patch);
    if (patch.ollamaBaseUrl && patch.ollamaBaseUrl !== this.options.ollamaBaseUrl) {
      this.options.ollamaBaseUrl = patch.ollamaBaseUrl;
    }
    return saved;
  }

  async probeOllama(baseUrl?: string): Promise<OllamaProbeResult> {
    const client = baseUrl
      ? new OllamaClient({
          ...(this.options.fetchImpl ? { fetchImpl: this.options.fetchImpl } : {}),
          baseUrl,
        })
      : this.resolveOllamaClient();
    return client.probe();
  }

  // ---------------------------------------------------------------- projekt

  async openProject(projectPath: string, name?: string): Promise<ProjectWorkspace> {
    const project = this.repositories.projects.upsert(projectPath, name);
    const existing = this.workspaces.get(project.id);
    if (existing) return existing;

    const workspace = await ProjectWorkspace.open({
      project,
      repositories: this.repositories,
      db: this.db,
      home: this.home,
      ...(this.options.fetchImpl ? { fetchImpl: this.options.fetchImpl } : {}),
      ...(this.options.ollamaBaseUrl ? { ollamaBaseUrl: this.options.ollamaBaseUrl } : {}),
      onMcpStatus: (status) =>
        this.broadcastAll({
          type: 'status',
          runId: `mcp:${status.id}`,
          phase: 'idle',
          message: status.connected ? 'mcp-ansluten' : 'mcp-frånkopplad',
        }),
    });

    this.workspaces.set(project.id, workspace);
    return workspace;
  }

  async closeProject(projectId: string): Promise<void> {
    const workspace = this.workspaces.get(projectId);
    if (workspace) await workspace.close();
    this.workspaces.delete(projectId);
  }

  listProjects(): Project[] {
    return this.repositories.projects.list();
  }

  workspace(projectId: string): ProjectWorkspace | null {
    return this.workspaces.get(projectId) ?? null;
  }

  requireWorkspace(projectId: string): ProjectWorkspace {
    const workspace = this.workspaces.get(projectId);
    if (!workspace) throw new Error(`Projektet ${projectId} är inte öppet.`);
    return workspace;
  }

  async loadProjectContext(projectId: string): Promise<void> {
    const workspace = this.requireWorkspace(projectId);
    await workspace.reload();
    await workspace.index();
  }

  async doctor(projectId?: string): Promise<DoctorReport> {
    const settings = this.settings();
    if (!projectId) {
      return runDoctor({
        vibeForgeHome: this.home,
        ollamaBaseUrl: settings.ollamaBaseUrl,
        model: settings.defaultModel,
      });
    }
    return this.requireWorkspace(projectId).doctor(settings.ollamaBaseUrl, settings.defaultModel);
  }

  // ---------------------------------------------------------------- sessioner

  listSessions(projectId: string): Session[] {
    return this.repositories.sessions.list(projectId);
  }

  createSession(
    projectId: string,
    title: string,
    model?: string,
    mode?: 'plan' | 'execute',
  ): Session {
    const settings = this.settings();
    const session = this.repositories.sessions.create({
      projectId,
      title,
      model: model ?? settings.defaultModel,
      ...(mode ? { mode } : {}),
    });
    this.repositories.projects.setLastModel(projectId, session.model);
    return session;
  }

  session(id: string): Session | null {
    return this.repositories.sessions.get(id);
  }

  updateSession(
    id: string,
    patch: { title?: string; mode?: 'plan' | 'execute'; model?: string },
  ): void {
    this.repositories.sessions.update(id, patch);
  }

  deleteSession(id: string): void {
    this.repositories.sessions.delete(id);
  }

  messages(sessionId: string): ChatMessage[] {
    return this.repositories.messages.list(sessionId);
  }

  taskList(sessionId: string) {
    return this.repositories.tasks.list(sessionId);
  }

  addTask(sessionId: string, title: string) {
    return this.repositories.tasks.create(sessionId, title);
  }

  setTaskStatus(id: string, status: 'todo' | 'doing' | 'blocked' | 'done'): void {
    this.repositories.tasks.setStatus(id, status);
  }

  removeTask(id: string): void {
    this.repositories.tasks.remove(id);
  }

  // ---------------------------------------------------------------- körningar

  activeRuns(): Array<{
    runId: string;
    sessionId: string;
    projectId: string;
    startedAt: number;
    status: string;
  }> {
    return [...this.runs.values()].map((run) => ({
      runId: run.runId,
      sessionId: run.sessionId,
      projectId: run.projectId,
      startedAt: run.startedAt,
      status: run.status,
    }));
  }

  activeSubagents(): SubagentStatus[] {
    return [];
  }

  subagentDefinitions() {
    return listSubagents().map((definition) => ({
      kind: definition.kind,
      label: definition.label,
      description: definition.description,
      readOnly: definition.readOnly,
      allowedTools: definition.allowedTools,
    }));
  }

  subscribe(runId: string, subscriber: RunSubscriber): () => void {
    const run = this.runs.get(runId);
    if (!run) return () => undefined;
    for (const event of run.buffer) subscriber(event);
    if (run.status === 'running') {
      run.subscribers.add(subscriber);
      return () => run.subscribers.delete(subscriber);
    }
    return () => undefined;
  }

  abort(runId: string, reason = 'Användaren avbröt körningen.'): boolean {
    const run = this.runs.get(runId);
    if (!run) return false;
    run.abort.abort();
    for (const [id, owner] of [...this.approvalOwners.entries()]) {
      if (owner.runId !== runId) continue;
      owner.manager.cancelAll(reason);
      this.approvalOwners.delete(id);
    }
    return true;
  }

  pendingApprovals(runId?: string): ApprovalRequest[] {
    return [...this.approvalOwners.values()]
      .filter((owner) => !runId || owner.runId === runId)
      .map((owner) => owner.request);
  }

  resolveApproval(
    approvalId: string,
    answer: Omit<ApprovalAnswer, 'approvalId'> & { approvalId?: string },
  ): boolean {
    const owner = this.approvalOwners.get(approvalId);
    if (!owner) return false;
    const resolved = owner.manager.resolve({
      approvalId,
      decision: answer.decision,
      ...(answer.answers ? { answers: answer.answers } : {}),
    });
    if (resolved) {
      this.approvalOwners.delete(approvalId);
      this.repositories.approvals.record({
        id: approvalId,
        sessionId: owner.request.runId,
        kind: owner.request.kind,
        decision: answer.decision,
        ...((owner.request.path ?? owner.request.command)
          ? { target: owner.request.path ?? owner.request.command }
          : {}),
      });
    }
    return resolved;
  }

  /** Startar en körning. Händelser levereras till alla som prenumererar på runId. */
  startRun(input: StartRunInput): ActiveRun {
    const session = this.repositories.sessions.get(input.sessionId);
    if (!session) throw new Error(`Sessionen ${input.sessionId} finns inte.`);

    const workspace = this.requireWorkspace(session.projectId);
    const runId = `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const run: ActiveRun = {
      runId,
      sessionId: session.id,
      projectId: session.projectId,
      abort: new AbortController(),
      subscribers: new Set(),
      buffer: [],
      pendingApprovals: new Set(),
      status: 'running',
      startedAt: Date.now(),
    };
    this.runs.set(runId, run);

    void this.executeRun(run, workspace, input).catch((error) => {
      this.broadcast(run, {
        type: 'error',
        runId,
        code: 'internal_error',
        message: describeError(error),
      });
      this.broadcast(run, { type: 'run_finished', runId, reason: 'error' });
      this.finishRun(run);
    });

    return run;
  }

  private async executeRun(
    run: ActiveRun,
    workspace: ProjectWorkspace,
    input: StartRunInput,
  ): Promise<void> {
    const settings = this.settings();
    const session = this.repositories.sessions.get(run.sessionId);
    const model = input.model ?? session?.model ?? settings.defaultModel;
    const mode = input.mode ?? session?.mode ?? 'execute';
    // Behörighetsläget läses från databasen varje körning: användaren kan ha ändrat det medan
    // projektet var öppet, och den cachade projektposten ska inte få bli gammal.
    const permissionMode =
      input.permissionMode ??
      this.repositories.projects.findById(run.projectId)?.permissionMode ??
      settings.permissionMode;

    const approvalManager = new ApprovalManager({
      onRequest: (request) => {
        this.approvalOwners.set(request.id, {
          runId: run.runId,
          manager: approvalManager,
          request,
        });
        run.pendingApprovals.add(request.id);
      },
      onResolved: (request) => {
        run.pendingApprovals.delete(request.id);
      },
    });

    const hooks = new HookRunner(workspace.rules.hooks, {
      root: workspace.root,
      runCommand: (command, options) => runShellCommand(command, options),
    });

    const browser = workspace.rules.preferences.browserAutomationEnabled
      ? this.options.createBrowserDriver?.()
      : undefined;

    const runtime = createToolRuntime({
      root: workspace.root,
      projectId: workspace.project.id,
      sessionId: run.sessionId,
      runId: run.runId,
      approvals: approvalManager,
      hooks,
      emit: (event) => this.broadcast(run, event),
      signal: run.abort.signal,
      browserAutomationEnabled: settings.browserAutomationEnabled,
      ...(browser ? { browser } : {}),
      ...(this.options.fetchImpl ? { fetchImpl: this.options.fetchImpl } : {}),
      ...(typeof workspace.rules.preferences.testCommand === 'string' &&
      workspace.rules.preferences.testCommand
        ? { testCommandOverride: workspace.rules.preferences.testCommand }
        : {}),
    });

    const loop = new AgentLoop({
      transport: this.resolveOllamaClient(),
      registry: workspace.registry,
      runtime,
      rules: workspace.rules,
      skills: workspace.activeSkills,
      indexer: workspace.indexer,
      maxIterations: workspace.rules.preferences.maxIterations ?? settings.maxIterations,
      contextBudgetChars:
        workspace.rules.preferences.contextBudgetChars ?? settings.contextBudgetChars,
      browserAutomationEnabled: settings.browserAutomationEnabled,
      ...(browser ? { browser } : {}),
      mcpServerApproved: (server) => workspace.mcp.isApproved(server),
    });

    // Användarmeddelandet sparas först, så att sessionen alltid har hela samtalet.
    this.repositories.messages.append({
      id: createId('msg'),
      sessionId: run.sessionId,
      role: 'user',
      content: input.prompt,
      createdAt: Date.now(),
    });

    const history = toHistory(this.repositories.messages.list(run.sessionId).slice(0, -1));

    const supportsTools =
      input.supportsTools ?? (await this.modelSupportsTools(model, settings.ollamaBaseUrl));

    for await (const event of loop.run({
      runId: run.runId,
      sessionId: run.sessionId,
      mode,
      permissionMode,
      model,
      userMessage: input.prompt,
      history,
      pinnedFiles: input.pinnedFiles ?? [],
      recentFiles: recentPaths(workspace.root),
      signal: run.abort.signal,
      supportsTools,
      projectName: workspace.project.name,
    })) {
      this.broadcast(run, event);
      this.persistEvent(run, event, model);
      if (event.type === 'run_finished') this.finishRun(run);
    }

    if (run.status === 'running') this.finishRun(run);
    await browser?.close().catch(() => undefined);
  }

  private persistEvent(run: ActiveRun, event: AgentEvent, model: string): void {
    if (event.type === 'assistant_message' && event.text.trim() !== '') {
      this.repositories.messages.append({
        id: event.messageId,
        sessionId: run.sessionId,
        role: 'assistant',
        content: event.text,
        model,
        createdAt: Date.now(),
      });
      return;
    }
    if (event.type === 'tool_result') {
      this.repositories.messages.append({
        // Raden får ett eget id: anropets id kommer från modellen och kan upprepas mellan
        // varv (eller mellan sessioner), och får därför inte vara primärnyckel.
        id: createId('msg'),
        sessionId: run.sessionId,
        role: 'tool',
        content: event.result.content.slice(0, 4_000),
        toolCallId: event.result.callId,
        createdAt: Date.now(),
      });
    }
  }

  private broadcast(run: ActiveRun, event: AgentEvent): void {
    run.buffer.push(event);
    if (run.buffer.length > MAX_BUFFERED_EVENTS) run.buffer.shift();
    for (const subscriber of run.subscribers) {
      try {
        subscriber(event);
      } catch {
        run.subscribers.delete(subscriber);
      }
    }
  }

  private broadcastAll(event: AgentEvent): void {
    for (const run of this.runs.values()) {
      if (run.status !== 'running') continue;
      this.broadcast(run, event);
    }
  }

  private finishRun(run: ActiveRun): void {
    run.status = 'finished';
    run.subscribers.clear();
  }

  private async modelSupportsTools(model: string, baseUrl: string): Promise<boolean> {
    try {
      const client = new OllamaClient({
        ...(this.options.fetchImpl ? { fetchImpl: this.options.fetchImpl } : {}),
        baseUrl,
      });
      const details = await client.showModel(model);
      return details.supportsTools;
    } catch {
      // Kunde inte fråga Ollama: anta att verktyg fungerar, och låt textuella anrop vara reservvägen.
      return true;
    }
  }

  /** Kör en underagent mot samma projekt. Används av UI:ts subagent-panel. */
  async runSubagent(
    projectId: string,
    kind: SubagentKind,
    task: string,
    sessionId: string,
  ): Promise<{ summary: string; status: string }> {
    const workspace = this.requireWorkspace(projectId);
    const settings = this.settings();

    const approvalManager = new ApprovalManager();
    const runtime = createToolRuntime({
      root: workspace.root,
      projectId,
      sessionId,
      runId: `sub_${Date.now().toString(36)}`,
      approvals: approvalManager,
      hooks: new HookRunner(workspace.rules.hooks, {
        root: workspace.root,
        runCommand: (command, options) => runShellCommand(command, options),
      }),
      emit: () => undefined,
      signal: new AbortController().signal,
      browserAutomationEnabled: settings.browserAutomationEnabled,
      ...(this.options.fetchImpl ? { fetchImpl: this.options.fetchImpl } : {}),
    });

    const runner = new SubagentRunner({
      transport: this.resolveOllamaClient(),
      registry: workspace.registry,
      runtime,
      rules: workspace.rules,
      skills: workspace.activeSkills,
      model: settings.defaultModel,
      permissionMode: 'ask',
      indexer: workspace.indexer,
    });

    const result = await runner.run({ kind, task, signal: new AbortController().signal });
    return { summary: result.summary, status: result.status };
  }

  async commit(
    projectId: string,
    message?: string,
    files?: string[],
  ): Promise<{ hash: string; message: string }> {
    const workspace = this.requireWorkspace(projectId);
    const { executeGit } = await import('./gitService.js');

    if (files && files.length > 0) {
      const staged = await executeGit(workspace.root, ['add', '--', ...files]);
      if (staged.exitCode !== 0)
        throw new Error(staged.output.trim() || 'Kunde inte staginga filerna.');
    }

    const diff = await executeGit(workspace.root, ['diff', '--cached']);
    if (diff.output.trim() === '') throw new Error('Inget är stagingat att committa.');

    let finalMessage = message?.trim();
    if (!finalMessage) {
      finalMessage = await this.suggestCommitMessage(workspace.project.id, diff.output);
    }

    const commit = await executeGit(workspace.root, ['commit', '-m', finalMessage]);
    if (commit.exitCode !== 0) throw new Error(commit.output.trim() || 'Commit misslyckades.');

    const hash = (await executeGit(workspace.root, ['rev-parse', '--short', 'HEAD'])).output.trim();
    return { hash, message: finalMessage };
  }

  async suggestCommitMessage(projectId: string, diff: string): Promise<string> {
    const settings = this.settings();
    const client = new OllamaClient({
      ...(this.options.fetchImpl ? { fetchImpl: this.options.fetchImpl } : {}),
      baseUrl: settings.ollamaBaseUrl,
    });
    let answer = '';
    for await (const chunk of client.chat({
      model: settings.defaultModel,
      messages: [
        { role: 'system', content: 'Du skriver korta, korrekta commit-meddelanden på svenska.' },
        { role: 'user', content: buildCommitMessagePrompt(diff) },
      ],
    })) {
      if (chunk.contentDelta) answer += chunk.contentDelta;
    }
    const cleaned = answer
      .replace(/^```[a-z]*\n?/i, '')
      .replace(/```$/, '')
      .trim();
    if (cleaned === '') throw new Error('Modellen gav inget förslag. Skriv ett meddelande själv.');
    return cleaned.split('\n').slice(0, 6).join('\n');
  }

  close(): void {
    for (const run of this.runs.values()) run.abort.abort();
    for (const workspace of this.workspaces.values()) void workspace.close();
    this.workspaces.clear();
    this.db.close();
  }
}

/** Gör databasens meddelanden till samtalshistorik för modellen. */
export function toHistory(messages: ChatMessage[]): ChatTurnMessage[] {
  return messages
    .filter((message) => message.role !== 'system')
    .map((message) => {
      if (message.role === 'tool') {
        return {
          role: 'tool' as const,
          content: message.content,
          ...(message.toolCallId ? { toolCallId: message.toolCallId } : {}),
        };
      }
      if (message.role === 'assistant') {
        return {
          role: 'assistant' as const,
          content: message.content,
          ...(message.toolCalls
            ? {
                toolCalls: message.toolCalls.map((call) => ({
                  id: call.id,
                  name: call.name,
                  args: call.args,
                  rawArguments: JSON.stringify(call.args ?? {}),
                })),
              }
            : {}),
        };
      }
      return { role: 'user' as const, content: message.content };
    });
}

function recentPaths(root: string): string[] {
  void root;
  return [];
}

/** Kör ett hook-kommando. Hooks skrivs av användaren själv i .vibeforge/hooks.json. */
export function runShellCommand(
  command: string,
  options: { cwd: string; timeoutMs: number },
): Promise<{ output: string; exitCode: number }> {
  return new Promise((resolve) => {
    exec(
      command,
      {
        cwd: options.cwd,
        timeout: options.timeoutMs,
        maxBuffer: 4 * 1024 * 1024,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (error) {
          const code =
            typeof (error as { code?: number }).code === 'number'
              ? Number((error as { code: number }).code)
              : 1;
          resolve({ output: `${stdout}${stderr}${error.message}`, exitCode: code });
          return;
        }
        resolve({ output: `${stdout}${stderr}`, exitCode: 0 });
      },
    );
  });
}

export { loadProjectRules, path };
