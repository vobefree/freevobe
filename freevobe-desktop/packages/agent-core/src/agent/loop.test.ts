import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AgentEvent, ApprovalRequest, Plan } from '@freevobe/protocol';
import { startFakeOllama, type FakeOllamaHandle, type FakeTurn } from '../testing/fakeOllama.js';
import { OllamaClient } from '../ollama/client.js';
import { ToolRegistry } from '../tools/registry.js';
import { builtinTools } from '../tools/index.js';
import { ApprovalManager } from '../approval/manager.js';
import { HookRunner } from '../hooks/hooks.js';
import { loadProjectRules } from '../rules/loader.js';
import { loadBuiltinSkills } from '../skills/loader.js';
import { buildRepoMap } from '../context/repoMap.js';
import { createToolRuntime } from './runtime.js';
import { AgentLoop } from './loop.js';

let root: string;
let fake: FakeOllamaHandle;

const ORIGINAL_FILE = [
  'export function halsa(namn: string) {',
  "  return 'hej ' + namn;",
  '}',
  '',
].join('\n');

/** Förväntat resultat av den redigering som modellen föreslår i testet. */
const UPDATED_FILE = ORIGINAL_FILE.replace("return 'hej ' + namn;", 'return `hej ${namn}!`;');

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-slice-'));
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'halsa.ts'), ORIGINAL_FILE);
  await fs.writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'svep', scripts: { test: 'echo tester ok' } }),
  );
});

afterEach(async () => {
  await fake?.close();
  await fs.rm(root, { recursive: true, force: true });
});

interface SliceOptions {
  turns: FakeTurn[];
  permissionMode?: 'ask' | 'auto-edit' | 'auto-run' | 'full-auto';
  mode?: 'plan' | 'execute';
  approve?: boolean;
  maxIterations?: number;
  supportsTools?: boolean;
  abortAfter?: number;
  /** Fördröjer första byten, som när Ollama laddar in modellen. */
  chatDelayMs?: number;
  /** Hur länge loopen väntar innan den säger att modellen laddas. */
  firstTokenNoticeMs?: number;
  /** Godkänd plan som ska gälla som kontrakt i körningen. */
  plan?: Plan;
}

interface SliceResult {
  events: AgentEvent[];
  toolResultContents: string[];
  approalski: ApprovalRequest[];
}

async function runSlice(options: SliceOptions): Promise<SliceResult> {
  fake = await startFakeOllama({
    turns: options.turns,
    ...(options.chatDelayMs !== undefined ? { chatDelayMs: options.chatDelayMs } : {}),
  });
  const events: AgentEvent[] = [];
  const approvals: ApprovalRequest[] = [];

  const approvalManager = new ApprovalManager({
    onRequest: (request) => {
      approvals.push(request);
      approvalManager.resolve({
        approvalId: request.id,
        decision: options.approve === false ? 'rejected' : 'approved',
      });
    },
  });

  const controller = new AbortController();
  const runtime = createToolRuntime({
    root,
    projectId: 'proj',
    sessionId: 'sess',
    runId: 'run_1',
    approvals: approvalManager,
    hooks: new HookRunner([], { root, runCommand: async () => ({ output: '', exitCode: 0 }) }),
    emit: (event) => events.push(event),
    signal: controller.signal,
    browserAutomationEnabled: false,
  });

  const registry = new ToolRegistry();
  registry.registerAll(builtinTools);

  const rules = await loadProjectRules(root);
  const skills = await loadBuiltinSkills();
  const loop = new AgentLoop({
    transport: new OllamaClient({ baseUrl: fake.url }),
    registry,
    runtime,
    rules,
    skills,
    repoMapProvider: () => buildRepoMap(root),
    ...(options.maxIterations !== undefined ? { maxIterations: options.maxIterations } : {}),
    ...(options.firstTokenNoticeMs !== undefined
      ? { firstTokenNoticeMs: options.firstTokenNoticeMs }
      : {}),
    browserAutomationEnabled: false,
  });

  const iterator = loop.run({
    runId: 'run_1',
    sessionId: 'sess',
    mode: options.mode ?? 'execute',
    permissionMode: options.permissionMode ?? 'ask',
    model: 'deepseek-r1:8b',
    userMessage: 'Läs src/halsa.ts och lägg till en svensk hälsning med template-sträng',
    history: [],
    signal: controller.signal,
    supportsTools: options.supportsTools ?? true,
    projectName: 'svep',
    ...(options.plan ? { plan: options.plan } : {}),
  });

  // Både loopens yieldade händelser och de som verktygen skickar via emit hamnar i samma lista,
  // i kronologisk ordning – det är precis den ordning UI:t får dem.
  let count = 0;
  for await (const event of iterator) {
    events.push(event);
    count += 1;
    if (options.abortAfter !== undefined && count >= options.abortAfter) controller.abort();
  }

  return {
    events,
    toolResultContents: events
      .filter((event) => event.type === 'tool_result')
      .map((event) => event.result.content),
    approalski: approvals,
  };
}

