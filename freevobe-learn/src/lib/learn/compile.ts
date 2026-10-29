/**
 * Hela kedjan: mening → beskrivning → karta → validering.
 *
 * Ett försök kan ge en karta som inte går att spela. Då provas nästa försök med ett nytt frö,
 * och först när alla är slut får barnet veta det – med en förklaring i stället för en tom ruta.
 */
import { describeWorld } from './describe';
import { generateWorld } from './generate';
import { asPlayableWorld, hasErrors, validateSpec, validateWorld } from './validate';
import type { CompileResult, PlayableWorld, ValidationIssue, WorldSpec } from './types';

/** Hur många kartor vi provar innan vi ger upp. */
export const MAX_ATTEMPTS = 8;

const NO_PLAYABLE_MAP: ValidationIssue = {
  code: 'no-playable-map',
  level: 'error',
  message: 'Jag kunde inte bygga en karta som går att spela av den här beskrivningen.',
  fix: 'Gör världen lite större eller be om färre skatter.',
};

export type WorldResult =
  | { ok: true; world: PlayableWorld; issues: ValidationIssue[] }
  | { ok: false; issues: ValidationIssue[] };

/** Bygger en karta ur en färdig beskrivning. `attempt` ger en annan karta ur samma beskrivning. */
export function buildWorld(spec: WorldSpec, attempt = 0): WorldResult {
  const specIssues = validateSpec(spec);
  if (hasErrors(specIssues)) return { ok: false, issues: specIssues };

  let lastIssues: ValidationIssue[] = [];
  for (let index = 0; index < MAX_ATTEMPTS; index += 1) {
    const world = generateWorld(spec, { attempt: attempt + index });
    const issues = validateWorld(world);
    lastIssues = issues;
    const playable = asPlayableWorld(world, issues);
    if (playable) return { ok: true, world: playable, issues };
  }

  return {
    ok: false,
    issues: [...lastIssues.filter((issue) => issue.level === 'error'), NO_PLAYABLE_MAP],
  };
}

/** Tolkar texten och bygger en spelbar värld, eller förklarar varför det inte gick. */
export function compileWorld(text: string): CompileResult {
  const interpretation = describeWorld(text);
  const result = buildWorld(interpretation.spec);
  return result.ok
    ? { ok: true, interpretation, world: result.world, issues: result.issues }
    : { ok: false, interpretation, issues: result.issues };
}
