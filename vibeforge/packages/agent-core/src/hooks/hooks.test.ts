import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HookRunner, mergeHookResults } from './hooks.js';
import { defaultHookTemplates } from './builtin.js';
import { createToolRuntime } from '../agent/runtime.js';
import { ApprovalManager } from '../approval/manager.js';
import type { HookConfig } from '@vibeforge/protocol';

let root: string;
const executed: string[] = [];

function makeRunner(hooks: HookConfig[], exitCode = 0): HookRunner {
  return new HookRunner(hooks, {
    root,
    runCommand: async (command) => {
      executed.push(command);
      return { output: `körde: ${command}`, exitCode };
    },
  });
}

function hook(overrides: Partial<HookConfig> = {}): HookConfig {
  return {
    name: 'test',
    event: 'after_file_edit',
    command: 'echo {{path}}',
    blockOnFailure: false,
    enabled: true,
    timeoutMs: 5_000,
    ...overrides,
  };
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'vibeforge-hooks-'));
  executed.length = 0;
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('HookRunner', () => {
  it('kör bara hooks för rätt händelse och fil', async () => {
    const runner = makeRunner([
      hook({ name: 'rätt', event: 'after_file_edit', filePattern: '**/*.ts' }),
      hook({ name: 'fel-event', event: 'before_commit' }),
      hook({ name: 'fel-fil', event: 'after_file_edit', filePattern: '**/*.py' }),
    ]);

    const result = await runner.run('after_file_edit', { path: 'src/agent.ts' });
    expect(result.matched).toBe(1);
    expect(executed).toHaveLength(1);
  });

  it('byter ut platshållare och citerar värden', async () => {
    const runner = makeRunner([hook({ command: 'eslint --fix {{path}}' })]);
    await runner.run('after_file_edit', { path: 'src/min fil.ts' });
    expect(executed[0]).toBe('eslint --fix "src/min fil.ts"');
  });

  it('blockerar när kommandot misslyckas och blockOnFailure är satt', async () => {
    const runner = makeRunner([hook({ blockOnFailure: true })], 1);
    const result = await runner.run('after_file_edit', { path: 'src/agent.ts' });
    expect(result.blocked).toBe(true);
  });

  it('blockerar inte när blockOnFailure är av', async () => {
    const runner = makeRunner([hook({ blockOnFailure: false })], 1);
    const result = await runner.run('after_file_edit', { path: 'src/agent.ts' });
    expect(result.blocked).toBe(false);
  });

  it('hoppar över inaktiverade hooks', async () => {
    const runner = makeRunner([hook({ enabled: false })]);
    const result = await runner.run('after_file_edit', { path: 'src/a.ts' });
    expect(result.matched).toBe(0);
    expect(executed).toHaveLength(0);
  });

  it('slår ihop resultat från flera hooks', async () => {
    const merged = mergeHookResults([
      { matched: 1, blocked: false, output: 'a' },
      { matched: 0, blocked: false, output: '' },
      { matched: 1, blocked: true, output: 'b' },
    ]);
    expect(merged.blocked).toBe(true);
    expect(merged.output).toBe('a\nb');
  });
});

describe('hooks i skrivvägen', () => {
  async function proposeWithHooks(hooks: HookConfig[], exitCode = 0) {
    const runner = makeRunner(hooks, exitCode);
    const runtime = createToolRuntime({
      root,
      projectId: 'p',
      sessionId: 's',
      runId: 'r',
      approvals: new ApprovalManager(),
      hooks: runner,
      emit: () => undefined,
      signal: new AbortController().signal,
      browserAutomationEnabled: false,
    });
    return runtime.proposeChange(
      { path: 'src/ny.ts', kind: 'create', newContent: 'export const x = 1;\n' },
      { required: false, risk: 'low', reason: 'test', hardBlock: false },
    );
  }

  it('skriver filen och kör after_file_edit', async () => {
    const result = await proposeWithHooks([
      hook({ name: 'formatera', event: 'after_file_edit', command: 'prettier --write {{path}}' }),
    ]);
    expect(result.applied).toBe(true);
    expect(await fs.readFile(path.join(root, 'src', 'ny.ts'), 'utf8')).toBe(
      'export const x = 1;\n',
    );
    expect(executed.some((command) => command.startsWith('prettier --write'))).toBe(true);
  });

  it('hindrar skrivningen när before_file_edit-hooken blockerar', async () => {
    const result = await proposeWithHooks(
      [
        hook({
          name: 'blockera',
          event: 'before_file_edit',
          command: 'node -e "process.exit(1)"',
          blockOnFailure: true,
        }),
      ],
      1,
    );
    expect(result.applied).toBe(false);
    expect(result.summary).toContain('blockerades av en hook');
    await expect(fs.access(path.join(root, 'src', 'ny.ts'))).rejects.toThrow();
  });
});

describe('hook-mallar', () => {
  it('är avstängda som standard så att inget körs utan användarens val', () => {
    const templates = defaultHookTemplates();
    expect(templates.length).toBeGreaterThanOrEqual(4);
    expect(templates.every((template) => template.enabled === false)).toBe(true);
    expect(templates.map((template) => template.event)).toContain('after_file_edit');
    expect(templates.map((template) => template.event)).toContain('before_commit');
  });
});
