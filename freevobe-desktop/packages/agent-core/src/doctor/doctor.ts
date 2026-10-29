import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { DoctorCheck, DoctorReport, McpServerStatus } from '@freevobe/protocol';
import { statfs } from 'node:fs/promises';
import { OllamaClient } from '../ollama/client.js';
import { describeError } from '../util/errors.js';

export interface DoctorOptions {
  projectRoot?: string;
  freevobeHome?: string;
  ollamaBaseUrl?: string;
  model?: string;
  mcpServers?: McpServerStatus[];
  /** Minimal fri disk i megabyte innan varning. */
  minimumFreeDiskMb?: number;
  /** Testkommando som projektet hittar, om något. */
  testCommand?: string | null;
  /** Om git finns i PATH. */
  gitVersion?: string;
  /** Om ett index finns för projektet. */
  indexedFiles?: number;
}

const REQUIRED_NODE_MAJOR = 22;
const REQUIRED_NODE_MINOR = 5;

/**
 * "Doctor"-läget: kontrollerar att maskinen och projektet är redo. Varje kontroll ger ett
 * tydligt svar och, när något saknas, ett förslag på åtgärd. Ingen kontroll kastar.
 */
export async function runDoctor(options: DoctorOptions = {}): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [];

  checks.push(checkNode());

  const home = options.freevobeHome ?? path.join(os.homedir(), '.freevobe');
  checks.push(await checkWritableDirectory(home));

  if (options.projectRoot) {
    checks.push(await checkProjectRoot(options.projectRoot));
    checks.push(await checkDiskSpace(options.projectRoot, options.minimumFreeDiskMb ?? 512));
  }

  checks.push(checkGit(options.gitVersion));
  checks.push(checkTestCommand(options.testCommand ?? null));

  const ollama = await checkOllama(options.ollamaBaseUrl, options.model);
  checks.push(...ollama);

  if (options.mcpServers) {
    for (const server of options.mcpServers) {
      checks.push({
        id: `mcp-${server.id}`,
        label: `MCP: ${server.serverName ?? server.id}`,
        status: server.connected ? 'ok' : 'warn',
        detail: server.connected
          ? `ansluten med ${server.toolCount} verktyg (${server.protocolVersion ?? 'okänd version'})`
          : (server.error ?? 'inte ansluten'),
        ...(server.connected
          ? {}
          : { fix: 'Kontrollera kommandot eller adressen i .freevobe/mcp.json.' }),
      });
    }
  }

  if (options.indexedFiles !== undefined) {
    checks.push({
      id: 'project-index',
      label: 'Projektindex',
      status: options.indexedFiles > 0 ? 'ok' : 'warn',
      detail:
        options.indexedFiles > 0 ? `${options.indexedFiles} filer indexerade` : 'inget index ännu',
      ...(options.indexedFiles > 0
        ? {}
        : { fix: 'Öppna projektet i Freevobe – indexeringen startar automatiskt.' }),
    });
  }

  const summary = {
    ok: checks.filter((check) => check.status === 'ok').length,
    warn: checks.filter((check) => check.status === 'warn').length,
    fail: checks.filter((check) => check.status === 'fail').length,
  };

  return { generatedAt: Date.now(), checks, summary };
}

function checkNode(): DoctorCheck {
  const [major = 0, minor = 0] = process.versions.node.split('.').map(Number);
  const ok =
    major > REQUIRED_NODE_MAJOR || (major === REQUIRED_NODE_MAJOR && minor >= REQUIRED_NODE_MINOR);
  return {
    id: 'node',
    label: 'Node.js',
    status: ok ? 'ok' : 'fail',
    detail: `v${process.versions.node}`,
    ...(ok
      ? {}
      : {
          fix: `Freevobe kräver Node ${REQUIRED_NODE_MAJOR}.${REQUIRED_NODE_MINOR} eller senare (node:sqlite).`,
        }),
  };
}

async function checkWritableDirectory(directory: string): Promise<DoctorCheck> {
  const probe = path.join(directory, `.freevobe-skrivtest-${process.pid}`);
  try {
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(probe, 'ok', 'utf8');
    await fs.rm(probe, { force: true });
    return {
      id: 'freevobe-home',
      label: 'Lokal datamapp',
      status: 'ok',
      detail: `${directory} är skrivbar`,
    };
  } catch (error) {
    return {
      id: 'freevobe-home',
      label: 'Lokal datamapp',
      status: 'fail',
      detail: describeError(error),
      fix: 'Kontrollera behörigheterna för mappen, eller sätt FREEVOBE_HOME till en plats du äger.',
    };
  }
}

