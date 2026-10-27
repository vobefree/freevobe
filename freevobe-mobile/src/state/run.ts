import { create } from 'zustand';
import type {
  AgentEvent,
  AgentPhase,
  ApprovalRequest,
  ChatMessage,
  FileDiff,
  MissionStep,
  TerminalEntry,
  TestSummary,
  ToolCallSummary,
} from '@/api/types';

/**
 * Körningar i realtid.
 *
 * Skrivbordet skickar en ström av händelser; chatten visar bara det som hänt sedan användaren
 * tryckte "skicka". Därför ligger den här vyn vid sidan av de hämtade meddelandena: historiken
 * kommer från API:t, medan det som pågår byggs upp här.
 *
 * `applyEvent` är en ren funktion (se `reduceRun`), så att händelseflödet kan testas utan React.
 */

export interface RunView {
  runId: string | null;
  phase: AgentPhase;
  running: boolean;
  /** Text som strömmar in medan modellen svarar. */
  streamingText: string;
  messages: ChatMessage[];
  steps: MissionStep[];
  toolCalls: ToolCallSummary[];
  diff: FileDiff | null;
  tests: TestSummary | null;
  logs: TerminalEntry[];
  pendingApproval: ApprovalRequest | null;
  error: string | null;
  summary: string | null;
}

export function emptyRunView(): RunView {
  return {
    runId: null,
    phase: 'idle',
    running: false,
    streamingText: '',
    messages: [],
    steps: [],
    toolCalls: [],
    diff: null,
    tests: null,
    logs: [],
    pendingApproval: null,
    error: null,
    summary: null,
  };
}

/** Verktygets namn och viktigaste argument, kort nog för en rad i chatten. */
function describeToolCall(name: string, args: Record<string, unknown>): string {
  for (const key of ['path', 'file', 'command', 'cmd', 'query', 'pattern', 'url']) {
    const value = args[key];
    if (typeof value === 'string' && value.trim() !== '') return `${name} ${value}`;
  }
  return name;
}

/**
 * Lägger en händelse till körningsvyn. Ren funktion: samma indata ger samma utdata, vilket är hela
 * poängen med att hålla den utanför komponenterna.
 */
export function reduceRun(view: RunView, event: AgentEvent): RunView {
  switch (event.type) {
    case 'run_started':
      return { ...emptyRunView(), runId: event.runId, running: true, phase: 'connecting' };

    case 'status':
      return { ...view, phase: event.phase, running: event.phase !== 'done' };

    case 'assistant_delta':
      return { ...view, streamingText: view.streamingText + event.text };

    case 'assistant_message':
      return {
        ...view,
        streamingText: '',
        messages: [
          ...view.messages,
          {
            id: event.messageId,
            role: 'assistant',
            text: event.text,
            createdAt: Date.now(),
            ...(view.toolCalls.length > 0 ? { toolCalls: view.toolCalls } : {}),
          },
        ],
      };

    case 'plan':
      return { ...view, steps: event.steps };

    case 'tool_call':
      return {
        ...view,
        toolCalls: [
          ...view.toolCalls,
          {
            id: event.call.id,
            name: event.call.name,
            status: 'running',
            summary: describeToolCall(event.call.name, event.call.args),
          },
        ],
      };

    case 'tool_result':
      return {
        ...view,
        toolCalls: view.toolCalls.map((call) =>
          call.id === event.result.callId
            ? {
                ...call,
                status: event.result.ok ? 'ok' : 'failed',
                durationMs: event.result.durationMs,
              }
            : call,
        ),
        logs: [
          ...view.logs,
          {
            id: `${event.result.callId}.result`,
            runId: event.runId,
            kind: event.result.ok ? 'stdout' : 'stderr',
            text: event.result.error ?? event.result.content,
            createdAt: Date.now(),
          },
        ],
      };

    case 'approval_request':
      return { ...view, pendingApproval: event.request, phase: 'waiting-approval', running: true };

    case 'approval_resolved':
      return {
        ...view,
        pendingApproval:
          view.pendingApproval?.id === event.approvalId ? null : view.pendingApproval,
      };

    case 'diff':
      return { ...view, diff: event.diff };

    case 'file_changed':
      return {
        ...view,
        logs: [
          ...view.logs,
          {
            id: `${event.path}.${event.kind}`,
            runId: event.runId,
            kind: 'system',
            text: `${event.kind === 'create' ? 'Skapade' : event.kind === 'delete' ? 'Tog bort' : 'Ändrade'} ${event.path}`,
            createdAt: Date.now(),
          },
        ],
      };

    case 'terminal':
      return { ...view, logs: [...view.logs, event.entry] };

    case 'tests':
      return {
        ...view,
        tests: event.tests,
        logs: [
          ...view.logs,
          {
            id: `${event.runId}.tests`,
            runId: event.runId,
            kind: 'test',
            text: `${event.tests.passed} godkända, ${event.tests.failed} misslyckade – ${event.tests.command}`,
            createdAt: Date.now(),
          },
        ],
      };

    case 'error':
      return { ...view, error: event.message, phase: 'idle', running: false };

    case 'run_finished':
      return {
        ...view,
        running: false,
        phase: event.reason === 'final' ? 'done' : 'idle',
        summary: event.summary ?? null,
        error:
          event.reason === 'error'
            ? (view.error ?? 'Körningen avbröts av ett fel.')
            : event.reason === 'rejected'
              ? 'Du avböjde ett steg, så körningen stoppades.'
              : view.error,
      };

    default:
      return view;
  }
}

export interface RunState {
  runs: Record<string, RunView>;
  /** Anropas när en körning startas: nollställer vyn för sessionen. */
  begin: (sessionId: string, runId: string) => void;
  apply: (sessionId: string, event: AgentEvent) => void;
  setPendingApproval: (sessionId: string, approval: ApprovalRequest | null) => void;
  reset: (sessionId: string) => void;
  clearAll: () => void;
}

export const useRuns = create<RunState>((set) => ({
  runs: {},

  begin(sessionId, runId) {
    set((state) => ({
      runs: { ...state.runs, [sessionId]: { ...emptyRunView(), runId, running: true } },
    }));
  },

  apply(sessionId, event) {
    set((state) => {
      const current = state.runs[sessionId] ?? emptyRunView();
      return { runs: { ...state.runs, [sessionId]: reduceRun(current, event) } };
    });
  },

  setPendingApproval(sessionId, approval) {
    set((state) => {
      const current = state.runs[sessionId] ?? emptyRunView();
      return { runs: { ...state.runs, [sessionId]: { ...current, pendingApproval: approval } } };
    });
  },

  reset(sessionId) {
    set((state) => {
      const next = { ...state.runs };
      delete next[sessionId];
      return { runs: next };
    });
  },

  clearAll() {
    set({ runs: {} });
  },
}));

export function selectRun(runs: Record<string, RunView>, sessionId: string): RunView {
  return runs[sessionId] ?? emptyRunView();
}
