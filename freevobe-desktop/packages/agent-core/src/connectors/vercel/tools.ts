import fs from 'node:fs/promises';
import path from 'node:path';
import { describeError } from '../../util/errors.js';
import {
  fail,
  numberArg,
  ok,
  stringArg,
  type RegisteredTool,
  type ToolHandler,
} from '../../tools/types.js';
import { VercelClient, deploymentUrl, type VercelDeployment } from './client.js';

export interface VercelToolOptions {
  /** Connectorns token. Skickas bara till Vercel, aldrig till modellen eller loggarna. */
  token: string;
  /** Team som anropen gäller. Utelämnas för personliga konton. */
  teamId?: string;
  fetchImpl?: typeof fetch;
  /** Används av testerna för att peka på en lokal fejkserver. */
  baseUrl?: string;
  /** Projektroten, för att kunna läsa ett env-värde från en fil i stället för chatten. */
  projectRoot: string;
  /** Rapporterar fel till connector-kortet i UI:t. Får aldrig innehålla token. */
  onError?: (message: string) => void;
}

const CONNECTOR = 'vercel';
const DEFAULT_TARGETS = ['production', 'preview'] as const;
const ENV_TARGETS = new Set(['production', 'preview', 'development', 'staging']);

/** Kort, mänsklig titel till godkännandekortet. Verktygets namn står kvar i detaljen. */
const APPROVAL_TITLES: Record<string, string> = {
  vercel_list_projects: 'lista Vercel-projekt',
  vercel_get_project: 'läs Vercel-projekt',
  vercel_create_project: 'skapa Vercel-projekt',
  vercel_deploy: 'deploya till Vercel',
  vercel_get_deployments: 'läs Vercel-deployments',
  vercel_get_deployment_logs: 'läs Vercel-byggloggar',
  vercel_get_env_vars: 'läs Vercel-miljövariabler',
  vercel_set_env_var: 'sätt Vercel-miljövariabel',
  vercel_delete_env_var: 'radera Vercel-miljövariabel',
  vercel_get_domains: 'läs Vercel-domäner',
  vercel_add_domain: 'lägg till Vercel-domän',
};

/** Argumenten som visas i godkännandet – ett env-värde maskas alltid. */
function approvalDetail(name: string, args: Record<string, unknown>): string {
  const shown: Record<string, unknown> = { ...args };
  if ('value' in shown) shown.value = '•••• (dolt)';
  return `Verktyg: ${name}\n${JSON.stringify(shown, null, 2).slice(0, 1_500)}`;
}

function statusLine(deployment: VercelDeployment): string {
  const parts = [`Status: ${deployment.readyState ?? 'okänd'}`];
  if (deployment.target === 'production') parts.push('mål: produktion');
  else if (deployment.target) parts.push(`mål: ${deployment.target}`);
  else parts.push('mål: preview');
  if (deployment.inspectorUrl) parts.push(`inspektör: ${deployment.inspectorUrl}`);
  return parts.join(' · ');
}

function deploymentLine(deployment: VercelDeployment): string {
  const url = deploymentUrl(deployment.url);
  return `- ${url} · ${deployment.readyState ?? 'okänd'} · ${deployment.id}`;
}

function envTargets(args: Record<string, unknown>): string[] {
  const raw = args.targets;
  const list = Array.isArray(raw) ? raw.map(String) : typeof raw === 'string' ? [raw] : [];
  const filtered = list
    .map((value) => value.trim().toLowerCase())
    .filter((value) => ENV_TARGETS.has(value));
  return filtered.length > 0 ? [...new Set(filtered)] : [...DEFAULT_TARGETS];
}

