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
 * Allt mobilappen gör mot skrivbordet går genom det här gränssnittet. Mock-adaptern och HTTP-adaptern
 * implementerar samma kontrakt, så att byta till en riktig Freevobe Desktop är en rad i `src/api/index.ts`
 * – ingen skärm behöver ändras.
 */
export interface FreevobeApi {
  readonly mode: 'mock' | 'live';

  health(): Promise<DesktopHealth>;

  /** Datorns status: modell, projekt, aktiva sessioner och väntande godkännanden. */
  snapshot(): Promise<DesktopSnapshot>;

  missions(): Promise<Mission[]>;
  mission(sessionId: string): Promise<MissionDetail>;

  messages(sessionId: string): Promise<ChatMessage[]>;

  /** Startar en körning och returnerar runId. Händelser kommer via `subscribeToRun`. */
  sendPrompt(input: SendPromptInput): Promise<StartRunResult>;

  abortRun(runId: string): Promise<{ aborted: boolean }>;

  /**
   * Prenumererar på en körnings händelseström. Returnerar en funktion som stänger strömmen.
   * Anropas den igen för samma runId ska den tidigare prenumerationen stängas.
   */
  subscribeToRun(runId: string, handler: (event: AgentEvent) => void): () => void;

  approvals(): Promise<ApprovalRequest[]>;
  approval(approvalId: string): Promise<ApprovalRequest | null>;

  /** Svara på ett godkännande. Kastar `ApiError` om id:t redan är besvarat. */
  resolveApproval(approvalId: string, answer: ApprovalAnswer): Promise<void>;

  logs(sessionId?: string): Promise<TerminalEntry[]>;

  gitStatus(projectId: string): Promise<GitStatus>;
}

export type ApiErrorCode =
  | 'unauthorized'
  | 'unreachable'
  | 'not-found'
  | 'conflict'
  | 'bad-response'
  | 'server';

/** Alla fel som mobilappen visar för användaren är `ApiError` med en kod att agera på. */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status?: number;

  constructor(code: ApiErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

/** Koden avgör om appen kräver ny parning (401) eller bara visar "kan inte nå datorn". */
export function apiErrorCodeForStatus(status: number): ApiErrorCode {
  if (status === 401 || status === 403) return 'unauthorized';
  if (status === 404) return 'not-found';
  if (status === 409) return 'conflict';
  return 'server';
}

/** Sant när felet betyder att parningen är ogiltig och måste göras om. */
export function requiresRepairing(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'unauthorized';
}
