import type { ApprovalAnswer, ApprovalRequest } from '@vibeforge/protocol';
import { createId, now } from '../util/ids.js';

export interface PendingApproval {
  request: ApprovalRequest;
  promise: Promise<ApprovalAnswer>;
}

export interface ApprovalManagerOptions {
  /** Anropas när en ny begäran skapas, så att UI:t kan visa den direkt. */
  onRequest?: (request: ApprovalRequest) => void;
  onResolved?: (request: ApprovalRequest, answer: ApprovalAnswer) => void;
}

/**
 * Håller reda på godkännanden som väntar på användaren. Ingen tidsgräns: agenten väntar
 * hellre än att fatta ett säkert beslut åt användaren.
 */
export class ApprovalManager {
  private readonly pending = new Map<
    string,
    { request: ApprovalRequest; resolve: (answer: ApprovalAnswer) => void }
  >();
  private readonly approvedForSession = new Set<string>();
  private readonly options: ApprovalManagerOptions;

  constructor(options: ApprovalManagerOptions = {}) {
    this.options = options;
  }

  create(input: Omit<ApprovalRequest, 'id' | 'createdAt'>): PendingApproval {
    const request: ApprovalRequest = { ...input, id: createId('approval'), createdAt: now() };
    let resolveFn: (answer: ApprovalAnswer) => void = () => undefined;
    const promise = new Promise<ApprovalAnswer>((resolve) => {
      resolveFn = resolve;
    });
    this.pending.set(request.id, { request, resolve: resolveFn });
    this.options.onRequest?.(request);
    return { request, promise };
  }

  /** Returnerar false om begäran redan är besvarad eller okänd. */
  resolve(answer: ApprovalAnswer): boolean {
    const entry = this.pending.get(answer.approvalId);
    if (!entry) return false;
    this.pending.delete(answer.approvalId);
    if (answer.rememberForSession && answer.decision === 'approved') {
      this.approvedForSession.add(this.sessionKey(entry.request));
    }
    this.options.onResolved?.(entry.request, answer);
    entry.resolve(answer);
    return true;
  }

  isApprovedForSession(request: ApprovalRequest): boolean {
    return this.approvedForSession.has(this.sessionKey(request));
  }

  rememberForSession(request: ApprovalRequest): void {
    this.approvedForSession.add(this.sessionKey(request));
  }

  listPending(): ApprovalRequest[] {
    return [...this.pending.values()].map((entry) => entry.request);
  }

  get size(): number {
    return this.pending.size;
  }

  /** Avbryter alla väntande begäranden, t.ex. när användaren stoppar agenten. */
  cancelAll(reason = 'Körningen avbröts.'): void {
    for (const [id, entry] of [...this.pending.entries()]) {
      this.pending.delete(id);
      this.options.onResolved?.(entry.request, { approvalId: id, decision: 'rejected' });
      entry.resolve({ approvalId: id, decision: 'rejected', answers: { reason: [reason] } });
    }
  }

  private sessionKey(request: ApprovalRequest): string {
    const target = request.path ?? request.command ?? request.url ?? request.kind;
    return `${request.kind}:${target}`;
  }
}
