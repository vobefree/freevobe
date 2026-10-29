import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  AgentEvent,
  ApprovalKind,
  ApprovalQuestion,
  FileChangeKind,
  FileDiff,
} from '@freevobe/protocol';
import { AGENT_SERVER_PORT, MAX_TOOL_OUTPUT_CHARS, TERMINAL_TIMEOUT_MS } from '@freevobe/protocol';
import { createFileDiff } from '../diff/engine.js';
import { assertWritable } from '../security/paths.js';
import { ApprovalRejectedError, PolicyBlockedError, describeError } from '../util/errors.js';
import { ensureTrailingNewline } from '../util/text.js';
import { pathExists } from '../util/walk.js';
import type { ApprovalManager } from '../approval/manager.js';
import type { RecordedChange } from '../checkpoints/service.js';
import type { HookRunner } from '../hooks/hooks.js';
import type {
  ApprovalOutcome,
  ApprovalPolicy,
  ChangeResult,
  CommandResult,
  ProposedChange,
  ToolContext,
} from '../tools/types.js';
import type { BrowserDriver } from '../tools/browser.js';

export interface ToolRuntimeOptions {
  root: string;
  projectId: string;
  sessionId: string;
  runId: string;
  approvals: ApprovalManager;
  hooks: HookRunner;
  emit: (event: AgentEvent) => void;
  signal: AbortSignal;
  browserAutomationEnabled: boolean;
  browser?: BrowserDriver;
  fetchImpl?: typeof fetch;
  limits?: { terminalTimeoutMs?: number; maxOutputChars?: number };
  testCommandOverride?: string;
  /**
   * Anropas precis innan en fil skrivs. Checkpointen sparar då filens tidigare innehåll, så att
   * ändringen kan rullas tillbaka utan att röra Git.
   */
  recordChange?: (change: RecordedChange) => Promise<void> | void;
}

export interface ApprovalPrompt {
  kind: ApprovalKind;
  title: string;
  detail: string;
  reason: string;
  risk: ApprovalPolicy['risk'];
  hardBlock: boolean;
  path?: string;
  command?: string;
  args?: string[];
  cwd?: string;
  url?: string;
  diff?: FileDiff;
  questions?: ApprovalQuestion[];
}

export interface ToolRuntime {
  exec(
    command: string,
    options?: { cwd?: string; timeoutMs?: number; env?: Record<string, string> },
  ): Promise<CommandResult>;
  requestApproval(prompt: ApprovalPrompt): Promise<ApprovalOutcome>;
  proposeChange(change: ProposedChange, approval: ApprovalPolicy): Promise<ChangeResult>;
  runHooks(
    name: string,
    payload: Record<string, unknown>,
  ): Promise<{ blocked: boolean; output: string }>;
  detectTestCommand(): Promise<string | null>;
  createContext(options: { approval: ApprovalPolicy; browser?: BrowserDriver }): ToolContext;
}

/** Hittar projektets testkommando utan att köra något: package.json, pyproject, Cargo, go.mod. */
export async function detectTestCommand(root: string, override?: string): Promise<string | null> {
  if (override && override.trim() !== '') return override.trim();

  try {
    const raw = await fs.readFile(path.join(root, 'package.json'), 'utf8');
    const parsed = JSON.parse(raw) as { scripts?: Record<string, string>; packageManager?: string };
    const scripts = parsed.scripts ?? {};
    const manager = parsed.packageManager?.startsWith('pnpm')
      ? 'pnpm'
      : parsed.packageManager?.startsWith('yarn')
        ? 'yarn'
        : parsed.packageManager?.startsWith('bun')
          ? 'bun'
          : 'npm';
    for (const candidate of ['test', 'test:unit', 'vitest', 'jest']) {
      if (scripts[candidate]) {
        return manager === 'npm' ? `npm run ${candidate} --silent` : `${manager} run ${candidate}`;
      }
    }
  } catch {
    // Ingen package.json – prova andra ekosystem nedan.
  }

  if (await pathExists(path.join(root, 'pyproject.toml'))) return 'python -m pytest -q';
  if (await pathExists(path.join(root, 'Cargo.toml'))) return 'cargo test';
  if (await pathExists(path.join(root, 'go.mod'))) return 'go test ./...';
  return null;
}

