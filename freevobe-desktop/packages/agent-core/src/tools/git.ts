import type { GitFileStatus } from '@freevobe/protocol';
import { describeError } from '../util/errors.js';
import { resolveProjectPath } from '../security/paths.js';
import { describeFindings, scanForSecrets } from '../security/secrets.js';
import { truncate } from '../util/text.js';
import { fail, ok, stringArg, type RegisteredTool, type ToolContext } from './types.js';

export interface GitStatusSummary {
  branch: string;
  ahead: number;
  behind: number;
  files: GitFileStatus[];
}

/** Tolkar `git status --porcelain=v1 -b`. */
export function parseGitStatus(output: string): GitStatusSummary {
  const summary: GitStatusSummary = { branch: 'okänd', ahead: 0, behind: 0, files: [] };

  for (const line of output.split('\n')) {
    if (line.startsWith('## ')) {
      const head = line.slice(3).trim();
      const branchMatch = head.match(/^([^\s.]+)/);
      if (branchMatch?.[1]) summary.branch = branchMatch[1];
      if (head.includes('gone')) summary.branch = head.split('...')[0] ?? summary.branch;
      const ahead = head.match(/ahead (\d+)/);
      const behind = head.match(/behind (\d+)/);
      if (ahead?.[1]) summary.ahead = Number(ahead[1]);
      if (behind?.[1]) summary.behind = Number(behind[1]);
      continue;
    }
    if (line.trim() === '' || line.length < 3) continue;
    const index = line[0] ?? ' ';
    const worktree = line[1] ?? ' ';
    const path = line.slice(3).trim();
    summary.files.push({ path, index, worktree, staged: index !== ' ' && index !== '?' });
  }

  return summary;
}

async function runGit(
  ctx: ToolContext,
  command: string,
): Promise<{ output: string; exitCode: number | null }> {
  const result = await ctx.exec(`git ${command}`, { cwd: ctx.root });
  return { output: result.output, exitCode: result.exitCode };
}

export const gitStatusTool: RegisteredTool = {
  spec: {
    name: 'git_status',
    description: 'Visar aktuell branch, ändrade filer och hur många commits som ligger före/efter.',
    parameters: { type: 'object', properties: {} },
    danger: 'safe',
    source: 'builtin',
  },
  handler: async (_args, ctx) => {
    const { output } = await runGit(ctx, 'status --porcelain=v1 -b');
    const status = parseGitStatus(output);
    ctx.emit({ type: 'git', runId: ctx.runId, ...status });

    if (status.files.length === 0) {
      return ok(`Branch ${status.branch}. Inga ändrade filer.`, {
        branch: status.branch,
        files: [],
      });
    }
    const lines = status.files
      .map((file) => `${file.index}${file.worktree} ${file.path}`)
      .join('\n');
    return ok(
      `Branch ${status.branch}${status.ahead ? ` (${status.ahead} före)` : ''}${status.behind ? ` (${status.behind} efter)` : ''}\n${lines}`,
      {
        branch: status.branch,
        files: status.files,
      },
    );
  },
};

export const gitDiffTool: RegisteredTool = {
  spec: {
    name: 'git_diff',
    description: 'Visar diff för arbetskatalogen, staging-området eller mot en referens.',
    parameters: {
      type: 'object',
      properties: {
        staged: {
          type: 'boolean',
          description: 'Visa staging-området (--cached).',
          default: false,
        },
        path: { type: 'string', description: 'Begränsa till en fil eller mapp.' },
        ref: { type: 'string', description: 'Jämför mot en referens, t.ex. HEAD~1.' },
      },
    },
    danger: 'safe',
    source: 'builtin',
  },
  handler: async (args, ctx) => {
    const parts = ['diff'];
    if (args.staged === true) parts.push('--cached');
    if (typeof args.ref === 'string' && args.ref.trim() !== '') parts.push(args.ref.trim());
    if (typeof args.path === 'string' && args.path.trim() !== '') {
      const resolved = resolveProjectPath(ctx.root, args.path);
      if (!resolved.ok) return fail(`Sökvägen avvisades: ${resolved.reason}`);
      parts.push('--', resolved.relative);
    }

    const { output } = await runGit(ctx, parts.join(' '));
    if (output.trim() === '') return ok('Ingen diff – inga ändringar att visa.');
    const { text, truncated } = truncate(output, 40_000);
    return ok(text, { truncated });
  },
};

