import { ApiError, type FreevobeApi } from './client';
import {
  approveDiff,
  makeDiff,
  MOCK_DESKTOP,
  mockGitStatus,
  seedApprovals,
  seedChat,
  seedLogs,
  seedMissions,
} from './fixtures';
import type {
  AgentEvent,
  AgentPhase,
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
  TestSummary,
} from './types';

/**
 * Mock-adapter. Spelar upp ett trovärdigt förlopp – kontext, verktygsanrop, godkännande, diff, tester
 * och avslut – så att hela appen kan användas och granskas utan Freevobe Desktop.
 *
 * Tidsstyrningen sker med `setTimeout`, vilket gör förloppet förutsägbart i tester: använd
 * `vi.useFakeTimers()` och spola fram tiden i stället för att sova.
 */

export interface MockApiOptions {
  /** Fördröjning per nätverksanrop. 0 i tester. */
  latencyMs?: number;
  /** Hur länge mocken väntar på ett godkännande innan den ger upp. */
  approvalTimeoutMs?: number;
}

interface MockRun {
  runId: string;
  sessionId: string;
  prompt: string;
  events: AgentEvent[];
  subscribers: Set<(event: AgentEvent) => void>;
  running: boolean;
  abort: () => void;
}

/**
 * Nyckeln för "samma åtgärd": filvägen respektive kommandoraden.
 *
 * Två godkännanden med samma nyckel är två frågor om samma sak, och då ska bara en av dem vänta på
 * svar – annars listas samma filändring två gånger med olika ålder.
 */
function approvalSubject(approval: ApprovalRequest): string {
  if (approval.kind === 'terminal') {
    return `terminal:${[approval.command, ...(approval.args ?? [])].filter(Boolean).join(' ')}`;
  }
  return `${approval.kind}:${approval.path ?? approval.id}`;
}

