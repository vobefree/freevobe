import type { ToolCall, ToolResult, ToolSpec } from '@freevobe/protocol';
import { validateAgainstSchema } from '@freevobe/protocol';
import { describeError } from '../util/errors.js';
import { truncate } from '../util/text.js';
import { fail, type RegisteredTool, type ToolContext } from './types.js';

export class ToolRegistry {
  private readonly tools = new Map<string, RegisteredTool>();

  register(tool: RegisteredTool): void {
    this.tools.set(tool.spec.name, tool);
  }

  registerAll(tools: RegisteredTool[]): void {
    for (const tool of tools) this.register(tool);
  }

  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /** Tar bort alla verktyg från en källa, t.ex. när en MCP-server kopplas från. */
  removeWhere(predicate: (spec: ToolSpec) => boolean): number {
    let removed = 0;
    for (const [name, tool] of [...this.tools.entries()]) {
      if (predicate(tool.spec)) {
        this.tools.delete(name);
        removed += 1;
      }
    }
    return removed;
  }

  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): ToolSpec[] {
    return [...this.tools.values()]
      .map((tool) => tool.spec)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Verktygsdefinitionerna som skickas till modellen. */
  specsForModel(): ToolSpec[] {
    return this.list();
  }

  async execute(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
    const started = Date.now();
    const tool = this.tools.get(call.name);

    const finish = (result: Omit<ToolResult, 'callId' | 'name' | 'durationMs'>): ToolResult => ({
      callId: call.id,
      name: call.name,
      durationMs: Date.now() - started,
      ...result,
    });

    if (!tool) {
      return finish(
        fail(
          `Verktyget "${call.name}" finns inte. Tillgängliga verktyg: ${[...this.tools.keys()].slice(0, 40).join(', ')}`,
        ),
      );
    }

    // 1. Validera argumenten och låt modellen rätta sig själv vid fel.
    const issues = validateAgainstSchema(call.args ?? {}, tool.spec.parameters);
    if (issues.length > 0) {
      return finish(
        fail(
          `Argumenten till ${call.name} är ogiltiga:\n${issues.map((issue) => `- ${issue.path}: ${issue.message}`).join('\n')}`,
        ),
      );
    }

    // 2. MCP-verktyg kan inte hantera godkännande själva – det görs här, före anropet.
    const isRemote = tool.remote !== undefined;
    if (isRemote && ctx.approval.required) {
      const outcome = await ctx.requestApproval({
        kind: 'mcp',
        title: `MCP-verktyg: ${call.name}`,
        detail: JSON.stringify(call.args, null, 2).slice(0, 2_000),
        reason: ctx.approval.reason,
        risk: ctx.approval.risk,
        hardBlock: ctx.approval.hardBlock,
        command: call.name,
      });
      if (!outcome.approved) {
        return finish(fail(`Användaren avvisade anropet till ${call.name}.`));
      }
    }

    try {
      const raw = isRemote
        ? await tool.remote?.(call.name, call.args, ctx)
        : await tool.handler?.(call.args, ctx);

      if (!raw) {
        return finish(fail(`Verktyget ${call.name} har ingen implementering.`));
      }

      const { text, truncated } = truncate(raw.content ?? '', ctx.limits.maxOutputChars);
      const result: ToolResult = {
        callId: call.id,
        name: call.name,
        durationMs: Date.now() - started,
        ok: raw.ok,
        content: text,
      };
      const data = truncated ? { ...(raw.data ?? {}), truncated: true } : raw.data;
      if (data) result.data = data;
      if (raw.error) result.error = raw.error;
      return result;
    } catch (error) {
      return finish(fail(`Verktyget ${call.name} misslyckades: ${describeError(error)}`));
    }
  }
}

export const BUILTIN_TOOL_NAMES = [
  'list_files',
  'read_file',
  'search_files',
  'write_file',
  'create_file',
  'edit_file',
  'delete_file',
  'run_terminal_command',
  'run_tests',
  'git_status',
  'git_diff',
  'git_commit',
  'git_branch',
  'web_fetch',
  'browser_open',
  'browser_read',
  'browser_screenshot',
  'browser_click',
  'browser_fill',
  'ask_user',
  'propose_plan',
  'run_verification',
] as const;
