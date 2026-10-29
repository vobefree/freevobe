import type { AgentEvent, PermissionMode, SubagentKind, SubagentStatus } from '@freevobe/protocol';
import { ToolRegistry } from '../tools/registry.js';
import type { ToolRuntime } from '../agent/runtime.js';
import { AgentLoop } from '../agent/loop.js';
import type { RepoMapEntryLike } from '../agent/loop.js';
import type { ChatTransport } from '../ollama/types.js';
import type { RuleBundle } from '../rules/loader.js';
import type { Skill } from '../skills/loader.js';
import type { ProjectIndexer } from '../context/indexer.js';
import type { BrowserDriver } from '../tools/browser.js';
import { describeError } from '../util/errors.js';
import { createId } from '../util/ids.js';
import {
  buildSubagentTask,
  getSubagentDefinition,
  type SubagentDefinition,
} from './definitions.js';

export interface SubagentRunnerOptions {
  transport: ChatTransport;
  registry: ToolRegistry;
  runtime: ToolRuntime;
  rules: RuleBundle;
  skills: Skill[];
  model: string;
  permissionMode: PermissionMode;
  supportsTools?: boolean;
  indexer?: ProjectIndexer;
  repoMapProvider?: () => Promise<RepoMapEntryLike[]>;
  browserAutomationEnabled?: boolean;
  browser?: BrowserDriver;
  /** Referensdata som subagenten kan få med sig (t.ex. den aktuella diffen). */
  hints?: string[];
}

export interface SubagentRunInput {
  kind: SubagentKind;
  task: string;
  label?: string;
  signal: AbortSignal;
  onEvent?: (event: AgentEvent) => void;
  onStatus?: (status: SubagentStatus) => void;
}

export interface SubagentRunResult {
  id: string;
  kind: SubagentKind;
  status: SubagentStatus['status'];
  summary: string;
  toolCalls: number;
  iterations: number;
  durationMs: number;
  events: AgentEvent[];
  error?: string;
}

const MAX_SUMMARY_CHARS = 3_000;

/**
 * Kör subagenter med isolerad kontext. Subagenten ser aldrig huvudagentens samtal – bara sin
 * egen uppgift och de ledtrådar den får – och returnerar en kort sammanfattning.
 *
 * Behörighetsregel: subagenten får aldrig mer än `auto-edit`. Filändringar kan därmed ske
 * automatiskt om användaren valt det, men kommandon kräver alltid godkännande.
 */
export class SubagentRunner {
  private readonly options: SubagentRunnerOptions;
  private readonly active = new Map<string, SubagentStatus>();

  constructor(options: SubagentRunnerOptions) {
    this.options = options;
  }

  get activeStatuses(): SubagentStatus[] {
    return [...this.active.values()];
  }

  /** Verktygsuppsättning per subagent – allt annat är otillgängligt för den. */
  private registryFor(definition: SubagentDefinition): ToolRegistry {
    const registry = new ToolRegistry();
    for (const spec of this.options.registry.list()) {
      if (definition.allowedTools.includes(spec.name) || spec.source === 'mcp') {
        const tool = this.options.registry.get(spec.name);
        if (tool) registry.register(tool);
      }
    }
    return registry;
  }

  effectivePermissionMode(): PermissionMode {
    // Aldrig mer än auto-edit: kommandon ska kräva godkännande.
    if (
      this.options.permissionMode === 'ask' ||
      this.options.permissionMode === 'full-auto' ||
      this.options.permissionMode === 'auto-run'
    ) {
      return this.options.permissionMode === 'full-auto'
        ? 'auto-edit'
        : this.options.permissionMode;
    }
    return 'auto-edit';
  }

