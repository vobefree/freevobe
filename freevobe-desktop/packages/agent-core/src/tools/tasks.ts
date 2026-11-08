import type { SubagentKind, TaskItem } from '@freevobe/protocol';
import { fail, ok, type RegisteredTool } from './types.js';

/**
 * Verktyg som gör att modellen kan hålla en uppgiftslista och delegera delar av arbetet – samma
 * två förmågor som gör en harness användbar över längre uppdrag.
 *
 * Båda kräver att körningen injicerar en implementation i `ToolContext`. Saknas den blir svaret
 * ett tydligt fel i stället för en tyst no-op.
 */

const TASK_STATUSES = ['todo', 'doing', 'blocked', 'done'] as const;

const SUBAGENT_KINDS: SubagentKind[] = [
  'explorer',
  'implementer',
  'tester',
  'reviewer',
  'documenter',
];

interface TaskInput {
  title: string;
  status: TaskItem['status'];
}

function parseTaskItems(args: Record<string, unknown>): TaskInput[] | string {
  const raw = args.items;
  if (!Array.isArray(raw)) return 'Fältet "items" måste vara en lista med uppgifter.';

  const items: TaskInput[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const title = (entry as { title?: unknown }).title;
    if (typeof title !== 'string' || title.trim() === '') continue;
    const status = (entry as { status?: unknown }).status;
    items.push({
      title: title.trim().slice(0, 200),
      status:
        typeof status === 'string' && (TASK_STATUSES as readonly string[]).includes(status)
          ? (status as TaskItem['status'])
          : 'todo',
    });
  }

  if (items.length === 0) return 'Listan är tom – ange minst en uppgift med en titel.';
  return items;
}

/** Ersätter hela uppgiftslistan. Modellen skickar den lista den vill ha, inte delta. */
export const todoWriteTool: RegisteredTool = {
  spec: {
    name: 'todo_write',
    description:
      'Sätter eller uppdaterar uppgiftslistan för samtalet. Skicka hela listan varje gång, med status todo, doing, blocked eller done. Använd den för att hålla ordning i uppdrag med flera steg, och uppdatera den när ett steg är klart.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'Hela uppgiftslistan, i den ordning den ska göras.',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Vad uppgiften innebär.' },
              status: { type: 'string', enum: [...TASK_STATUSES] },
            },
            required: ['title'],
          },
        },
      },
      required: ['items'],
    },
    danger: 'safe',
    source: 'builtin',
  },
  handler: async (args, ctx) => {
    if (!ctx.tasks) {
      return fail('Uppgiftslistan är inte tillgänglig i den här körningen.');
    }
    const parsed = parseTaskItems(args);
    if (typeof parsed === 'string') return fail(parsed);

    const list = ctx.tasks.replace(parsed);
    const summary = list
      .map(
        (task) =>
          `${task.status === 'done' ? '✓' : task.status === 'doing' ? '→' : '·'} ${task.title}`,
      )
      .join('\n');
    return ok(`Uppgiftslistan har ${list.length} punkter:\n${summary}`, {
      tasks: list.map((task) => ({ id: task.id, title: task.title, status: task.status })),
    });
  },
};

/** Kör en subagent med egen kontext. Resultatet är en sammanfattning, inte hela samtalet. */
export const runSubagentTool: RegisteredTool = {
  spec: {
    name: 'run_subagent',
    description:
      'Delegerar en avgränsad uppgift till en subagent med egen kontext: explorer (läsa och hitta), implementer (skriva kod), tester (köra och tolka tester), reviewer (granska) eller documenter (skriva dokumentation). Subagenten ser inte samtalet och returnerar en sammanfattning. Använd den för att hålla huvudkontexten ren i större uppdrag.',
    parameters: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: SUBAGENT_KINDS, description: 'Vilken sorts subagent.' },
        task: { type: 'string', description: 'Uppgiften, avgränsad och med tydligt mål.' },
      },
      required: ['kind', 'task'],
    },
    danger: 'execute',
    source: 'builtin',
  },
  handler: async (args, ctx) => {
    if (!ctx.runSubagent) {
      return fail('Subagenter är inte tillgängliga i den här körningen.');
    }
    const kind = args.kind;
    if (typeof kind !== 'string' || !SUBAGENT_KINDS.includes(kind as SubagentKind)) {
      return fail(`Okänd subagent: ${String(kind)}.`);
    }
    const task = args.task;
    if (typeof task !== 'string' || task.trim() === '') {
      return fail('Fältet "task" saknas.');
    }

    try {
      const result = await ctx.runSubagent(kind as SubagentKind, task.trim());
      return ok(`Subagenten ${kind} är ${result.status}.\n\n${result.summary}`, {
        subagent: { kind, status: result.status },
      });
    } catch (error) {
      return fail(
        `Subagenten misslyckades: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },
};

export const taskTools: RegisteredTool[] = [todoWriteTool, runSubagentTool];