/** Läser ett env-värde från en fil i projektet. Sökvägen får inte lämna projektroten. */
async function readValueFromFile(
  root: string,
  file: string,
  key: string,
): Promise<{ value: string } | { error: string }> {
  const resolved = path.resolve(root, file);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return { error: `Filen "${file}" ligger utanför projektet.` };
  }
  let content: string;
  try {
    content = await fs.readFile(resolved, 'utf8');
  } catch {
    return { error: `Kunde inte läsa "${file}".` };
  }

  // .env-filer: plocka raden för nyckeln. Andra filer: hela innehållet.
  const lines = content.split('\n');
  for (const line of lines) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (match?.[1] === key) {
      const raw = (match[2] ?? '').trim();
      return { value: raw.replace(/^(['"])(.*)\1$/, '$2').replace(/\\n$/, '') };
    }
  }
  const trimmed = content.replace(/\r\n/g, '\n').trim();
  if (!trimmed) return { error: `Filen "${file}" är tom.` };
  return { value: trimmed };
}

export function vercelTools(options: VercelToolOptions): RegisteredTool[] {
  const client = new VercelClient({
    token: options.token,
    ...(options.teamId ? { teamId: options.teamId } : {}),
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    ...(options.baseUrl ? { baseUrl: options.baseUrl } : {}),
  });

  /**
   * Ett Vercel-fel får aldrig kasta vidare ut i loopen: det blir ett tydligt verktygssvar och
   * samtidigt en rad i connector-kortet, så att användaren ser att token eller behörigheten är slut.
   */
  const guard =
    (handler: ToolHandler): ToolHandler =>
    async (args, ctx) => {
      try {
        return await handler(args, ctx);
      } catch (error) {
        const message = describeError(error);
        options.onError?.(message);
        return fail(`Vercel-anropet misslyckades: ${message}`);
      }
    };

  const tool = (spec: RegisteredTool['spec'], handler: ToolHandler): RegisteredTool => ({
    spec: { ...spec, source: 'connector', connectorId: CONNECTOR },
    handler: guard(async (args, ctx) => {
      // Lokala verktygshandlers ansvarar själva för godkännandet. Policyn har redan avgjort om det
      // behövs; här visas ett kort med verktygets namn och de (maskade) argumenten.
      if (ctx.approval.required) {
        const outcome = await ctx.requestApproval({
          kind: 'network',
          title: `Vercel: ${APPROVAL_TITLES[spec.name] ?? spec.name}`,
          detail: approvalDetail(spec.name, args),
          reason: ctx.approval.reason,
          risk: ctx.approval.risk,
          hardBlock: ctx.approval.hardBlock,
          command: spec.name,
        });
        if (!outcome.approved) return fail(`Användaren avvisade ${spec.name}.`);
      }
      return handler(args, ctx);
    }),
  });

  const projectArg = (args: Record<string, unknown>): string | null =>
    stringArg(args, 'project') ?? stringArg(args, 'projectId');

  return [
    tool(
      {
        name: 'vercel_list_projects',
        description:
          'Listar Vercel-projekt för kontot eller teamet med id, namn och ramverk. Skickar inga filer.',
        parameters: {
          type: 'object',
          properties: {
            limit: { type: 'integer', description: 'Max antal projekt (1–100).', default: 20 },
          },
        },
        danger: 'network',
        source: 'connector',
      },
      async (args) => {
        const limit = Math.min(Math.max(numberArg(args, 'limit', 20), 1), 100);
        const projects = await client.listProjects(limit);
        if (projects.length === 0) return ok('Vercel returnerade inga projekt.');
        const lines = projects.map(
          (project) =>
            `- ${project.name} (${project.id})${project.framework ? ` · ${project.framework}` : ''}${
              project.link?.type ? ` · git: ${project.link.type}` : ' · inget git-repo'
            }`,
        );
        return ok(`${projects.length} projekt:\n${lines.join('\n')}`, { count: projects.length });
      },
    ),

    tool(
      {
        name: 'vercel_get_project',
        description:
          'Hämtar ett Vercel-projekt: namn, ramverk, git-länk och när det skapades. Används innan deploy.',
        parameters: {
          type: 'object',
          properties: {
            project: { type: 'string', description: 'Projektets id eller namn.' },
          },
          required: ['project'],
        },
        danger: 'network',
        source: 'connector',
      },
      async (args) => {
        const projectArgValue = projectArg(args);
        if (!projectArgValue) return fail('Argumentet "project" saknas.');
        const project = await client.getProject(projectArgValue);
        const link = project.link;
        const lines = [
          `Projekt: ${project.name} (${project.id})`,
          `Ramverk: ${project.framework ?? 'okänt'}`,
          link?.type
            ? `Git: ${link.type}${link.org ? ` · ${link.org}/${link.repo ?? ''}` : ''}${
                link.productionBranch ? ` · produktionsgren ${link.productionBranch}` : ''
              }`
            : 'Git: inget repo kopplat – deploy kräver att du kopplar repot i Vercel först.',
        ];
        return ok(lines.join('\n'), {
          projectId: project.id,
          name: project.name,
          hasGitLink: Boolean(link?.type),
        });
      },
    ),

    tool(
      {
        name: 'vercel_create_project',
        description:
          'Skapar ett tomt Vercel-projekt. Kräver godkännande. Koppla git-repot i Vercel innan du deployar.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Projektnamn (används i URL:en).' },
            framework: {
              type: 'string',
              description: 'Ramverk, t.ex. "nextjs", "vite" eller "other".',
            },
          },
          required: ['name'],
        },
        danger: 'write',
        source: 'connector',
        alwaysRequiresApproval: true,
      },
      async (args) => {
        const name = stringArg(args, 'name');
        if (!name) return fail('Argumentet "name" saknas.');
        const framework = stringArg(args, 'framework') ?? undefined;
        const project = await client.createProject({
          name,
          ...(framework ? { framework } : {}),
        });
        return ok(
          `Projektet ${project.name} skapades (${project.id}).\nNästa steg: koppla git-repot i Vercel, sedan kan vercel_deploy användas.`,
          { projectId: project.id, name: project.name },
        );
      },
    ),

    tool(
      {
        name: 'vercel_deploy',
        description:
          'Startar en deploy av ett Vercel-projekt från dess git-repo. Standard är preview; produktion kräver ett extra godkännande. Returnerar URL och status – byggloggar hämtas med vercel_get_deployment_logs.',
        parameters: {
          type: 'object',
          properties: {
            project: { type: 'string', description: 'Projektets id eller namn.' },
            target: {
              type: 'string',
              enum: ['preview', 'production'],
              default: 'preview',
              description: 'preview (standard) eller production (kräver extra godkännande).',
            },
            ref: {
              type: 'string',
              description: 'Git-gren eller commit. Standard är projektets produktionsgren.',
            },
          },
          required: ['project'],
        },
        danger: 'execute',
        source: 'connector',
        alwaysRequiresApproval: true,
      },
      async (args, ctx) => {
        const projectArgValue = projectArg(args);
        if (!projectArgValue) return fail('Argumentet "project" saknas.');
        const target = args.target === 'production' ? 'production' : 'preview';
        const ref = stringArg(args, 'ref') ?? undefined;

        if (target === 'production') {
          // Extra steg utöver det vanliga godkännandet: produktion publiceras aldrig av misstag.
          const outcome = await ctx.requestApproval({
            kind: 'terminal',
            title: 'Publicera till produktion?',
            detail: [
              `Projekt: ${projectArgValue}`,
              `Mål: produktion (alla domäner pekar om)`,
              ref ? `Git-ref: ${ref}` : 'Git-ref: projektets produktionsgren',
              '',
              'Det här påverkar riktiga användare. Godkänn bara om du granskat ändringarna.',
            ].join('\n'),
            reason: 'Produktionsdeploy kräver ett extra godkännande utöver det vanliga.',
            risk: 'high',
            hardBlock: true,
            command: 'vercel deploy --prod',
          });
          if (!outcome.approved) {
            return fail(
              'Produktionsdeploy avbröts: det extra godkännandet gavs inte. Ingen deployment skapades.',
            );
          }
        }

        const deployment = await client.createDeployment({
          project: projectArgValue,
          target,
          ...(ref ? { ref } : {}),
        });
        const url = deploymentUrl(deployment.url);
        const lines = [
          `Deploy skapad mot ${target}: ${url}`,
          statusLine(deployment),
          '',
          'Bygget körs hos Vercel. Hämta byggloggar med vercel_get_deployment_logs och deploymentId ovan.',
        ];
        return ok(lines.join('\n'), {
          deploymentId: deployment.id,
          url,
          target,
          readyState: deployment.readyState ?? null,
        });
      },
    ),

    tool(
      {
        name: 'vercel_get_deployments',
        description: 'Listar de senaste deploymenterna för ett projekt med status och URL.',
        parameters: {
          type: 'object',
          properties: {
            project: { type: 'string', description: 'Projektets id eller namn.' },
            limit: { type: 'integer', description: 'Max antal (1–50).', default: 10 },
          },
          required: ['project'],
        },
        danger: 'network',
        source: 'connector',
      },
      async (args) => {
        const projectArgValue = projectArg(args);
        if (!projectArgValue) return fail('Argumentet "project" saknas.');
        const project = await client.getProject(projectArgValue);
        const limit = Math.min(Math.max(numberArg(args, 'limit', 10), 1), 50);
        const deployments = await client.listDeployments(project.id, limit);
        if (deployments.length === 0) return ok(`Inga deployments för ${project.name} än.`);
        return ok(
          `${deployments.length} deployments för ${project.name}:\n${deployments
            .map(deploymentLine)
            .join('\n')}`,
          { count: deployments.length },
        );
      },
    ),

    tool(
      {
        name: 'vercel_get_deployment_logs',
        description:
          'Hämtar byggloggar för en deployment som text. Används efter vercel_deploy för att visa vad bygget gjorde.',
        parameters: {
          type: 'object',
          properties: {
            deploymentId: { type: 'string', description: 'Deployment-id (dpl_...) eller URL.' },
            limit: { type: 'integer', description: 'Max antal händelser (1–500).', default: 200 },
          },
          required: ['deploymentId'],
        },
        danger: 'network',
        source: 'connector',
      },
      async (args) => {
        const id = stringArg(args, 'deploymentId');
        if (!id) return fail('Argumentet "deploymentId" saknas.');
        const limit = Math.min(Math.max(numberArg(args, 'limit', 200), 1), 500);
        const deployment = await client.getDeployment(id);
        const logs = await client.buildLogs(id, limit);
        if (!logs.trim()) {
          return ok(
            `Inga byggloggar än för ${deployment.id} (status ${deployment.readyState ?? 'okänd'}).`,
            { deploymentId: deployment.id, lines: 0 },
          );
        }
        return ok(
          `Byggloggar för ${deployment.id} (${deployment.readyState ?? 'okänd'}):\n${logs}`,
          { deploymentId: deployment.id, lines: logs.split('\n').length },
        );
      },
    ),

    tool(
      {
        name: 'vercel_get_env_vars',
        description:
          'Listar projektets miljövariabler: nyckel, miljöer och typ. Värdena hämtas aldrig och visas aldrig.',
        parameters: {
          type: 'object',
          properties: {
            project: { type: 'string', description: 'Projektets id eller namn.' },
          },
          required: ['project'],
        },
        danger: 'network',
        source: 'connector',
      },
      async (args) => {
        const projectArgValue = projectArg(args);
        if (!projectArgValue) return fail('Argumentet "project" saknas.');
        const project = await client.getProject(projectArgValue);
        const envs = await client.listEnvVars(project.id);
        if (envs.length === 0) return ok(`Inga miljövariabler i ${project.name}.`);
        const lines = envs.map(
          (entry) =>
            `- ${entry.key} · ${(entry.target ?? []).join(', ') || 'okänd miljö'} · ${entry.type ?? 'okänd typ'}`,
        );
        return ok(
          `${envs.length} miljövariabler i ${project.name} (värden visas aldrig):\n${lines.join('\n')}`,
          { count: envs.length },
        );
      },
    ),

    tool(
      {
        name: 'vercel_set_env_var',
        description:
          'Sätter eller uppdaterar en miljövariabel. Skicka värdet med "value", eller med "valueFromFile" (t.ex. .env.local) så att hemligheten aldrig hamnar i chatten. Kräver godkännande.',
        parameters: {
          type: 'object',
          properties: {
            project: { type: 'string', description: 'Projektets id eller namn.' },
            key: { type: 'string', description: 'Variabelns namn, t.ex. DATABASE_URL.' },
            value: { type: 'string', description: 'Värde. Utelämna om du använder valueFromFile.' },
            valueFromFile: {
              type: 'string',
              description:
                'Projektrelativ fil att läsa värdet från (stödjer .env-rader med KEY=...).',
            },
            targets: {
              type: 'array',
              items: { type: 'string', enum: ['production', 'preview', 'development'] },
              description: 'Miljöer. Standard är production och preview.',
            },
          },
          required: ['project', 'key'],
        },
        danger: 'write',
        source: 'connector',
        alwaysRequiresApproval: true,
      },
      async (args) => {
        const projectArgValue = projectArg(args);
        if (!projectArgValue) return fail('Argumentet "project" saknas.');
        const key = stringArg(args, 'key');
        if (!key) return fail('Argumentet "key" saknas.');

        const inline = stringArg(args, 'value');
        const file = stringArg(args, 'valueFromFile');
        if (!inline && !file) {
          return fail(
            'Ange ett värde: "value" för ett icke-hemligt värde, eller "valueFromFile" för att läsa det från en fil i projektet.',
          );
        }

        let value = inline ?? '';
        let source: 'inline' | 'file' = 'inline';
        if (file) {
          const read = await readValueFromFile(options.projectRoot, file, key);
          if ('error' in read) return fail(read.error);
          value = read.value;
          source = 'file';
        }
        if (!value.trim()) return fail('Värdet är tomt.');

        const project = await client.getProject(projectArgValue);
        const saved = await client.setEnvVar(project.id, {
          key,
          value,
          targets: envTargets(args),
        });
        return ok(
          [
            `Miljövariabeln ${key} sparades i ${project.name} för ${(saved.target ?? envTargets(args)).join(', ')}.`,
            'Värdet skickades direkt till Vercel och visas aldrig här.',
            saved.id ? `Id: ${saved.id}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
          { key, envId: saved.id, targets: saved.target ?? envTargets(args), valueSource: source },
        );
      },
    ),

    tool(
      {
        name: 'vercel_delete_env_var',
        description:
          'Raderar en miljövariabel, antingen med id eller med nyckel (då tas alla poster med nyckeln bort). Destruktivt: kräver godkännande.',
        parameters: {
          type: 'object',
          properties: {
            project: { type: 'string', description: 'Projektets id eller namn.' },
            envId: { type: 'string', description: 'Postens id från vercel_get_env_vars.' },
            key: { type: 'string', description: 'Variabelnamn, om id saknas.' },
          },
          required: ['project'],
        },
        danger: 'write',
        source: 'connector',
        alwaysRequiresApproval: true,
      },
      async (args, ctx) => {
        const projectArgValue = projectArg(args);
        if (!projectArgValue) return fail('Argumentet "project" saknas.');
        const envId = stringArg(args, 'envId');
        const key = stringArg(args, 'key');
        if (!envId && !key) return fail('Ange "envId" eller "key".');

        const project = await client.getProject(projectArgValue);
        const envs = await client.listEnvVars(project.id);
        const targets = envId
          ? envs.filter((entry) => entry.id === envId)
          : envs.filter((entry) => entry.key === key);
        if (targets.length === 0) {
          return fail(
            `Hittade ingen miljövariabel ${envId ? `med id ${envId}` : `med nyckeln ${key}`} i ${project.name}.`,
          );
        }

        // Ett extra ja även när policyn redan frågat: borttagning går inte att ångra.
        const outcome = await ctx.requestApproval({
          kind: 'terminal',
          title: `Radera miljövariabeln ${key ?? envId}?`,
          detail: [
            `Projekt: ${project.name}`,
            `Poster: ${targets.length}`,
            `Miljöer: ${[...new Set(targets.flatMap((entry) => entry.target ?? []))].join(', ') || 'okända'}`,
            '',
            'Variabeln försvinner från nästa deployment och kan inte återställas.',
          ].join('\n'),
          reason: 'Borttagning av miljövariabler kan inte ångras.',
          risk: 'high',
          hardBlock: true,
          command: `vercel env rm ${key ?? envId}`,
        });
        if (!outcome.approved) return fail('Borttagningen avbröts: inget raderades.');

        for (const entry of targets) await client.deleteEnvVar(project.id, entry.id);
        return ok(`Raderade ${targets.length} post(er) för ${key ?? envId} i ${project.name}.`, {
          removed: targets.length,
        });
      },
    ),

    tool(
      {
        name: 'vercel_get_domains',
        description: 'Listar domäner som är kopplade till projektet och om de är verifierade.',
        parameters: {
          type: 'object',
          properties: {
            project: { type: 'string', description: 'Projektets id eller namn.' },
          },
          required: ['project'],
        },
        danger: 'network',
        source: 'connector',
      },
      async (args) => {
        const projectArgValue = projectArg(args);
        if (!projectArgValue) return fail('Argumentet "project" saknas.');
        const project = await client.getProject(projectArgValue);
        const domains = await client.listDomains(project.id);
        if (domains.length === 0) return ok(`Inga egna domäner i ${project.name}.`);
        return ok(
          `${domains.length} domäner i ${project.name}:\n${domains
            .map(
              (domain) => `- ${domain.name} · ${domain.verified ? 'verifierad' : 'ej verifierad'}`,
            )
            .join('\n')}`,
          { count: domains.length },
        );
      },
    ),

    tool(
      {
        name: 'vercel_add_domain',
        description:
          'Kopplar en domän till projektet. Kräver godkännande. DNS-poster måste sedan sättas hos domänleverantören.',
        parameters: {
          type: 'object',
          properties: {
            project: { type: 'string', description: 'Projektets id eller namn.' },
            domain: { type: 'string', description: 'Domännamn, t.ex. app.example.com.' },
          },
          required: ['project', 'domain'],
        },
        danger: 'write',
        source: 'connector',
        alwaysRequiresApproval: true,
      },
      async (args) => {
        const projectArgValue = projectArg(args);
        if (!projectArgValue) return fail('Argumentet "project" saknas.');
        const domain = stringArg(args, 'domain');
        if (!domain) return fail('Argumentet "domain" saknas.');
        const project = await client.getProject(projectArgValue);
        const added = await client.addDomain(project.id, domain);
        return ok(
          [
            `Domänen ${added.name || domain} lades till i ${project.name}.`,
            added.verified === false
              ? 'Status: ej verifierad – sätt DNS-posten hos domänleverantören och verifiera i Vercel.'
              : 'Status: verifierad.',
          ].join('\n'),
          { domain: added.name || domain, verified: added.verified ?? null },
        );
      },
    ),
  ];
}
