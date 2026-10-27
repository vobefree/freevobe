import { fail, numberArg, stringArg, type RegisteredTool, type ToolContext } from './types.js';

interface TestCounts {
  passed: number;
  failed: number;
}

/**
 * Läser ut antal godkända och underkända tester ur vanliga testramars utdata:
 * vitest/jest ("Tests: 3 failed, 7 passed"), pytest ("5 passed, 1 failed"), go test ("--- FAIL:").
 */
export function parseTestCounts(output: string): TestCounts {
  let passed = 0;
  let failed = 0;

  const vitest = output.match(/Tests\s+(?:(\d+)\s+failed[^,]*,\s*)?(?:(\d+)\s+passed[^,]*)?/i);
  if (vitest) {
    failed = Number(vitest[1] ?? 0) || failed;
    passed = Number(vitest[2] ?? 0) || passed;
  }
  if (passed === 0 && failed === 0) {
    const pytest = output.match(/(?:^|\s)(\d+)\s+passed/i);
    const pytestFailed = output.match(/(?:^|\s)(\d+)\s+failed/i);
    if (pytest) passed = Number(pytest[1]);
    if (pytestFailed) failed = Number(pytestFailed[1]);
  }
  if (passed === 0 && failed === 0) {
    const okMatches = output.match(/\bok\s+\S+/g);
    const failMatches = output.match(/--- FAIL/g);
    passed = okMatches?.length ?? 0;
    failed = failMatches?.length ?? 0;
  }

  return { passed, failed };
}

export const runTestsTool: RegisteredTool = {
  spec: {
    name: 'run_tests',
    description:
      'Kör projektets tester (hittar testkommandot automatiskt om inget anges) och sammanfattar resultatet.',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Eget testkommando. Standard: projektets testskript.',
        },
        filter: { type: 'string', description: 'Fil- eller testnamn att filtrera på.' },
        timeoutMs: { type: 'integer', description: 'Tidsgräns i millisekunder.' },
      },
    },
    danger: 'execute',
    source: 'builtin',
  },
  handler: async (args, ctx) => {
    const explicit = stringArg(args, 'command');
    const detected = explicit ?? (await ctx.detectTestCommand());
    if (!detected) {
      return fail(
        'Hittade inget testkommando. Lägg till ett "test"-skript i package.json eller ange command.',
      );
    }

    const filter = stringArg(args, 'filter');
    const command = filter ? `${detected} ${filter}` : detected;
    const timeoutMs = Math.min(
      numberArg(args, 'timeoutMs', ctx.limits.terminalTimeoutMs),
      ctx.limits.terminalTimeoutMs,
    );

    if (ctx.approval.required) {
      const outcome = await ctx.requestApproval({
        kind: 'terminal',
        title: 'Kör tester',
        detail: command,
        reason: ctx.approval.reason,
        risk: ctx.approval.risk,
        hardBlock: ctx.approval.hardBlock,
        command,
        cwd: ctx.root,
      });
      if (!outcome.approved) return fail('Användaren avvisade testkörningen.');
    }

    const blocked = await runTestHooks(ctx, 'before_test_run', { command });
    if (blocked) return fail(blocked);

    const result = await ctx.exec(command, { cwd: ctx.root, timeoutMs });
    const counts = parseTestCounts(result.output);
    await runTestHooks(ctx, 'after_test_run', { command, exitCode: result.exitCode, ...counts });

    ctx.emit({
      type: 'tests',
      runId: ctx.runId,
      command,
      passed: counts.passed,
      failed: counts.failed,
      output: result.output.slice(-4_000),
    });

    const summary = result.timedOut
      ? `Testkörningen nådde tidsgränsen (${timeoutMs} ms).`
      : `${counts.passed} godkända, ${counts.failed} underkända (exit-kod ${result.exitCode ?? 'okänd'}).`;

    return {
      ok: !result.timedOut && (result.exitCode ?? 0) === 0,
      content: `${summary}\n$ ${command}\n\n${result.output.slice(-8_000) || '(ingen utdata)'}`,
      data: { command, passed: counts.passed, failed: counts.failed, exitCode: result.exitCode },
      ...(result.exitCode === 0 && !result.timedOut ? {} : { error: summary }),
    };
  },
};

async function runTestHooks(
  ctx: ToolContext,
  name: string,
  payload: Record<string, unknown>,
): Promise<string | null> {
  const outcome = await ctx.runHooks(name, payload);
  return outcome.blocked
    ? `En hook blockerade ${name === 'before_test_run' ? 'testkörningen' : 'steget'}: ${outcome.output}`
    : null;
}
