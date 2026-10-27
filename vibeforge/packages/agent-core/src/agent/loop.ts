import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AgentEvent, PermissionMode, ToolResult } from '@vibeforge/protocol';
import { DEFAULT_CONTEXT_BUDGET_CHARS, DEFAULT_MAX_ITERATIONS } from '@vibeforge/protocol';
import type { ToolRegistry } from '../tools/registry.js';
import type { ApprovalPolicy } from '../tools/types.js';
import { evaluateToolCall, type PolicyContext } from '../security/policy.js';
import { buildContextBlock, selectContext } from '../context/selector.js';
import { embed } from '../context/embedding.js';
import type { IndexedFile, ProjectIndexer } from '../context/indexer.js';
import { activateSkills, type Skill } from '../skills/loader.js';
import type { RuleBundle } from '../rules/loader.js';
import { ToolCallAccumulator, parseTextualToolCalls } from '../ollama/openai.js';
import type { ChatToolCall, ChatTransport, ChatTurnMessage } from '../ollama/types.js';
import { describeError } from '../util/errors.js';
import { createId } from '../util/ids.js';
import { buildSystemPrompt } from './prompt.js';
import type { ToolRuntime } from './runtime.js';
import type { BrowserDriver } from '../tools/browser.js';

export interface RepoMapEntryLike {
  path: string;
  size: number;
  lines: number;
  language: string;
  symbols: string[];
  imports: string[];
}

export interface AgentLoopOptions {
  transport: ChatTransport;
  registry: ToolRegistry;
  runtime: ToolRuntime;
  rules: RuleBundle;
  skills: Skill[];
  /** Indexerat projekt. Används för vektorsökning i kontextvalet. */
  indexer?: ProjectIndexer;
  /** Fallback när inget index finns ännu. */
  repoMapProvider?: () => Promise<RepoMapEntryLike[]>;
  contextBudgetChars?: number;
  maxIterations?: number;
  browserAutomationEnabled?: boolean;
  mcpServerApproved?: (server: string) => boolean;
  browser?: BrowserDriver;
  osLabel?: string;
}

export interface RunInput {
  runId: string;
  sessionId: string;
  mode: 'plan' | 'execute';
  permissionMode: PermissionMode;
  model: string;
  userMessage: string;
  history: ChatTurnMessage[];
  pinnedFiles?: string[];
  recentFiles?: string[];
  signal: AbortSignal;
  supportsTools?: boolean;
  projectName?: string;
}

export interface ChatTurnResult {
  content: string;
  reasoning: string;
  toolCalls: ChatToolCall[];
}

/**
 * Agent-loopen: begäran → kontext → modellsvar → verktygsanrop → körning → reflektion →
 * slutligt svar. Allt som händer är en AgentEvent på samma kanal, så UI:t kan rita hela
 * förloppet live och användaren kan avbryta när som helst.
 */
export class AgentLoop {
  private readonly options: AgentLoopOptions;
  private cachedFallback: IndexedFile[] | null = null;

  constructor(options: AgentLoopOptions) {
    this.options = options;
  }

