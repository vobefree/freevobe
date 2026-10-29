import fs from 'node:fs/promises';
import path from 'node:path';
import type { HookConfig, McpServerConfig, PermissionMode } from '@freevobe/protocol';
import {
  AGENTS_FILE,
  FREEVOBE_DIR,
  FREEVOBE_MEMORY_FILE,
  FREEVOBE_PREFERENCES_FILE,
  FREEVOBE_RULES_FILE,
  FREEVOBE_SKILLS_DIR,
} from '@freevobe/protocol';
import { pathExists } from '../util/walk.js';

export interface ProjectPreferences {
  permissionMode?: PermissionMode;
  model?: string;
  testCommand?: string;
  contextBudgetChars?: number;
  maxIterations?: number;
  browserAutomationEnabled?: boolean;
  hooks?: HookConfig[];
  mcpServers?: McpServerConfig[];
  [key: string]: unknown;
}

export interface RuleBundle {
  root: string;
  agentsFile: string;
  rulesFile: string;
  memory: string;
  preferences: ProjectPreferences;
  hooks: HookConfig[];
  mcpServers: McpServerConfig[];
  skillsDir: string;
  /** Kort sammanfattning av vad som lästes, för UI:t. */
  sources: string[];
}

const RULES_TEMPLATE = `# Projektregler för {{name}}

Här skriver du vad agenten alltid ska följa i det här projektet. Reglerna läggs in i
systemprompten vid varje körning.

## Kodstil
- Beskriv projektets stil (t.ex. "använd named exports", "inga default exports").

## Arbetsflöde
- Vilka kommandon ska köras före commit?
- Vilka filer får aldrig ändras automatiskt?

## Testning
- Vilket kommando kör testerna?
- Ska nya funktioner alltid ha ett test?
`;

const PREFERENCES_TEMPLATE: ProjectPreferences = {
  permissionMode: 'ask',
  model: '',
  testCommand: '',
  contextBudgetChars: 24_000,
  maxIterations: 12,
  browserAutomationEnabled: false,
  hooks: [],
  mcpServers: [],
};

async function readIfExists(target: string): Promise<string> {
  try {
    return await fs.readFile(target, 'utf8');
  } catch {
    return '';
  }
}

function isPermissionMode(value: unknown): value is PermissionMode {
  return value === 'ask' || value === 'auto-edit' || value === 'auto-run' || value === 'full-auto';
}

/** Läser projektets regler, preferenser, minne, hooks och MCP-konfiguration. Saknade filer är ok. */
export async function loadProjectRules(root: string): Promise<RuleBundle> {
  const absoluteRoot = path.resolve(root);
  const freevobeDir = path.join(absoluteRoot, FREEVOBE_DIR);
  const sources: string[] = [];

  const agentsFile = await readIfExists(path.join(absoluteRoot, AGENTS_FILE));
  if (agentsFile) sources.push(AGENTS_FILE);

  const rulesFile = await readIfExists(path.join(absoluteRoot, FREEVOBE_RULES_FILE));
  if (rulesFile) sources.push(FREEVOBE_RULES_FILE);

  const memory = await readIfExists(path.join(absoluteRoot, FREEVOBE_MEMORY_FILE));
  if (memory) sources.push(FREEVOBE_MEMORY_FILE);

  const rawPreferences = await readIfExists(path.join(absoluteRoot, FREEVOBE_PREFERENCES_FILE));
  let preferences: ProjectPreferences = {};
  if (rawPreferences) {
    sources.push(FREEVOBE_PREFERENCES_FILE);
    try {
      const parsed: unknown = JSON.parse(rawPreferences);
      if (typeof parsed === 'object' && parsed !== null) preferences = parsed as ProjectPreferences;
    } catch {
      sources.push(`${FREEVOBE_PREFERENCES_FILE} (ogiltig JSON – ignorerad)`);
    }
  }

  const rawHooks = await readIfExists(path.join(freevobeDir, 'hooks.json'));
  let hooks: HookConfig[] = Array.isArray(preferences.hooks) ? preferences.hooks : [];
  if (rawHooks) {
    sources.push(`${FREEVOBE_DIR}/hooks.json`);
    try {
      const parsed: unknown = JSON.parse(rawHooks);
      if (Array.isArray(parsed)) hooks = parsed as HookConfig[];
    } catch {
      sources.push(`${FREEVOBE_DIR}/hooks.json (ogiltig JSON – ignorerad)`);
    }
  }

  const rawMcp = await readIfExists(path.join(freevobeDir, 'mcp.json'));
  let mcpServers: McpServerConfig[] = Array.isArray(preferences.mcpServers)
    ? preferences.mcpServers
    : [];
  if (rawMcp) {
    sources.push(`${FREEVOBE_DIR}/mcp.json`);
    try {
      const parsed: unknown = JSON.parse(rawMcp);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        Array.isArray((parsed as { mcpServers?: unknown }).mcpServers)
      ) {
        mcpServers = (parsed as { mcpServers: McpServerConfig[] }).mcpServers;
      } else if (Array.isArray(parsed)) {
        mcpServers = parsed as McpServerConfig[];
      }
    } catch {
      sources.push(`${FREEVOBE_DIR}/mcp.json (ogiltig JSON – ignorerad)`);
    }
  }

  if (preferences.permissionMode && !isPermissionMode(preferences.permissionMode)) {
    delete preferences.permissionMode;
  }

  return {
    root: absoluteRoot,
    agentsFile,
    rulesFile,
    memory,
    preferences,
    hooks,
    mcpServers,
    skillsDir: path.join(absoluteRoot, FREEVOBE_SKILLS_DIR),
    sources,
  };
}

/** Skapar .freevobe-stommen om den saknas, så att användaren har något att redigera. */
export async function ensureProjectScaffold(root: string, projectName?: string): Promise<string[]> {
  const absoluteRoot = path.resolve(root);
  const created: string[] = [];

  await fs.mkdir(path.join(absoluteRoot, FREEVOBE_SKILLS_DIR), { recursive: true });

  const files: Array<{ relative: string; content: string }> = [
    {
      relative: FREEVOBE_RULES_FILE,
      content: RULES_TEMPLATE.replace('{{name}}', projectName ?? path.basename(absoluteRoot)),
    },
    {
      relative: FREEVOBE_PREFERENCES_FILE,
      content: `${JSON.stringify(PREFERENCES_TEMPLATE, null, 2)}\n`,
    },
    {
      relative: FREEVOBE_MEMORY_FILE,
      content: `# Projektminne – ${projectName ?? path.basename(absoluteRoot)}\n\n<!-- Freevobe fyller på här. Filen är lokal och kan versionshanteras. -->\n`,
    },
    { relative: path.join(FREEVOBE_DIR, 'hooks.json'), content: '[]\n' },
  ];

  for (const file of files) {
    const absolute = path.join(absoluteRoot, file.relative);
    if (!(await pathExists(absolute))) {
      await fs.writeFile(absolute, file.content, 'utf8');
      created.push(file.relative);
    }
  }

  return created;
}
