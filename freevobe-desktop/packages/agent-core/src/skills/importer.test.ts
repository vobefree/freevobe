import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applySkillImport, scanSkillDirectory, scanSkillImportTarget } from './importer.js';
import { SkillStore } from './store.js';

let root: string;

async function write(relative: string, content: string): Promise<void> {
  const absolute = path.join(root, relative);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, content, 'utf8');
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-import-test-'));
  await write(
    '.claude/skills/review/SKILL.md',
    '---\nname: review\ndescription: Granskar kod\nwhen_to_use: när du granskar kod, review\n---\n\nLäs diffen först.\n',
  );
  await write(
    '.cursor/rules/typescript.mdc',
    '---\ndescription: TypeScript-stil\nglobs: src/**/*.ts\nalwaysApply: false\n---\nAnvänd interface.\n',
  );
  await write('AGENTS.md', '# Projektregler\n\n- Kör tester före commit.\n');
  await write('README.md', '# Projektet\n\nVanlig dokumentation.\n');
  await write(
    'node_modules/pkg/.claude/skills/x/SKILL.md',
    '---\nname: x\ndescription: Ska ignoreras\n---\nx\n',
  );
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('scanSkillDirectory', () => {
  it('hittar kända format, normaliserar dem och listar okänd markdown', async () => {
    const scan = await scanSkillDirectory({ root });

    expect(scan.items.map((item) => item.name).sort()).toEqual([
      'project-rules',
      'review',
      'typescript',
    ]);
    expect(scan.bySource).toEqual([
      { source: 'claude', count: 1 },
      { source: 'cursor', count: 1 },
      { source: 'agents_md', count: 1 },
    ]);
    expect(scan.unknown).toEqual(['README.md']);
    expect(scan.target).toBe(root);

    const review = scan.items.find((item) => item.name === 'review');
    expect(review?.triggers).toEqual(['när du granskar kod', 'review']);
    expect(review?.markdown).toContain('source: claude');

    const cursor = scan.items.find((item) => item.name === 'typescript');
    expect(cursor?.globs).toEqual(['src/**/*.ts']);
    expect(cursor?.markdown).toContain('globs:');

    const agents = scan.items.find((item) => item.name === 'project-rules');
    expect(agents?.alwaysApply).toBe(true);
  });

  it('märker konflikter mot befintliga skills', async () => {
    const scan = await scanSkillDirectory({
      root,
      existing: [
        {
          name: 'review',
          description: 'Inbyggd kodgranskning',
          tools: [],
          triggers: [],
          source: 'builtin',
          chars: 10,
        },
      ],
    });

    const review = scan.items.find((item) => item.name === 'review');
    expect(review?.conflict).toEqual({ with: 'builtin', description: 'Inbyggd kodgranskning' });
    expect(scan.items.find((item) => item.name === 'typescript')?.conflict).toBeNull();
  });

  it('hoppar över filer i node_modules', async () => {
    const scan = await scanSkillDirectory({ root });
    expect(scan.items.some((item) => item.name === 'x')).toBe(false);
    expect(scan.unknown).not.toContain('node_modules/pkg/.claude/skills/x/SKILL.md');
  });
});

describe('scanSkillImportTarget', () => {
  it('skannar projektet när ingen adress anges', async () => {
    const scan = await scanSkillImportTarget({ cwd: root });
    expect(scan.items).toHaveLength(3);
  });

  it('läser en relativ mapp', async () => {
    const scan = await scanSkillImportTarget({ cwd: root, target: '.claude' });
    expect(scan.items.map((item) => item.name)).toEqual(['review']);
  });

  it('låter en lokal mapp vinna över en tolkning som repo-namn', async () => {
    await write('acme/rules/.cursor/rules/style.mdc', '---\ndescription: Stil\n---\nText.\n');
    const scan = await scanSkillImportTarget({ cwd: root, target: 'acme/rules' });
    expect(scan.items.map((item) => item.name)).toEqual(['style']);
  });

  it('ger ett tydligt fel för en sökväg som inte finns', async () => {
    await expect(scanSkillImportTarget({ cwd: root, target: './finns-inte' })).rejects.toThrow(
      /Hittade ingen mapp/,
    );
  });
});

describe('applySkillImport', () => {
  it('sparar valda skills med globs, alwaysApply och ursprung', async () => {
    const scan = await scanSkillDirectory({ root });
    const store = new SkillStore({ root });
    const chosen = scan.items
      .filter((item) => item.source === 'cursor' || item.source === 'claude')
      .map((item) => ({
        name: item.name,
        description: item.description,
        tools: item.tools,
        triggers: item.triggers,
        globs: item.globs,
        alwaysApply: item.alwaysApply,
        body: item.body,
        source: item.source,
        sourcePath: item.path,
      }));

    const result = await applySkillImport(store, chosen);
    expect(result.created.sort()).toEqual(['review', 'typescript']);
    expect(result.files).toHaveLength(2);

    const saved = await store.list();
    const typescript = saved.find((skill) => skill.name === 'typescript');
    expect(typescript?.source).toBe('project');
    expect(typescript?.importedFrom).toBe('cursor');
    expect(typescript?.globs).toEqual(['src/**/*.ts']);
  });

  it('hoppar över poster utan beskrivning', async () => {
    const store = new SkillStore({ root });
    const result = await applySkillImport(store, [
      {
        name: 'tom',
        description: '',
        tools: [],
        triggers: [],
        globs: [],
        alwaysApply: false,
        body: 'Text',
        source: 'generic',
        sourcePath: 'tom.md',
      },
    ]);
    expect(result.created).toEqual([]);
  });

  it('gör en importerad skill läsbar direkt efter import', async () => {
    const scan = await scanSkillDirectory({ root });
    const store = new SkillStore({ root });
    const rules = scan.items.find((item) => item.name === 'project-rules');
    expect(rules).toBeDefined();
    await applySkillImport(store, [
      {
        name: rules!.name,
        description: rules!.description,
        tools: rules!.tools,
        triggers: rules!.triggers,
        globs: rules!.globs,
        alwaysApply: rules!.alwaysApply,
        body: rules!.body,
        source: rules!.source,
        sourcePath: rules!.path,
      },
    ]);

    const loaded = await store.read('project-rules');
    expect(loaded?.alwaysApply).toBe(true);
    expect(loaded?.body).toContain('Kör tester före commit.');
  });
});