export const gitBranchTool: RegisteredTool = {
  spec: {
    name: 'git_branch',
    description: 'Listar, skapar eller byter git-branch.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'create', 'switch'], default: 'list' },
        name: { type: 'string', description: 'Branch-namn för create/switch.' },
      },
    },
    danger: 'safe',
    source: 'builtin',
  },
  handler: async (args, ctx) => {
    const action = typeof args.action === 'string' ? args.action : 'list';
    const name = stringArg(args, 'name');

    if (action === 'list') {
      const { output } = await runGit(ctx, 'branch --all --format="%(refname:short)"');
      const branches = output
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      return ok(`Branchar:\n${branches.join('\n')}`, { branches });
    }

    if (!name) return fail(`Argumentet "name" krävs för action=${action}.`);

    if (action === 'create') {
      const { output, exitCode } = await runGit(ctx, `checkout -b ${shellQuote(name)}`);
      if (exitCode !== 0) return fail(`Kunde inte skapa branchen: ${output.trim()}`);
      return ok(`Skapade och bytte till ${name}.`, { branch: name });
    }

    const { output, exitCode } = await runGit(ctx, `checkout ${shellQuote(name)}`);
    if (exitCode !== 0) return fail(`Kunde inte byta till ${name}: ${output.trim()}`);
    return ok(`Bytte till ${name}.`, { branch: name });
  },
};

export const gitCommitTool: RegisteredTool = {
  spec: {
    name: 'git_commit',
    description:
      'Skapar en commit. Om inget meddelande anges föreslår modellen ett. Commits med hemligheter blockeras.',
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Commit-meddelande. Utelämna för att låta modellen föreslå.',
        },
        files: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filer att staginga innan commit. Tomt = använd redan stagingade filer.',
        },
      },
    },
    danger: 'write',
    source: 'builtin',
  },
  handler: async (args, ctx) => {
    const files = Array.isArray(args.files)
      ? args.files.filter((file): file is string => typeof file === 'string')
      : [];

    if (files.length > 0) {
      const resolvedFiles: string[] = [];
      for (const file of files) {
        const resolved = resolveProjectPath(ctx.root, file);
        if (!resolved.ok) return fail(`Sökvägen avvisades: ${resolved.reason}`);
        resolvedFiles.push(shellQuote(resolved.relative));
      }
      const staged = await runGit(ctx, `add -- ${resolvedFiles.join(' ')}`);
      if (staged.exitCode !== 0)
        return fail(`Kunde inte staginga filerna: ${staged.output.trim()}`);
    }

    const stagedDiff = await runGit(ctx, 'diff --cached');
    if (stagedDiff.output.trim() === '') {
      return fail('Inget är stagingat. Staginga filer med "files" eller kör git add först.');
    }

    const findings = scanForSecrets(stagedDiff.output);
    if (findings.length > 0) {
      return fail(
        `Commit blockerad: diffen ser ut att innehålla hemligheter (${describeFindings(findings)}). Ta bort dem och försök igen.`,
      );
    }

    let message = stringArg(args, 'message');
    if (!message) {
      if (!ctx.generateCommitMessage) {
        return fail(
          'Inget commit-meddelande angavs och ingen modell är tillgänglig för att föreslå ett.',
        );
      }
      message = await ctx.generateCommitMessage(stagedDiff.output);
    }

    const before = await ctx.runHooks('before_commit', { diff: stagedDiff.output, message });
    if (before.blocked) return fail(`En hook blockerade commiten: ${before.output}`);

    if (ctx.approval.required) {
      const outcome = await ctx.requestApproval({
        kind: 'git_commit',
        title: 'Skapa commit',
        detail: message,
        reason: ctx.approval.reason,
        risk: ctx.approval.risk,
        hardBlock: ctx.approval.hardBlock,
        command: `git commit -m ${shellQuote(message)}`,
        cwd: ctx.root,
      });
      if (!outcome.approved) return fail('Användaren avvisade commiten.');
    }

    const commit = await runGit(ctx, `commit -m ${shellQuote(message)}`);
    if (commit.exitCode !== 0) {
      return fail(`Commit misslyckades: ${commit.output.trim()}`);
    }

    const hash = (await runGit(ctx, 'rev-parse --short HEAD')).output.trim();
    await ctx.runHooks('after_commit', { hash, message });

    return ok(`Commit ${hash} skapad:\n${message}\n\n${commit.output.trim()}`, { hash, message });
  },
};

/** Prompten som används för att låta modellen föreslå ett commit-meddelande. */
export function buildCommitMessagePrompt(diff: string): string {
  return [
    'Skriv ett koncist commit-meddelande på svenska för diffen nedan.',
    'Första raden: imperative form, max 72 tecken, ingen punkt.',
    'Lägg till en kort brödtext (max 3 rader) endast om ändringen kräver förklaring.',
    'Svara med enbart commit-meddelandet, utan kodstaket och utan inledning.',
    '',
    '```diff',
    truncate(diff, 12_000).text,
    '```',
  ].join('\n');
}

export function shellQuote(value: string): string {
  return `"${value.replace(/(["\\$`])/g, '\\$1')}"`;
}

export const gitTools: RegisteredTool[] = [
  gitStatusTool,
  gitDiffTool,
  gitBranchTool,
  gitCommitTool,
];

export { describeError };
