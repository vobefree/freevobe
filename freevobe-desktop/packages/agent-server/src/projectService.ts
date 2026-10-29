import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  DoctorReport,
  HookConfig,
  McpServerConfig,
  McpServerStatus,
  Project,
  SkillSummary,
} from '@freevobe/protocol';
import {
  CheckpointService,
  McpManager,
  ProjectIndexer,
  ProjectMemory,
  SkillStore,
  ToolRegistry,
  buildRepoMap,
  loadProjectRules,
  loadProjectSkills,
  mergeSkills,
  loadBuiltinSkills,
  builtinTools,
  parseGitStatus,
  defaultHookTemplates,
  detectTestCommand,
  ensureProjectScaffold,
  formatRepoMap,
  type IndexedFile,
  type Repositories,
  type RuleBundle,
  type GitStatusSummary,
  type Skill,
  type FreevobeDatabase,
} from '@freevobe/agent-core';
import { executeGit } from './gitService.js';
import { runDoctor } from '@freevobe/agent-core';

export interface ProjectWorkspaceOptions {
  project: Project;
  repositories: Repositories;
  db: FreevobeDatabase;
  home: string;
  fetchImpl?: typeof fetch;
  ollamaBaseUrl?: string;
  onMcpStatus?: (status: McpServerStatus) => void;
}

/**
 * Allt som hör till ett öppet projekt: regler, skills, index, verktygsregister, MCP-servrar
 * och projektminne. En instans per öppet projekt, så att flera projekt kan vara öppna samtidigt
 * utan att deras kontext blandas.
 */
export class ProjectWorkspace {
  readonly project: Project;
  readonly registry = new ToolRegistry();
  readonly indexer: ProjectIndexer;
  readonly memory: ProjectMemory;
  readonly skillStore: SkillStore;
  readonly mcp: McpManager;
  /** Checkpoints per projekt: snapshot av filerna innan agenten ändrar dem. */
  readonly checkpoints: CheckpointService;

  private rulesBundle: RuleBundle;
  private skills: Skill[] = [];
  private readonly repositories: Repositories;
  private readonly options: ProjectWorkspaceOptions;

  private constructor(options: ProjectWorkspaceOptions, rules: RuleBundle) {
    this.options = options;
    this.project = options.project;
    this.repositories = options.repositories;
    this.rulesBundle = rules;
    this.memory = new ProjectMemory(options.project.path);
    this.skillStore = new SkillStore({
      root: options.project.path,
      userSkillsDir: path.join(options.home, 'skills'),
    });
    this.indexer = new ProjectIndexer(options.repositories.index);
    this.registry.registerAll(builtinTools);
    this.checkpoints = new CheckpointService({
      db: options.db,
      root: options.project.path,
      home: options.home,
    });
    this.mcp = new McpManager({
      registry: this.registry,
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
      ...(options.onMcpStatus ? { onStatusChange: options.onMcpStatus } : {}),
    });
  }

  static async open(options: ProjectWorkspaceOptions): Promise<ProjectWorkspace> {
    await ensureProjectScaffold(options.project.path, options.project.name);
    const rules = await loadProjectRules(options.project.path);
    const workspace = new ProjectWorkspace(options, rules);
    await workspace.reloadSkills();
    await workspace.mcp.connectEnabled(rules.mcpServers);
    return workspace;
  }

  get root(): string {
    return this.project.path;
  }

  get rules(): RuleBundle {
    return this.rulesBundle;
  }

  get activeSkills(): Skill[] {
    return this.skills;
  }

  async reload(): Promise<void> {
    this.rulesBundle = await loadProjectRules(this.project.path);
    await this.reloadSkills();
  }

  async reloadSkills(): Promise<void> {
    const builtin = await loadBuiltinSkills();
    const project = await loadProjectSkills(this.skillStore.directory);
    this.skills = mergeSkills(builtin, project);
  }

  async listSkills(): Promise<SkillSummary[]> {
    return this.skillStore.list();
  }

  async saveSkill(draft: Parameters<SkillStore['write']>[0]): Promise<string> {
    const file = await this.skillStore.write(draft);
    await this.reloadSkills();
    return file;
  }

  async deleteSkill(name: string): Promise<boolean> {
    const removed = await this.skillStore.remove(name);
    await this.reloadSkills();
    return removed;
  }

  async importSkills(contents: string[]): Promise<string[]> {
    const created = await this.skillStore.importMarkdown(contents);
    await this.reloadSkills();
    return created;
  }

  async exportSkill(name: string): Promise<string | null> {
    return this.skillStore.export(name);
  }

  async copyBuiltinSkills(): Promise<string[]> {
    const created = await this.skillStore.copyBuiltinToProject();
    await this.reloadSkills();
    return created;
  }

  async index(
    onProgress?: (done: number, total: number) => void,
  ): Promise<{ indexed: number; unchanged: number; removed: number; durationMs: number }> {
    const result = await this.indexer.index(this.project.path, {
      ...(onProgress ? { onProgress: (progress) => onProgress(progress.scanned, 0) } : {}),
    });
    return {
      indexed: result.indexed,
      unchanged: result.unchanged,
      removed: result.removed,
      durationMs: result.durationMs,
    };
  }

