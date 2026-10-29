import type { HookConfig, HookEvent, HookName } from '@freevobe/protocol';
import { matchesGlob } from '../util/text.js';

export interface HookRunResult {
  matched: number;
  blocked: boolean;
  output: string;
}

export interface HookExecutionContext {
  root: string;
  runCommand: (
    command: string,
    options: { cwd: string; timeoutMs: number },
  ) => Promise<{ output: string; exitCode: number | null }>;
  onEvent?: (event: HookEvent) => void;
}

const HOOK_NAMES: HookName[] = [
  'on_session_start',
  'before_file_edit',
  'after_file_edit',
  'before_terminal_command',
  'after_terminal_command',
  'before_test_run',
  'after_test_run',
  'before_commit',
  'after_commit',
];

export function isHookName(value: string): value is HookName {
  return (HOOK_NAMES as string[]).includes(value);
}

export function shellQuote(value: string): string {
  return `"${value.replace(/(["\\$`])/g, '\\$1')}"`;
}

/**
 * Kör användarens hooks. Hooks är vanliga skal-kommandon med platshållare, t.ex.
 * `npx eslint --fix {{path}}`. De körs utanför modellen och kan aldrig påverkas av dess text.
 */
export class HookRunner {
  private readonly hooks: HookConfig[];
  private readonly ctx: HookExecutionContext;

  constructor(hooks: HookConfig[], ctx: HookExecutionContext) {
    this.hooks = hooks;
    this.ctx = ctx;
  }

  list(): HookConfig[] {
    return [...this.hooks];
  }

  async run(name: HookName, payload: Record<string, unknown> = {}): Promise<HookRunResult> {
    const filePath = typeof payload.path === 'string' ? payload.path : undefined;
    const matching = this.hooks.filter((hook) => {
      if (!hook.enabled || hook.event !== name) return false;
      if (!hook.filePattern || hook.filePattern.trim() === '') return true;
      if (!filePath) return false;
      return matchesGlob(filePath, hook.filePattern);
    });

    let blocked = false;
    const outputs: string[] = [];

    for (const hook of matching) {
      const command = substitute(hook.command, payload);
      const result = await this.ctx.runCommand(command, {
        cwd: this.ctx.root,
        timeoutMs: hook.timeoutMs || 60_000,
      });
      const failed = (result.exitCode ?? 1) !== 0;
      if (failed && hook.blockOnFailure) blocked = true;
      outputs.push(
        `${hook.name}: exit ${result.exitCode ?? 'okänd'}${failed ? ' (misslyckades)' : ''}${result.output ? `\n${result.output.slice(-1_500)}` : ''}`,
      );
      this.ctx.onEvent?.({
        name,
        matched: true,
        blocked: failed && hook.blockOnFailure,
        output: result.output.slice(0, 2_000),
      });
    }

    return { matched: matching.length, blocked, output: outputs.join('\n') };
  }
}

function substitute(command: string, payload: Record<string, unknown>): string {
  return command.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = payload[key];
    if (value === undefined || value === null) return '';
    if (Array.isArray(value)) return value.map((entry) => shellQuote(String(entry))).join(' ');
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return shellQuote(String(value));
  });
}

export interface ResolvedHookResult {
  blocked: boolean;
  output: string;
}

/** Slår ihop resultatet från flera hook-körningar till ett svar. */
export function mergeHookResults(results: HookRunResult[]): ResolvedHookResult {
  return {
    blocked: results.some((result) => result.blocked),
    output: results
      .filter((result) => result.matched > 0)
      .map((result) => result.output)
      .join('\n'),
  };
}