  async *run(input: RunInput): AsyncGenerator<AgentEvent> {
    const { runId } = input;
    const contextBudgetChars = this.options.contextBudgetChars ?? DEFAULT_CONTEXT_BUDGET_CHARS;
    const maxIterations = this.options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    const runtime = this.options.runtime;

    yield {
      type: 'run_started',
      runId,
      sessionId: input.sessionId,
      model: input.model,
      mode: input.permissionMode,
    };

    try {
      yield { type: 'status', runId, phase: 'building-context', message: 'Bygger kontext' };
      const { entries, fromIndex } = await this.loadEntries(input);

      const selection = selectContext({
        prompt: input.userMessage,
        entries,
        pinned: input.pinnedFiles ?? [],
        recentFiles: input.recentFiles ?? [],
        budgetChars: contextBudgetChars,
      });

      const contextBlock = await buildContextBlock(this.options.rules.root, selection.files, {
        readFile: (filePath) => fs.readFile(filePath, 'utf8'),
        maxChars: contextBudgetChars,
      });

      yield {
        type: 'context',
        runId,
        files: selection.files,
        chars: selection.chars,
        fromCache: fromIndex,
      };

      const activations = activateSkills(this.options.skills, input.userMessage);
      const repoMapText = entries
        .slice(0, 500)
        .map(
          (entry) =>
            `${entry.path}${entry.symbols.length > 0 ? ` – ${entry.symbols.slice(0, 5).join(', ')}` : ''}`,
        )
        .join('\n');

      const systemPrompt = buildSystemPrompt({
        projectName: input.projectName ?? path.basename(this.options.rules.root),
        root: this.options.rules.root,
        mode: input.mode,
        permissionMode: input.permissionMode,
        model: input.model,
        supportsTools: input.supportsTools ?? true,
        agentsFile: this.options.rules.agentsFile,
        rulesFile: this.options.rules.rulesFile,
        memory: this.options.rules.memory,
        preferences: this.options.rules.preferences as Record<string, unknown>,
        skillActivations: activations,
        repoMap: repoMapText,
        contextFiles: selection.files,
        contextBlock,
        ...(typeof this.options.rules.preferences.testCommand === 'string' &&
        this.options.rules.preferences.testCommand
          ? { testCommand: this.options.rules.preferences.testCommand }
          : {}),
        os: this.options.osLabel ?? `${os.platform()} ${os.release()}`,
      });

      const messages: ChatTurnMessage[] = [
        { role: 'system', content: systemPrompt },
        ...input.history,
        { role: 'user', content: input.userMessage },
      ];

      const policyContext: PolicyContext = {
        root: this.options.rules.root,
        mode: input.permissionMode,
        browserAutomationEnabled: this.options.browserAutomationEnabled ?? false,
        mcpServerApproved: this.options.mcpServerApproved ?? (() => false),
      };

      for (let iteration = 0; iteration < maxIterations; iteration += 1) {
        if (input.signal.aborted) {
          yield { type: 'run_finished', runId, reason: 'aborted' };
          return;
        }

        yield {
          type: 'status',
          runId,
          phase: 'thinking',
          message: `Modellen arbetar (varv ${iteration + 1})`,
        };

        const generator = this.chatOnce(input, messages);
        let step = await generator.next();
        while (!step.done) {
          yield step.value;
          step = await generator.next();
        }
        const turn: ChatTurnResult = step.value;
        let toolCalls = turn.toolCalls;

        if (toolCalls.length === 0 && input.supportsTools === false) {
          toolCalls = parseTextualToolCalls(turn.content).map((call) => ({
            id: createId('call'),
            name: call.name,
            args: call.args,
            rawArguments: JSON.stringify(call.args),
          }));
        }

        if (turn.content.trim() !== '' || turn.toolCalls.length > 0) {
          messages.push({
            role: 'assistant',
            content: turn.content,
            ...(turn.toolCalls.length > 0 ? { toolCalls: turn.toolCalls } : {}),
          });
          yield {
            type: 'assistant_message',
            runId,
            text: turn.content,
            messageId: createId('msg'),
          };
        }

        if (toolCalls.length === 0) {
          yield { type: 'status', runId, phase: 'done' };
          yield { type: 'run_finished', runId, reason: 'final' };
          return;
        }

        for (const call of toolCalls) {
          if (input.signal.aborted) {
            yield { type: 'run_finished', runId, reason: 'aborted' };
            return;
          }

          yield { type: 'tool_call', runId, call };
          const spec = this.options.registry.get(call.name)?.spec;

          if (!spec) {
            const result: ToolResult = {
              callId: call.id,
              name: call.name,
              ok: false,
              content: `Verktyget "${call.name}" finns inte.`,
              error: 'Verktyget finns inte.',
              durationMs: 0,
            };
            yield { type: 'tool_result', runId, result };
            yield { type: 'error', runId, code: 'tool_not_found', message: result.content };
            messages.push({
              role: 'tool',
              content: result.content,
              toolCallId: call.id,
              name: call.name,
            });
            continue;
          }

          if (input.mode === 'plan' && spec.danger !== 'safe') {
            const message = `Plan-läget tillåter inte "${call.name}". Beskriv ändringen i text i stället, eller be användaren växla till Execute-läget.`;
            yield { type: 'error', runId, code: 'policy_blocked', message };
            messages.push({ role: 'tool', content: message, toolCallId: call.id, name: call.name });
            continue;
          }

          const decision = evaluateToolCall({ spec, args: call.args }, policyContext);
          if (decision.effect === 'block') {
            const message = `${decision.reason}${decision.detail ? ` ${decision.detail}` : ''}`;
            yield { type: 'error', runId, code: 'policy_blocked', message };
            messages.push({
              role: 'tool',
              content: `Blockerat: ${message}`,
              toolCallId: call.id,
              name: call.name,
            });
            continue;
          }

          const approval: ApprovalPolicy =
            decision.effect === 'require-approval'
              ? {
                  required: true,
                  risk: decision.risk,
                  reason: decision.reason,
                  hardBlock: decision.hardBlock,
                }
              : {
                  required: false,
                  risk: 'low',
                  reason: 'Tillåtet enligt behörighetsläget.',
                  hardBlock: false,
                };

          yield {
            type: 'status',
            runId,
            phase: approval.required ? 'waiting-approval' : 'executing-tool',
            message: call.name,
          };

          const context = runtime.createContext({
            approval,
            ...(this.options.browser ? { browser: this.options.browser } : {}),
          });
          const result = await this.options.registry.execute(call, context);
          yield { type: 'tool_result', runId, result };

          if (!result.ok) {
            yield {
              type: 'error',
              runId,
              code:
                result.error && /avvisade/i.test(result.error)
                  ? 'approval_rejected'
                  : 'tool_failed',
              message: result.error ?? 'Verktyget misslyckades.',
            };
          }

          messages.push({
            role: 'tool',
            content: result.content,
            toolCallId: call.id,
            name: call.name,
          });
        }
      }

      yield {
        type: 'error',
        runId,
        code: 'loop_limit',
        message: `Nådde taket på ${maxIterations} varv. Säg till om jag ska fortsätta.`,
      };
      yield { type: 'run_finished', runId, reason: 'loop_limit' };
    } catch (error) {
      if (input.signal.aborted) {
        yield { type: 'run_finished', runId, reason: 'aborted' };
        return;
      }
      yield {
        type: 'error',
        runId,
        code: 'internal_error',
        message: describeError(error),
        ...(error instanceof Error && error.stack ? { detail: error.stack.slice(0, 2_000) } : {}),
      };
      yield { type: 'run_finished', runId, reason: 'error' };
    }
  }

