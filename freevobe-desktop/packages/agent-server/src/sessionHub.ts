import { exec } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  AgentEvent,
  AppSettings,
  ApprovalAnswer,
  ApprovalRequest,
  ChatMessage,
  Checkpoint,
  CheckpointDiff,
  CheckpointRestoreReport,
  DoctorReport,
  GivesBackPayload,
  OllamaProbeResult,
  PermissionMode,
  Plan,
  Project,
  Session,
  SubagentKind,
  SubagentStatus,
  VerificationCommand,
  VerificationKind,
  VerificationReport,
} from '@freevobe/protocol';
import { AUTO_VERIFICATION_KINDS } from '@freevobe/protocol';
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
  resolveFreevobeHome,
  runDoctor,
  FreevobeDatabase,
  buildCommitMessagePrompt,
  detectVerificationCommands,
  filterVerificationCommands,
  runVerification,
  type BrowserDriver,
  type RecordedChange,
  type Repositories,
  type ChatTurnMessage,
} from '@freevobe/agent-core';
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
  readonly db: FreevobeDatabase;
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
    this.home = resolveFreevobeHome(options.home);
    this.db = new FreevobeDatabase({ file: options.dbFile ?? databasePath(this.home) });
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
        freevobeHome: this.home,
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

  // ---------------------------------------------------------------- planer

  /** Alla planer i en session, nyast först. Den aktiva planen är kontraktet. */
  listPlans(sessionId: string): Plan[] {
    return this.repositories.plans.listBySession(sessionId);
  }

  plan(planId: string): Plan | null {
    return this.repositories.plans.get(planId);
  }

  /**
   * Användarens beslut om en plan. Ett godkännande gör planen till sessionens kontrakt och
   * växlar sessionen till Execute-läget – men det startar ingen körning. Sändningen sker i UI:t.
   */
  decidePlan(planId: string, decision: 'approved' | 'rejected'): Plan | null {
    const updated = this.repositories.plans.decide(planId, decision);
    if (!updated) return null;

    if (decision === 'approved') {
      this.repositories.sessions.update(updated.sessionId, { mode: 'execute' });
    }
    for (const run of this.runs.values()) {
      if (run.sessionId !== updated.sessionId) continue;
      this.broadcast(run, {
        type: 'plan_decided',
        runId: run.runId,
        planId: updated.id,
        status: updated.status,
      });
    }
    return updated;
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

    // En checkpoint per körning. Den skapas först när en fil faktiskt ändras, så en körning som
    // bara läser kod lämnar inget skräp i tidslinjen.
    const checkpoint = workspace.checkpoints.begin({
      projectId: run.projectId,
      sessionId: run.sessionId,
      runId: run.runId,
      label: checkpointLabel(input.prompt),
      reason: 'agent-run',
      onChange: (saved) =>
        this.broadcast(run, { type: 'checkpoint', runId: run.runId, checkpoint: saved }),
    });

    // Verktygens egna händelser (bland annat `file_changed`) går direkt till prenumeranterna och
    // passerar aldrig loopens ström – därför måste filbytet fångas redan här.
    let filesChanged = false;

    const runtime = createToolRuntime({
      root: workspace.root,
      projectId: workspace.project.id,
      sessionId: run.sessionId,
      runId: run.runId,
      approvals: approvalManager,
      hooks,
      recordChange: (change) => checkpoint.record(change),
      emit: (event) => {
        if (event.type === 'file_changed') filesChanged = true;
        this.broadcast(run, event);
      },
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
      autoApprove: settings.autoApprove,
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
    // Den godkända planen är sessionens kontrakt och följer med in i varje Execute-körning.
    const activePlan = this.repositories.plans.active(run.sessionId);

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
      ...(activePlan ? { plan: activePlan } : {}),
    })) {
      if (event.type === 'file_changed') filesChanged = true;

      // Verifieringen körs innan sista händelsen skickas, så att rapporten hinner fram medan
      // klienten fortfarande lyssnar på körningen.
      if (
        event.type === 'run_finished' &&
        event.reason === 'final' &&
        filesChanged &&
        settings.verifyAfterRun
      ) {
        this.broadcast(run, {
          type: 'status',
          runId: run.runId,
          phase: 'testing',
          message: 'Verifierar projektet',
        });
        try {
          await this.verifyProject(run.projectId, {
            sessionId: run.sessionId,
            runId: run.runId,
            trigger: 'run',
            kinds: AUTO_VERIFICATION_KINDS,
            onEvent: (verificationEvent) => this.broadcast(run, verificationEvent),
          });
        } catch (error) {
          this.broadcast(run, {
            type: 'error',
            runId: run.runId,
            code: 'verification_failed',
            message: describeError(error),
          });
        }
      }

      if (event.type === 'tests') {
        await checkpoint.setTests({
          status: event.failed > 0 ? 'failed' : 'passed',
          summary: `${event.passed} godkända, ${event.failed} underkända · ${event.command}`,
        });
      }
      // Checkpointen skrivs klart innan sista händelsen skickas, så att klienten hinner se den.
      if (event.type === 'run_finished') await checkpoint.finish();
      this.broadcast(run, event);
      this.persistEvent(run, event, model);
      if (event.type === 'run_finished') this.finishRun(run);
    }

    await checkpoint.finish();
    if (run.status === 'running') this.finishRun(run);
    await browser?.close().catch(() => undefined);
  }

  private persistEvent(run: ActiveRun, event: AgentEvent, model: string): void {
    if (event.type === 'plan_proposed') {
      this.repositories.plans.create(event.plan);
      return;
    }
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

  // ---------------------------------------------------------------- verifiering

  /** Projektets verifieringssteg, för panelen som visar vad som kan köras. */
  async verificationCommands(projectId: string): Promise<VerificationCommand[]> {
    return detectVerificationCommands(this.requireWorkspace(projectId).root);
  }

  /**
   * Kör projektets egna kontroller. `onEvent` låter anroparen strömma stegen till en pågående
   * körning; rapporten sparas alltid, oavsett vem som bad om den.
   */
  async verifyProject(
    projectId: string,
    options: {
      sessionId?: string;
      runId?: string;
      trigger?: VerificationReport['trigger'];
      kinds?: readonly VerificationKind[];
      onEvent?: (event: AgentEvent) => void;
    } = {},
  ): Promise<VerificationReport> {
    const workspace = this.requireWorkspace(projectId);
    const trigger = options.trigger ?? 'manual';
    const runId = options.runId ?? `verify:${projectId}`;
    const emit = options.onEvent ?? (() => undefined);
    const commands = filterVerificationCommands(
      await detectVerificationCommands(workspace.root),
      options.kinds,
    );

    emit({ type: 'verification_started', runId, trigger, commands });

    const report = await runVerification({
      root: workspace.root,
      projectId,
      trigger,
      commands,
      ...(options.sessionId ? { sessionId: options.sessionId } : {}),
      ...(options.runId ? { runId: options.runId } : {}),
      run: (command, runOptions) => runVerificationCommand(command, runOptions),
      onCheck: (check) => emit({ type: 'verification_check', runId, check }),
    });

    emit({ type: 'verification', runId, report });
    this.repositories.verifications.create(report);
    return report;
  }

  listVerifications(projectId: string, limit = 20): VerificationReport[] {
    return this.repositories.verifications.list(projectId, limit);
  }

  // ---------------------------------------------------------------- gives back

  /**
   * Användarens egen påverkanslogg. Inget här är kopplat till ett projekt, ett konto eller en
   * betalning – det är samma lokala databas som resten av appen, och raden raderas på begäran.
   */
  givesBack(limit = 200): GivesBackPayload {
    return {
      entries: this.repositories.givesBack.list(limit),
      summary: this.repositories.givesBack.summary(),
    };
  }

  addContribution(input: { causeId: string; amountSek?: number; note?: string }): GivesBackPayload {
    this.repositories.givesBack.add({
      causeId: input.causeId,
      ...(input.amountSek === undefined ? {} : { amountSek: input.amountSek }),
      ...(input.note ? { note: input.note } : {}),
    });
    return this.givesBack();
  }

  removeContribution(id: string): GivesBackPayload & { removed: boolean } {
    const removed = this.repositories.givesBack.remove(id);
    return { ...this.givesBack(), removed };
  }

  // ---------------------------------------------------------------- checkpoints

  listCheckpoints(projectId: string): Checkpoint[] {
    return this.requireWorkspace(projectId).checkpoints.list(projectId);
  }

  /**
   * En checkpoint som användaren själv väljer att spara: nuvarande innehåll i filerna som ändrats
   * i arbetskopian. Den kan återställas precis som agentens egna checkpoints.
   */
  async createCheckpoint(projectId: string, label?: string): Promise<Checkpoint> {
    const workspace = this.requireWorkspace(projectId);
    const status = await workspace.gitStatus();
    // Appens egen stomme och beroendemappar hör inte hemma i en checkpoint: de är antingen
    // återskapade av appen själv eller för stora för att snapshotas.
    const changed = status.files.filter((file) => {
      const relative = file.path.replace(/\\/g, '/');
      if (relative.endsWith('/')) return false;
      return !['.freevobe/', '.git/', 'node_modules/'].some((prefix) =>
        relative.startsWith(prefix),
      );
    });
    if (changed.length === 0) {
      throw new Error(
        'Inga ändrade filer att spara. Gör en ändring först, eller låt agenten skapa checkpointen åt dig.',
      );
    }

    const files: RecordedChange[] = [];
    for (const file of changed) {
      let content: string | null = null;
      try {
        content = await fs.readFile(path.join(workspace.root, file.path), 'utf8');
      } catch {
        content = null;
      }
      const changeKind = file.index === 'D' || file.worktree === 'D' ? 'delete' : 'update';
      files.push({
        path: file.path,
        beforeContent: content,
        afterContent: content,
        additions: 0,
        deletions: 0,
        changeKind,
      });
    }

    return workspace.checkpoints.createManual({
      projectId,
      label: label?.trim() || 'Manuell checkpoint',
      files,
    });
  }

  checkpoint(checkpointId: string): Checkpoint | null {
    return this.checkpointWorkspace(checkpointId).checkpoints.get(checkpointId);
  }

  async checkpointDiff(checkpointId: string): Promise<CheckpointDiff> {
    const workspace = this.checkpointWorkspace(checkpointId);
    return workspace.checkpoints.diff(checkpointId);
  }

  async restoreCheckpoint(
    checkpointId: string,
    options: { force?: boolean } = {},
  ): Promise<CheckpointRestoreReport> {
    const workspace = this.checkpointWorkspace(checkpointId);
    return workspace.checkpoints.restore(checkpointId, options);
  }

  async discardCheckpoint(checkpointId: string): Promise<boolean> {
    const workspace = this.checkpointWorkspace(checkpointId);
    return workspace.checkpoints.discard(checkpointId);
  }

  /** Committar filerna i en checkpoint till Git. Checkpointen finns kvar som historik. */
  async commitCheckpoint(
    checkpointId: string,
    message?: string,
  ): Promise<{ hash: string; message: string }> {
    const workspace = this.checkpointWorkspace(checkpointId);
    const checkpoint = workspace.checkpoints.get(checkpointId);
    if (!checkpoint) throw new Error(`Checkpointen ${checkpointId} finns inte.`);
    const result = await this.commit(
      checkpoint.projectId,
      message,
      checkpoint.files.map((file) => file.path),
    );
    await workspace.checkpoints.markCommitted(checkpointId, result.hash);
    return result;
  }

  /**
   * Checkpointens eget projekt – inte det första öppna. Alla projekt delar databas, så en rad syns
   * från vilken arbetskopia som helst; att läsa eller skriva filerna i fel projekt vore förödande.
   */
  private checkpointWorkspace(checkpointId: string): ProjectWorkspace {
    const [first] = this.workspaces.values();
    if (!first) throw new Error('Inget projekt är öppet.');
    const projectId = first.checkpoints.projectIdOf(checkpointId);
    if (!projectId) throw new Error(`Checkpointen ${checkpointId} finns inte.`);
    const workspace = this.workspaces.get(projectId);
    if (!workspace) {
      throw new Error(`Projektet för checkpointen ${checkpointId} är inte öppet.`);
    }
    return workspace;
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

/** Första meningen i prompten blir checkpointens namn i tidslinjen. */
function checkpointLabel(prompt: string): string {
  const firstLine = prompt.trim().split('\n')[0] ?? '';
  const trimmed = firstLine.replace(/\s+/g, ' ').trim();
  if (trimmed === '') return 'Agentkörning';
  return trimmed.length > 72 ? `${trimmed.slice(0, 71)}…` : trimmed;
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

/** Kör ett hook-kommando. Hooks skrivs av användaren själv i .freevobe/hooks.json. */
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

/**
 * Kör ett verifieringskommando. Till skillnad från hook-kommandon behöver rapporten veta om
 * tidsgränsen slog till, så att steget kan markeras som `timeout` i stället för `failed`.
 */
export function runVerificationCommand(
  command: string,
  options: { cwd: string; timeoutMs: number },
): Promise<{ output: string; exitCode: number | null; timedOut: boolean }> {
  return new Promise((resolve) => {
    exec(
      command,
      {
        cwd: options.cwd,
        timeout: options.timeoutMs,
        maxBuffer: 8 * 1024 * 1024,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        const output = `${stdout}${stderr}`;
        if (!error) {
          resolve({ output, exitCode: 0, timedOut: false });
          return;
        }
        const timedOut = Boolean((error as { killed?: boolean }).killed);
        const code = (error as { code?: unknown }).code;
        resolve({
          output: `${output}${error.message}`,
          exitCode: typeof code === 'number' ? code : 1,
          timedOut,
        });
      },
    );
  });
}

export { loadProjectRules, path };
