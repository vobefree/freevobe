import fs from 'node:fs/promises';
import path from 'node:path';
import type { ToolSpec } from '@vibeforge/protocol';
import { truncate } from '../util/text.js';
import { walkFiles } from '../util/walk.js';
import { resolveProjectPath } from '../security/paths.js';
import { fail, ok, numberArg, stringArg, type RegisteredTool, type ToolContext } from './types.js';

const MAX_READ_CHARS = 200_000;
const MAX_SEARCH_FILES = 3_000;
const MAX_SEARCH_FILE_BYTES = 1_500_000;

function spec(
  name: string,
  description: string,
  parameters: ToolSpec['parameters'],
  danger: ToolSpec['danger'] = 'safe',
): ToolSpec {
  return { name, description, parameters, danger, source: 'builtin' };
}

function resolveOrFail(
  ctx: ToolContext,
  candidate: string,
): { absolute: string; relative: string } | string {
  const resolved = resolveProjectPath(ctx.root, candidate);
  if (!resolved.ok) return `Sökvägen avvisades: ${resolved.reason}`;
  return { absolute: resolved.absolute, relative: resolved.relative };
}

export const listFilesTool: RegisteredTool = {
  spec: spec(
    'list_files',
    'Listar filer i projektet. Använd ett globmönster för att begränsa, t.ex. "src/**/*.ts".',
    {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Undermapp relativt projektroten. Standard: roten.' },
        glob: { type: 'string', description: 'Globmönster, t.ex. "**/*.tsx".' },
        maxEntries: { type: 'integer', description: 'Max antal rader i svaret.', default: 200 },
      },
    },
  ),
  handler: async (args, ctx) => {
    const sub = typeof args.path === 'string' ? args.path : '.';
    const resolved = resolveOrFail(ctx, sub);
    if (typeof resolved === 'string') return fail(resolved);

    const globPattern = stringArg(args, 'glob');
    const maxEntries = Math.min(numberArg(args, 'maxEntries', 200), 2_000);
    const lines: string[] = [];
    let total = 0;

    for await (const entry of walkFiles({ root: ctx.root, maxFiles: 5_000 })) {
      const relativeToSub = path.relative(resolved.absolute, entry.absolute).replace(/\\/g, '/');
      if (relativeToSub.startsWith('..')) continue;
      if (globPattern && !matches(entry.relative, globPattern)) continue;
      total += 1;
      if (lines.length < maxEntries) lines.push(`${entry.relative} (${entry.size} B)`);
    }

    if (total === 0) return ok(`Inga filer hittades i ${resolved.relative}.`);
    const rest = total > lines.length ? `\n… och ${total - lines.length} filer till.` : '';
    return ok(`${total} filer:\n${lines.join('\n')}${rest}`, { total });
  },
};

function matches(relative: string, pattern: string): boolean {
  const normalized = pattern.replace(/\\/g, '/');
  const target = relative.replace(/\\/g, '/');
  if (normalized.startsWith('**/')) {
    const tail = normalized.slice(3);
    return target.split('/').some((_, index, parts) => {
      const candidate = parts.slice(index).join('/');
      return candidate === tail || candidate.endsWith(`/${tail}`) || simpleGlob(candidate, tail);
    });
  }
  return simpleGlob(target, normalized);
}

function simpleGlob(target: string, pattern: string): boolean {
  // NUL-tecknet används som platshållare för "**" medan enkelstjärnorna ersätts.
  const placeholder = String.fromCharCode(0);
  const placeholderPattern = new RegExp(placeholder, 'g');
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, placeholder)
    .replace(/\*/g, '[^/]*')
    .replace(placeholderPattern, '.*')
    .replace(/\?/g, '[^/]');
  return new RegExp(`^${escaped}$`).test(target);
}

