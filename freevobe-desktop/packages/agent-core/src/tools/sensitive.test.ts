import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readFileTool, searchFilesTool, writeFileTool } from './fs.js';

let root = '';

async function makeProject(): Promise<string> {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-hemlig-'));
  await fs.writeFile(path.join(root, '.env'), 'API_KEY=hemlig-varde\n', 'utf8');
  await fs.writeFile(
    path.join(root, 'app.ts'),
    'export const key = process.env.API_KEY;\n',
    'utf8',
  );
  await fs.mkdir(path.join(root, '.ssh'), { recursive: true });
  await fs.writeFile(path.join(root, '.ssh', 'config'), 'Host *\n', 'utf8');
  return root;
}

describe('hemlighetsfiler i verktygen', () => {
  afterEach(async () => {
    if (root) await fs.rm(root, { recursive: true, force: true });
    root = '';
  });

  it('vägrar läsa .env och förklarar varför', async () => {
    const dir = await makeProject();
    const result = await readFileTool.handler!({ path: '.env' }, { root: dir } as never);
    expect(result.ok).toBe(false);
    expect(result.content).toContain('hemligheter');
    expect(result.content).not.toContain('hemlig-varde');
  });

  it('vägrar läsa filer i .ssh', async () => {
    const dir = await makeProject();
    const result = await readFileTool.handler!({ path: '.ssh/config' }, { root: dir } as never);
    expect(result.ok).toBe(false);
    expect(result.content).toContain('hemligheter');
  });

  it('läser vanliga filer som förut', async () => {
    const dir = await makeProject();
    const result = await readFileTool.handler!({ path: 'app.ts' }, { root: dir } as never);
    expect(result.ok).toBe(true);
    expect(result.content).toContain('API_KEY');
  });

  it('hoppar över hemligheter i sökningen och redovisar det', async () => {
    const dir = await makeProject();
    const result = await searchFilesTool.handler!({ query: 'API_KEY' }, { root: dir } as never);
    expect(result.ok).toBe(true);
    expect(result.content).toContain('app.ts');
    expect(result.content).toContain('filer med hemligheter genomsöktes inte');
    expect(result.content).not.toContain('hemlig-varde');
  });

  it('vägrar skriva till .env via write_file', async () => {
    const dir = await makeProject();
    const result = await writeFileTool.handler!({ path: '.env', content: 'API_KEY=ny' }, {
      root: dir,
    } as never);
    expect(result.ok).toBe(false);
    expect(result.content).toContain('hemligheter');
    expect(await fs.readFile(path.join(dir, '.env'), 'utf8')).toBe('API_KEY=hemlig-varde\n');
  });

  it('tillåter .env.example eftersom den saknar värden', async () => {
    const dir = await makeProject();
    await fs.writeFile(path.join(dir, '.env.example'), 'API_KEY=\n', 'utf8');
    const result = await readFileTool.handler!({ path: '.env.example' }, { root: dir } as never);
    expect(result.ok).toBe(true);
  });
});
