import { describe, expect, it } from 'vitest';
import type { Plan, ToolSpec } from '@freevobe/protocol';
import {
  PROPOSE_PLAN_TOOL_NAME,
  createPlan,
  formatApprovedPlan,
  parsePlanDraft,
  planScopeViolation,
} from './plan.js';

const writeSpec: ToolSpec = {
  name: 'edit_file',
  description: 'ändra fil',
  parameters: { type: 'object' },
  danger: 'write',
  source: 'builtin',
};

const readSpec: ToolSpec = {
  name: 'read_file',
  description: 'läs fil',
  parameters: { type: 'object' },
  danger: 'safe',
  source: 'builtin',
};

function approvedPlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: 'plan_1',
    sessionId: 'sess_1',
    runId: 'run_1',
    title: 'Byt hälsning',
    summary: 'Uppdatera hälsningen i src/halsa.ts.',
    steps: [
      { id: 'step_1', title: 'Läs filen', files: ['src/halsa.ts'] },
      { id: 'step_2', title: 'Byt text', files: ['src/halsa.ts'] },
    ],
    files: ['src/halsa.ts'],
    status: 'approved',
    createdAt: 1_000,
    decidedAt: 2_000,
    ...overrides,
  };
}

describe('parsePlanDraft', () => {
  it('läser steg som text och objekt och samlar filerna', () => {
    const parsed = parsePlanDraft({
      title: '  Lägg till test  ',
      summary: 'Ett test för diff-motorn.',
      steps: ['Läs diff-motorn', { title: 'Skriv testet', files: ['src/diff.test.ts'] }],
      files: ['src/diff.test.ts', './src/diff.test.ts'],
    });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.draft.title).toBe('Lägg till test');
    expect(parsed.draft.steps).toHaveLength(2);
    expect(parsed.draft.steps[1]?.files).toEqual(['src/diff.test.ts']);
    // Dubbletter och ./ tas bort, och stegens filer hamnar i planens filista.
    expect(parsed.draft.files).toEqual(['src/diff.test.ts']);
  });

  it('låter den uttryckliga filistan vara kontraktet, även när steg nämner andra filer', () => {
    const parsed = parsePlanDraft({
      title: 'Bara skrivfilen',
      steps: [
        { title: 'Läs package.json', files: ['package.json'] },
        { title: 'Skriv filen', files: ['src/ny.ts'] },
      ],
      files: ['src/ny.ts'],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    // package.json läses bara – det ska inte ge skrivrätt via kontraktet.
    expect(parsed.draft.files).toEqual(['src/ny.ts']);

    const derived = parsePlanDraft({
      title: 'Härledd',
      steps: [{ title: 'Skriv filen', files: ['src/ny.ts'] }],
    });
    expect(derived.ok && derived.draft.files).toEqual(['src/ny.ts']);
  });

  it('normaliserar bakåtsnedstreck och katalogprefix', () => {
    const parsed = parsePlanDraft({
      title: 'Windows',
      steps: [{ title: 'Skriv', files: ['src\\komponent.tsx'] }],
      files: ['/src/komponent.tsx'],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.draft.files).toEqual(['src/komponent.tsx']);
  });

  it('vägrar en plan utan rubrik eller steg', () => {
    expect(parsePlanDraft({ steps: ['ett'] })).toMatchObject({ ok: false });
    expect(parsePlanDraft({ title: 'Tom', steps: [] })).toMatchObject({ ok: false });
    expect(parsePlanDraft({ title: 'Tom', steps: [{ files: ['src/a.ts'] }] })).toMatchObject({
      ok: false,
    });
  });
});

describe('createPlan', () => {
  it('ger planen id, stegid och statusen proposed', () => {
    const plan = createPlan(
      {
        title: 'Plan',
        summary: '',
        steps: [
          { title: 'Ett', files: [] },
          { title: 'Två', files: ['src/a.ts'] },
        ],
        files: ['src/a.ts'],
      },
      { sessionId: 'sess_9', runId: 'run_9', now: 42 },
    );

    expect(plan.id).toMatch(/^plan_/);
    expect(plan.sessionId).toBe('sess_9');
    expect(plan.runId).toBe('run_9');
    expect(plan.status).toBe('proposed');
    expect(plan.createdAt).toBe(42);
    expect(plan.steps.map((step) => step.id)).toEqual(['step_1', 'step_2']);
  });
});

describe('planScopeViolation', () => {
  it('släpper igenom filer som planen omfattar', () => {
    const plan = approvedPlan();
    expect(planScopeViolation(plan, writeSpec, { path: 'src/halsa.ts' })).toBeNull();
    expect(planScopeViolation(plan, writeSpec, { path: './src/halsa.ts' })).toBeNull();
  });

  it('flaggar filändringar utanför planen', () => {
    const violation = planScopeViolation(approvedPlan(), writeSpec, { path: 'src/annan.ts' });
    expect(violation?.path).toBe('src/annan.ts');
    expect(violation?.allowed).toEqual(['src/halsa.ts']);
  });

  it('matchar en katalog som planen pekar ut', () => {
    const plan = approvedPlan({ files: ['src/'] });
    expect(planScopeViolation(plan, writeSpec, { path: 'src/djup/fil.ts' })).toBeNull();
  });

  it('bryr sig inte om läsning, icke-godkända planer eller planer utan filer', () => {
    expect(planScopeViolation(approvedPlan(), readSpec, { path: 'src/annan.ts' })).toBeNull();
    expect(
      planScopeViolation(approvedPlan({ status: 'proposed' }), writeSpec, { path: 'src/annan.ts' }),
    ).toBeNull();
    expect(planScopeViolation(approvedPlan({ files: [] }), writeSpec, { path: 'x.ts' })).toBeNull();
    expect(planScopeViolation(undefined, writeSpec, { path: 'x.ts' })).toBeNull();
  });
});

describe('formatApprovedPlan', () => {
  it('räknar upp stegen och filerna som kontraktet gäller', () => {
    const text = formatApprovedPlan(approvedPlan());
    expect(text).toContain('Byt hälsning');
    expect(text).toContain('1. Läs filen (src/halsa.ts)');
    expect(text).toContain('- src/halsa.ts');
  });

  it('säger till när planen inte namnger några filer', () => {
    const text = formatApprovedPlan(approvedPlan({ files: [] }));
    expect(text).toContain('Inga filer namngavs');
  });
});

describe('verktygsnamnet', () => {
  it('är det som loopen känner igen', () => {
    expect(PROPOSE_PLAN_TOOL_NAME).toBe('propose_plan');
  });
});