export const readFileTool: RegisteredTool = {
  spec: spec(
    'read_file',
    'Läser en textfil i projektet. Stora filer klipps och du får veta vad som utelämnats.',
    {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Projektrelativ sökväg.' },
        startLine: { type: 'integer', description: 'Första rad (1-baserad).' },
        endLine: { type: 'integer', description: 'Sista rad (inkluderad).' },
        maxChars: { type: 'integer', description: 'Max antal tecken att returnera.' },
      },
      required: ['path'],
    },
  ),
  handler: async (args, ctx) => {
    const candidate = stringArg(args, 'path');
    if (!candidate) return fail('Argumentet "path" saknas.');
    const resolved = resolveOrFail(ctx, candidate);
    if (typeof resolved === 'string') return fail(resolved);

    let raw: string;
    try {
      raw = await fs.readFile(resolved.absolute, 'utf8');
    } catch (error) {
      return fail(
        `Kunde inte läsa ${resolved.relative}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const allLines = raw.split('\n');
    const startLine = Math.max(1, numberArg(args, 'startLine', 1));
    const endLine = Math.min(allLines.length, numberArg(args, 'endLine', allLines.length));
    const selected = allLines.slice(startLine - 1, endLine);
    const withNumbers = selected
      .map((line, index) => `${String(startLine + index).padStart(5)} | ${line}`)
      .join('\n');
    const maxChars = Math.min(numberArg(args, 'maxChars', MAX_READ_CHARS), MAX_READ_CHARS);
    const { text, truncated } = truncate(withNumbers, maxChars);

    const header = `${resolved.relative} (${allLines.length} rader)${startLine > 1 || endLine < allLines.length ? ` – visar rad ${startLine}-${endLine}` : ''}`;
    return ok(`${header}\n${text}`, {
      path: resolved.relative,
      lines: allLines.length,
      truncated,
      shownLines: selected.length,
    });
  },
};

export const searchFilesTool: RegisteredTool = {
  spec: spec(
    'search_files',
    'Söker efter text eller ett reguljärt uttryck i projektets filer och returnerar fil, radnummer och radinnehåll.',
    {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Text att söka efter.' },
        path: { type: 'string', description: 'Undermapp att söka i.' },
        include: { type: 'string', description: 'Glob för filnamn, t.ex. "*.ts".' },
        regex: {
          type: 'boolean',
          description: 'Tolka query som ett reguljärt uttryck.',
          default: false,
        },
        caseSensitive: { type: 'boolean', default: false },
        maxResults: { type: 'integer', default: 60 },
      },
      required: ['query'],
    },
  ),
  handler: async (args, ctx) => {
    const query = stringArg(args, 'query');
    if (!query) return fail('Argumentet "query" saknas.');

    const isRegex = args.regex === true;
    let matcher: RegExp;
    try {
      matcher = isRegex
        ? new RegExp(query, args.caseSensitive === true ? 'g' : 'gi')
        : new RegExp(
            query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            args.caseSensitive === true ? 'g' : 'gi',
          );
    } catch (error) {
      return fail(
        `Ogiltigt reguljärt uttryck: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const sub = typeof args.path === 'string' ? args.path : '.';
    const resolved = resolveOrFail(ctx, sub);
    if (typeof resolved === 'string') return fail(resolved);
    const include = stringArg(args, 'include');
    const maxResults = Math.min(numberArg(args, 'maxResults', 60), 300);

    const results: string[] = [];
    let scanned = 0;
    let skipped = 0;
    let matches = 0;

    for await (const entry of walkFiles({ root: ctx.root, maxFiles: MAX_SEARCH_FILES })) {
      const relativeToSub = path.relative(resolved.absolute, entry.absolute).replace(/\\/g, '/');
      if (relativeToSub.startsWith('..')) continue;
      if (include && !simpleGlob(path.basename(entry.relative), include)) continue;
      if (entry.size > MAX_SEARCH_FILE_BYTES) {
        skipped += 1;
        continue;
      }
      scanned += 1;

      let content: string;
      try {
        content = await fs.readFile(entry.absolute, 'utf8');
      } catch {
        continue;
      }

      const lines = content.split('\n');
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] as string;
        matcher.lastIndex = 0;
        if (!matcher.test(line)) continue;
        matches += 1;
        if (results.length < maxResults) {
          results.push(`${entry.relative}:${index + 1}: ${line.trim().slice(0, 200)}`);
        }
      }
    }

    if (matches === 0)
      return ok(`Inga träffar på "${query}" (${scanned} filer genomsökta).`, { matches: 0 });
    const rest =
      matches > results.length ? `\n… och ${matches - results.length} träffar till.` : '';
    return ok(
      `${matches} träffar på "${query}":\n${results.join('\n')}${rest}${skipped > 0 ? `\n(${skipped} filer hoppades över p.g.a. storlek)` : ''}`,
      { matches, scanned },
    );
  },
};

async function proposeFileContent(
  ctx: ToolContext,
  candidate: string,
  content: string,
  kind: 'create' | 'update',
) {
  const result = await ctx.proposeChange({ path: candidate, kind, newContent: content });
  return result;
}

export const writeFileTool: RegisteredTool = {
  spec: spec(
    'write_file',
    'Skriver en fil (skapar eller ersätter hela innehållet). Ändringen visas alltid som en diff innan den sparas.',
    {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Projektrelativ sökväg.' },
        content: { type: 'string', description: 'Fullständigt nytt innehåll.' },
        reason: { type: 'string', description: 'Kort motivering som visas i diffen.' },
      },
      required: ['path', 'content'],
    },
    'write',
  ),
  handler: async (args, ctx) => {
    const candidate = stringArg(args, 'path');
    const content = typeof args.content === 'string' ? args.content : null;
    if (!candidate || content === null) return fail('Både "path" och "content" krävs.');
    const result = await proposeFileContent(ctx, candidate, content, 'update');
    return ok(result.summary, {
      diffId: result.diff.id,
      path: result.diff.path,
      applied: result.applied,
    });
  },
};

