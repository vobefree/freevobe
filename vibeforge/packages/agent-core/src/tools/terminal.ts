import { resolveProjectPath } from '../security/paths.js';
import { describeError } from '../util/errors.js';
import { truncate } from '../util/text.js';
import { fail, numberArg, stringArg, type RegisteredTool } from './types.js';

export const runTerminalCommandTool: RegisteredTool = {
  spec: {
    name: 'run_terminal_command',
    description:
      'Kör ett skal-kommando i projektet. All utdata visas i terminalpanelen. Kommandon som kan skada systemet blockeras av säkerhetsreglerna.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Kommandot som ska köras.' },
        cwd: {
          type: 'string',
          description: 'Arbetskatalog relativt projektroten. Standard: projektroten.',
        },
        timeoutMs: { type: 'integer', description: 'Tidsgräns i millisekunder.' },
        purpose: { type: 'string', description: 'Kort beskrivning av varför kommandot körs.' },
      },
      required: ['command'],
    },
    danger: 'execute',
    source: 'builtin',
  },
  handler: async (args, ctx) => {
    const command = stringArg(args, 'command');
    if (!command) return fail('Argumentet "command" saknas.');

    let cwd = ctx.root;
    if (typeof args.cwd === 'string' && args.cwd.trim() !== '') {
      const resolved = resolveProjectPath(ctx.root, args.cwd);
      if (!resolved.ok) return fail(`Arbetskatalogen avvisades: ${resolved.reason}`);
      cwd = resolved.absolute;
    }

    const timeoutMs = Math.min(
      numberArg(args, 'timeoutMs', ctx.limits.terminalTimeoutMs),
      ctx.limits.terminalTimeoutMs,
    );

    if (ctx.approval.required) {
      const outcome = await ctx.requestApproval({
        kind: 'terminal',
        title: 'Kör kommandot',
        detail: typeof args.purpose === 'string' ? args.purpose : '',
        reason: ctx.approval.reason,
        risk: ctx.approval.risk,
        hardBlock: ctx.approval.hardBlock,
        command,
        cwd,
        args: [command],
      });
      if (!outcome.approved) {
        return fail(`Användaren avvisade kommandot: ${command}`);
      }
    }

    const before = await ctx.runHooks('before_terminal_command', { command, cwd });
    if (before.blocked) {
      return fail(`En hook blockerade kommandot: ${before.output}`);
    }

    try {
      const result = await ctx.exec(command, { cwd, timeoutMs });
      await ctx.runHooks('after_terminal_command', {
        command,
        cwd,
        exitCode: result.exitCode,
        output: result.output,
      });
      const { text } = truncate(result.output, ctx.limits.maxOutputChars);
      const status = result.timedOut
        ? `Tidsgränsen ${timeoutMs} ms nåddes och kommandot dödades.`
        : `exit-kod ${result.exitCode ?? 'okänd'}`;

      return {
        ok: !result.timedOut && (result.exitCode ?? 0) === 0,
        content: `$ ${command}\n${status}\n${text || '(ingen utdata)'}`,
        data: { exitCode: result.exitCode, timedOut: result.timedOut, cwd },
        ...(result.timedOut || (result.exitCode ?? 0) !== 0
          ? {
              error: result.timedOut
                ? 'Kommandot tog för lång tid.'
                : `Kommandot gav exit-kod ${result.exitCode}.`,
            }
          : {}),
      };
    } catch (error) {
      return fail(`Kunde inte köra kommandot: ${describeError(error)}`);
    }
  },
};
