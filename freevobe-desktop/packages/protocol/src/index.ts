export * from './json-schema.js';
export * from './tools.js';
export * from './events.js';

import type { ApprovalCategory } from './events.js';
export * from './ipc.js';
export * from './checkpoints.js';
export * from './plans.js';
export * from './verification.js';
export * from './gives-back.js';
export * from './connectors.js';

/** Protokollversion för agent-server <-> UI. Ökas vid brytande ändringar. */
export const FREEVOBE_PROTOCOL_VERSION = 1 as const;

/** Namn på de fyra behörighetslägena, används av UI och dokumentation. */
export const PERMISSION_MODES = ['ask', 'auto-edit', 'auto-run', 'full-auto'] as const;

/**
 * Kategorier som går att auto-godkänna. `browser` och `other` är medvetet utanför: de kräver
 * alltid ett personligt ja.
 */
export const AUTO_APPROVE_CATEGORIES = [
  'file_write',
  'command',
  'test',
  'git',
  'network',
  'mcp',
] as const satisfies readonly ApprovalCategory[];

/** Standard: inget auto-godkänns. Allt kräver ett ja tills användaren väljer annat. */
export const DEFAULT_AUTO_APPROVE: Record<ApprovalCategory, boolean> = {
  file_write: false,
  command: false,
  test: false,
  git: false,
  network: false,
  mcp: false,
  browser: false,
  other: false,
};

export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
export const DEFAULT_MODEL = 'deepseek-r1:8b';
export const AGENT_SERVER_PORT = 4319;
export const DEFAULT_CONTEXT_BUDGET_CHARS = 24_000;
export const DEFAULT_MAX_ITERATIONS = 12;
export const MAX_TOOL_OUTPUT_CHARS = 131_072;
export const TERMINAL_TIMEOUT_MS = 120_000;
export const DIFF_CONTEXT_LINES = 3;
export const EMBEDDING_DIMENSIONS = 256;

/** Mappar och filer Freevobe läser respektive skriver i ett projekt. */
export const FREEVOBE_DIR = '.freevobe';
export const FREEVOBE_SKILLS_DIR = '.freevobe/skills';
export const FREEVOBE_RULES_FILE = '.freevobe/rules.md';
export const FREEVOBE_PREFERENCES_FILE = '.freevobe/preferences.json';
export const FREEVOBE_MEMORY_FILE = '.freevobe/memory.md';
export const AGENTS_FILE = 'AGENTS.md';
