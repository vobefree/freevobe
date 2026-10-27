import type { AgentErrorCode } from '@vibeforge/protocol';

/** Fel som agent-loopen kan förklara för användaren med en kod och ett förslag på åtgärd. */
export class VibeForgeError extends Error {
  readonly code: AgentErrorCode;
  readonly detail?: string;
  readonly helpUrl?: string;

  constructor(
    code: AgentErrorCode,
    message: string,
    options: { detail?: string; helpUrl?: string; cause?: unknown } = {},
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'VibeForgeError';
    this.code = code;
    this.detail = options.detail;
    this.helpUrl = options.helpUrl;
  }
}

export class OllamaUnavailableError extends VibeForgeError {
  constructor(baseUrl: string, detail?: string) {
    super('ollama_unavailable', `Kan inte nå Ollama på ${baseUrl}.`, {
      detail,
      helpUrl: 'https://vibeforge.dev/docs/ollama',
    });
    this.name = 'OllamaUnavailableError';
  }
}

export class PolicyBlockedError extends VibeForgeError {
  constructor(message: string, detail?: string) {
    super('policy_blocked', message, { detail });
    this.name = 'PolicyBlockedError';
  }
}

export class ApprovalRejectedError extends VibeForgeError {
  constructor(message = 'Användaren avvisade åtgärden.') {
    super('approval_rejected', message);
    this.name = 'ApprovalRejectedError';
  }
}

export class ToolExecutionError extends VibeForgeError {
  constructor(message: string, detail?: string) {
    super('tool_failed', message, { detail });
    this.name = 'ToolExecutionError';
  }
}

/** Gör ett okänt kastat värde till en läsbar sträng. */
export function describeError(error: unknown): string {
  if (error instanceof Error) {
    const code = error instanceof VibeForgeError ? ` [${error.code}]` : '';
    return `${error.message}${code}`;
  }
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
}
