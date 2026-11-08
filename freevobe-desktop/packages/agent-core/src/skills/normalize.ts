import type { SkillFormatSource } from '@freevobe/protocol';
import { parseFrontmatter } from './loader.js';

/** Max antal triggers vi behåller från ett importerat dokument. */
const MAX_TRIGGERS = 8;
const MAX_DESCRIPTION = 220;

export interface NormalizeInput {
  /** Projektrelativ sökväg, som den kom från detektorn. */
  path: string;
  source: SkillFormatSource;
  kind: 'skill' | 'document';
  /** Namnförslag från detektorn (mappnamn eller filnamn). */
  nameHint: string;
  content: string;
  /** T.ex. `owner/repo` när skillen kommer från GitHub. */
  repo?: string;
}

export interface NormalizedSkill {
  name: string;
  description: string;
  tools: string[];
  triggers: string[];
  globs: string[];
  alwaysApply: boolean;
  source: SkillFormatSource;
  sourcePath: string;
  sourceRepo?: string;
  body: string;
  chars: number;
  /** Saker användaren bör se i förhandsgranskningen, t.ex. att beskrivningen gissades. */
  warnings: string[];
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((entry) => String(entry).trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim() !== '') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function asBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return /^(true|yes|1)$/i.test(value.trim());
  return false;
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function splitDocument(content: string): { frontmatter: Record<string, unknown>; body: string } {
  const normalized = content.replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: normalized.trim() };
  return {
    frontmatter: parseFrontmatter(match[1] ?? ''),
    body: (match[2] ?? '').trim(),
  };
}

/** Första meningsfulla stycket, som reservbeskrivning när frontmatter saknar description. */
function firstParagraph(body: string): string {
  const lines = body.split('\n');
  const collected: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '') {
      if (collected.length > 0) break;
      continue;
    }
    if (trimmed.startsWith('#')) {
      if (collected.length > 0) break;
      continue;
    }
    if (trimmed.startsWith('```')) break;
    collected.push(trimmed);
  }
  const text = collected.join(' ').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > MAX_DESCRIPTION ? `${text.slice(0, MAX_DESCRIPTION - 1).trimEnd()}…` : text;
}