export function createMockApi(options: MockApiOptions = {}): FreevobeApi {
  const latency = options.latencyMs ?? 120;
  const approvalTimeoutMs = options.approvalTimeoutMs ?? 120_000;

  let approvals: ApprovalRequest[] = seedApprovals();
  const sessions = seedMissions.map((seed) => ({
    ...seed,
    createdAt: Date.now() + seed.updatedAtOffsetMs,
    updatedAt: Date.now() + seed.updatedAtOffsetMs,
    messages: seedChat(seed.id),
    logs: seedLogs(seed.id),
    tests: null as TestSummary | null,
    // Den seedade prisändringen har en färdig diff, så att detaljvyn har något att visa direkt.
    diff: (seed.id === 'session.pricing' ? approveDiff : null) as MissionDetail['diff'],
  }));

  const runs = new Map<string, MockRun>();
  const waiters = new Map<string, (answer: ApprovalAnswer) => void>();
  let runCounter = 0;

  // En körning som redan pågår när appen öppnas: skrivbordet rapporterar den som aktiv, och
  // hemvyn ska visa "Kör nu" även innan användaren har skickat något själv.
  runs.set('run.session.login', {
    runId: 'run.session.login',
    sessionId: 'session.login',
    prompt: 'Fixa inloggningsbuggen på iOS',
    events: [],
    subscribers: new Set(),
    running: true,
    abort: () => undefined,
  });

  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  const withLatency = async <T>(value: T): Promise<T> => {
    if (latency > 0) await wait(latency);
    return value;
  };

  function emit(run: MockRun, event: AgentEvent) {
    run.events.push(event);
    for (const subscriber of run.subscribers) subscriber(event);
  }

  function requireSession(sessionId: string) {
    const session = sessions.find((candidate) => candidate.id === sessionId);
    if (!session) throw new ApiError('not-found', `Sessionen ${sessionId} finns inte i mocken.`);
    return session;
  }

  /**
   * Ett godkännande hör till en session antingen via körningens id (seedade körningar heter
   * `run.<sessionId>`) eller via id:t som mocken sätter när den spelar upp ett förlopp.
   */
  function approvalsForSession(sessionId: string): ApprovalRequest[] {
    return approvals.filter(
      (approval) =>
        approval.runId === `run.${sessionId}` || approval.id.startsWith(`mock.${sessionId}`),
    );
  }

  function toMission(session: (typeof sessions)[number]): Mission {
    const sessionApprovals = approvalsForSession(session.id);
    const liveRun = [...runs.values()].find((run) => run.sessionId === session.id && run.running);
    const failed = session.steps.some((step) => step.status === 'failed');

    const status: Mission['status'] = sessionApprovals.length
      ? 'waiting-approval'
      : liveRun
        ? 'running'
        : failed
          ? 'failed'
          : 'idle';

    return {
      id: session.id,
      projectId: MOCK_DESKTOP.project.id,
      title: session.title,
      status,
      phase: status === 'waiting-approval' ? 'waiting-approval' : status === 'running' ? 'executing-tool' : 'idle',
      steps: session.steps,
      files: session.diff
        ? [
            {
              path: session.diff.path,
              kind: session.diff.kind,
              additions: session.diff.additions,
              deletions: session.diff.deletions,
            },
          ]
        : [],
      needsApproval: sessionApprovals.length > 0,
      model: session.model,
      updatedAt: session.updatedAt,
    };
  }

  /** Kör ett manus: fas för fas, med ett stopp när ett godkännande krävs. */
  async function play(run: MockRun) {
    const session = requireSession(run.sessionId);
    const emitStatus = (phase: AgentPhase) =>
      emit(run, { type: 'status', runId: run.runId, phase });

    try {
      emitStatus('building-context');
      await wait(600);
      if (!run.running) return;

      session.steps = session.steps.map((step, index) =>
        index === 0 ? { ...step, status: 'done' } : index === 1 ? { ...step, status: 'active' } : step,
      );
      emit(run, { type: 'plan', runId: run.runId, steps: session.steps });

      emitStatus('thinking');
      emit(run, {
        type: 'assistant_delta',
        runId: run.runId,
        text: 'Jag uppdaterar total() så att antal räknas in.',
      });
      await wait(700);
      if (!run.running) return;

      emit(run, {
        type: 'assistant_message',
        runId: run.runId,
        messageId: `${run.runId}.answer`,
        text: 'Jag uppdaterar total() så att antal räknas in.',
      });

      // 1. Filändring som kräver godkännande.
      const diff = makeDiff({
        id: `diff.${run.runId}`,
        path: 'src/pricing/calculate.ts',
        kind: 'update',
        oldLines: approveDiff.oldContent.split('\n'),
        newLines: approveDiff.newContent.split('\n'),
      });
      const first = await requestApproval(run, session.id, () =>
        makeApproval({
          id: `mock.${session.id}.file`,
          runId: run.runId,
          kind: 'file_write',
          title: 'Skriv över src/pricing/calculate.ts',
          detail: 'Räknar med antal i stället för att bara summera priset.',
          risk: 'low',
          reason: 'Behörighetsläget är "ask".',
          hardBlock: false,
          path: 'src/pricing/calculate.ts',
          diff,
        }),
      );
      if (first.decision === 'rejected') return finish(run, 'rejected');

      session.diff = diff;
      session.logs = [
        ...session.logs,
        {
          id: `${run.runId}.log.diff`,
          runId: run.runId,
          kind: 'system',
          text: `Skrev ${diff.path} (+${diff.additions}/-${diff.deletions}).`,
          createdAt: Date.now(),
        },
      ];
      emit(run, { type: 'diff', runId: run.runId, diff });
      emit(run, { type: 'file_changed', runId: run.runId, path: diff.path, kind: 'update' });

      // 2. Terminalkommando – kräver också godkännande.
      const log: TerminalEntry = {
        id: `${run.runId}.log.test`,
        runId: run.runId,
        kind: 'command',
        command: 'npm test -- --run pricing',
        text: '> vitest run --run pricing\n',
        createdAt: Date.now(),
      };
      session.logs = [...session.logs, log];
      emit(run, { type: 'terminal', runId: run.runId, entry: log });

      const second = await requestApproval(run, session.id, () =>
        makeApproval({
          id: `mock.${session.id}.terminal`,
          runId: run.runId,
          kind: 'terminal',
          title: 'Kör tester',
          detail: 'npm test -- --run pricing',
          risk: 'medium',
          reason: 'Terminalkommandon kräver godkännande i detta projekt.',
          hardBlock: false,
          command: 'npm',
          args: ['test', '--', '--run', 'pricing'],
          cwd: MOCK_DESKTOP.project.path,
        }),
      );
      if (second.decision === 'rejected') return finish(run, 'rejected');

      emit(run, { type: 'tool_call', runId: run.runId, call: { id: `${run.runId}.tool`, name: 'run_terminal_command', args: { command: 'npm test -- --run pricing' } } });
      emitStatus('testing');
      await wait(900);
      if (!run.running) return;

      const tests: TestSummary = {
        passed: 4,
        failed: 1,
        command: 'npm test -- --run pricing',
        output: 'FAIL pricing/quantity.test.ts > räknar antal\nExpected: 300\nReceived: 100',
        createdAt: Date.now(),
      };
      session.tests = tests;
      emit(run, { type: 'tests', runId: run.runId, tests });
      session.logs = [
        ...session.logs,
        {
          id: `${run.runId}.log.fail`,
          runId: run.runId,
          kind: 'stderr',
          text: 'FAIL pricing/quantity.test.ts > räknar antal\nExpected: 300\nReceived: 100\n',
          exitCode: 1,
          createdAt: Date.now(),
        },
      ];

      session.steps = session.steps.map((step, index) => {
        if (index === 1) return { ...step, status: 'done' };
        if (index === 2) return { ...step, status: 'failed' };
        return step;
      });
      emit(run, { type: 'plan', runId: run.runId, steps: session.steps });

      await wait(500);
      finish(run, 'final', 'Ett test failar fortfarande: quantity.test.ts förväntar 300 men får 100.');
    } catch {
      finish(run, 'error');
    }
  }

  function finish(run: MockRun, reason: 'final' | 'aborted' | 'error' | 'rejected', summary?: string) {
    run.running = false;
    emit(run, { type: 'run_finished', runId: run.runId, reason, ...(summary ? { summary } : {}) });
    const session = sessions.find((candidate) => candidate.id === run.sessionId);
    if (session) session.updatedAt = Date.now();
  }

  /** Väntar tills användaren svarar på ett godkännande. */
  function waitForApproval(approvalId: string, run: MockRun): Promise<ApprovalAnswer> {
    return new Promise<ApprovalAnswer>((resolve) => {
      const timer = setTimeout(() => {
        waiters.delete(approvalId);
        resolve({ decision: 'rejected' });
      }, approvalTimeoutMs);
      waiters.set(approvalId, (answer) => {
        clearTimeout(timer);
        waiters.delete(approvalId);
        resolve(answer);
      });
      void run;
    });
  }

  function makeApproval(input: Omit<ApprovalRequest, 'createdAt'>): ApprovalRequest {
    return { ...input, createdAt: Date.now() };
  }

  /**
   * Ber om ett godkännande och väntar på svaret.
   *
   * Väntar det redan ett godkännande för samma åtgärd i sessionen – till exempel ett som låg kvar när
   * appen öppnades – används det i stället för att ett nytt skapas. Annars skulle samma filändring
   * listas två gånger, och den äldre skulle ligga kvar som väntande även sedan filen redan skrivits.
   * Att svara på kortet som redan syns sätter alltså körningen i rörelse, precis som på datorn där
   * godkännandet hör till arbetet och inte till den enskilda körningen.
   */
  function requestApproval(
    run: MockRun,
    sessionId: string,
    build: () => ApprovalRequest,
  ): Promise<ApprovalAnswer> {
    const candidate = build();
    const subject = approvalSubject(candidate);
    const pending = approvalsForSession(sessionId).find(
      (approval) => approvalSubject(approval) === subject,
    );
    const request = pending ?? candidate;
    if (!pending) approvals = [candidate, ...approvals];
    emit(run, { type: 'approval_request', runId: run.runId, request });
    return waitForApproval(request.id, run);
  }

  return {
    mode: 'mock',

    async health(): Promise<DesktopHealth> {
      return withLatency({
        ok: true,
        name: MOCK_DESKTOP.name,
        protocol: MOCK_DESKTOP.protocol,
        port: MOCK_DESKTOP.port,
      });
    },

    async snapshot(): Promise<DesktopSnapshot> {
      return withLatency({
        health: {
          ok: true,
          name: MOCK_DESKTOP.name,
          protocol: MOCK_DESKTOP.protocol,
          port: MOCK_DESKTOP.port,
        },
        activeModel: MOCK_DESKTOP.model,
        projects: [
          {
            id: MOCK_DESKTOP.project.id,
            name: MOCK_DESKTOP.project.name,
            path: MOCK_DESKTOP.project.path,
            permissionMode: 'ask',
          },
        ],
        activeSessions: [...runs.values()].filter((run) => run.running).length,
        pendingApprovals: approvals.length,
      });
    },

    async missions(): Promise<Mission[]> {
      const list = sessions.map(toMission).sort((a, b) => b.updatedAt - a.updatedAt);
      return withLatency(list);
    },

    async mission(sessionId: string): Promise<MissionDetail> {
      const session = requireSession(sessionId);
      const mission = toMission(session);
      return withLatency({
        ...mission,
        approvals: approvalsForSession(session.id),
        logs: session.logs,
        messages: session.messages,
        diff: session.diff,
        tests: session.tests,
      });
    },

    async messages(sessionId: string): Promise<ChatMessage[]> {
      return withLatency(requireSession(sessionId).messages);
    },

    async sendPrompt(input: SendPromptInput): Promise<StartRunResult> {
      const session = requireSession(input.sessionId);
      runCounter += 1;
      const runId = `run.mock-${runCounter}`;
      session.messages = [
        ...session.messages,
        { id: `${runId}.user`, role: 'user', text: input.prompt, createdAt: Date.now() },
      ];

      const run: MockRun = {
        runId,
        sessionId: session.id,
        prompt: input.prompt,
        events: [],
        subscribers: new Set(),
        running: true,
        abort: () => {
          run.running = false;
        },
      };
      runs.set(runId, run);
      emit(run, { type: 'run_started', runId, sessionId: session.id, model: session.model });
      void play(run);
      return withLatency({ runId, eventsUrl: `/api/runs/${runId}/events` });
    },

    async abortRun(runId: string): Promise<{ aborted: boolean }> {
      const run = runs.get(runId);
      if (!run || !run.running) return { aborted: false };
      run.abort();
      finish(run, 'aborted');
      return withLatency({ aborted: true });
    },

    subscribeToRun(runId: string, handler: (event: AgentEvent) => void): () => void {
      const run = runs.get(runId);
      if (!run) return () => undefined;
      // Spela upp det som redan hänt, precis som skrivbordet gör för sena prenumeranter.
      for (const event of run.events) handler(event);
      run.subscribers.add(handler);
      return () => {
        run.subscribers.delete(handler);
      };
    },

    async approvals(): Promise<ApprovalRequest[]> {
      return withLatency([...approvals]);
    },

    async approval(approvalId: string): Promise<ApprovalRequest | null> {
      return withLatency(approvals.find((approval) => approval.id === approvalId) ?? null);
    },

    async resolveApproval(approvalId: string, answer: ApprovalAnswer): Promise<void> {
      const approval = approvals.find((candidate) => candidate.id === approvalId);
      if (!approval) throw new ApiError('conflict', 'Godkännandet är redan besvarat.', 409);
      approvals = approvals.filter((candidate) => candidate.id !== approvalId);
      const run = runs.get(approval.runId);
      if (run) {
        emit(run, {
          type: 'approval_resolved',
          runId: run.runId,
          approvalId,
          decision: answer.decision,
        });
      }
      waiters.get(approvalId)?.(answer);
      await withLatency(undefined);
    },

    async logs(sessionId?: string): Promise<TerminalEntry[]> {
      if (!sessionId) {
        return withLatency(sessions.flatMap((session) => session.logs).sort((a, b) => a.createdAt - b.createdAt));
      }
      return withLatency(requireSession(sessionId).logs);
    },

    async gitStatus(): Promise<GitStatus> {
      return withLatency(mockGitStatus);
    },
  };
}
