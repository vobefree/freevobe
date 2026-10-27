#!/usr/bin/env node
/**
 * VibeForge Doctor som kommandoradsverktyg.
 *
 *   npm run doctor                                   # kontrollerar aktuell mapp
 *   node packages/agent-core/bin/vibeforge-doctor.mjs --project "C:\\kod\\projekt"
 *   node packages/agent-core/bin/vibeforge-doctor.mjs --json
 *
 * Samma kontroller som Doctor-knappen i appen: Node, Git, Ollama, vald modell, diskutrymme,
 * skrivbar datamapp och testkommando. Exitkod 1 om något är rött, så den kan användas i CI.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { register } from 'node:module';
import { promisify } from 'node:util';

register(new URL('../../../scripts/ts-resolve.mjs', import.meta.url));

const { runDoctor } = await import('../src/doctor/doctor.ts');

const execFileAsync = promisify(execFile);
const SYMBOL = { ok: '✓', warn: '!', fail: '✗' };

function parseArgs(argv) {
  const options = { project: undefined, json: false, model: undefined, ollamaUrl: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') options.json = true;
    else if (arg === '--project') options.project = argv[++index];
    else if (arg === '--model') options.model = argv[++index];
    else if (arg === '--ollama') options.ollamaUrl = argv[++index];
  }
  return options;
}

/** Läser git-versionen om git finns i PATH. Returnerar undefined annars. */
async function detectGit() {
  try {
    const { stdout } = await execFileAsync('git', ['--version'], { timeout: 5_000 });
    return stdout.trim();
  } catch {
    return undefined;
  }
}

/** Hittar projektets testkommando i package.json. */
async function detectTestCommand(root) {
  try {
    const raw = await fs.readFile(path.join(root, 'package.json'), 'utf8');
    const test = JSON.parse(raw).scripts?.test;
    return typeof test === 'string' && test.trim() !== '' ? test : null;
  } catch {
    return null;
  }
}

const options = parseArgs(process.argv.slice(2));
const projectPath = path.resolve(options.project ?? process.cwd());
const gitVersion = await detectGit();
const testCommand = await detectTestCommand(projectPath);

const report = await runDoctor({
  projectRoot: projectPath,
  ...(gitVersion ? { gitVersion } : {}),
  testCommand,
  ...(options.model ? { model: options.model } : {}),
  ...(options.ollamaUrl ? { ollamaBaseUrl: options.ollamaUrl } : {}),
});

if (options.json) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  process.stdout.write(`\nVibeForge Doctor – ${projectPath}\n\n`);
  for (const check of report.checks) {
    process.stdout.write(`${SYMBOL[check.status] ?? '?'} ${check.label}: ${check.detail}\n`);
    if (check.fix) process.stdout.write(`   åtgärd: ${check.fix}\n`);
  }
  process.stdout.write(
    `\n${report.summary.ok} ok · ${report.summary.warn} varningar · ${report.summary.fail} fel\n\n`,
  );
}

// Sätt exitkoden i stället för process.exit: då hinner Node stänga sina handtag innan
// processen avslutas.
process.exitCode = report.summary.fail > 0 ? 1 : 0;