export const createFileTool: RegisteredTool = {
  spec: spec(
    'create_file',
    'Skapar en ny fil. Misslyckas om filen redan finns (använd edit_file eller write_file då).',
    {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Projektrelativ sökväg.' },
        content: { type: 'string', description: 'Filens innehåll.' },
      },
      required: ['path', 'content'],
    },
    'write',
  ),
  handler: async (args, ctx) => {
    const candidate = stringArg(args, 'path');
    const content = typeof args.content === 'string' ? args.content : null;
    if (!candidate || content === null) return fail('Både "path" och "content" krävs.');
    const resolved = resolveOrFail(ctx, candidate);
    if (typeof resolved === 'string') return fail(resolved);

    try {
      await fs.access(resolved.absolute);
      return fail(`Filen ${resolved.relative} finns redan. Använd edit_file för att ändra den.`);
    } catch {
      // Bra: filen finns inte.
    }

    const result = await proposeFileContent(ctx, candidate, content, 'create');
    return ok(result.summary, {
      diffId: result.diff.id,
      path: result.diff.path,
      applied: result.applied,
    });
  },
};

export const editFileTool: RegisteredTool = {
  spec: spec(
    'edit_file',
    'Ersätter en exakt textsträng i en befintlig fil. Ändringen visas som diff innan den sparas.',
    {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Projektrelativ sökväg.' },
        oldString: { type: 'string', description: 'Texten som ska bytas ut (måste finnas exakt).' },
        newString: { type: 'string', description: 'Ersättningstext.' },
        replaceAll: { type: 'boolean', description: 'Byt ut alla förekomster.', default: false },
      },
      required: ['path', 'oldString', 'newString'],
    },
    'write',
  ),
  handler: async (args, ctx) => {
    const candidate = stringArg(args, 'path');
    const oldString = typeof args.oldString === 'string' ? args.oldString : null;
    const newString = typeof args.newString === 'string' ? args.newString : null;
    if (!candidate || oldString === null || newString === null) {
      return fail('Argumenten "path", "oldString" och "newString" krävs.');
    }
    if (oldString === newString)
      return fail('oldString och newString är identiska – ingen ändring behövs.');

    const resolved = resolveOrFail(ctx, candidate);
    if (typeof resolved === 'string') return fail(resolved);

    let current: string;
    try {
      current = await fs.readFile(resolved.absolute, 'utf8');
    } catch (error) {
      return fail(
        `Kunde inte läsa ${resolved.relative}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const occurrences = current.split(oldString).length - 1;
    if (occurrences === 0) {
      return fail(
        `Texten hittades inte i ${resolved.relative}. Läs filen igen och använd en exakt sträng.`,
      );
    }
    const replaceAll = args.replaceAll === true;
    if (occurrences > 1 && !replaceAll) {
      return fail(
        `Texten förekommer ${occurrences} gånger i ${resolved.relative}. Ge mer kontext eller sätt replaceAll=true.`,
      );
    }

    const updated = replaceAll
      ? current.split(oldString).join(newString)
      : current.replace(oldString, newString);
    const result = await proposeFileContent(ctx, candidate, updated, 'update');
    return ok(`${result.summary} (${replaceAll ? occurrences : 1} ersättning)`, {
      diffId: result.diff.id,
      path: result.diff.path,
      applied: result.applied,
      occurrences: replaceAll ? occurrences : 1,
    });
  },
};

export const deleteFileTool: RegisteredTool = {
  spec: spec(
    'delete_file',
    'Tar bort en fil. Kräver godkännande och visas som en diff (allt innehåll tas bort).',
    {
      type: 'object',
      properties: { path: { type: 'string', description: 'Projektrelativ sökväg.' } },
      required: ['path'],
    },
    'write',
  ),
  handler: async (args, ctx) => {
    const candidate = stringArg(args, 'path');
    if (!candidate) return fail('Argumentet "path" saknas.');
    const resolved = resolveOrFail(ctx, candidate);
    if (typeof resolved === 'string') return fail(resolved);

    try {
      await fs.access(resolved.absolute);
    } catch {
      return fail(`Filen ${resolved.relative} finns inte.`);
    }

    const result = await ctx.proposeChange({ path: candidate, kind: 'delete' });
    return ok(result.summary, {
      diffId: result.diff.id,
      path: result.diff.path,
      applied: result.applied,
    });
  },
};

export const fsTools: RegisteredTool[] = [
  listFilesTool,
  readFileTool,
  searchFilesTool,
  writeFileTool,
  createFileTool,
  editFileTool,
  deleteFileTool,
];
