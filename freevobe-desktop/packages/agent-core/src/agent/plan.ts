import type { Plan, PlanStep, ToolSpec } from '@freevobe/protocol';
import { normalizePlanPath } from '@freevobe/protocol';
import { toolCategory } from '../security/policy.js';
import { createId } from '../util/ids.js';

export const PROPOSE_PLAN_TOOL_NAME = 'propose_plan';

export interface PlanDraft {
  title: string;
  summary: string;
  steps: Array<{ title: string; files: string[] }>;
  files: string[];
}

export type PlanDraftResult = { ok: true; draft: PlanDraft } | { ok: false; error: string };

function uniqueFiles(entries: unknown): string[] {
  if (!Array.isArray(entries)) return [];
  const seen = new Set<string>();
  const files: string[] = [];
  for (const entry of entries) {
    if (typeof entry !== 'string') continue;
    const normalized = normalizePlanPath(entry);
    if (normalized === '' || seen.has(normalized)) continue;
    seen.add(normalized);
    files.push(normalized);
  }
  return files;
}

/**
 * Läser och städar argumenten till `propose_plan`. Modeller skickar ibland steg som rena
 * strängar, ibland med egna filfält, och ibland dubbletter – allt normaliseras här så att
 * kontraktet blir entydigt. Fel returneras som text så att modellen kan rätta sig själv.
 */
export function parsePlanDraft(args: Record<string, unknown>): PlanDraftResult {
  const rawTitle = typeof args.title === 'string' ? args.title.trim() : '';
  if (rawTitle === '') {
    return { ok: false, error: 'Planen saknar en rubrik. Skicka fältet "title".' };
  }

  if (!Array.isArray(args.steps) || args.steps.length === 0) {
    return {
      ok: false,
      error: 'Planen måste ha minst ett steg. Skicka en lista i fältet "steps".',
    };
  }

  const steps: PlanDraft['steps'] = [];
  for (const [index, entry] of args.steps.entries()) {
    if (typeof entry === 'string') {
      const title = entry.trim();
      if (title !== '') steps.push({ title, files: [] });
      continue;
    }
    if (entry && typeof entry === 'object') {
      const record = entry as Record<string, unknown>;
      const title = typeof record.title === 'string' ? record.title.trim() : '';
      if (title === '') continue;
      steps.push({ title, files: uniqueFiles(record.files) });
      continue;
    }
    return { ok: false, error: `Steg ${index + 1} är varken text eller ett objekt.` };
  }

  if (steps.length === 0) {
    return { ok: false, error: 'Inget av stegen hade en rubrik. Skriv vad varje steg gör.' };
  }

  // Den uttryckliga filistan är kontraktet. Stegens filer är information om vad steget rör
  // (t.ex. en fil som bara läses) och får bara bli kontrakt när modellen inte angett någon lista.
  const declared = uniqueFiles(args.files);
  const files = declared.length > 0 ? declared : [...new Set(steps.flatMap((step) => step.files))];

  return {
    ok: true,
    draft: {
      title: rawTitle,
      summary: typeof args.summary === 'string' ? args.summary.trim() : '',
      steps,
      files,
    },
  };
}

/** Bygger en komplett plan (med id och status "proposed") av ett normaliserat utkast. */
export function createPlan(
  draft: PlanDraft,
  input: { sessionId: string; runId: string; now?: number },
): Plan {
  const steps: PlanStep[] = draft.steps.map((step, index) => ({
    id: `step_${index + 1}`,
    title: step.title,
    files: step.files,
  }));

  return {
    id: createId('plan'),
    sessionId: input.sessionId,
    runId: input.runId,
    title: draft.title,
    summary: draft.summary,
    steps,
    files: draft.files,
    status: 'proposed',
    createdAt: input.now ?? Date.now(),
  };
}

function fileArgument(args: Record<string, unknown>): string | null {
  for (const key of ['path', 'file', 'target']) {
    const value = args[key];
    if (typeof value === 'string' && value.trim() !== '') return normalizePlanPath(value);
  }
  return null;
}

/**
 * Sant när anropet ligger utanför den godkända planen. Bara filändringar kontrolleras: att läsa
 * filer eller köra tester är alltid förenligt med en plan. Ett planfält som slutar med `/` eller
 * pekar ut en katalog matchar allt under katalogen.
 */
export function planScopeViolation(
  plan: Plan | undefined,
  spec: ToolSpec,
  args: Record<string, unknown>,
): { path: string; allowed: string[] } | null {
  if (!plan || plan.status !== 'approved') return null;
  if (plan.files.length === 0) return null;
  if (toolCategory(spec) !== 'file_write') return null;

  const candidate = fileArgument(args);
  if (!candidate) return null;

  const allowed = plan.files.map(normalizePlanPath).filter((entry) => entry !== '');
  const inScope = allowed.some((entry) => candidate === entry || candidate.startsWith(`${entry}/`));
  if (inScope) return null;
  return { path: candidate, allowed };
}

/** Planen som skickas in i systemprompten när den är godkänd. */
export function formatApprovedPlan(plan: Plan): string {
  const steps = plan.steps
    .map((step, index) => {
      const files = step.files.length > 0 ? ` (${step.files.join(', ')})` : '';
      return `${index + 1}. ${step.title}${files}`;
    })
    .join('\n');

  const files =
    plan.files.length > 0
      ? plan.files.map((file) => `- ${file}`).join('\n')
      : '- Inga filer namngavs i planen.';

  return [
    `### ${plan.title}`,
    plan.summary,
    '',
    '**Steg**',
    steps,
    '',
    '**Filer planen omfattar**',
    files,
  ]
    .filter((line) => line !== '\n')
    .join('\n')
    .trim();
}
