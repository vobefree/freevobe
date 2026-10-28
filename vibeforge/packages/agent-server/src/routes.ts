import path from 'node:path';
import type {
  ApprovalAnswer,
  HookConfig,
  McpServerConfig,
  PermissionMode,
  SubagentKind,
} from '@vibeforge/protocol';
import { VIBEFORGE_PROTOCOL_VERSION } from '@vibeforge/protocol';
import { defaultMcpExamples } from '@vibeforge/agent-core';
import type { AgentSessionHub } from './sessionHub.js';

export interface RouteContext {
  hub: AgentSessionHub;
  url: URL;
  method: string;
  params: Record<string, string>;
  body: () => Promise<unknown>;
  /**
   * Skickar en SSE-ström till klienten. `start` får en skrivfunktion och kopplar upp
   * prenumerationen; `stop` städar när anslutningen stängs.
   */
  stream: (start: (write: (chunk: string) => void) => void, stop: () => void) => void;
}

export interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: (context: RouteContext) => Promise<unknown> | unknown;
}

function route(method: string, template: string, handler: Route['handler']): Route {
  const keys: string[] = [];
  const pattern = new RegExp(
    `^${template.replace(/:([A-Za-z]+)/g, (_match, key: string) => {
      keys.push(key);
      return '([^/]+)';
    })}$`,
  );
  return { method, pattern, keys, handler };
}

async function requireString(body: unknown, key: string): Promise<string> {
  const value = (body as Record<string, unknown> | null)?.[key];
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`Fältet "${key}" saknas.`);
  return value;
}

