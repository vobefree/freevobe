import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type {
  AgentEvent,
  ApprovalCategory,
  PermissionMode,
  Plan,
  ToolResult,
} from '@freevobe/protocol';
import { DEFAULT_CONTEXT_BUDGET_CHARS, DEFAULT_MAX_ITERATIONS } from '@freevobe/protocol';
import type { ToolRegistry } from '../tools/registry.js';
import type { ApprovalPolicy } from '../tools/types.js';
import { evaluateToolCall, type PolicyContext, type PolicyDecision } from '../security/policy.js';
import { buildContextBlock, selectContext } from '../context/selector.js';
import { embed } from '../context/embedding.js';
import type { IndexedFile, ProjectIndexer } from '../context/indexer.js';
import { activateSkills, type Skill } from '../skills/loader.js';
import type { RuleBundle } from '../rules/loader.js';
import {
  ToolCallAccumulator,
  parseTextualToolCalls,
  stripTextualToolCalls,
} from '../ollama/openai.js';
import { ContentStreamGuard } from '../ollama/textGuard.js';
import type {
  ChatChunk,
  ChatToolCall,
  ChatTransport,
  ChatTurnMessage,
} from '../ollama/types.js';
import { describeError } from '../util/errors.js';
import { createId } from '../util/ids.js';
import { buildSystemPrompt } from './prompt.js';
import { PROPOSE_PLAN_TOOL_NAME, createPlan, parsePlanDraft, planScopeViolation } from './plan.js';
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
  /** Kategorier användaren valt att auto-godkänna i inställningarna. */
  autoApprove?: Partial<Record<ApprovalCategory, boolean>>;
  browser?: BrowserDriver;
  osLabel?: string;
  /**
   * Hur länge ett modellsvar får dröja innan chatten säger att modellen laddas in.
   * En varm modell svarar inom några hundra millisekunder, så standardvärdet syns bara när
   * Ollama faktiskt måste läsa in modellen först.
   */
  firstTokenNoticeMs?: number;
}

