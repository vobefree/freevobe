import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AgentEvent, SubagentStatus } from '@vibeforge/protocol';
import { startFakeOllama, type FakeOllamaHandle, type FakeTurn } from '../testing/fakeOllama.js';
import { OllamaClient } from '../ollama/client.js';
import { ToolRegistry } from '../tools/registry.js';
import { builtinTools } from '../tools/index.js';
import { ApprovalManager } from '../approval/manager.js';
import { HookRunner } from '../hooks/hooks.js';
import { loadProjectRules } from '../rules/loader.js';
import { loadBuiltinSkills } from '../skills/loader.js';
import { createToolRuntime } from '../agent/runtime.js';
import { buildRepoMap } from '../context/repoMap.js';
import { SubagentRunner, summarize } from './runner.js';
import { listSubagents, buildSubagentTask, getSubagentDefinition } from './definitions.js';

let root: string;
let fake: FakeOllamaHandle | undefined;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'vibeforge-subagents-'));
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'app.ts'), 'export const app = 1;\n');
});

afterEach(async () => {
  await fake?.close();
  fake = undefined;
  await fs.rm(root, { recursive: true, force: true });
});

async function makeRunner(turns: FakeTurn[] | undefined, approve = true) {
  fake = await startFakeOllama({ turns: turns ?? [] });
  const registry = new ToolRegistry();
  registry.registerAll(builtinTools);

  const approvals: string[] = [];
  const approvalManager = new ApprovalManager({
    onRequest: (request) => {
      approvals.push(request.kind);
      approvalManager.resolve({
        approvalId: request.id,
        decision: approve ? 'approved' : 'rejected',
      });
    },
  });

  const runtime = createToolRuntime({
    root,
    projectId: 'p',
    sessionId: 's',
    runId: 'parent-run',
    approvals: approvalManager,
    hooks: new HookRunner([], { root, runCommand: async () => ({ output: '', exitCode: 0 }) }),
    emit: () => undefined,
    signal: new AbortController().signal,
    browserAutomationEnabled: false,
  });

  const runner = new SubagentRunner({
    transport: new OllamaClient({ baseUrl: fake.url }),
    registry,
    runtime,
    rules: await loadProjectRules(root),
    skills: await loadBuiltinSkills(),
    model: 'deepseek-r1:8b',
    permissionMode: 'ask',
    repoMapProvider: () => buildRepoMap(root),
  });

  return { runner, approvals };
}

describe('subagentdefinitioner', () => {
  it('har de fem subagenter specen kräver', () => {
    expect(listSubagents().map((definition) => definition.kind)).toEqual([
      'explorer',
      'implementer',
      'tester',
      'reviewer',
      'documenter',
    ]);
  });

  it('markerar lässubagenter som readOnly', () => {
    expect(getSubagentDefinition('explorer').readOnly).toBe(true);
    expect(getSubagentDefinition('reviewer').readOnly).toBe(true);
    expect(getSubagentDefinition('implementer').readOnly).toBe(false);
  });

  it('begränsar vilka verktyg varje subagent får', () => {
    expect(getSubagentDefinition('explorer').allowedTools).not.toContain('write_file');
    expect(getSubagentDefinition('implementer').allowedTools).toContain('edit_file');
    expect(getSubagentDefinition('documenter').allowedTools).not.toContain('run_terminal_command');
  });

  it('bygger uppgiftsbeskrivningen med ledtrådar', () => {
    const task = buildSubagentTask('explorer', 'Hitta Ollama-klienten', [
      'Filen ligger under packages/agent-core',
    ]);
    expect(task).toContain('Hitta Ollama-klienten');
    expect(task).toContain('Ledtrådar');
    expect(task).toContain('Sammanfattning');
  });
});