/** Hela API-ytan. Varje väg är liten och gör en sak; all logik bor i hubben. */
export function createRoutes(serverInfo: { port: number; devMode: boolean }): Route[] {
  return [
    route('GET', '/api/health', () => ({
      ok: true,
      name: 'Freevobe Agent',
      protocol: VIBEFORGE_PROTOCOL_VERSION,
      port: serverInfo.port,
      node: process.versions.node,
      uptimeSeconds: Math.round(process.uptime()),
    })),

    route('GET', '/api/settings', ({ hub }) => hub.settings()),
    route('PATCH', '/api/settings', async ({ hub, body }) =>
      hub.updateSettings((await body()) as never),
    ),

    route('GET', '/api/ollama', ({ hub, url }) =>
      hub.probeOllama(url.searchParams.get('baseUrl') ?? undefined),
    ),

    route('GET', '/api/projects', ({ hub }) => hub.listProjects()),
    route('POST', '/api/projects', async ({ hub, body }) => {
      const payload = (await body()) as { path?: string; name?: string; index?: boolean };
      const projectPath = await requireString(payload, 'path');
      const workspace = await hub.openProject(projectPath, payload.name);
      if (payload.index !== false) await workspace.index();
      return {
        project: workspace.project,
        rules: workspace.rules.sources,
        indexed: (await workspace.indexedFiles()).length,
      };
    }),
    route('DELETE', '/api/projects/:projectId', async ({ hub, params }) => {
      await hub.closeProject(params.projectId as string);
      return { ok: true };
    }),
    route('PATCH', '/api/projects/:projectId', async ({ hub, params, body }) => {
      const payload = (await body()) as { permissionMode?: PermissionMode; name?: string };
      const projectId = params.projectId as string;
      const workspace = hub.requireWorkspace(projectId);
      if (payload.permissionMode) {
        hub.repositories.projects.setPermissionMode(projectId, payload.permissionMode);
        // Håll den cachade projektposten i synk så att UI:t ser ändringen direkt.
        workspace.project.permissionMode = payload.permissionMode;
      }
      if (payload.name) {
        hub.repositories.projects.upsert(hub.requireWorkspace(projectId).root, payload.name);
      }
      return hub.repositories.projects.findById(projectId);
    }),
    route('POST', '/api/projects/:projectId/index', async ({ hub, params }) => {
      const workspace = hub.requireWorkspace(params.projectId as string);
      return workspace.index();
    }),
    route('GET', '/api/projects/:projectId/tree', ({ hub, params }) =>
      hub.requireWorkspace(params.projectId as string).fileTree(),
    ),
    route('GET', '/api/projects/:projectId/repomap', async ({ hub, params, url }) => {
      const maxChars = Number(url.searchParams.get('maxChars') ?? 12_000);
      return { text: await hub.requireWorkspace(params.projectId as string).repoMapText(maxChars) };
    }),
    route('GET', '/api/projects/:projectId/context', async ({ hub, params }) => {
      const workspace = hub.requireWorkspace(params.projectId as string);
      const files = await workspace.indexedFiles();
      return {
        indexedFiles: files.length,
        files: files.map((file) => ({
          path: file.path,
          language: file.language,
          lines: file.lines,
          symbols: file.symbols.slice(0, 8),
          bytes: file.bytes,
        })),
      };
    }),
    route('GET', '/api/projects/:projectId/doctor', ({ hub, params }) =>
      hub.doctor(params.projectId as string),
    ),
    route('DELETE', '/api/projects/:projectId/index', async ({ hub, params }) => {
      const workspace = hub.requireWorkspace(params.projectId as string);
      await workspace.repositoriesRef.index.clear();
      return { ok: true };
    }),

    // ---- skills
    route('GET', '/api/projects/:projectId/skills', ({ hub, params }) =>
      hub.requireWorkspace(params.projectId as string).listSkills(),
    ),
    route('POST', '/api/projects/:projectId/skills', async ({ hub, params, body }) => {
      const file = await hub
        .requireWorkspace(params.projectId as string)
        .saveSkill((await body()) as never);
      return { file };
    }),
    route('DELETE', '/api/projects/:projectId/skills/:name', async ({ hub, params }) => ({
      removed: await hub
        .requireWorkspace(params.projectId as string)
        .deleteSkill(decodeURIComponent(params.name as string)),
    })),
    route('GET', '/api/projects/:projectId/skills/:name/export', async ({ hub, params }) => ({
      markdown: await hub
        .requireWorkspace(params.projectId as string)
        .exportSkill(decodeURIComponent(params.name as string)),
    })),
    route('POST', '/api/projects/:projectId/skills/import', async ({ hub, params, body }) => {
      const payload = (await body()) as { contents?: string[] };
      const created = await hub
        .requireWorkspace(params.projectId as string)
        .importSkills(payload.contents ?? []);
      return { created };
    }),
    route('POST', '/api/projects/:projectId/skills/copy-builtin', async ({ hub, params }) => ({
      created: await hub.requireWorkspace(params.projectId as string).copyBuiltinSkills(),
    })),

    // ---- MCP
    route('GET', '/api/projects/:projectId/mcp', ({ hub, params }) => {
      const workspace = hub.requireWorkspace(params.projectId as string);
      return {
        servers: workspace.listMcp(),
        statuses: workspace.mcpStatuses(),
        examples: defaultMcpExamples(),
      };
    }),
    route('PUT', '/api/projects/:projectId/mcp', async ({ hub, params, body }) => {
      const payload = (await body()) as { servers?: McpServerConfig[] };
      return {
        servers: await hub
          .requireWorkspace(params.projectId as string)
          .saveMcp(payload.servers ?? []),
      };
    }),
    route('POST', '/api/projects/:projectId/mcp/:serverId/connect', async ({ hub, params }) => {
      const workspace = hub.requireWorkspace(params.projectId as string);
      const config = workspace.listMcp().find((server) => server.id === params.serverId);
      if (!config)
        throw new Error(`MCP-servern ${params.serverId} finns inte i projektets konfiguration.`);
      return workspace.mcp.connect({ ...config, enabled: true });
    }),
    route('DELETE', '/api/projects/:projectId/mcp/:serverId', async ({ hub, params }) => {
      await hub
        .requireWorkspace(params.projectId as string)
        .mcp.disconnect(params.serverId as string);
      return { ok: true };
    }),
    route('POST', '/api/projects/:projectId/mcp/:serverId/approve', ({ hub, params }) => {
      hub.requireWorkspace(params.projectId as string).mcp.approve(params.serverId as string);
      return { ok: true };
    }),

    // ---- minne, regler, hooks
    route('GET', '/api/projects/:projectId/memory', async ({ hub, params }) => ({
      content: await hub.requireWorkspace(params.projectId as string).memoryContent(),
      rules: hub.requireWorkspace(params.projectId as string).rules.sources,
    })),
    route('PUT', '/api/projects/:projectId/memory', async ({ hub, params, body }) => {
      const payload = (await body()) as { content?: string };
      await hub.requireWorkspace(params.projectId as string).saveMemory(payload.content ?? '');
      return { ok: true };
    }),
    route('POST', '/api/projects/:projectId/memory/remember', async ({ hub, params, body }) => {
      const payload = (await body()) as { kind?: string; text?: string };
      const text = await requireString(payload, 'text');
      await hub
        .requireWorkspace(params.projectId as string)
        .remember((payload.kind ?? 'decision') as never, text);
      return { ok: true };
    }),
    route('GET', '/api/projects/:projectId/hooks', ({ hub, params }) =>
      hub.requireWorkspace(params.projectId as string).hooks(),
    ),
    route('PUT', '/api/projects/:projectId/hooks', async ({ hub, params, body }) => {
      const payload = (await body()) as { hooks?: HookConfig[] };
      return {
        hooks: await hub
          .requireWorkspace(params.projectId as string)
          .saveHooks(payload.hooks ?? []),
      };
    }),

    // ---- git och filer
    route('GET', '/api/projects/:projectId/git/status', ({ hub, params }) =>
      hub.requireWorkspace(params.projectId as string).gitStatus(),
    ),
    route('GET', '/api/projects/:projectId/git/branches', ({ hub, params }) =>
      hub.requireWorkspace(params.projectId as string).gitBranches(),
    ),
    route('GET', '/api/projects/:projectId/git/diff', ({ hub, params, url }) =>
      hub
        .requireWorkspace(params.projectId as string)
        .gitDiff({
          staged: url.searchParams.get('staged') === '1',
          ...(url.searchParams.get('ref') ? { ref: url.searchParams.get('ref') as string } : {}),
          ...(url.searchParams.get('file') ? { file: url.searchParams.get('file') as string } : {}),
        })
        .then((text) => ({ diff: text })),
    ),
    route('POST', '/api/projects/:projectId/git/commit', async ({ hub, params, body }) => {
      const payload = (await body()) as { message?: string; files?: string[] };
      return hub.commit(params.projectId as string, payload.message, payload.files);
    }),
    route('POST', '/api/projects/:projectId/git/commit-message', async ({ hub, params, body }) => {
      const payload = (await body()) as { diff?: string };
      const workspace = hub.requireWorkspace(params.projectId as string);
      const diff = payload.diff ?? (await workspace.gitDiff({ staged: true }));
      return { message: await hub.suggestCommitMessage(params.projectId as string, diff) };
    }),
    route('GET', '/api/projects/:projectId/file', async ({ hub, params, url }) => {
      const relative = url.searchParams.get('path');
      if (!relative) throw new Error('Query-parametern "path" saknas.');
      return hub.requireWorkspace(params.projectId as string).readFile(relative);
    }),
    route('PUT', '/api/projects/:projectId/file', async ({ hub, params, body }) => {
      const payload = (await body()) as { path?: string; content?: string };
      const relative = await requireString(payload, 'path');
      return hub
        .requireWorkspace(params.projectId as string)
        .writeFileByUser(relative, payload.content ?? '');
    }),
    route('POST', '/api/projects/:projectId/reveal', async ({ hub, params, body }) => {
      // Används av UI:t för att visa en sökväg i operativsystemet. Servern rör inte disk här.
      const payload = (await body()) as { path?: string };
      const workspace = hub.requireWorkspace(params.projectId as string);
      return { absolutePath: path.join(workspace.root, payload.path ?? '') };
    }),

    // ---- sessioner
    route('GET', '/api/sessions', ({ hub, url }) => {
      const projectId = url.searchParams.get('projectId');
      if (!projectId) throw new Error('Query-parametern "projectId" saknas.');
      return hub.listSessions(projectId);
    }),
    route('POST', '/api/sessions', async ({ hub, body }) => {
      const payload = (await body()) as {
        projectId?: string;
        title?: string;
        model?: string;
        mode?: 'plan' | 'execute';
      };
      const projectId = await requireString(payload, 'projectId');
      return hub.createSession(projectId, payload.title ?? 'Ny chatt', payload.model, payload.mode);
    }),
    route('GET', '/api/sessions/:sessionId', ({ hub, params }) =>
      hub.session(params.sessionId as string),
    ),
    route('PATCH', '/api/sessions/:sessionId', async ({ hub, params, body }) => {
      hub.updateSession(params.sessionId as string, (await body()) as never);
      return hub.session(params.sessionId as string);
    }),
    route('DELETE', '/api/sessions/:sessionId', ({ hub, params }) => {
      hub.deleteSession(params.sessionId as string);
      return { ok: true };
    }),
    route('GET', '/api/sessions/:sessionId/messages', ({ hub, params }) =>
      hub.messages(params.sessionId as string),
    ),
    route('GET', '/api/sessions/:sessionId/tasks', ({ hub, params }) =>
      hub.taskList(params.sessionId as string),
    ),
    route('POST', '/api/sessions/:sessionId/tasks', async ({ hub, params, body }) => {
      const payload = (await body()) as { title?: string };
      return hub.addTask(params.sessionId as string, await requireString(payload, 'title'));
    }),
    route('PATCH', '/api/tasks/:taskId', async ({ hub, params, body }) => {
      const payload = (await body()) as { status?: string };
      hub.setTaskStatus(params.taskId as string, (payload.status ?? 'todo') as never);
      return { ok: true };
    }),
    route('DELETE', '/api/tasks/:taskId', ({ hub, params }) => {
      hub.removeTask(params.taskId as string);
      return { ok: true };
    }),

    // ---- körningar och godkännanden
    route('GET', '/api/runs', ({ hub }) => hub.activeRuns()),
    route('POST', '/api/runs/:runId/abort', ({ hub, params }) => ({
      aborted: hub.abort(params.runId as string),
    })),
    route('GET', '/api/approvals', ({ hub, url }) =>
      hub.pendingApprovals(url.searchParams.get('runId') ?? undefined),
    ),
    route('POST', '/api/approvals/:approvalId', async ({ hub, params, body }) => {
      const payload = (await body()) as Partial<ApprovalAnswer>;
      const resolved = hub.resolveApproval(params.approvalId as string, {
        decision: payload.decision === 'rejected' ? 'rejected' : 'approved',
        ...(payload.answers ? { answers: payload.answers } : {}),
      });
      return { resolved };
    }),

    route('GET', '/api/tools', ({ hub, url }) => {
      const projectId = url.searchParams.get('projectId');
      if (!projectId) throw new Error('Query-parametern "projectId" saknas.');
      return hub.requireWorkspace(projectId).registry.list();
    }),
    route('GET', '/api/subagents', ({ hub }) => hub.subagentDefinitions()),
    route('POST', '/api/subagents/run', async ({ hub, body }) => {
      const payload = (await body()) as {
        projectId?: string;
        kind?: SubagentKind;
        task?: string;
        sessionId?: string;
      };
      const projectId = await requireString(payload, 'projectId');
      const task = await requireString(payload, 'task');
      return hub.runSubagent(
        projectId,
        (payload.kind ?? 'explorer') as SubagentKind,
        task,
        payload.sessionId ?? 'panel',
      );
    }),
    route('GET', '/api/doctor', ({ hub, url }) =>
      hub.doctor(url.searchParams.get('projectId') ?? undefined),
    ),

    /**
     * Startar en körning och svarar direkt med runId. Klienten öppnar sedan
     * `GET /api/runs/:runId/events` för händelseströmmen. Tidiga händelser går inte förlorade:
     * hubben buffrar dem och spelar upp dem för den som prenumererar.
     */
    route('POST', '/api/chat', async ({ hub, body }) => {
      const payload = (await body()) as {
        sessionId?: string;
        prompt?: string;
        model?: string;
        mode?: 'plan' | 'execute';
        permissionMode?: PermissionMode;
        pinnedFiles?: string[];
      };
      const sessionId = await requireString(payload, 'sessionId');
      const prompt = await requireString(payload, 'prompt');

      const run = hub.startRun({
        sessionId,
        prompt,
        ...(payload.model ? { model: payload.model } : {}),
        ...(payload.mode ? { mode: payload.mode } : {}),
        ...(payload.permissionMode ? { permissionMode: payload.permissionMode } : {}),
        ...(payload.pinnedFiles ? { pinnedFiles: payload.pinnedFiles } : {}),
      });

      return { runId: run.runId, eventsUrl: `/api/runs/${run.runId}/events` };
    }),
    route('GET', '/api/runs/:runId/events', ({ hub, params, stream }) => {
      const runId = params.runId as string;
      let unsubscribe: () => void = () => undefined;
      stream(
        (write) => {
          unsubscribe = hub.subscribe(runId, (event) => {
            write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
          });
          write(': ansluten\n\n');
        },
        () => unsubscribe(),
      );
      return undefined;
    }),
  ];
}
