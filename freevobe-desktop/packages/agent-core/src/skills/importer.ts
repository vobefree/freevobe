import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type {
  SkillImportApplyItem,
  SkillImportApplyResult,
  SkillImportItem,
  SkillImportScan,
  SkillSummary,
} from '@freevobe/protocol';
import { detectSkillFormats } from './formats.js';
import { normalizeSkill, renderNormalizedSkill } from './normalize.js';
import { parseFrontmatter } from './loader.js';
import { scanSkillSecurity } from './security.js';
import type { SkillStore } from './store.js';
import { isDirectory, walkFiles } from '../util/walk.js';

const execFileAsync = promisify(execFile);
/** En skillfil är alltid liten; större filer är något annat och hoppas över. */
const MAX_FILE_BYTES = 512 * 1024;
const MAX_SCAN_FILES = 20_000;
const CLONE_TIMEOUT_MS = 120_000;

export interface ScanDirectoryOptions {
  /** Katalogen som ska skannas. */
  root: string;
  /** Etikett som visas i gränssnittet. Standard är den absoluta sökvägen. */
  label?: string;
  /** Befintliga skills, för att kunna flagga konflikter. */
  existing?: SkillSummary[];
  /** `owner/repo` när källan är ett GitHub-repo. */
  sourceRepo?: string;
}

export interface ScanTargetOptions {
  /** Mapp eller GitHub-adress. Tom = skanna projektet självt. */
  target?: string;
  /** Projektroten som relativa sökvägar utgår från. */
  cwd: string;
  existing?: SkillSummary[];
}

function isMarkdown(relative: string): boolean {
  const lower = relative.toLowerCase();
  return lower.endsWith('.md') || lower.endsWith('.mdc');
}

/**
 * GitHub-adresser och `owner/repo` blir en klonad URL. Vanliga mappsökvägar lämnas ifred –
 * en lokal mapp vinner alltid över en tolkning som repo-namn.
 */
