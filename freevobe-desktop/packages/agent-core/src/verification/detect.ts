import fs from 'node:fs/promises';
import path from 'node:path';
import type { VerificationCommand, VerificationKind } from '@freevobe/protocol';

export interface VerificationDetectDeps {
  readFile: (absolutePath: string) => Promise<string | null>;
  exists: (absolutePath: string) => Promise<boolean>;
}

const defaultDeps: VerificationDetectDeps = {
  async readFile(absolutePath) {
    try {
      return await fs.readFile(absolutePath, 'utf8');
    } catch {
      return null;
    }
  },
  async exists(absolutePath) {
    try {
      await fs.access(absolutePath);
      return true;
    } catch {
      return false;
    }
  },
};

const LABELS: Record<VerificationKind, string> = {
  typecheck: 'Typkontroll',
  lint: 'Lint',
  test: 'Tester',
  build: 'Bygge',
  custom: 'Eget steg',
};

/** Ordningen som stegen körs i: typfel först, bygget sist. */
const KIND_ORDER: VerificationKind[] = ['typecheck', 'lint', 'test', 'build', 'custom'];

/** Skriptnamn i package.json som räknas som respektive steg. Första träffen vinner. */
const NPM_SCRIPT_NAMES: Record<Exclude<VerificationKind, 'custom'>, string[]> = {
  typecheck: ['typecheck', 'type-check', 'tsc', 'check-types'],
  lint: ['lint', 'eslint'],
  test: ['test', 'test:unit', 'vitest', 'jest'],
  build: ['build', 'compile'],
};

function packageManager(manifest: unknown): 'npm' | 'pnpm' | 'yarn' | 'bun' {
  if (manifest && typeof manifest === 'object') {
    const field = (manifest as { packageManager?: unknown }).packageManager;
    if (typeof field === 'string') {
      if (field.startsWith('pnpm')) return 'pnpm';
      if (field.startsWith('yarn')) return 'yarn';
      if (field.startsWith('bun')) return 'bun';
    }
  }
  return 'npm';
}

function scriptCommand(manager: 'npm' | 'pnpm' | 'yarn' | 'bun', script: string): string {
  return manager === 'npm' ? `npm run ${script} --silent` : `${manager} run ${script}`;
}

async function detectNodeCommands(
  root: string,
  deps: VerificationDetectDeps,
): Promise<VerificationCommand[]> {
  const raw = await deps.readFile(path.join(root, 'package.json'));
  if (!raw) return [];

  let manifest: { scripts?: Record<string, string>; packageManager?: string } = {};
  try {
    manifest = JSON.parse(raw) as typeof manifest;
  } catch {
    return [];
  }

  const scripts = manifest.scripts ?? {};
  const manager = packageManager(manifest);
  const commands: VerificationCommand[] = [];

  for (const [kind, candidates] of Object.entries(NPM_SCRIPT_NAMES) as Array<
    [Exclude<VerificationKind, 'custom'>, string[]]
  >) {
    const script = candidates.find((candidate) => typeof scripts[candidate] === 'string');
    if (!script) continue;
    commands.push({
      id: kind,
      kind,
      label: LABELS[kind],
      command: scriptCommand(manager, script),
      source: 'package.json',
    });
  }

  return commands;
}

async function detectPythonCommands(
  root: string,
  deps: VerificationDetectDeps,
): Promise<VerificationCommand[]> {
  const hasPytest =
    (await deps.exists(path.join(root, 'pyproject.toml'))) ||
    (await deps.exists(path.join(root, 'pytest.ini'))) ||
    (await deps.exists(path.join(root, 'tests')));
  if (!hasPytest) return [];

  const commands: VerificationCommand[] = [];
  const hasRuff =
    (await deps.exists(path.join(root, 'ruff.toml'))) ||
    (await deps.exists(path.join(root, '.ruff.toml')));
  const hasMypy = await deps.exists(path.join(root, 'mypy.ini'));

  if (hasRuff) {
    commands.push({
      id: 'lint',
      kind: 'lint',
      label: LABELS.lint,
      command: 'python -m ruff check .',
      source: 'ruff.toml',
    });
  }
  if (hasMypy) {
    commands.push({
      id: 'typecheck',
      kind: 'typecheck',
      label: LABELS.typecheck,
      command: 'python -m mypy .',
      source: 'mypy.ini',
    });
  }
  if (await deps.exists(path.join(root, 'pyproject.toml'))) {
    commands.push({
      id: 'test',
      kind: 'test',
      label: LABELS.test,
      command: 'python -m pytest -q',
      source: 'pyproject.toml',
    });
  }
  return commands;
}

async function detectRustCommands(
  root: string,
  deps: VerificationDetectDeps,
): Promise<VerificationCommand[]> {
  if (!(await deps.exists(path.join(root, 'Cargo.toml')))) return [];
  return [
    {
      id: 'lint',
      kind: 'lint',
      label: LABELS.lint,
      command: 'cargo clippy --all-targets -- -D warnings',
      source: 'Cargo.toml',
    },
    {
      id: 'test',
      kind: 'test',
      label: LABELS.test,
      command: 'cargo test',
      source: 'Cargo.toml',
    },
    {
      id: 'build',
      kind: 'build',
      label: LABELS.build,
      command: 'cargo build',
      source: 'Cargo.toml',
    },
  ];
}

async function detectGoCommands(
  root: string,
  deps: VerificationDetectDeps,
): Promise<VerificationCommand[]> {
  if (!(await deps.exists(path.join(root, 'go.mod')))) return [];
  return [
    {
      id: 'lint',
      kind: 'lint',
      label: LABELS.lint,
      command: 'go vet ./...',
      source: 'go.mod',
    },
    {
      id: 'test',
      kind: 'test',
      label: LABELS.test,
      command: 'go test ./...',
      source: 'go.mod',
    },
    {
      id: 'build',
      kind: 'build',
      label: LABELS.build,
      command: 'go build ./...',
      source: 'go.mod',
    },
  ];
}

function sortByKind(commands: VerificationCommand[]): VerificationCommand[] {
  return commands.sort(
    (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.id.localeCompare(b.id),
  );
}

/**
 * Hittar projektets egna verifieringskommandon. Inget gissas: bara kommandon som faktiskt finns
 * i projektet (skript, konfigurationsfiler) tas med, så att rapporten aldrig påstår att något
 * kontrollerats som inte kördes.
 */
export async function detectVerificationCommands(
  root: string,
  overrides: Partial<VerificationDetectDeps> = {},
): Promise<VerificationCommand[]> {
  const deps: VerificationDetectDeps = { ...defaultDeps, ...overrides };
  const node = await detectNodeCommands(root, deps);
  if (node.length > 0) return sortByKind(node);

  const python = await detectPythonCommands(root, deps);
  if (python.length > 0) return sortByKind(python);

  const rust = await detectRustCommands(root, deps);
  if (rust.length > 0) return sortByKind(rust);

  return sortByKind(await detectGoCommands(root, deps));
}

/** Filtrerar fram de steg användaren eller loopen vill köra. Tom lista = alla. */
export function filterVerificationCommands(
  commands: VerificationCommand[],
  kinds?: readonly VerificationKind[],
): VerificationCommand[] {
  if (!kinds || kinds.length === 0) return commands;
  return commands.filter((command) => kinds.includes(command.kind));
}