  async indexedFiles(): Promise<IndexedFile[]> {
    return this.indexer.all();
  }

  async repoMapText(maxChars = 12_000): Promise<string> {
    const entries = await this.indexer.repoMap();
    if (entries.length > 0) return formatRepoMap(entries, maxChars);
    return formatRepoMap(await buildRepoMap(this.project.path), maxChars);
  }

  async fileTree(): Promise<
    Array<{ path: string; size: number; lines: number; language: string; symbols: string[] }>
  > {
    const entries = await this.indexer.repoMap();
    if (entries.length > 0) return entries;
    return buildRepoMap(this.project.path);
  }

  async readFile(relative: string): Promise<{ path: string; content: string; lines: number }> {
    const absolute = path.join(this.project.path, relative);
    const content = await fs.readFile(absolute, 'utf8');
    return { path: relative, content, lines: content.split('\n').length };
  }

  /**
   * Skriver en fil efter att användaren själv redigerat den i editorn. Ingen diff och inget
   * godkännande behövs – användaren är själv upphovspersonen. Sökvägen måste ligga i projektet.
   */
  async writeFileByUser(
    relative: string,
    content: string,
  ): Promise<{ path: string; bytes: number }> {
    const resolved = path.resolve(this.project.path, relative);
    const relativeToRoot = path.relative(this.project.path, resolved);
    if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
      throw new Error('Sökvägen ligger utanför projektet.');
    }
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, content, 'utf8');
    return { path: relativeToRoot.replace(/\\/g, '/'), bytes: Buffer.byteLength(content, 'utf8') };
  }

  async gitStatus(): Promise<GitStatusSummary> {
    const { output } = await executeGit(this.project.path, ['status', '--porcelain=v1', '-b']);
    return parseGitStatus(output);
  }

  async gitDiff(options: { staged?: boolean; ref?: string; file?: string }): Promise<string> {
    const args = ['diff'];
    if (options.staged) args.push('--cached');
    if (options.ref) args.push(options.ref);
    if (options.file) args.push('--', options.file);
    const { output } = await executeGit(this.project.path, args);
    return output;
  }

  async gitBranches(): Promise<string[]> {
    const { output } = await executeGit(this.project.path, [
      'branch',
      '--all',
      '--format=%(refname:short)',
    ]);
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }

  async memoryContent(): Promise<string> {
    return this.memory.read();
  }

  async remember(kind: Parameters<ProjectMemory['remember']>[0], text: string): Promise<void> {
    await this.memory.remember(kind, text);
    await this.reload();
  }

  async saveMemory(content: string): Promise<void> {
    await this.memory.replace(content);
    await this.reload();
  }

  async hooks(): Promise<{ configured: HookConfig[]; templates: HookConfig[] }> {
    return { configured: this.rulesBundle.hooks, templates: defaultHookTemplates() };
  }

  async saveHooks(hooks: HookConfig[]): Promise<HookConfig[]> {
    const file = path.join(this.project.path, '.freevobe', 'hooks.json');
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, `${JSON.stringify(hooks, null, 2)}\n`, 'utf8');
    await this.reload();
    return this.rulesBundle.hooks;
  }

  listMcp(): McpServerConfig[] {
    return this.rulesBundle.mcpServers;
  }

  async saveMcp(servers: McpServerConfig[]): Promise<McpServerConfig[]> {
    const file = path.join(this.project.path, '.freevobe', 'mcp.json');
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, `${JSON.stringify({ mcpServers: servers }, null, 2)}\n`, 'utf8');
    await this.reload();
    await this.mcp.disconnectAll();
    await this.mcp.connectEnabled(this.rulesBundle.mcpServers);
    return this.rulesBundle.mcpServers;
  }

  mcpStatuses(): McpServerStatus[] {
    return this.mcp.statuses(this.rulesBundle.mcpServers);
  }

  async doctor(
    ollamaBaseUrl: string | undefined,
    model: string | undefined,
  ): Promise<DoctorReport> {
    const testCommand = await detectTestCommand(
      this.project.path,
      this.rulesBundle.preferences.testCommand,
    );
    return runDoctor({
      projectRoot: this.project.path,
      freevobeHome: this.options.home,
      ...(ollamaBaseUrl ? { ollamaBaseUrl } : {}),
      ...(model ? { model } : {}),
      mcpServers: this.mcpStatuses(),
      testCommand,
      gitVersion: await gitVersion(),
      indexedFiles: (await this.indexer.all()).length,
    });
  }

  async close(): Promise<void> {
    await this.mcp.disconnectAll();
  }

  get repositoriesRef(): Repositories {
    return this.repositories;
  }
}

async function gitVersion(): Promise<string | undefined> {
  const { output, exitCode } = await executeGit(process.cwd(), ['--version']);
  if (exitCode !== 0) return undefined;
  const version = output.trim();
  return version === '' ? undefined : version;
}
