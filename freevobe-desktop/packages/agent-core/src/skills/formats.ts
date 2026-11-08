import { normalizeSlashes } from '../util/text.js';
import { DEFAULT_IGNORED_DIRS } from '../util/walk.js';

/**
 * Varifrån en importerad skill kommer. `generic` används bara när användaren själv väljer att
 * importera en markdownfil som inte matchar något känt format.
 */
export type SkillFormatSource =
  | 'claude'
  | 'cursor'
  | 'agents_md'
  | 'copilot'
  | 'codex'
  | 'opencode'
  | 'windsurf'
  | 'cline'
  | 'generic';

/** `skill` = en enskild skill, `document` = ett helt regeldokument (AGENTS.md, Copilot). */
export type SkillFileKind = 'skill' | 'document';

export interface DetectedSkillFile {
  /** Projektrelativ sökväg, alltid med `/` som avgränsare. */
  path: string;
  source: SkillFormatSource;
  kind: SkillFileKind;
  /** Förslag på namn, taget ur mappen (skills) eller filnamnet (dokument). */
  nameHint: string;
}

export interface FormatDetectionResult {
  files: DetectedSkillFile[];
  /** Antal filer per källa, i fast ordning och bara för källor som hittades. */
  bySource: { source: SkillFormatSource; count: number }[];
  /** Markdown utan känt format – underlag för "Importera som generisk skill". */
  unknownMarkdown: string[];
  /** Filer som hoppades över, t.ex. i `node_modules`. */
  ignored: number;
}

interface DetectionRule {
  source: SkillFormatSource;
  kind: SkillFileKind;
  matches: (lowerPath: string) => boolean;
}

const SOURCE_ORDER: SkillFormatSource[] = [
  'claude',
  'cursor',
  'agents_md',
  'copilot',
  'codex',
  'opencode',
  'windsurf',
  'cline',
  'generic',
];

/** En fil är en Claude-skill om den ligger i `.claude/skills/` eller rotens `skills/`. */
function isClaudeSkill(lowerPath: string): boolean {
  if (!lowerPath.endsWith('/skill.md')) return false;
  return lowerPath.includes('.claude/skills/') || lowerPath.startsWith('skills/');
}

function isCursorRule(lowerPath: string): boolean {
  return lowerPath.endsWith('.mdc') && lowerPath.includes('.cursor/rules/');
}

function isAgentsDocument(lowerPath: string): boolean {
  if (lowerPath !== 'agents.md' && !lowerPath.endsWith('/agents.md')) return false;
  // Specen säger reporoten eller `.github/` – djupare varianter fångas som generisk markdown.
  return lowerPath === 'agents.md' || lowerPath.startsWith('.github/');
}

/**
 * Ordningen spelar roll: första träffen vinner. Claude och Cursor ligger före de bredare
 * katalogreglerna, så en `.mdc` i `.cursor/rules/` aldrig tolkas som något annat.
 */
const RULES: DetectionRule[] = [
  { source: 'claude', kind: 'skill', matches: isClaudeSkill },
  { source: 'cursor', kind: 'skill', matches: isCursorRule },
  { source: 'agents_md', kind: 'document', matches: isAgentsDocument },
  {
    source: 'copilot',
    kind: 'document',
    matches: (path) => path === '.github/copilot-instructions.md',
  },
  {
    source: 'codex',
    kind: 'skill',
    matches: (path) => path.startsWith('.codex/') && path.endsWith('.md'),
  },
  {
    source: 'opencode',
    kind: 'skill',
    matches: (path) => path.startsWith('.opencode/') && path.endsWith('.md'),
  },
  {
    source: 'windsurf',
    kind: 'skill',
    matches: (path) => path.startsWith('.windsurf/rules/') && path.endsWith('.md'),
  },
  {
    source: 'cline',
    kind: 'skill',
    matches: (path) =>
      (path.startsWith('.clinerules/') && path.endsWith('.md')) || path === '.clinerules',
  },
];

function normalizePath(rawPath: string): string {
  const slashed = normalizeSlashes(rawPath).replace(/^\.\//, '').replace(/^\/+/, '');
  return slashed.replace(/\/{2,}/g, '/');
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function basename(value: string): string {
  return value.slice(value.lastIndexOf('/') + 1);
}

function parentName(value: string): string {
  const withoutFile = value.slice(0, value.lastIndexOf('/'));
  return basename(withoutFile);
}

function nameHintFor(path: string, kind: SkillFileKind): string {
  const file = basename(path).toLowerCase();
  // Claude döper skillen med mappen (SKILL.md), Cursor med filen (react.mdc).
  const fromDirectory = kind === 'skill' && file === 'skill.md';
  const raw = fromDirectory ? parentName(path) : basename(path).replace(/\.(md|mdc)$/, '');
  return slugify(raw) || 'skill';
}

function isIgnored(path: string): boolean {
  const segments = path.toLowerCase().split('/');
  return segments.some((segment) => DEFAULT_IGNORED_DIRS.includes(segment));
}

function isMarkdown(path: string): boolean {
  return path.endsWith('.md') || path.endsWith('.mdc');
}

export interface DetectionInput {
  path: string;
}

/**
 * Klassificerar en enskild sökväg. Returnerar `null` när filen inte hör till något känt format.
 * Ren funktion utan filsystemsanrop, så att både en git-scan och ett uppladdat arkiv kan använda
 * samma logik.
 */
export function detectSkillFile(rawPath: string): DetectedSkillFile | null {
  const path = normalizePath(rawPath);
  const lower = path.toLowerCase();
  for (const rule of RULES) {
    if (!rule.matches(lower)) continue;
    return { path, source: rule.source, kind: rule.kind, nameHint: nameHintFor(path, rule.kind) };
  }
  return null;
}

/**
 * Detekterar format i en lista av sökvägar. `bySource` grupperar träffarna per källa så att
 * importvyn kan visa "12 skills från 3 källor" utan att räkna själv.
 */
export function detectSkillFormats(files: DetectionInput[]): FormatDetectionResult {
  const detected: DetectedSkillFile[] = [];
  const unknownMarkdown: string[] = [];
  const seen = new Set<string>();
  let ignored = 0;

  for (const file of files) {
    const path = normalizePath(file.path);
    if (!path || seen.has(path)) continue;
    seen.add(path);
    if (isIgnored(path)) {
      ignored += 1;
      continue;
    }

    const match = detectSkillFile(path);
    if (match) {
      detected.push(match);
      continue;
    }
    if (isMarkdown(path.toLowerCase())) unknownMarkdown.push(path);
  }

  detected.sort((a, b) => {
    const bySource = SOURCE_ORDER.indexOf(a.source) - SOURCE_ORDER.indexOf(b.source);
    return bySource !== 0 ? bySource : a.path.localeCompare(b.path);
  });
  unknownMarkdown.sort((a, b) => a.localeCompare(b));

  const counts = new Map<SkillFormatSource, number>();
  for (const file of detected) counts.set(file.source, (counts.get(file.source) ?? 0) + 1);
  const bySource = SOURCE_ORDER.filter((source) => counts.has(source)).map((source) => ({
    source,
    count: counts.get(source) ?? 0,
  }));

  return { files: detected, bySource, unknownMarkdown, ignored };
}

/** Summan av alla träffar, för "Found 12 skills from 3 sources". */
export function countDetected(detection: FormatDetectionResult): {
  skills: number;
  sources: number;
} {
  return { skills: detection.files.length, sources: detection.bySource.length };
}