export function createToolRuntime(options: ToolRuntimeOptions): ToolRuntime {
  const limits = {
    terminalTimeoutMs: options.limits?.terminalTimeoutMs ?? TERMINAL_TIMEOUT_MS,
    maxOutputChars: options.limits?.maxOutputChars ?? MAX_TOOL_OUTPUT_CHARS,
  };

  const exec: ToolRuntime['exec'] = (command, execOptions = {}) =>
    new Promise<CommandResult>((resolve) => {
      const cwd = execOptions.cwd ?? options.root;
      const timeoutMs = execOptions.timeoutMs ?? limits.terminalTimeoutMs;
      const started = Date.now();
      let output = '';
      let timedOut = false;
      let settled = false;

      options.emit({
        type: 'terminal',
        runId: options.runId,
        chunk: { stream: 'system', text: `$ ${command}\n` },
      });

      const child = spawn(command, {
        cwd,
        shell: true,
        env: {
          ...process.env,
          ...(execOptions.env ?? {}),
          FREEVOBE_AGENT_PORT: String(AGENT_SERVER_PORT),
        },
        windowsHide: true,
      });

      const append = (stream: 'stdout' | 'stderr', chunk: Buffer) => {
        const text = chunk.toString('utf8');
        options.emit({ type: 'terminal', runId: options.runId, chunk: { stream, text } });
        if (output.length < limits.maxOutputChars * 2) output += text;
      };

      child.stdout?.on('data', (chunk: Buffer) => append('stdout', chunk));
      child.stderr?.on('data', (chunk: Buffer) => append('stderr', chunk));

      const timer = setTimeout(() => {
        timedOut = true;
        options.emit({
          type: 'terminal',
          runId: options.runId,
          chunk: { stream: 'system', text: `\n[tidsgräns ${timeoutMs} ms – processen avslutas]\n` },
        });
        child.kill('SIGTERM');
        setTimeout(() => child.kill('SIGKILL'), 3_000).unref?.();
      }, timeoutMs);

      const abortHandler = () => {
        child.kill('SIGTERM');
      };
      options.signal.addEventListener('abort', abortHandler, { once: true });

      const finish = (exitCode: number | null, errorText?: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        options.signal.removeEventListener('abort', abortHandler);
        if (errorText) output += `\n${errorText}`;
        options.emit({
          type: 'terminal',
          runId: options.runId,
          chunk: {
            stream: 'system',
            text: `[klart: ${timedOut ? 'tidsgräns' : `exit ${exitCode ?? 'okänd'}`} på ${Date.now() - started} ms]\n`,
          },
        });
        resolve({ command, exitCode, passed: 0, failed: 0, output, timedOut });
      };

      child.on('error', (error) => finish(null, describeError(error)));
      child.on('close', (code) => finish(code));
    });

  const requestApproval: ToolRuntime['requestApproval'] = async (prompt) => {
    const pending = options.approvals.create({
      runId: options.runId,
      kind: prompt.kind,
      title: prompt.title,
      detail: prompt.detail,
      reason: prompt.reason,
      risk: prompt.risk,
      hardBlock: prompt.hardBlock,
      ...(prompt.path ? { path: prompt.path } : {}),
      ...(prompt.command ? { command: prompt.command } : {}),
      ...(prompt.args ? { args: prompt.args } : {}),
      ...(prompt.cwd ? { cwd: prompt.cwd } : {}),
      ...(prompt.url ? { url: prompt.url } : {}),
      ...(prompt.diff ? { diff: prompt.diff } : {}),
      ...(prompt.questions ? { questions: prompt.questions } : {}),
    });

    options.emit({ type: 'approval_request', runId: options.runId, request: pending.request });
    const answer = await pending.promise;
    options.emit({
      type: 'approval_resolved',
      runId: options.runId,
      approvalId: pending.request.id,
      decision: answer.decision,
    });
    return {
      approved: answer.decision === 'approved',
      ...(answer.answers ? { answers: answer.answers } : {}),
    };
  };

  const proposeChange: ToolRuntime['proposeChange'] = async (change, approval) => {
    const resolved = assertWritable(options.root, change.path);
    if (!resolved.ok) {
      throw new PolicyBlockedError(
        resolved.reason ?? 'Sökvägen är inte tillåten.',
        resolved.relative,
      );
    }

    const existed = await pathExists(resolved.absolute);
    const kind: FileChangeKind =
      change.kind === 'delete' ? 'delete' : existed ? 'update' : 'create';

    let oldContent = '';
    if (existed) {
      try {
        oldContent = await fs.readFile(resolved.absolute, 'utf8');
      } catch {
        oldContent = '';
      }
    }

    const newContent = change.kind === 'delete' ? '' : (change.newContent ?? '');
    const diff = createFileDiff({
      path: resolved.relative,
      absolutePath: resolved.absolute,
      kind,
      oldContent,
      newContent,
    });

    // Diffen visas alltid för användaren, även när den godkänns automatiskt.
    options.emit({ type: 'diff', runId: options.runId, diff });

    if (approval.required) {
      const outcome = await requestApproval({
        kind: kind === 'delete' ? 'file_delete' : 'file_write',
        title:
          kind === 'delete'
            ? `Ta bort ${resolved.relative}`
            : `${kind === 'create' ? 'Skapa' : 'Ändra'} ${resolved.relative}`,
        detail: `+${diff.additions} / -${diff.deletions} rader`,
        reason: approval.reason,
        risk: approval.risk,
        hardBlock: approval.hardBlock,
        diff,
        path: resolved.relative,
      });
      if (!outcome.approved) {
        throw new ApprovalRejectedError(`Användaren avvisade ändringen av ${resolved.relative}.`);
      }
    }

    const hookPayload = {
      path: resolved.relative,
      kind,
      additions: diff.additions,
      deletions: diff.deletions,
    };
    const beforeHook = await options.hooks.run('before_file_edit', hookPayload);
    if (beforeHook.blocked) {
      return {
        diff,
        applied: false,
        summary: `Ändringen av ${resolved.relative} blockerades av en hook: ${beforeHook.output}`,
      };
    }

    const written = kind === 'delete' ? null : ensureTrailingNewline(newContent);
    if (options.recordChange) {
      // Före skrivningen: det är detta innehåll en återställning ska lägga tillbaka.
      await options.recordChange({
        path: resolved.relative,
        beforeContent: existed ? oldContent : null,
        afterContent: written,
        additions: diff.additions,
        deletions: diff.deletions,
        changeKind: kind,
      });
    }

    if (kind === 'delete') {
      await fs.rm(resolved.absolute, { force: true });
    } else {
      await fs.mkdir(path.dirname(resolved.absolute), { recursive: true });
      await fs.writeFile(resolved.absolute, written as string, 'utf8');
    }

    await options.hooks.run('after_file_edit', hookPayload);
    options.emit({ type: 'file_changed', runId: options.runId, path: resolved.relative, kind });

    return {
      diff,
      applied: true,
      summary: `${kind === 'create' ? 'Skapade' : kind === 'delete' ? 'Tog bort' : 'Ändrade'} ${resolved.relative} (+${diff.additions}/-${diff.deletions}).`,
    };
  };

  const runHooks: ToolRuntime['runHooks'] = async (name, payload) => {
    const result = await options.hooks.run(name as Parameters<HookRunner['run']>[0], payload);
    return { blocked: result.blocked, output: result.output };
  };

  const detect = () => detectTestCommand(options.root, options.testCommandOverride);

  return {
    exec,
    requestApproval,
    proposeChange,
    runHooks,
    detectTestCommand: detect,
    createContext({ approval, browser }) {
      const context: ToolContext = {
        root: options.root,
        projectId: options.projectId,
        sessionId: options.sessionId,
        runId: options.runId,
        signal: options.signal,
        approval,
        emit: options.emit,
        requestApproval,
        proposeChange: (change) => proposeChange(change, approval),
        runHooks,
        exec,
        detectTestCommand: detect,
        fetchImpl: options.fetchImpl ?? globalThis.fetch,
        limits,
      };
      if (browser) context.browser = browser;
      return context;
    },
  };
}
