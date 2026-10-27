export * from './json-schema.js';
export * from './tools.js';
export * from './events.js';
export * from './ipc.js';

/** Protokollversion för agent-server <-> UI. Ökas vid brytande ändringar. */
export const VIBEFORGE_PROTOCOL_VERSION = 1 as const;

/** Namn på de fyra behörighetslägena, används av UI och dokumentation. */
export const PERMISSION_MODES = ['ask', 'auto-edit', 'auto-run', 'full-auto'] as const;

export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
export const DEFAULT_MODEL = 'deepseek-r1:8b';
export const AGENT_SERVER_PORT = 4319;
export const DEFAULT_CONTEXT_BUDGET_CHARS = 24_000;
export const DEFAULT_MAX_ITERATIONS = 12;
export const MAX_TOOL_OUTPUT_CHARS = 131_072;
export const TERMINAL_TIMEOUT_MS = 120_000;
export const DIFF_CONTEXT_LINES = 3;
export const EMBEDDING_DIMENSIONS = 256;
export const AD_INTERVAL_PROMPTS = 10;

/** Mappar och filer VibeForge läser respektive skriver i ett projekt. */
export const VIBEFORGE_DIR = '.vibeforge';
export const VIBEFORGE_SKILLS_DIR = '.vibeforge/skills';
export const VIBEFORGE_RULES_FILE = '.vibeforge/rules.md';
export const VIBEFORGE_PREFERENCES_FILE = '.vibeforge/preferences.json';
export const VIBEFORGE_MEMORY_FILE = '.vibeforge/memory.md';
export const AGENTS_FILE = 'AGENTS.md';