  async run(input: SubagentRunInput): Promise<SubagentRunResult> {
    const definition = getSubagentDefinition(input.kind);
    const id = createId(`sub_${input.kind}`);
    const startedAt = Date.now();
    const status: SubagentStatus = {
      id,
      runId: id,
      kind: input.kind,
      label: input.label ?? definition.label,
      status: 'running',
      startedAt,
    };
    this.active.set(id, status);
    input.onStatus?.(status);

    const events: AgentEvent[] = [];
    const emit = (event: AgentEvent) => {
      events.push(event);
      input.onEvent?.(event);
    };

    let summary = '';
    let toolCalls = 0;
    let iterations = 0;
    let finalStatus: SubagentStatus['status'] = 'done';
    let error: string | undefined;

    try {
      const loop = new AgentLoop({
        transport: this.options.transport,
        registry: this.registryFor(definition),
        runtime: this.options.runtime,
        rules: { ...this.options.rules },
        skills: this.options.skills,
        ...(this.options.indexer ? { indexer: this.options.indexer } : {}),
        ...(this.options.repoMapProvider ? { repoMapProvider: this.options.repoMapProvider } : {}),
        contextBudgetChars: definition.contextBudgetChars,
        maxIterations: definition.maxIterations,
        browserAutomationEnabled: this.options.browserAutomationEnabled ?? false,
        ...(this.options.browser ? { browser: this.options.browser } : {}),
        mcpServerApproved: () => false,
      });

      for await (const event of loop.run({
        runId: id,
        sessionId: `subagent:${input.kind}`,
        mode: 'execute',
        permissionMode: this.effectivePermissionMode(),
        model: this.options.model,
        userMessage: buildSubagentTask(input.kind, input.task, this.options.hints),
        history: [],
        signal: input.signal,
        supportsTools: this.options.supportsTools ?? true,
        projectName: definition.label,
      })) {
        emit(event);
        if (event.type === 'assistant_message') {
          summary = event.text;
          iterations += 1;
        }
        if (event.type === 'tool_call') toolCalls += 1;
        if (event.type === 'status' && event.phase === 'thinking') iterations += 1;
        if (event.type === 'run_finished') {
          if (event.reason === 'aborted') finalStatus = 'aborted';
          else if (event.reason === 'error') finalStatus = 'failed';
        }
        if (event.type === 'error') {
          error = event.message;
          if (event.code !== 'approval_rejected') finalStatus = 'failed';
        }
      }
    } catch (caught) {
      finalStatus = 'failed';
      error = describeError(caught);
    }

    const result: SubagentRunResult = {
      id,
      kind: input.kind,
      status: finalStatus,
      summary: summarize(summary),
      toolCalls,
      iterations,
      durationMs: Date.now() - startedAt,
      events,
      ...(error ? { error } : {}),
    };

    const finishedStatus: SubagentStatus = {
      ...status,
      status: finalStatus,
      summary: result.summary,
      finishedAt: Date.now(),
    };
    this.active.set(id, finishedStatus);
    input.onStatus?.(finishedStatus);

    return result;
  }

  /**
   * Kör flera subagenter. Lässubagenter körs parallellt; så snart någon får skriva körs de i tur
   * och ordning, så att två agenter aldrig redigerar samma fil samtidigt.
   */
  async runMany(inputs: SubagentRunInput[]): Promise<SubagentRunResult[]> {
    const allReadOnly = inputs.every((input) => getSubagentDefinition(input.kind).readOnly);
    this.options.hints = this.options.hints ?? [];

    if (allReadOnly && inputs.length > 1) {
      return Promise.all(inputs.map((input) => this.run(input)));
    }

    const results: SubagentRunResult[] = [];
    for (const input of inputs) {
      results.push(await this.run(input));
    }
    return results;
  }
}

/** Klipper och städar subagentens svar till en användbar sammanfattning. */
export function summarize(text: string): string {
  const cleaned = text.trim();
  if (cleaned === '') return '(ingen sammanfattning lämnades)';
  if (cleaned.length <= MAX_SUMMARY_CHARS) return cleaned;

  const marker = cleaned.search(/##\s*Sammanfattning/i);
  if (marker !== -1) {
    return cleaned.slice(marker).slice(0, MAX_SUMMARY_CHARS);
  }
  return `${cleaned.slice(0, MAX_SUMMARY_CHARS)}\n… (nedkortad)`;
}
