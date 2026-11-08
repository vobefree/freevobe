/**
 * Kommandon i Qoder-läget. Ett kommandofält ska räcka: `:w` sparar, `:q` stänger, `:run` startar
 * preview och `:test` kör testerna. Parsern är ren och testas separat.
 */

export type ColonAction =
  'save' | 'quit' | 'run' | 'test' | 'verify' | 'theme' | 'qoder' | 'sidechat';

const ACTIONS: Record<string, ColonAction> = {
  w: 'save',
  write: 'save',
  q: 'quit',
  quit: 'quit',
  run: 'run',
  preview: 'run',
  test: 'test',
  tests: 'test',
  verify: 'verify',
  theme: 'theme',
  qoder: 'qoder',
  side: 'sidechat',
  sidechat: 'sidechat',
};

export interface ParsedCommand {
  name: string;
  rest: string;
}

export function parseCommandInput(input: string): ParsedCommand | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith(':')) return null;
  const [head, ...rest] = trimmed.slice(1).split(/\s+/);
  if (!head) return null;
  return { name: head.toLowerCase(), rest: rest.join(' ') };
}

export function resolveColonAction(input: string): ColonAction | null {
  const parsed = parseCommandInput(input);
  return parsed ? (ACTIONS[parsed.name] ?? null) : null;
}

export const COLON_HINT = ':w  :q  :run  :test  :verify  :theme  :qoder  :side';
