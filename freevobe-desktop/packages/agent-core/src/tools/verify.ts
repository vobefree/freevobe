import type { VerificationKind } from '@freevobe/protocol';
import { detectVerificationCommands, filterVerificationCommands } from '../verification/detect.js';
import { runVerification } from '../verification/engine.js';
import { fail, type RegisteredTool } from './types.js';

const KINDS: VerificationKind[] = ['typecheck', 'lint', 'test', 'build'];

function requestedKinds(args: Record<string, unknown>): VerificationKind[] {
  const raw = args.kinds;
  if (!Array.isArray(raw)) return [];
  return raw.filter((kind): kind is VerificationKind => KINDS.includes(kind as VerificationKind));
}

/**
 * Verifieringsmotorn som verktyg: agenten kan köra projektets egna kontroller och få en rapport
 * i stället för att gissa att ändringen fungerar.
 */
export const runVerificationTool: RegisteredTool = {
  spec: {
    name: 'run_verification',
    description:
      'Kör projektets verifieringssteg (typkontroll, lint, tester, bygge – de som faktiskt finns) och returnerar en rapport per steg. Använd den efter en större ändring i stället för att påstå att allt fungerar.',
    parameters: {
      type: 'object',
      properties: {
        kinds: {
          type: 'array',
          description: 'Begränsa till vissa steg. Utelämnad = alla steg som hittas (även bygget).',
          items: { type: 'string', enum: KINDS },
        },
      },
    },
    danger: 'execute',
    source: 'builtin',
  },
  handler: async (args, ctx) => {
    const detected = await detectVerificationCommands(ctx.root);
    const commands = filterVerificationCommands(detected, requestedKinds(args));

    if (commands.length === 0) {
      return fail(
        detected.length === 0
          ? 'Hittade inga verifieringssteg i projektet. Lägg till skript i package.json (typecheck, lint, test, build) eller motsvarande konfiguration.'
          : 'Inget av de efterfrågade stegen finns i projektet.',
      );
    }

    const detail = commands.map((command) => command.command).join('\n');
    if (ctx.approval.required) {
      const outcome = await ctx.requestApproval({
        kind: 'terminal',
        title: 'Kör verifieringen',
        detail,
        reason: ctx.approval.reason,
        risk: ctx.approval.risk,
        hardBlock: ctx.approval.hardBlock,
        command: detail,
        cwd: ctx.root,
      });
      if (!outcome.approved) return fail('Användaren avvisade verifieringen.');
    }

    ctx.emit({
      type: 'verification_started',
      runId: ctx.runId,
      trigger: 'tool',
      commands,
    });

    const report = await runVerification({
      root: ctx.root,
      projectId: ctx.projectId,
      sessionId: ctx.sessionId,
      runId: ctx.runId,
      trigger: 'tool',
      commands,
      run: (command, options) => ctx.exec(command, options),
      ...(ctx.signal ? { signal: ctx.signal } : {}),
      onCheck: (check) => ctx.emit({ type: 'verification_check', runId: ctx.runId, check }),
    });

    ctx.emit({ type: 'verification', runId: ctx.runId, report });

    const lines = report.checks.map((check) => {
      const marker = check.status === 'passed' ? '✓' : check.status === 'skipped' ? '–' : '✗';
      return `${marker} ${check.label}: ${check.status} (${check.command})`;
    });

    const quiet = report.status === 'passed';
    return {
      ok: quiet,
      content: `${report.summary}\n${lines.join('\n')}\n\n${report.checks
        .filter((check) => check.status !== 'passed' && check.output)
        .map((check) => `--- ${check.label} ---\n${check.output.slice(-3_000)}`)
        .join('\n\n')}`.trim(),
      data: { status: report.status, reportId: report.id },
      ...(quiet ? {} : { error: report.summary }),
    };
  },
};

/** Används av UI:t för att visa vilka steg som finns innan något körs. */
export async function listVerificationSteps(root: string) {
  return detectVerificationCommands(root);
}