function cloneUrlFor(target: string): string | null {
  if (/^https?:\/\//i.test(target) || /^git@[^:]+:/i.test(target)) return target;
  const shorthand = target.match(/^([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
  if (!shorthand) return null;
  const owner = shorthand[1] as string;
  const repo = shorthand[2] as string;
  if (owner.startsWith('.')) return null;
  return `https://github.com/${owner}/${repo}.git`;
}

/**
 * Skannar en katalog: hittar kända format, normaliserar dem och märker konflikter.
 * Läser bara markdownfiler och rör aldrig projektets egna skills.
 */
export async function scanSkillDirectory(options: ScanDirectoryOptions): Promise<SkillImportScan> {
  const root = path.resolve(options.root);
  const existing = new Map((options.existing ?? []).map((skill) => [skill.name, skill]));
  const files: { path: string; content: string }[] = [];
  let unreadable = 0;

  for await (const entry of walkFiles({ root, maxFiles: MAX_SCAN_FILES })) {
    if (!isMarkdown(entry.relative) || entry.size > MAX_FILE_BYTES) continue;
    try {
      files.push({ path: entry.relative, content: await fs.readFile(entry.absolute, 'utf8') });
    } catch {
      unreadable += 1;
    }
  }

  const detection = detectSkillFormats(files.map((file) => ({ path: file.path })));
  const contents = new Map(files.map((file) => [file.path, file.content]));

  const items: SkillImportItem[] = detection.files.map((file) => {
    const skill = normalizeSkill({
      path: file.path,
      source: file.source,
      kind: file.kind,
      nameHint: file.nameHint,
      content: contents.get(file.path) ?? '',
      ...(options.sourceRepo ? { repo: options.sourceRepo } : {}),
    });
    const raw = contents.get(file.path) ?? '';
    const frontmatter = parseFrontmatter(raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '');
    const markdown = renderNormalizedSkill(skill);
    // Skannern körs på exakt den text som skulle sparas, inte på råfilen.
    const security = scanSkillSecurity(markdown);
    const author = typeof frontmatter.author === 'string' ? frontmatter.author.trim() : '';
    const owner = options.sourceRepo?.split('/')[0] ?? '';
    const conflict = existing.get(skill.name);
    const item: SkillImportItem = {
      path: file.path,
      source: file.source,
      kind: file.kind,
      name: skill.name,
      description: skill.description,
      tools: skill.tools,
      triggers: skill.triggers,
      globs: skill.globs,
      alwaysApply: skill.alwaysApply,
      body: skill.body,
      markdown,
      warnings: skill.warnings,
      security,
      conflict: conflict ? { with: conflict.source, description: conflict.description } : null,
    };
    if (skill.sourceRepo) item.sourceRepo = skill.sourceRepo;
    if (author || owner) item.author = author || owner;
    if (options.sourceRepo) {
      const encoded = file.path.split('/').map(encodeURIComponent).join('/');
      item.sourceUrl = `https://github.com/${options.sourceRepo}/blob/HEAD/${encoded}`;
    }
    return item;
  });

  return {
    target: options.label ?? root,
    bySource: detection.bySource,
    items,
    unknown: detection.unknownMarkdown,
    ignored: detection.ignored + unreadable,
  };
}

async function cloneAndScan(url: string, options: ScanTargetOptions): Promise<SkillImportScan> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-import-'));
  try {
    try {
      await execFileAsync('git', ['clone', '--depth', '1', '--quiet', url, tempDir], {
        timeout: CLONE_TIMEOUT_MS,
        maxBuffer: 4 * 1024 * 1024,
      });
    } catch (error) {
      throw new Error(
        `Kunde inte hämta ${url}. Kontrollera adressen och att git finns installerat. (${
          error instanceof Error ? error.message : String(error)
        })`,
      );
    }
    const repoName = url
      .replace(/\.git$/, '')
      .split(/[/:]/)
      .filter(Boolean)
      .slice(-2)
      .join('/');
    return await scanSkillDirectory({
      root: tempDir,
      label: repoName || url,
      ...(options.existing ? { existing: options.existing } : {}),
      ...(repoName ? { sourceRepo: repoName } : {}),
    });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

/**
 * Skannar en mapp eller ett GitHub-repo. Lokala mappar vinner alltid: finns sökvägen på disk
 * läses den, annars tolkas texten som en git-adress.
 */
export async function scanSkillImportTarget(options: ScanTargetOptions): Promise<SkillImportScan> {
  const target = options.target?.trim();
  const scanOptions: ScanDirectoryOptions = {
    root: options.cwd,
    label: options.cwd,
    ...(options.existing ? { existing: options.existing } : {}),
  };
  if (!target) return scanSkillDirectory(scanOptions);

  const local = path.resolve(options.cwd, target);
  if (await isDirectory(local)) return scanSkillDirectory({ ...scanOptions, root: local });

  const url = cloneUrlFor(target);
  if (url) return cloneAndScan(url, options);

  throw new Error(`Hittade ingen mapp på ${local}.`);
}

/** Sparar de valda skillsen i projektet. Poster utan namn eller beskrivning hoppas över. */
export async function applySkillImport(
  store: SkillStore,
  items: SkillImportApplyItem[],
): Promise<SkillImportApplyResult> {
  const created: string[] = [];
  const files: string[] = [];
  for (const item of items) {
    if (!item.name?.trim() || !item.description?.trim()) continue;
    const file = await store.write({
      name: item.name,
      description: item.description,
      tools: item.tools,
      triggers: item.triggers,
      body: item.body,
      globs: item.globs,
      alwaysApply: item.alwaysApply,
      importedFrom: item.source,
      sourcePath: item.sourcePath,
      ...(item.sourceRepo ? { sourceRepo: item.sourceRepo } : {}),
      ...(item.author ? { author: item.author } : {}),
      ...(item.sourceUrl ? { sourceUrl: item.sourceUrl } : {}),
    });
    created.push(item.name);
    files.push(file);
  }
  return { created, files };
}
