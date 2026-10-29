import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectVerificationCommands, filterVerificationCommands } from './detect.js';

const root = path.resolve('/projekt');

function fakeFs(files: Record<string, string>) {
  return {
    readFile: async (absolutePath: string) => files[absolutePath] ?? null,
    exists: async (absolutePath: string) => absolutePath in files,
  };
}

function manifest(scripts: Record<string, string>, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ name: 'test', scripts, ...extra });
}

describe('detectVerificationCommands', () => {
  it('hittar typkontroll, lint, test och bygge i package.json', async () => {
    const commands = await detectVerificationCommands(
      root,
      fakeFs({
        [path.join(root, 'package.json')]: manifest({
          typecheck: 'tsc --noEmit',
          lint: 'eslint .',
          test: 'vitest run',
          build: 'vite build',
        }),
      }),
    );

    expect(commands.map((command) => command.id)).toEqual(['typecheck', 'lint', 'test', 'build']);
    expect(commands[0]?.command).toBe('npm run typecheck --silent');
    expect(commands.every((command) => command.source === 'package.json')).toBe(true);
    expect(commands.map((command) => command.kind)).toEqual(['typecheck', 'lint', 'test', 'build']);
  });

  it('hoppar över skript som inte finns och använder projektets pakethanterare', async () => {
    const commands = await detectVerificationCommands(
      root,
      fakeFs({
        [path.join(root, 'package.json')]: manifest(
          { test: 'vitest run', 'type-check': 'tsc --noEmit' },
          { packageManager: 'pnpm@9.0.0' },
        ),
      }),
    );

    expect(commands.map((command) => command.kind)).toEqual(['typecheck', 'test']);
    expect(commands.map((command) => command.command)).toEqual([
      'pnpm run type-check',
      'pnpm run test',
    ]);
  });

  it('hittar pytest och ruff i ett Python-projekt', async () => {
    const commands = await detectVerificationCommands(
      root,
      fakeFs({
        [path.join(root, 'pyproject.toml')]: '[project]\nname = "x"\n',
        [path.join(root, 'ruff.toml')]: 'line-length = 100\n',
      }),
    );

    expect(commands.map((command) => command.kind)).toEqual(['lint', 'test']);
    expect(commands.map((command) => command.command)).toEqual([
      'python -m ruff check .',
      'python -m pytest -q',
    ]);
  });

  it('hittar cargo och go', async () => {
    const rust = await detectVerificationCommands(
      root,
      fakeFs({ [path.join(root, 'Cargo.toml')]: '[package]\nname = "x"\n' }),
    );
    expect(rust.map((command) => command.command)).toEqual([
      'cargo clippy --all-targets -- -D warnings',
      'cargo test',
      'cargo build',
    ]);

    const go = await detectVerificationCommands(
      root,
      fakeFs({ [path.join(root, 'go.mod')]: 'module x\n' }),
    );
    expect(go.map((command) => command.command)).toEqual([
      'go vet ./...',
      'go test ./...',
      'go build ./...',
    ]);
  });

  it('gissar aldrig: tomt projekt ger inga steg', async () => {
    expect(await detectVerificationCommands(root, fakeFs({}))).toEqual([]);
  });

  it('filtrerar på kind', async () => {
    const commands = [
      {
        id: 'typecheck',
        label: 'Typkontroll',
        kind: 'typecheck' as const,
        command: 'a',
        source: 'x',
      },
      { id: 'test', label: 'Tester', kind: 'test' as const, command: 'b', source: 'x' },
      { id: 'build', label: 'Bygge', kind: 'build' as const, command: 'c', source: 'x' },
    ];

    expect(filterVerificationCommands(commands, ['test']).map((command) => command.id)).toEqual([
      'test',
    ]);
    expect(filterVerificationCommands(commands, [])).toHaveLength(3);
    expect(filterVerificationCommands(commands)).toHaveLength(3);
  });
});