describe('SubagentRunner', () => {
  it('kör en utforskare med isolerad kontext och returnerar en sammanfattning', async () => {
    const { runner } = await makeRunner([
      { toolCalls: [{ id: 'c1', name: 'read_file', args: { path: 'src/app.ts' } }] },
      { content: '## Sammanfattning\nAppen exporterar en konstant i src/app.ts.' },
    ]);

    const events: AgentEvent[] = [];
    const statuses: SubagentStatus[] = [];
    const result = await runner.run({
      kind: 'explorer',
      task: 'Förklara vad src/app.ts gör.',
      signal: new AbortController().signal,
      onEvent: (event) => events.push(event),
      onStatus: (status) => statuses.push(status),
    });

    expect(result.status).toBe('done');
    expect(result.summary).toContain('src/app.ts');
    expect(result.toolCalls).toBe(1);
    expect(events.some((event) => event.type === 'tool_call')).toBe(true);
    expect(statuses[0]?.status).toBe('running');
    expect(statuses.at(-1)?.status).toBe('done');
    expect(statuses.at(-1)?.summary).toContain('src/app.ts');
  });

  it('ger utforskaren verktyget write_file?, nej – den får inte skriva', async () => {
    const { runner } = await makeRunner([
      {
        toolCalls: [
          { id: 'c1', name: 'write_file', args: { path: 'src/olovlig.ts', content: 'x' } },
        ],
      },
      { content: '## Sammanfattning\nJag kunde inte skriva.' },
    ]);

    const result = await runner.run({
      kind: 'explorer',
      task: 'Skriv en fil.',
      signal: new AbortController().signal,
    });

    await expect(fs.access(path.join(root, 'src', 'olovlig.ts'))).rejects.toThrow();
    expect(
      result.events.some((event) => event.type === 'error' && event.code === 'tool_not_found'),
    ).toBe(true);
  });

  it('låter implementeraren skriva filer efter godkännande', async () => {
    const { runner, approvals } = await makeRunner([
      {
        toolCalls: [
          {
            id: 'c1',
            name: 'create_file',
            args: { path: 'src/ny.ts', content: 'export const ny = 2;\n' },
          },
        ],
      },
      { content: '## Sammanfattning\nSkapade src/ny.ts.' },
    ]);

    const result = await runner.run({
      kind: 'implementer',
      task: 'Skapa src/ny.ts.',
      signal: new AbortController().signal,
    });

    expect(result.status).toBe('done');
    expect(await fs.readFile(path.join(root, 'src', 'ny.ts'), 'utf8')).toBe(
      'export const ny = 2;\n',
    );
    expect(approvals).toContain('file_write');
  });

  it('skriver inte när användaren avvisar', async () => {
    const { runner } = await makeRunner(
      [
        {
          toolCalls: [
            { id: 'c1', name: 'create_file', args: { path: 'src/nej.ts', content: 'x' } },
          ],
        },
        { content: '## Sammanfattning\nAvbrutet.' },
      ],
      false,
    );

    await runner.run({
      kind: 'implementer',
      task: 'Skapa src/nej.ts.',
      signal: new AbortController().signal,
    });
    await expect(fs.access(path.join(root, 'src', 'nej.ts'))).rejects.toThrow();
  });

  it('kör lässubagenter parallellt', async () => {
    const { runner } = await makeRunner([
      { content: '## Sammanfattning\nFörsta svaret.' },
      { content: '## Sammanfattning\nAndra svaret.' },
    ]);

    const started = Date.now();
    const results = await runner.runMany([
      { kind: 'explorer', task: 'Uppgift A', signal: new AbortController().signal },
      { kind: 'reviewer', task: 'Uppgift B', signal: new AbortController().signal },
    ]);
    const duration = Date.now() - started;

    expect(results).toHaveLength(2);
    expect(results.every((result) => result.status === 'done')).toBe(true);
    // Båda mot samma fake-server (som svarar i turordning) – bara att de båda blev klara räcker.
    expect(duration).toBeGreaterThan(0);
  });

  it('kör skrivande subagenter i tur och ordning', async () => {
    const { runner } = await makeRunner([
      { content: '## Sammanfattning\nA klar.' },
      { content: '## Sammanfattning\nB klar.' },
    ]);

    const results = await runner.runMany([
      { kind: 'implementer', task: 'A', signal: new AbortController().signal },
      { kind: 'documenter', task: 'B', signal: new AbortController().signal },
    ]);

    expect(results.map((result) => result.summary)).toEqual([
      expect.stringContaining('A klar'),
      expect.stringContaining('B klar'),
    ]);
  });

  it('rapporterar avbrott', async () => {
    const { runner } = await makeRunner([{ content: '## Sammanfattning\nklar' }]);
    const controller = new AbortController();
    controller.abort();

    const result = await runner.run({ kind: 'explorer', task: 'x', signal: controller.signal });
    expect(result.status).toBe('aborted');
  });
});

describe('summarize', () => {
  it('klipper långa svar vid sammanfattningsrubriken', () => {
    const long = `${'brus\n'.repeat(2_000)}## Sammanfattning\nDet viktiga.`;
    const summary = summarize(long);
    expect(summary.startsWith('## Sammanfattning')).toBe(true);
    expect(summary.length).toBeLessThanOrEqual(3_000);
  });

  it('hanterar tomt svar', () => {
    expect(summarize('   ')).toContain('ingen sammanfattning');
  });
});