  /** Strömmar ett modellsvar: yielde:r deltan direkt och returnerar det sammanställda svaret. */
  private async *chatOnce(
    input: RunInput,
    messages: ChatTurnMessage[],
  ): AsyncGenerator<AgentEvent, ChatTurnResult> {
    const accumulator = new ToolCallAccumulator();
    let content = '';
    let reasoning = '';

    for await (const chunk of this.options.transport.chat({
      model: input.model,
      messages,
      tools: this.options.registry.specsForModel(),
      signal: input.signal,
    })) {
      if (chunk.contentDelta) {
        content += chunk.contentDelta;
        yield { type: 'assistant_delta', runId: input.runId, text: chunk.contentDelta };
      }
      if (chunk.reasoningDelta) {
        reasoning += chunk.reasoningDelta;
        yield { type: 'reasoning_delta', runId: input.runId, text: chunk.reasoningDelta };
      }
      if (chunk.toolCallDelta) accumulator.add(chunk.toolCallDelta);
      if (chunk.usage) {
        yield {
          type: 'usage',
          runId: input.runId,
          promptTokens: chunk.usage.promptTokens,
          completionTokens: chunk.usage.completionTokens,
        };
      }
    }

    return { content, reasoning, toolCalls: accumulator.list() };
  }

  /** Hämtar indexerade filer, eller bygger en repo map från disk första gången. */
  private async loadEntries(
    input: RunInput,
  ): Promise<{ entries: IndexedFile[]; fromIndex: boolean }> {
    if (this.options.indexer) {
      const indexed = await this.options.indexer.all();
      if (indexed.length > 0) return { entries: indexed, fromIndex: true };
    }

    if (!this.cachedFallback) {
      const map = (await this.options.repoMapProvider?.()) ?? [];
      this.cachedFallback = map.map((entry) => ({
        path: entry.path,
        hash: '',
        bytes: entry.size,
        lines: entry.lines,
        language: entry.language,
        symbols: entry.symbols,
        imports: entry.imports,
        vector: embed(`${entry.path}\n${entry.symbols.join(' ')}`),
        updatedAt: 0,
      }));
    }

    void input;
    return { entries: this.cachedFallback, fromIndex: false };
  }
}
