import { parsePlanDraft } from '../agent/plan.js';
import { fail, ok, type RegisteredTool } from './types.js';

/**
 * Verktyget som låter modellen lägga fram en plan. Det har inga sidoeffekter: själva planen
 * skapas och visas av agent-loopen, som också avslutar Plan-läget när planen är lagd.
 */
export const proposePlanTool: RegisteredTool = {
  spec: {
    name: 'propose_plan',
    description:
      'Lägger fram en plan med numrerade steg och vilka filer som berörs. Planen visas för användaren som ett kontrakt: inget skrivs förrän den är godkänd. Används alltid i Plan-läget, och igen om en godkänd plan behöver ändras.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Kort rubrik på planen.' },
        summary: {
          type: 'string',
          description: 'En till tre meningar om vad som ska göras och varför.',
        },
        steps: {
          type: 'array',
          description: 'Planens steg, i ordning.',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Vad steget gör.' },
              files: {
                type: 'array',
                description: 'Projektrelativa filer steget rör.',
                items: { type: 'string' },
              },
            },
            required: ['title'],
          },
        },
        files: {
          type: 'array',
          description: 'Alla projektrelativa filer planen får ändra.',
          items: { type: 'string' },
        },
      },
      required: ['title', 'steps'],
    },
    danger: 'safe',
    source: 'builtin',
  },
  handler: async (args) => {
    const parsed = parsePlanDraft(args);
    if (!parsed.ok) return fail(parsed.error);

    const { draft } = parsed;
    const files = draft.files.length > 0 ? draft.files.join(', ') : 'inga namngivna filer';
    return ok(
      `Planen "${draft.title}" med ${draft.steps.length} steg är registrerad och visas för användaren (filer: ${files}).`,
      {
        plan: {
          title: draft.title,
          summary: draft.summary,
          steps: draft.steps,
          files: draft.files,
        },
      },
    );
  },
};