/** Första rubriken i ett dokument, används som beskrivning för AGENTS.md och Copilot. */
function firstHeading(body: string): string {
  const heading = body.match(/^#{1,6}\s+(.+)$/m);
  return heading?.[1]?.trim() ?? '';
}

function deriveTriggers(value: string): string[] {
  const parts = value
    .split(/[,;\n]/)
    .map((entry) => entry.trim().toLowerCase().replace(/\.$/, ''))
    .filter((entry) => entry.length >= 3 && entry.length <= 60);
  return [...new Set(parts)].slice(0, MAX_TRIGGERS);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function ensureName(raw: string, fallback: string): string {
  return raw.trim() || fallback;
}

function finish(
  input: NormalizeInput,
  parts: Omit<NormalizedSkill, 'source' | 'sourcePath' | 'sourceRepo' | 'chars'>,
): NormalizedSkill {
  const skill: NormalizedSkill = {
    ...parts,
    source: input.source,
    sourcePath: input.path,
    chars: parts.description.length + parts.body.length,
    warnings: parts.warnings,
  };
  if (input.repo) skill.sourceRepo = input.repo;
  return skill;
}

/**
 * Gör om en detekterad fil till en Freevobe-skill. Ren funktion: ingen disk, inget nät.
 *
 * Formaten skiljer sig åt på tre punkter som spelar roll: Claude har `when_to_use` i stället för
 * triggers, Cursor styr aktivering med `globs`/`alwaysApply`, och AGENTS.md/Copilot är
 * regeldokument som alltid gäller. Allt annat blir en generisk markdown-skill.
 */
export function normalizeSkill(input: NormalizeInput): NormalizedSkill {
  const { frontmatter, body } = splitDocument(input.content);
  const warnings: string[] = [];
  const tools = asStringArray(frontmatter.tools);
  const globs = asStringArray(frontmatter.globs);
  const declaredTriggers = asStringArray(frontmatter.triggers);
  const documentedDescription = asText(frontmatter.description);

  if (body.trim() === '') warnings.push('Filen har ingen brödtext – bara frontmatter.');

  // Regeldokument: hela dokumentet blir en skill som alltid är aktiv.
  if (input.kind === 'document' || input.source === 'agents_md' || input.source === 'copilot') {
    const fallbackName = input.source === 'copilot' ? 'copilot-instructions' : 'project-rules';
    const heading = firstHeading(body);
    const description =
      documentedDescription ||
      heading ||
      firstParagraph(body) ||
      `Projektregler importerade från ${input.path}.`;
    if (!documentedDescription && heading) {
      warnings.push('Beskrivningen togs från dokumentets första rubrik.');
    }
    return finish(input, {
      name: ensureName(asText(frontmatter.name), fallbackName),
      description,
      tools,
      triggers: declaredTriggers.slice(0, MAX_TRIGGERS),
      globs,
      alwaysApply: true,
      body,
      warnings,
    });
  }

  // Cursor: aktiveringen styrs av globs/alwaysApply, inte av triggers.
  if (input.source === 'cursor') {
    const alwaysApply = asBoolean(frontmatter.alwaysApply);
    const description =
      documentedDescription ||
      firstParagraph(body) ||
      `Cursor-regel importerad från ${input.path}.`;
    if (!documentedDescription) warnings.push('Beskrivningen togs från regelns första stycke.');
    if (!alwaysApply && globs.length === 0) {
      warnings.push('Regeln aktiveras varken av alwaysApply eller globs – den blir manuell.');
    }
    return finish(input, {
      name: ensureName(asText(frontmatter.name), input.nameHint),
      description,
      tools,
      triggers: declaredTriggers.slice(0, MAX_TRIGGERS),
      globs,
      alwaysApply,
      body,
      warnings,
    });
  }

  // Claude och generisk markdown: name/description plus triggers, gärna från when_to_use.
  const whenToUse = asText(frontmatter.when_to_use) || asText(frontmatter.whenToUse);
  const description =
    documentedDescription ||
    whenToUse ||
    firstParagraph(body) ||
    `Skill importerad från ${input.path}.`;
  if (!documentedDescription) {
    warnings.push(
      whenToUse
        ? 'Beskrivningen togs från when_to_use.'
        : 'Beskrivningen togs från filens första stycke.',
    );
  }

  let triggers = declaredTriggers.slice(0, MAX_TRIGGERS);
  if (triggers.length === 0 && whenToUse) triggers = deriveTriggers(whenToUse);
  if (triggers.length === 0) {
    const name = ensureName(asText(frontmatter.name), input.nameHint);
    const slug = slugify(name);
    if (slug) triggers = [slug];
  }

  const alwaysApply = asBoolean(frontmatter.alwaysApply);
  return finish(input, {
    name: ensureName(asText(frontmatter.name), input.nameHint),
    description,
    tools,
    triggers,
    globs,
    alwaysApply,
    body,
    warnings,
  });
}

/** YAML-skalär som tål kolon, apostrofer och citattecken utan att tolkas fel. */
export function yamlScalar(value: string): string {
  const needsQuotes =
    value === '' ||
    /[:#?*[\]{}&!|>'"%@`,]/.test(value) ||
    /^\s|\s$/.test(value) ||
    /^(true|false|null|yes|no|on|off|~)$/i.test(value) ||
    /^[\d-]/.test(value);
  return needsQuotes ? `'${value.replace(/'/g, "''")}'` : value;
}

function list(key: string, values: string[]): string[] {
  if (values.length === 0) return [`${key}: []`];
  return [`${key}:`, ...values.map((value) => `  - ${yamlScalar(value)}`)];
}

/**
 * Renderar den normaliserade skillen som markdown med frontmatter, i samma form som
 * `SkillStore` läser. Fälten `source`, `source_path` och `source_repo` gör att en ny import kan
 * upptäcka att skillen redan finns och erbjuda uppdatering i stället för en dubblett.
 */
export function renderNormalizedSkill(skill: NormalizedSkill): string {
  const lines = [
    '---',
    `name: ${yamlScalar(skill.name)}`,
    `description: ${yamlScalar(skill.description)}`,
    ...list('tools', skill.tools),
    ...list('triggers', skill.triggers),
    ...(skill.globs.length > 0 ? list('globs', skill.globs) : []),
    ...(skill.alwaysApply ? ['alwaysApply: true'] : []),
    `source: ${skill.source}`,
    `source_path: ${yamlScalar(skill.sourcePath)}`,
    ...(skill.sourceRepo ? [`source_repo: ${yamlScalar(skill.sourceRepo)}`] : []),
    '---',
    '',
  ];
  const body = skill.body.trim();
  lines.push(body === '' ? `# ${skill.name}\n` : `${body}\n`);
  return lines.join('\n');
}

/** Filnamn för den sparade skillen. */
export function normalizedFileName(skill: NormalizedSkill): string {
  return `${slugify(skill.name) || 'skill'}.md`;
}
