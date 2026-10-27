import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ensureProjectScaffold, loadProjectRules } from './loader.js';
import { ProjectMemory } from '../memory/store.js';

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'vibeforge-rules-'));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('loadProjectRules', () => {
  it('läser AGENTS.md, rules.md, preferences.json, hooks.json och mcp.json', async () => {
    await fs.writeFile(path.join(root, 'AGENTS.md'), '# Agentregler\nAnvänd named exports.');
    await fs.mkdir(path.join(root, '.vibeforge'), { recursive: true });
    await fs.writeFile(
      path.join(root, '.vibeforge', 'rules.md'),
      '# Regler\nKör tester före commit.',
    );
    await fs.writeFile(
      path.join(root, '.vibeforge', 'preferences.json'),
      JSON.stringify({
        permissionMode: 'auto-edit',
        testCommand: 'npm test',
        model: 'deepseek-r1:8b',
      }),
    );
    await fs.writeFile(
      path.join(root, '.vibeforge', 'hooks.json'),
      JSON.stringify([
        {
          name: 'lint',
          event: 'after_file_edit',
          command: 'npx eslint {{path}}',
          blockOnFailure: false,
          enabled: true,
          timeoutMs: 5000,
        },
      ]),
    );
    await fs.writeFile(
      path.join(root, '.vibeforge', 'mcp.json'),
      JSON.stringify({
        mcpServers: [
          {
            id: 'fs',
            name: 'filesystem',
            transport: 'stdio',
            command: 'npx',
            enabled: true,
            requireApproval: true,
            warnings: [],
          },
        ],
      }),
    );

    const rules = await loadProjectRules(root);
    expect(rules.agentsFile).toContain('named exports');
    expect(rules.rulesFile).toContain('tester före commit');
    expect(rules.preferences.permissionMode).toBe('auto-edit');
    expect(rules.preferences.testCommand).toBe('npm test');
    expect(rules.hooks).toHaveLength(1);
    expect(rules.hooks[0]?.name).toBe('lint');
    expect(rules.mcpServers[0]?.name).toBe('filesystem');
    expect(rules.sources).toContain('AGENTS.md');
    expect(rules.sources).toContain('.vibeforge/rules.md');
  });

  it('ignorerar ogiltig JSON i stället för att kasta', async () => {
    await fs.mkdir(path.join(root, '.vibeforge'), { recursive: true });
    await fs.writeFile(path.join(root, '.vibeforge', 'preferences.json'), '{ trasig json');
    const rules = await loadProjectRules(root);
    expect(rules.preferences).toEqual({});
    expect(rules.sources.some((source) => source.includes('ogiltig JSON'))).toBe(true);
  });

  it('tar bort ett ogiltigt behörighetsläge', async () => {
    await fs.mkdir(path.join(root, '.vibeforge'), { recursive: true });
    await fs.writeFile(
      path.join(root, '.vibeforge', 'preferences.json'),
      JSON.stringify({ permissionMode: 'galet' }),
    );
    const rules = await loadProjectRules(root);
    expect(rules.preferences.permissionMode).toBeUndefined();
  });

  it('klarar ett tomt projekt', async () => {
    const rules = await loadProjectRules(root);
    expect(rules.agentsFile).toBe('');
    expect(rules.preferences).toEqual({});
    expect(rules.hooks).toEqual([]);
  });
});

describe('ensureProjectScaffold', () => {
  it('skapar stommen och skriver inte över befintliga filer', async () => {
    const created = await ensureProjectScaffold(root, 'Svep-projektet');
    expect(created).toContain('.vibeforge/rules.md');
    expect(created).toContain('.vibeforge/preferences.json');

    await fs.writeFile(path.join(root, '.vibeforge', 'rules.md'), 'min egen regel');
    const again = await ensureProjectScaffold(root);
    expect(again).not.toContain('.vibeforge/rules.md');
    expect(await fs.readFile(path.join(root, '.vibeforge', 'rules.md'), 'utf8')).toBe(
      'min egen regel',
    );
  });
});

describe('ProjectMemory', () => {
  it('lägger till poster under rätt rubrik och läser tillbaka dem', async () => {
    const memory = new ProjectMemory(root);
    await memory.replace('# Projektminne\n\n## Arkitektur\n- Allt körs lokalt.\n');
    await memory.remember('bug', 'Terminalen dör vid timeout.');
    await memory.remember('test-command', 'npm test');

    const entries = await memory.entries();
    expect(entries).toContainEqual(
      expect.objectContaining({ kind: 'architecture', text: 'Allt körs lokalt.' }),
    );
    expect(entries).toContainEqual(
      expect.objectContaining({ kind: 'bug', text: 'Terminalen dör vid timeout.' }),
    );
    expect(entries).toContainEqual(
      expect.objectContaining({ kind: 'test-command', text: 'npm test' }),
    );

    const summary = await memory.summary();
    expect(summary).toContain('Kända buggar');
  });

  it('skapar minnesfilen om den saknas', async () => {
    const memory = new ProjectMemory(root);
    await memory.remember('decision', 'Vi valde node:sqlite i stället för better-sqlite3.');
    const content = await memory.read();
    expect(content).toContain('## Tekniska val');
    expect(content).toContain('node:sqlite');
  });

  it('ignorerar tom text', async () => {
    const memory = new ProjectMemory(root);
    await memory.remember('style', '   ');
    expect(await memory.read()).toBe('');
  });
});
