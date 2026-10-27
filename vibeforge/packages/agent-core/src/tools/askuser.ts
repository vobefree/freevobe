import type { ApprovalQuestion } from '@vibeforge/protocol';
import { fail, ok, type RegisteredTool } from './types.js';

function normalizeQuestions(raw: unknown): ApprovalQuestion[] {
  if (!Array.isArray(raw)) return [];
  const questions: ApprovalQuestion[] = [];
  raw.forEach((entry, index) => {
    if (typeof entry !== 'object' || entry === null) return;
    const record = entry as Record<string, unknown>;
    const question = typeof record.question === 'string' ? record.question : '';
    if (!question) return;
    const options = Array.isArray(record.options)
      ? record.options
          .map((option) => {
            if (typeof option === 'string') return { label: option };
            if (
              typeof option === 'object' &&
              option !== null &&
              typeof (option as { label?: unknown }).label === 'string'
            ) {
              const label = (option as { label: string }).label;
              const description = (option as { description?: unknown }).description;
              return typeof description === 'string' ? { label, description } : { label };
            }
            return null;
          })
          .filter((option): option is { label: string; description?: string } => option !== null)
      : [];

    questions.push({
      id: typeof record.id === 'string' ? record.id : `q${index + 1}`,
      header: typeof record.header === 'string' && record.header ? record.header : 'Fråga',
      question,
      options,
      multiSelect: record.multiSelect === true,
    });
  });
  return questions;
}

export const askUserTool: RegisteredTool = {
  spec: {
    name: 'ask_user',
    description:
      'Ställer en fråga till användaren och väntar på svaret. Används när ett beslut kräver mänsklig bedömning.',
    parameters: {
      type: 'object',
      properties: {
        questions: {
          type: 'array',
          description: 'En till fyra frågor.',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              header: { type: 'string' },
              question: { type: 'string' },
              options: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { label: { type: 'string' }, description: { type: 'string' } },
                  required: ['label'],
                },
              },
              multiSelect: { type: 'boolean' },
            },
            required: ['question'],
          },
        },
      },
      required: ['questions'],
    },
    danger: 'safe',
    source: 'builtin',
    alwaysRequiresApproval: false,
  },
  handler: async (args, ctx) => {
    const questions = normalizeQuestions(args.questions);
    if (questions.length === 0) return fail('Ingen fråga angavs.');

    const outcome = await ctx.requestApproval({
      kind: 'user_question',
      title: questions[0]?.header ?? 'Fråga',
      detail: questions[0]?.question ?? '',
      reason: 'Agenten behöver ditt svar för att gå vidare.',
      risk: 'low',
      hardBlock: true,
      questions,
    });

    if (!outcome.approved) {
      return ok('Användaren avbröt frågan utan att svara.', { unanswered: true });
    }

    const answers = outcome.answers ?? {};
    const lines = questions.map((question) => {
      const chosen = answers[question.id] ?? [];
      return `${question.question}\n→ ${chosen.length > 0 ? chosen.join(', ') : '(inget svar)'}`;
    });

    return ok(`Användaren svarade:\n${lines.join('\n\n')}`, { answers });
  },
};
