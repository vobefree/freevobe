import path from 'node:path';
import type {
  ApprovalAnswer,
  ConnectorsResponse,
  HookConfig,
  McpServerConfig,
  PermissionMode,
  SubagentKind,
  VerificationKind,
} from '@freevobe/protocol';
import { FREEVOBE_PROTOCOL_VERSION } from '@freevobe/protocol';
import { defaultMcpExamples } from '@freevobe/agent-core';
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
      protocol: FREEVOBE_PROTOCOL_VERSION,
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

    // ---- Gives Back: frivillig välgörenhet, ingen reklam och inga pengar genom appen.
    route('GET', '/api/gives-back', ({ hub, url }) =>
      hub.givesBack(Number(url.searchParams.get('limit') ?? 200) || 200),
    ),
    route('POST', '/api/gives-back', async ({ hub, body }) => {
      const payload = (await body()) as {
        causeId?: unknown;
        amountSek?: unknown;
        note?: unknown;
      };
      const causeId = await requireString(payload, 'causeId');
      if (payload.amountSek !== undefined && typeof payload.amountSek !== 'number') {
        throw new Error('Fältet "amountSek" måste vara ett tal.');
      }
      if (payload.note !== undefined && typeof payload.note !== 'string') {
        throw new Error('Fältet "note" måste vara en sträng.');
      }
      return hub.addContribution({
        causeId,
        ...(typeof payload.amountSek === 'number' ? { amountSek: payload.amountSek } : {}),
        ...(typeof payload.note === 'string' ? { note: payload.note } : {}),
      });
    }),
    route('DELETE', '/api/gives-back/:id', ({ hub, params }) =>
      hub.removeContribution(params.id as string),
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

    // ---- connectors: opt-in-bryggor till externa tjänster. Token lämnar aldrig servern.
    route('GET', '/api/projects/:projectId/connectors', ({ hub, params }) => {
      const projectId = hub.requireWorkspace(params.projectId as string).project.id;
      const payload: ConnectorsResponse = {
        connectors: hub.connectors.list(projectId),
        storage: hub.connectors.storage,
      };
      return payload;
    }),
    route(
      'POST',
      '/api/projects/:projectId/connectors/:connectorId/connect',
      async ({ hub, params, body }) => {
        const projectId = hub.requireWorkspace(params.projectId as string).project.id;
        const payload = (await body()) as { secret?: unknown; accountLabel?: unknown };
        if (payload.secret !== undefined && typeof payload.secret !== 'string') {
          throw new Error('Fältet "secret" måste vara en sträng.');
        }
        if (payload.accountLabel !== undefined && typeof payload.accountLabel !== 'string') {
          throw new Error('Fältet "accountLabel" måste vara en sträng.');
        }
        const view = hub.connectors.connect(projectId, params.connectorId as string, {
          ...(typeof payload.secret === 'string' ? { secret: payload.secret } : {}),
          ...(typeof payload.accountLabel === 'string'
            ? { accountLabel: payload.accountLabel }
            : {}),
        });
        // Verktygen ska finnas direkt efter anslutningen, utan att projektet öppnas om.
        hub.requireWorkspace(projectId).syncConnectorTools();
        return view;
      },
    ),
    route('DELETE', '/api/projects/:projectId/connectors/:connectorId', ({ hub, params }) => {
      const result = hub.connectors.disconnect(
        params.projectId as string,
        params.connectorId as string,
      );
      hub.requireWorkspace(params.projectId as string).syncConnectorTools();
      return result;
    }),
    route(
      'PATCH',
      '/api/projects/:projectId/connectors/:connectorId',
      async ({ hub, params, body }) => {
        const projectId = hub.requireWorkspace(params.projectId as string).project.id;
        const payload = (await body()) as { enabled?: unknown };
        if (typeof payload.enabled !== 'boolean') {
          throw new Error('Fältet "enabled" måste vara sant eller falskt.');
        }
        const view = hub.connectors.setEnabled(
          projectId,
          params.connectorId as string,
          payload.enabled,
        );
        hub.requireWorkspace(projectId).syncConnectorTools();
        return view;
      },
    ),

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

    // ---- verifiering (typkontroll, lint, tester, bygge)
    route('GET', '/api/projects/:projectId/verification', async ({ hub, params }) => ({
      commands: await hub.verificationCommands(params.projectId as string),
    })),
    route('POST', '/api/projects/:projectId/verification', async ({ hub, params, body }) => {
      const payload = (await body()) as { kinds?: VerificationKind[] };
      return hub.verifyProject(params.projectId as string, {
        trigger: 'manual',
        ...(payload.kinds ? { kinds: payload.kinds } : {}),
      });
    }),
    route('GET', '/api/projects/:projectId/verifications', ({ hub, params, url }) =>
      hub.listVerifications(
        params.projectId as string,
        Number(url.searchParams.get('limit') ?? 20) || 20,
      ),
    ),

    // ---- checkpoints (lokala ångra-punkter, oberoende av Git)
    route('GET', '/api/projects/:projectId/checkpoints', ({ hub, params }) =>
      hub.listCheckpoints(params.projectId as string),
    ),
    route('POST', '/api/projects/:projectId/checkpoints', async ({ hub, params, body }) => {
      const payload = (await body()) as { label?: string };
      return hub.createCheckpoint(params.projectId as string, payload.label);
    }),
    route('GET', '/api/checkpoints/:checkpointId', ({ hub, params }) =>
      hub.checkpoint(params.checkpointId as string),
    ),
    route('GET', '/api/checkpoints/:checkpointId/diff', ({ hub, params }) =>
      hub.checkpointDiff(params.checkpointId as string),
    ),
    route('POST', '/api/checkpoints/:checkpointId/restore', async ({ hub, params, body }) => {
      const payload = (await body()) as { force?: boolean };
      return hub.restoreCheckpoint(params.checkpointId as string, {
        force: payload.force === true,
      });
    }),
    route('POST', '/api/checkpoints/:checkpointId/commit', async ({ hub, params, body }) => {
      const payload = (await body()) as { message?: string };
      return hub.commitCheckpoint(params.checkpointId as string, payload.message);
    }),
    route('DELETE', '/api/checkpoints/:checkpointId', async ({ hub, params }) => ({
      discarded: await hub.discardCheckpoint(params.checkpointId as string),
    })),

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
    route('GET', '/api/sessions/:sessionId/plans', ({ hub, params }) =>
      hub.listPlans(params.sessionId as string),
    ),
    route('GET', '/api/plans/:planId', ({ hub, params }) => {
      const plan = hub.plan(params.planId as string);
      if (!plan) throw new Error(`Planen ${params.planId} finns inte.`);
      return plan;
    }),
    /** Användarens beslut. Godkännande växlar sessionen till Execute-läget. */
    route('POST', '/api/plans/:planId/decision', async ({ hub, params, body }) => {
      const payload = (await body()) as { decision?: string };
      const plan = hub.decidePlan(
        params.planId as string,
        payload.decision === 'rejected' ? 'rejected' : 'approved',
      );
      if (!plan) throw new Error(`Planen ${params.planId} finns inte.`);
      return plan;
    }),
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
