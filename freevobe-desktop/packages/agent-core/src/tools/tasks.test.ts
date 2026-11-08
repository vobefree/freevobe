import { describe, expect, it, vi } from 'vitest';
import type { TaskItem } from '@freevobe/protocol';
import { runSubagentTool, todoWriteTool } from './tasks.js';
import type { ToolContext } from './types.js';

function task(title: string, status: TaskItem['status'] = 'todo'): TaskItem {
  return { id: title, title, status, sessionId: 's', createdAt: 0 };
}

function context(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    root: '/tmp',
    projectId: 'p',
    sessionId: 's',
    runId: 'r',
    signal: new AbortController().signal,
    approval: { required: false, risk: 'low', reason: '', hardBlock: false },
    emit: () => undefined,
    requestApproval: async () => ({ approved: true }),
    proposeChange: async () => {
      throw new Error('inte här');
    },
    runHooks: async () => ({ blocked: false, output: '' }),
    exec: async () => ({
      command: '',
      exitCode: 0,
      passed: 0,
      failed: 0,
      output: '',
      timedOut: false,
    }),
    detectTestCommand: async () => null,
    fetchImpl: globalThis.fetch,
    limits: { terminalTimeoutMs: 1_000, maxOutputChars: 1_000 },
    ...overrides,
  } as ToolContext;
}

describe('todo_write', () => {
  it('ersätter hela listan och normaliserar okänd status', async () => {
    const replace = vi.fn((items: Array<{ title: string; status: string }>) =>
      items.map((item, index) => ({
        ...task(item.title, item.status as TaskItem['status']),
        id: `t${index}`,
      })),
    );
    const result = await todoWriteTool.handler!(
      {
        items: [{ title: 'Läs koden' }, { title: 'Skriv testet', status: 'done' }, { title: ' ' }],
      },
      context({ tasks: { list: () => [], replace } }),
    );

    expect(result.ok).toBe(true);
    expect(replace).toHaveBeenCalledWith([
      { title: 'Läs koden', status: 'todo' },
      { title: 'Skriv testet', status: 'done' },
    ]);
    expect(result.content).toContain('Läs koden');
  });

  it('säger ifrån när listan saknas eller är tom', async () => {
    expect((await todoWriteTool.handler!({}, context())).ok).toBe(false);
    const empty = await todoWriteTool.handler!(
      { items: [] },
      context({ tasks: { list: () => [], replace: () => [] } }),
    );
    expect(empty.ok).toBe(false);
    expect(empty.error).toMatch(/tom/i);
  });
});

describe('run_subagent', () => {
  it('delegerar och returnerar sammanfattningen', async () => {
    const runSubagent = vi.fn(async () => ({ summary: 'Hittade tre filer.', status: 'done' }));
    const result = await runSubagentTool.handler!(
      { kind: 'explorer', task: 'Hitta ingångspunkten' },
      context({ runSubagent }),
    );
    expect(result.ok).toBe(true);
    expect(runSubagent).toHaveBeenCalledWith('explorer', 'Hitta ingångspunkten');
    expect(result.content).toContain('Hittade tre filer.');
  });

  it('avvisar okänd subagent och saknad uppgift', async () => {
    expect((await runSubagentTool.handler!({ kind: 'okänd', task: 'x' }, context())).ok).toBe(
      false,
    );
    const missing = await runSubagentTool.handler!({ kind: 'explorer' }, context());
    expect(missing.ok).toBe(false);
  });
});