function types(events: AgentEvent[]): string[] {
  return events.map((event) => event.type);
}

describe('vertikal slice: Ollama → chatt → läs fil → ändra → diff → godkänn → skriv', () => {
  it('kör hela kedjan och skriver filen på disk', async () => {
    const result = await runSlice({
      permissionMode: 'ask',
      turns: [
        {
          toolCalls: [{ id: 'c1', name: 'read_file', args: { path: 'src/halsa.ts' } }],
          content: 'Jag läser filen först.',
        },
        {
          toolCalls: [
            {
              id: 'c2',
              name: 'edit_file',
              args: {
                path: 'src/halsa.ts',
                oldString: "return 'hej ' + namn;",
                newString: 'return `hej ${namn}!`;',
              },
            },
          ],
        },
        { content: 'Klart. Jag bytte till en template-sträng och lade till en hälsning.' },
      ],
    });

    // 1. Filen är faktiskt ändrad på disk.
    const written = await fs.readFile(path.join(root, 'src', 'halsa.ts'), 'utf8');
    expect(written).toBe(UPDATED_FILE);

    // 2. Diffen genererades och visades innan skrivningen.
    const diffEvent = result.events.find((event) => event.type === 'diff');
    expect(diffEvent).toBeDefined();
    if (diffEvent?.type === 'diff') {
      expect(diffEvent.diff.path).toBe('src/halsa.ts');
      expect(diffEvent.diff.additions).toBeGreaterThan(0);
      expect(diffEvent.diff.oldContent).toContain("return 'hej ' + namn");
      expect(diffEvent.diff.newContent).toContain('hej ${namn}!');
    }

    // 3. Godkännande begärdes för skrivningen och besvarades.
    expect(result.approalski.some((request) => request.kind === 'file_write')).toBe(true);
    expect(types(result.events)).toContain('approval_request');
    expect(types(result.events)).toContain('approval_resolved');

    // 4. Händelseordningen är den förväntade.
    const sequence = types(result.events);
    expect(sequence[0]).toBe('run_started');
    expect(sequence).toContain('context');
    expect(sequence.indexOf('tool_call')).toBeLessThan(sequence.indexOf('tool_result'));
    expect(sequence.indexOf('diff')).toBeLessThan(sequence.indexOf('file_changed'));
    expect(sequence.at(-1)).toBe('run_finished');
    expect(sequence).toContain('assistant_message');

    // 5. Loopen avslutades med ett slutligt svar.
    const finished = result.events.at(-1);
    expect(finished?.type === 'run_finished' && finished.reason).toBe('final');

    // 6. Verktygsresultaten innehåller det modellen behöver veta.
    expect(result.toolResultContents[0]).toContain('src/halsa.ts');
    expect(result.toolResultContents[0]).toContain('export function halsa');

    // 7. Kontexten innehöll den relevanta filen.
    const contextEvent = result.events.find((event) => event.type === 'context');
    expect(
      contextEvent?.type === 'context' &&
        contextEvent.files.some((file) => file.path === 'src/halsa.ts'),
    ).toBe(true);
  });

  it('skriver inte filen när användaren avvisar diffen', async () => {
    const result = await runSlice({
      approve: false,
      turns: [
        {
          toolCalls: [
            {
              id: 'c1',
              name: 'write_file',
              args: { path: 'src/halsa.ts', content: 'helt nytt innehåll\n' },
            },
          ],
        },
        { content: 'Jag kunde inte ändra filen.' },
      ],
    });

    expect(await fs.readFile(path.join(root, 'src', 'halsa.ts'), 'utf8')).toBe(ORIGINAL_FILE);
    expect(
      result.events.some((event) => event.type === 'error' && event.code === 'approval_rejected'),
    ).toBe(true);
    expect(types(result.events)).not.toContain('file_changed');
  });

  it('avbryter mitt i körningen och skriver ingenting', async () => {
    const result = await runSlice({
      abortAfter: 3,
      turns: [
        {
          toolCalls: [
            { id: 'c1', name: 'write_file', args: { path: 'src/ny.ts', content: 'x\n' } },
          ],
        },
        { content: 'klart' },
      ],
    });

    const finished = result.events.at(-1);
    expect(finished?.type === 'run_finished' && finished.reason).toBe('aborted');
    await expect(fs.access(path.join(root, 'src', 'ny.ts'))).rejects.toThrow();
  });

  it('stannar vid iterationsgränsen', async () => {
    const result = await runSlice({
      maxIterations: 2,
      permissionMode: 'auto-edit',
      turns: [
        { toolCalls: [{ id: 'c1', name: 'read_file', args: { path: 'src/halsa.ts' } }] },
        { toolCalls: [{ id: 'c2', name: 'read_file', args: { path: 'src/halsa.ts' } }] },
      ],
    });

    expect(
      result.events.some((event) => event.type === 'error' && event.code === 'loop_limit'),
    ).toBe(true);
    const finished = result.events.at(-1);
    expect(finished?.type === 'run_finished' && finished.reason).toBe('loop_limit');
  });

  it('blockerar farliga kommandon även i Full auto och kör dem aldrig', async () => {
    const result = await runSlice({
      permissionMode: 'full-auto',
      turns: [
        { toolCalls: [{ id: 'c1', name: 'run_terminal_command', args: { command: 'rm -rf /' } }] },
        { content: 'Det gick inte.' },
      ],
    });

    expect(
      result.events.some((event) => event.type === 'error' && event.code === 'policy_blocked'),
    ).toBe(true);
    const terminalChunks = result.events.filter((event) => event.type === 'terminal');
    expect(terminalChunks).toHaveLength(0);

    const blocked = result.events.find(
      (event) => event.type === 'error' && event.code === 'policy_blocked',
    );
    expect(blocked?.type === 'error' && blocked.message).toMatch(/Blockerat av säkerhetsregeln/);
  });

  it('lägger fram en plan i Plan-läget och avslutar utan att skriva', async () => {
    const result = await runSlice({
      mode: 'plan',
      permissionMode: 'ask',
      turns: [
        {
          toolCalls: [
            {
              id: 'c1',
              name: 'propose_plan',
              args: {
                title: 'Svensk hälsning',
                summary: 'Byt hälsningen i src/halsa.ts.',
                steps: [
                  { title: 'Läs filen', files: ['src/halsa.ts'] },
                  { title: 'Byt texten', files: ['src/halsa.ts'] },
                ],
                files: ['src/halsa.ts'],
              },
            },
          ],
        },
        // Modellen ska aldrig nå den här turen: planen avslutar Plan-läget.
        { content: 'Här är planen.' },
      ],
    });

    const proposed = result.events.find((event) => event.type === 'plan_proposed');
    expect(proposed).toBeDefined();
    if (proposed?.type === 'plan_proposed') {
      expect(proposed.plan.status).toBe('proposed');
      expect(proposed.plan.title).toBe('Svensk hälsning');
      expect(proposed.plan.steps).toHaveLength(2);
      expect(proposed.plan.files).toEqual(['src/halsa.ts']);
      expect(proposed.plan.sessionId).toBe('sess');
    }

    // Planen är resultatet av körningen, och inga filer rördes. Ett varv med bara verktygsanrop
    // ska inte ge en tom pratbubbla i chatten.
    expect(types(result.events)).not.toContain('assistant_message');
    const finished = result.events.at(-1);
    expect(finished?.type === 'run_finished' && finished.reason).toBe('plan-ready');
    expect(types(result.events)).not.toContain('file_changed');
    expect(await fs.readFile(path.join(root, 'src', 'halsa.ts'), 'utf8')).toBe(ORIGINAL_FILE);
  });

  it('låter en godkänd plan styra vilka filer som får ändras', async () => {
    const plan: Plan = {
      id: 'plan_1',
      sessionId: 'sess',
      runId: 'run_0',
      title: 'Byt hälsning',
      summary: 'Endast src/halsa.ts.',
      steps: [{ id: 'step_1', title: 'Byt texten', files: ['src/halsa.ts'] }],
      files: ['src/halsa.ts'],
      status: 'approved',
      createdAt: 1,
      decidedAt: 2,
    };

    const result = await runSlice({
      plan,
      // Full auto tillåter annars allt – det är kontraktet som ska stoppa filen utanför planen.
      permissionMode: 'full-auto',
      turns: [
        {
          toolCalls: [
            { id: 'c1', name: 'write_file', args: { path: 'src/utanfor.ts', content: 'x\n' } },
          ],
        },
        {
          toolCalls: [
            {
              id: 'c2',
              name: 'edit_file',
              args: {
                path: 'src/halsa.ts',
                oldString: "return 'hej ' + namn;",
                newString: 'return `hej ${namn}!`;',
              },
            },
          ],
        },
        { content: 'Klart. Jag höll mig till planen.' },
      ],
    });

    // 1. Filen utanför planen krävde ett personligt ja, trots full auto.
    const deviation = result.approalski.find((request) => request.path === 'src/utanfor.ts');
    expect(deviation).toBeDefined();
    expect(deviation?.reason).toContain('utanför den godkända planen');
    // Planens filer står i orsaken så att användaren ser kontraktet i godkännandekortet.
    expect(deviation?.reason).toContain('src/halsa.ts');

    // 2. Filen i planen skrevs utan att fråga.
    expect(await fs.readFile(path.join(root, 'src', 'halsa.ts'), 'utf8')).toBe(UPDATED_FILE);
    expect(result.approalski.filter((request) => request.path === 'src/halsa.ts')).toHaveLength(0);

    // 3. Kontraktet skickades in i systemprompten.
    const systemPrompt = (
      fake.requests[0]?.body.messages as Array<{ content: string }> | undefined
    )?.[0]?.content;
    expect(systemPrompt).toBeDefined();
    expect(systemPrompt).toContain('Godkänd plan (kontrakt)');
    expect(systemPrompt).toContain('src/halsa.ts');
  });

  it('tillåter inte ändringar i Plan-läget', async () => {
    const result = await runSlice({
      mode: 'plan',
      permissionMode: 'auto-run',
      turns: [
        {
          toolCalls: [
            { id: 'c1', name: 'write_file', args: { path: 'src/ny.ts', content: 'x\n' } },
          ],
        },
        { content: 'Här är planen.' },
      ],
    });

    expect(
      result.events.some((event) => event.type === 'error' && event.code === 'policy_blocked'),
    ).toBe(true);
    await expect(fs.access(path.join(root, 'src', 'ny.ts'))).rejects.toThrow();
  });

  it('kör ett terminalkommando och strömmar utdata', async () => {
    const result = await runSlice({
      permissionMode: 'auto-run',
      turns: [
        {
          toolCalls: [
            {
              id: 'c1',
              name: 'run_terminal_command',
              args: { command: 'echo hej från terminalen' },
            },
          ],
        },
        { content: 'Klart.' },
      ],
    });

    const terminalText = result.events
      .filter((event) => event.type === 'terminal')
      .map((event) => (event.type === 'terminal' ? event.chunk.text : ''))
      .join('');
    expect(terminalText).toContain('echo hej från terminalen');
    expect(terminalText).toContain('hej från terminalen');
    expect(result.approalski.filter((request) => request.kind === 'terminal')).toHaveLength(0);
  });

  it('kräver godkännande för terminalkommandon i läget Fråga alltid', async () => {
    const result = await runSlice({
      permissionMode: 'ask',
      turns: [
        { toolCalls: [{ id: 'c1', name: 'run_tests', args: {} }] },
        { content: 'Testerna är gröna.' },
      ],
    });

    expect(result.approalski.some((request) => request.kind === 'terminal')).toBe(true);
    expect(result.events.some((event) => event.type === 'tests')).toBe(true);
  });

  it('kör ett textuellt plan-anrop även när modellen uppger verktygsstöd', async () => {
    // Felet som rapporterades: modellen svarade med rå JSON i chatten och inget hände, trots
    // att den (enligt /api/show) har verktygsstöd.
    const result = await runSlice({
      mode: 'plan',
      permissionMode: 'ask',
      turns: [
        {
          content: [
            '{"name": "propose_plan", "arguments": {"title": "Hemsida för Klippet", "steps": [',
            '{"title": "Bygg sidan", "files": ["index.html"]}]}',
          ].join(''),
        },
        // Ska aldrig nås: planen avslutar Plan-läget.
        { content: 'Här är planen.' },
      ],
    });

    const proposed = result.events.find((event) => event.type === 'plan_proposed');
    expect(proposed).toBeDefined();
    if (proposed?.type === 'plan_proposed') expect(proposed.plan.title).toBe('Hemsida för Klippet');

    // Ingen pratbubbla med rå JSON, och inget av anropet strömmas ut i chatten.
    const texts = result.events
      .filter((event) => event.type === 'assistant_message')
      .map((event) => (event.type === 'assistant_message' ? event.text : ''));
    expect(texts.join('\n')).not.toContain('propose_plan');
    const streamed = result.events
      .filter((event) => event.type === 'assistant_delta')
      .map((event) => (event.type === 'assistant_delta' ? event.text : ''))
      .join('');
    expect(streamed).not.toContain('propose_plan');
    expect(streamed).not.toContain('"name"');
    expect(types(result.events)).toContain('assistant_reset');
    const finished = result.events.at(-1);
    expect(finished?.type === 'run_finished' && finished.reason).toBe('plan-ready');
  });

  it('kör textuella verktygsanrop även när modellen uppger verktygsstöd', async () => {
    const result = await runSlice({
      permissionMode: 'auto-edit',
      turns: [
        {
          content: [
            'Jag läser filen.',
            '<tool_call>{"name":"read_file","arguments":{"path":"src/halsa.ts"}}</tool_call>',
          ].join('\n'),
        },
        { content: 'Klart.' },
      ],
    });

    expect(
      result.toolResultContents.some((content) => content.includes('export function halsa')),
    ).toBe(true);
    const first = result.events.find((event) => event.type === 'assistant_message');
    expect(first?.type === 'assistant_message' && first.text).toBe('Jag läser filen.');
  });

  it('hanterar modeller utan verktygsstöd via textuella anrop', async () => {
    const result = await runSlice({
      permissionMode: 'auto-edit',
      supportsTools: false,
      turns: [
        {
          content: [
            'Jag läser filen.',
            '```json',
            '{"name":"read_file","arguments":{"path":"src/halsa.ts"}}',
            '```',
          ].join('\n'),
        },
        { content: 'Klart.' },
      ],
    });

    expect(
      result.toolResultContents.some((content) => content.includes('export function halsa')),
    ).toBe(true);
  });
});

