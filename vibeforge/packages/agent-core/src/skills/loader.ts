import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SkillSummary } from '@vibeforge/protocol';
import { truncate } from '../util/text.js';
import { pathExists } from '../util/walk.js';

export interface Skill extends SkillSummary {
  body: string;
}

/**
 * Var de inbyggda skillsen ligger. I källkoden ligger de bredvid paketet. I den paketerade appen
 * är agenten en SEA-binär, som inte kan bära med sig markdown-filerna – där pekar skalet ut dem
 * med VIBEFORGE_BUILTIN_SKILLS mot appens resurskatalog i stället.
 *
 * `import.meta.url` finns inte i den bundlade CommonJS-koden, så sökvägen måste kunna misslyckas
 * utan att modulen kraschar vid inläsning; hellre en tom skillslista än en agent som inte startar.
 */
function resolveBuiltinDir(): string {
  const override = process.env.VIBEFORGE_BUILTIN_SKILLS?.trim();
  if (override) return path.resolve(override);
  try {
    return fileURLToPath(new URL('../../builtin-skills', import.meta.url));
  } catch {
    return path.resolve(process.cwd(), 'builtin-skills');
  }
}

const BUILTIN_DIR = resolveBuiltinDir();

/**
 * Tolkar en skill-fil: YAML-frontmatter mellan `---` och markdown-texten efter.
 * Vi stödjer den lilla delmängd vi själva dokumenterar (strängar och listor), utan YAML-beroende.
 */
export function parseSkill(
  content: string,
  origin: { source: Skill['source']; path?: string },
): Skill | null {
  const normalized = content.replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return null;

  const frontmatter = match[1] ?? '';
  const body = (match[2] ?? '').trim();
  const fields = parseFrontmatter(frontmatter);

  const name = typeof fields.name === 'string' ? fields.name.trim() : '';
  const description = typeof fields.description === 'string' ? fields.description.trim() : '';
  if (!name || !description) return null;

  const tools = toStringArray(fields.tools);
  const triggers = toStringArray(fields.triggers);

  const skill: Skill = {
    name,
    description,
    tools,
    triggers,
    source: origin.source,
    body,
    chars: description.length + body.length,
  };
  if (origin.path) skill.path = origin.path;
  return skill;
}

function parseFrontmatter(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = text.split('\n');
  let currentKey: string | null = null;
  let currentList: string[] | null = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, '');
    if (line.trim() === '' || line.trim().startsWith('#')) continue;

    const listItem = line.match(/^\s*-\s*(.+)$/);
    if (listItem && currentKey && currentList) {
      currentList.push(stripQuotes((listItem[1] ?? '').trim()));
      continue;
    }

    const keyValue = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!keyValue) continue;
    const key = keyValue[1] as string;
    const value = (keyValue[2] ?? '').trim();

    if (value === '') {
      currentKey = key;
      currentList = [];
      result[key] = currentList;
      continue;
    }

    currentKey = null;
    currentList = null;
    if (value.startsWith('[') && value.endsWith(']')) {
      result[key] = value
        .slice(1, -1)
        .split(',')
        .map((entry) => stripQuotes(entry.trim()))
        .filter(Boolean);
    } else {
      result[key] = stripQuotes(value);
    }
  }

  return result;
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((entry) => String(entry).trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim() !== '') return [value.trim()];
  return [];
}

/** Läser inbyggda skills som följer med Freevobe. */
export async function loadBuiltinSkills(): Promise<Skill[]> {
  return loadSkillsFromDirectory(BUILTIN_DIR, 'builtin');
}

/** Läser projektets egna skills från `.vibeforge/skills`. */
export async function loadProjectSkills(skillsDir: string): Promise<Skill[]> {
  return loadSkillsFromDirectory(skillsDir, 'project');
}

export async function loadSkillsFromDirectory(
  directory: string,
  source: Skill['source'],
): Promise<Skill[]> {
  if (!(await pathExists(directory))) return [];
  let entries: string[];
  try {
    entries = await fs.readdir(directory);
  } catch {
    return [];
  }

  const skills: Skill[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue;
    const absolute = path.join(directory, entry);
    try {
      const content = await fs.readFile(absolute, 'utf8');
      const skill = parseSkill(content, { source, path: absolute });
      if (skill) skills.push(skill);
    } catch {
      // En trasig skillfil får inte stoppa resten.
    }
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

export interface SkillActivation {
  skill: Skill;
  reason: 'explicit' | 'trigger';
  trigger?: string;
}

/** Slår ihop inbyggda och projektets skills. Projektets vinner vid namnkonflikt. */
export function mergeSkills(builtin: Skill[], project: Skill[]): Skill[] {
  const byName = new Map<string, Skill>();
  for (const skill of builtin) byName.set(skill.name, skill);
  for (const skill of project) byName.set(skill.name, skill);
  return [...byName.values()];
}

/**
 * Aktiverar skills som matchar prompten. `@namn` tvingar fram en skill, annars matchas
 * triggers mot hela ord i prompten.
 */
export function activateSkills(skills: Skill[], prompt: string): SkillActivation[] {
  const activations: SkillActivation[] = [];
  const lower = prompt.toLowerCase();
  // Bindestreck räknas som avgränsare så att "react-komponent" matchar både "react" och "komponent".
  const words = new Set(lower.split(/[^a-z0-9åäö+#]+/i).filter(Boolean));

  for (const skill of skills) {
    const mention = new RegExp(`@${escapeRegExp(skill.name)}\\b`, 'i');
    if (mention.test(prompt)) {
      activations.push({ skill, reason: 'explicit' });
      continue;
    }
    const trigger = skill.triggers.find((candidate) => {
      const needle = candidate.toLowerCase().trim();
      if (needle === '') return false;
      if (/[\s-]/.test(needle)) return lower.includes(needle);
      return words.has(needle);
    });
    if (trigger) activations.push({ skill, reason: 'trigger', trigger });
  }

  return activations;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Formaterar aktiva skills som en del av systemprompten. */
export function formatSkillsForPrompt(activations: SkillActivation[], maxChars = 16_000): string {
  if (activations.length === 0) return '';
  const blocks = activations.map(({ skill, reason, trigger }) => {
    const header = `### Skill: ${skill.name}${reason === 'trigger' && trigger ? ` (aktiverad av "${trigger}")` : ' (anropad av användaren)'}`;
    const tools = skill.tools.length > 0 ? `\nFöreslagna verktyg: ${skill.tools.join(', ')}` : '';
    return `${header}\n${skill.description}${tools}\n\n${skill.body}`;
  });
  return truncate(blocks.join('\n\n'), maxChars).text;
}