async function checkProjectRoot(root: string): Promise<DoctorCheck> {
  try {
    const stats = await fs.stat(root);
    if (!stats.isDirectory()) {
      return {
        id: 'project',
        label: 'Projektmapp',
        status: 'fail',
        detail: `${root} är inte en mapp.`,
      };
    }
    const entries = await fs.readdir(root);
    return {
      id: 'project',
      label: 'Projektmapp',
      status: entries.length > 0 ? 'ok' : 'warn',
      detail: `${root} (${entries.length} poster)`,
      ...(entries.length === 0 ? { fix: 'Mappen är tom. Öppna ett projekt med kod i.' } : {}),
    };
  } catch (error) {
    return {
      id: 'project',
      label: 'Projektmapp',
      status: 'fail',
      detail: describeError(error),
      fix: 'Välj en mapp som finns och som du har läsrättighet till.',
    };
  }
}

async function checkDiskSpace(root: string, minimumFreeMb: number): Promise<DoctorCheck> {
  try {
    const stats = await statfs(root);
    const freeMb = Math.round((stats.bavail * stats.bsize) / (1024 * 1024));
    return {
      id: 'disk',
      label: 'Ledigt diskutrymme',
      status: freeMb >= minimumFreeMb ? 'ok' : 'warn',
      detail: `${freeMb} MB ledigt`,
      ...(freeMb >= minimumFreeMb
        ? {}
        : { fix: `Mindre än ${minimumFreeMb} MB kvar. Städa eller välj en annan plats.` }),
    };
  } catch (error) {
    return {
      id: 'disk',
      label: 'Ledigt diskutrymme',
      status: 'warn',
      detail: describeError(error),
    };
  }
}

function checkGit(version?: string): DoctorCheck {
  if (!version) {
    return {
      id: 'git',
      label: 'Git',
      status: 'warn',
      detail: 'hittades inte i PATH',
      fix: 'Installera git om du vill kunna visa diffar, committa och skapa brancher.',
    };
  }
  return { id: 'git', label: 'Git', status: 'ok', detail: version };
}

function checkTestCommand(command: string | null): DoctorCheck {
  return command
    ? { id: 'test-command', label: 'Testkommando', status: 'ok', detail: command }
    : {
        id: 'test-command',
        label: 'Testkommando',
        status: 'warn',
        detail: 'inget testkommando hittades',
        fix: 'Lägg till ett "test"-skript i package.json, eller ange ett i .freevobe/preferences.json.',
      };
}

async function checkOllama(baseUrl?: string, model?: string): Promise<DoctorCheck[]> {
  const client = new OllamaClient({ ...(baseUrl ? { baseUrl } : {}), timeoutMs: 4_000 });
  const probe = await client.probe();

  if (!probe.available) {
    return [
      {
        id: 'ollama',
        label: 'Ollama',
        status: 'fail',
        detail: probe.error ?? 'svarar inte',
        fix: `Starta Ollama och öppna ${probe.helpUrl} om du behöver hjälp.`,
      },
    ];
  }

  const checks: DoctorCheck[] = [
    {
      id: 'ollama',
      label: 'Ollama',
      status: 'ok',
      detail: `${probe.baseUrl} (v${probe.version ?? 'okänd'}), ${probe.models.length} modeller`,
    },
  ];

  if (model) {
    const found = probe.models.find((entry) => entry.name === model);
    if (!found) {
      checks.push({
        id: 'ollama-model',
        label: 'Vald modell',
        status: 'fail',
        detail: `${model} är inte installerad`,
        fix: `Kör: ollama pull ${model}`,
      });
    } else {
      checks.push({
        id: 'ollama-model',
        label: 'Vald modell',
        status: found.supportsTools ? 'ok' : 'warn',
        detail: `${found.name} (${found.parameterSize}, kontext ${found.contextLength || 'okänd'})`,
        ...(found.supportsTools
          ? {}
          : {
              fix: 'Modellen saknar verktygsstöd. Freevobe kan fortfarande arbeta, men agenten får svårare att ändra filer. Välj en modell som stödjer verktyg.',
            }),
      });
    }
  }

  return checks;
}

export function formatDoctorReport(report: DoctorReport): string {
  const icon = (status: DoctorCheck['status']) =>
    status === 'ok' ? '✓' : status === 'warn' ? '!' : '✗';
  const lines = report.checks.map((check) => {
    const base = `${icon(check.status)} ${check.label}: ${check.detail}`;
    return check.fix ? `${base}\n    → ${check.fix}` : base;
  });
  lines.push(
    '',
    `${report.summary.ok} ok, ${report.summary.warn} varningar, ${report.summary.fail} fel`,
  );
  return lines.join('\n');
}