const DEFAULT_FIRST_TOKEN_NOTICE_MS = 1_500;

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
  /** Godkänd plan som gäller som kontrakt för den här körningen. */
  plan?: Plan;
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
        ...(input.plan ? { plan: input.plan } : {}),
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
        ...(this.options.autoApprove ? { autoApprove: this.options.autoApprove } : {}),
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
        let content = turn.content;
        let textualCall = false;

        // Lokala modeller skriver ibland anropet som JSON i texten i stället för att fylla i
        // tool_calls – även när de uppger stöd för verktyg. Då tolkas blocket här, annars
        // stannar körningen på rå JSON och inget händer.
        if (toolCalls.length === 0 && content.trim() !== '') {
          const parsed = parseTextualToolCalls(content, {
            isToolName: (name) => this.options.registry.has(name),
          });
          if (parsed.length > 0) {
            toolCalls = parsed.map((call) => ({
              id: createId('call'),
              name: call.name,
              args: call.args,
              rawArguments: JSON.stringify(call.args),
            }));
            content = stripTextualToolCalls(content, parsed);
            textualCall = true;
          }
        }

        if (content.trim() !== '' || toolCalls.length > 0) {
          messages.push({
            role: 'assistant',
            content,
            ...(toolCalls.length > 0 ? { toolCalls } : {}),
          });
          // Ett varv som bara innehåller verktygsanrop har ingen text – då ska chatten inte få
          // en tom pratbubbla (t.ex. när modellen bara lägger fram en plan).
          if (content.trim() !== '') {
            yield {
              type: 'assistant_message',
              runId,
              text: content,
              messageId: createId('msg'),
            };
          } else if (textualCall) {
            // Anropet strömmades som text. Utan den här händelsen blir rå JSON kvar i bubblan
            // tills körningen tar slut.
            yield { type: 'assistant_reset', runId };
          }
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

          const policyDecision = evaluateToolCall({ spec, args: call.args }, policyContext);
          // Den godkända planen är ett kontrakt: en filändring utanför den kräver alltid ett
          // personligt ja, oavsett behörighetsläge och auto-godkända kategorier.
          const deviation = planScopeViolation(input.plan, spec, call.args);
          const decision =
            deviation && policyDecision.effect !== 'block'
              ? ({
                  effect: 'require-approval' as const,
                  risk: 'medium' as const,
                  // Filändringens kort bygger sin egen detaljtext, så planens filer måste stå
                  // i orsaken för att användaren ska se vad kontraktet omfattar.
                  reason: `${deviation.path} ligger utanför den godkända planen (${deviation.allowed.join(', ')}).`,
                  hardBlock: false,
                } satisfies PolicyDecision)
              : policyDecision;
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

          // Planen skapas av loopen, inte av verktyget: den ska bära sessionens och körningens
          // id och bli en händelse som UI:t kan visa och användaren kan godkänna.
          let planReady = false;
          if (result.ok && call.name === PROPOSE_PLAN_TOOL_NAME) {
            const parsed = parsePlanDraft(call.args);
            if (parsed.ok) {
              yield {
                type: 'plan_proposed',
                runId,
                plan: createPlan(parsed.draft, { sessionId: input.sessionId, runId }),
              };
              // I Plan-läget är planen körningens resultat: agenten ska inte fortsätta skriva.
              planReady = input.mode === 'plan';
            }
          }

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

          if (planReady) {
            yield { type: 'status', runId, phase: 'done' };
            yield { type: 'run_finished', runId, reason: 'plan-ready' };
            return;
          }
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
    // Håller tillbaka text som kan visa sig vara ett verktygsanrop, så att rå JSON aldrig
    // hinner synas i chatten medan modellen skriver den.
    const guard = new ContentStreamGuard({
      isToolName: (name) => this.options.registry.has(name),
    });
    let content = '';
    let reasoning = '';

    const stream = this.options.transport.chat({
      model: input.model,
      messages,
      tools: this.options.registry.specsForModel(),
      signal: input.signal,
    })[Symbol.asyncIterator]();

    const first = await this.awaitFirstChunk(stream);
    let step: IteratorResult<ChatChunk>;
    if (first.kind === 'slow') {
      yield {
        type: 'status',
        runId: input.runId,
        phase: 'loading-model',
        message: `Laddar ${input.model}`,
      };
      step = await first.pending;
    } else if (first.kind === 'error') {
      throw first.error;
    } else {
      step = first.result;
    }

    while (!step.done) {
      const chunk: ChatChunk = step.value;
      if (chunk.contentDelta) {
        content += chunk.contentDelta;
        const visible = guard.push(chunk.contentDelta);
        if (visible !== '') {
          yield { type: 'assistant_delta', runId: input.runId, text: visible };
        }
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

      step = await stream.next();
    }

    return { content, reasoning, toolCalls: accumulator.list() };
  }

  /**
   * Hämtar första chunken, men väntar inte i tysthet: Ollama laddar in hela modellen innan
   * första token kommer, och en kall 7B kan ta en minut. Då säger chatten att modellen laddas i
   * stället för att stå tom, så väntetiden aldrig ser ut som en hängning.
   */
  private async awaitFirstChunk(
    stream: AsyncIterator<ChatChunk>,
  ): Promise<
    | { kind: 'chunk'; result: IteratorResult<ChatChunk> }
    | { kind: 'error'; error: unknown }
    | { kind: 'slow'; pending: Promise<IteratorResult<ChatChunk>> }
  > {
    const pending = stream.next();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const noticeMs = this.options.firstTokenNoticeMs ?? DEFAULT_FIRST_TOKEN_NOTICE_MS;

    const delayed = new Promise<'slow'>((resolve) => {
      timer = setTimeout(() => resolve('slow'), noticeMs);
    });

    const outcome = await Promise.race([
      // Både värde och fel tas om hand, så att en sen avvisning inte blir en obehandlad promise.
      pending.then(
        (result) => ({ kind: 'chunk' as const, result }),
        (error: unknown) => ({ kind: 'error' as const, error }),
      ),
      delayed.then(() => ({ kind: 'slow' as const })),
    ]);
    if (timer !== undefined) clearTimeout(timer);

    if (outcome.kind === 'slow') return { kind: 'slow', pending };
    return outcome;
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