describe('modellinläsning syns i chatten', () => {
  it('säger att modellen laddas när första token dröjer', async () => {
    const result = await runSlice({
      permissionMode: 'auto-edit',
      turns: [{ content: 'Klart.' }],
      chatDelayMs: 120,
      firstTokenNoticeMs: 20,
    });

    const phases = result.events
      .filter((event) => event.type === 'status')
      .map((event) => (event.type === 'status' ? event.phase : ''));
    expect(phases).toContain('loading-model');

    // Aviseringen kommer innan första tecknet, så chatten hinner visa vänteläget.
    const notice = result.events.findIndex(
      (event) => event.type === 'status' && event.phase === 'loading-model',
    );
    const firstDelta = result.events.findIndex((event) => event.type === 'assistant_delta');
    expect(notice).toBeGreaterThanOrEqual(0);
    expect(firstDelta).toBeGreaterThan(notice);
  });

  it('säger ingenting när modellen svarar direkt', async () => {
    const result = await runSlice({
      permissionMode: 'auto-edit',
      turns: [{ content: 'Klart.' }],
      firstTokenNoticeMs: 400,
    });

    const phases = result.events
      .filter((event) => event.type === 'status')
      .map((event) => (event.type === 'status' ? event.phase : ''));
    expect(phases).not.toContain('loading-model');
  });
});
