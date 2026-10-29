import { consumeSseStream } from '@/lib/sse';
import { ApiError, apiErrorCodeForStatus, type FreevobeApi } from './client';
import * as desktop from './desktop';
import type {
  AgentEvent,
  ApprovalAnswer,
  ApprovalRequest,
  ChatMessage,
  DesktopHealth,
  DesktopSnapshot,
  GitStatus,
  Mission,
  MissionDetail,
  SendPromptInput,
  StartRunResult,
  TerminalEntry,
} from './types';

/**
 * Live-adapter mot Freevobe Desktop.
 *
 * Skrivbordets API beskrivs i README (avsnittet "Endpoints Freevobe Desktop måste exponera"). Allt
 * den här filen gör är att översätta mobilanrop till de vägarna och att mappa svaren genom
 * `desktop.ts`.
 */

export interface HttpApiOptions {
  /** Basadress utan avslutande snedstreck, t.ex. http://192.168.1.20:4319 */
  baseUrl: string;
  token: string;
  /** Projektet som missioner och git-status hämtas för. */
  projectId: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Skrivbordet kräver sitt token i ett eget huvud. Samma huvudnamn används av skrivbordet och
 * webbläsarläget, så det finns bara ett att hålla reda på.
 */
export function authHeaders(token: string): Record<string, string> {
  return { 'x-freevobe-token': token };
}

/** Tar bort avslutande snedstreck så att sökvägar kan läggas på utan dubbla snedstreck. */
export function normalizeBaseUrl(input: string): string {
  return input.trim().replace(/\/+$/, '');
}

export function createHttpApi(options: HttpApiOptions): FreevobeApi {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const doFetch: typeof fetch = options.fetchImpl ?? ((...args) => fetch(...args));
  const timeoutMs = options.timeoutMs ?? 15_000;

  /** Strömmar har ingen timeout – en körning kan pågå i minuter. */
  async function request(path: string, init: RequestInit = {}, withTimeout = true): Promise<Response> {
    const controller = new AbortController();
    const timer = withTimeout ? setTimeout(() => controller.abort(), timeoutMs) : null;
    let response: Response;
    try {
      response = await doFetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          accept: 'application/json',
          ...authHeaders(options.token),
          ...(init.body ? { 'content-type': 'application/json' } : {}),
          ...(init.headers as Record<string, string> | undefined),
        },
        signal: init.signal ?? controller.signal,
      });
    } catch {
      throw new ApiError(
        'unreachable',
        `Kunde inte nå datorn på ${baseUrl}. Kontrollera att Freevobe Desktop kör och att telefonen är på samma nätverk.`,
      );
    } finally {
      if (timer) clearTimeout(timer);
    }

    if (!response.ok) {
      const code = apiErrorCodeForStatus(response.status);
      throw new ApiError(code, await describeFailure(code, response), response.status);
    }
    return response;
  }

  async function json(path: string, init?: RequestInit): Promise<unknown> {
    const response = await request(path, init);
    try {
      return (await response.json()) as unknown;
    } catch {
      throw new ApiError('bad-response', 'Datorn svarade med något som inte är JSON.');
    }
  }

  /** Lägger på projektet som query-parameter (sessionslistan kräver den). */
  function withProject(path: string): string {
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}projectId=${encodeURIComponent(options.projectId)}`;
  }

  /** Sökväg under projektet, t.ex. `/git/status`. */
  function projectPath(suffix: string): string {
    return `/api/projects/${encodeURIComponent(options.projectId)}${suffix}`;
  }

  return {
    mode: 'live',

    async health(): Promise<DesktopHealth> {
      const parsed = desktop.readHealth(await json('/api/health'));
      if (!parsed) throw new ApiError('bad-response', 'Hälsosvaret saknade förväntade fält.');
      return {
        ok: parsed.ok,
        name: parsed.name,
        protocol: parsed.protocol,
        port: parsed.port,
      };
    },

    async snapshot(): Promise<DesktopSnapshot> {
      const [health, settings, projects, runs, approvals] = await Promise.all([
        json('/api/health'),
        json('/api/settings').catch(() => null),
        json('/api/projects').catch(() => []),
        json('/api/runs').catch(() => []),
        json('/api/approvals').catch(() => []),
      ]);

      const parsedHealth = desktop.readHealth(health);
      if (!parsedHealth) throw new ApiError('bad-response', 'Hälsosvaret saknade förväntade fält.');

      const settingsRecord =
        settings && typeof settings === 'object' ? (settings as Record<string, unknown>) : null;
      const defaultModel = settingsRecord?.defaultModel;

      const activeRuns = desktop.readRuns(runs).filter((run) => run.status === 'running');

      return {
        health: {
          ok: parsedHealth.ok,
          name: parsedHealth.name,
          protocol: parsedHealth.protocol,
          port: parsedHealth.port,
        },
        activeModel: typeof defaultModel === 'string' && defaultModel ? defaultModel : null,
        projects: desktop.readProjects(projects).map(desktop.toProjectSummary),
        activeSessions: activeRuns.length,
        pendingApprovals: desktop.readApprovals(approvals).length,
      };
    },

    async missions(): Promise<Mission[]> {
      const [sessions, runs, approvals, git] = await Promise.all([
        json(withProject('/api/sessions')),
        json('/api/runs'),
        json('/api/approvals'),
        json(projectPath('/git/status')).catch(() => null),
      ]);

      const parsedRuns = desktop.readRuns(runs);
      const parsedApprovals = desktop.readApprovals(approvals);

      return desktop.readSessions(sessions).map((session) => {
        const sessionRuns = parsedRuns.filter((run) => run.sessionId === session.id);
        const runIds = new Set(sessionRuns.map((run) => run.runId));
        return desktop.toMission(session, {
          tasks: [],
          runs: sessionRuns,
          approvals: parsedApprovals.filter((approval) => runIds.has(approval.runId)),
          files: git ? desktop.toFileChanges(readGitFiles(git)) : [],
        });
      });
    },

    async mission(sessionId: string): Promise<MissionDetail> {
      const encoded = encodeURIComponent(sessionId);
      const [sessions, tasks, messages, runs, approvals, git] = await Promise.all([
        json(withProject('/api/sessions')),
        json(`/api/sessions/${encoded}/tasks`).catch(() => []),
        json(`/api/sessions/${encoded}/messages`),
        json('/api/runs'),
        json('/api/approvals'),
        json(projectPath('/git/status')).catch(() => null),
      ]);

      const session = desktop
        .readSessions(sessions)
        .find((candidate) => candidate.id === sessionId);
      if (!session) throw new ApiError('not-found', 'Missionen finns inte längre på datorn.');

      const sessionRuns = desktop.readRuns(runs).filter((run) => run.sessionId === sessionId);
      const runIds = new Set(sessionRuns.map((run) => run.runId));
      const sessionApprovals = desktop
        .readApprovals(approvals)
        .filter((approval) => runIds.has(approval.runId));
      const parsedMessages = desktop.readMessages(messages);

      const mission = desktop.toMission(session, {
        tasks: desktop.readTasks(tasks),
        runs: sessionRuns,
        approvals: sessionApprovals,
        files: git ? desktop.toFileChanges(readGitFiles(git)) : [],
      });

      return {
        ...mission,
        approvals: sessionApprovals,
        logs: parsedMessages.map(desktop.toTerminalEntry),
        messages: parsedMessages.map(desktop.toChatMessage),
        diff: sessionApprovals.find((approval) => approval.diff)?.diff ?? null,
        tests: null,
      };
    },

    async messages(sessionId: string): Promise<ChatMessage[]> {
      const raw = await json(`/api/sessions/${encodeURIComponent(sessionId)}/messages`);
      return desktop.readMessages(raw).map(desktop.toChatMessage);
    },

    async sendPrompt(input: SendPromptInput): Promise<StartRunResult> {
      const raw = await json('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: input.sessionId,
          prompt: input.prompt,
          ...(input.model ? { model: input.model } : {}),
        }),
      });
      const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
      const runId = typeof record.runId === 'string' ? record.runId : null;
      if (!runId) throw new ApiError('bad-response', 'Datorn startade ingen körning.');
      return {
        runId,
        eventsUrl: typeof record.eventsUrl === 'string' ? record.eventsUrl : `/api/runs/${runId}/events`,
      };
    },

    async abortRun(runId: string): Promise<{ aborted: boolean }> {
      const raw = await json(`/api/runs/${encodeURIComponent(runId)}/abort`, { method: 'POST' });
      const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
      return { aborted: record.aborted === true };
    },

    subscribeToRun(runId: string, handler: (event: AgentEvent) => void): () => void {
      const controller = new AbortController();
      let closed = false;

      void (async () => {
        try {
          const response = await request(
            `/api/runs/${encodeURIComponent(runId)}/events`,
            { headers: { accept: 'text/event-stream' }, signal: controller.signal },
            false,
          );
          await consumeSseStream(
            response,
            {
              onMessage: (_event, parsed) => {
                if (closed) return;
                const event = parsed as AgentEvent | null;
                if (event && typeof event === 'object' && 'type' in event) handler(event);
              },
            },
            controller.signal,
          );
        } catch {
          // Strömmen avbröts eller dog. Anroparen ser slutet via händelser eller hämtar om status.
        }
      })();

      return () => {
        closed = true;
        controller.abort();
      };
    },

    async approvals(): Promise<ApprovalRequest[]> {
      return desktop.readApprovals(await json('/api/approvals'));
    },

    async approval(approvalId: string): Promise<ApprovalRequest | null> {
      const all = desktop.readApprovals(await json('/api/approvals'));
      return all.find((approval) => approval.id === approvalId) ?? null;
    },

    async resolveApproval(approvalId: string, answer: ApprovalAnswer): Promise<void> {
      await json(`/api/approvals/${encodeURIComponent(approvalId)}`, {
        method: 'POST',
        body: JSON.stringify({
          decision: answer.decision,
          ...(answer.answers ? { answers: answer.answers } : {}),
          ...(answer.rememberForSession ? { rememberForSession: answer.rememberForSession } : {}),
        }),
      });
    },

    async logs(sessionId?: string): Promise<TerminalEntry[]> {
      if (!sessionId) return [];
      const raw = await json(`/api/sessions/${encodeURIComponent(sessionId)}/messages`);
      return desktop.readMessages(raw).map(desktop.toTerminalEntry);
    },

    async gitStatus(projectId: string): Promise<GitStatus> {
      const raw = await json(`/api/projects/${encodeURIComponent(projectId)}/git/status`);
      const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
      return {
        branch: typeof record.branch === 'string' ? record.branch : '',
        ...(typeof record.ahead === 'number' ? { ahead: record.ahead } : {}),
        ...(typeof record.behind === 'number' ? { behind: record.behind } : {}),
        files: readGitFiles(raw),
      };
    },
  };
}

function readGitFiles(value: unknown): { path: string; index: string; worktree: string; staged: boolean }[] {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const files = Array.isArray(record.files) ? record.files : [];
  return files.flatMap((entry) => {
    const file = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : null;
    const path = file && typeof file.path === 'string' ? file.path : null;
    if (!file || !path) return [];
    return [
      {
        path,
        index: typeof file.index === 'string' ? file.index : '',
        worktree: typeof file.worktree === 'string' ? file.worktree : '',
        staged: file.staged === true,
      },
    ];
  });
}

async function describeFailure(code: ApiError['code'], response: Response): Promise<string> {
  if (code === 'unauthorized') {
    return 'Datorn nekade parningen. Öppna Freevobe Desktop och para ihop telefonen igen.';
  }
  if (code === 'not-found') return 'Datorn känner inte igen den här adressen.';
  try {
    const body = (await response.clone().text()).slice(0, 200);
    return body.trim() || `Datorn svarade med status ${response.status}.`;
  } catch {
    return `Datorn svarade med status ${response.status}.`;
  }
}
