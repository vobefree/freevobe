import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  activateSkills,
  formatSkillsForPrompt,
  loadBuiltinSkills,
  mergeSkills,
  parseSkill,
} from './loader.js';
import { SkillStore, renderSkillMarkdown } from './store.js';

let tempDir: string;

beforeAll(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-skills-'));
});

afterAll(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

const EXPECTED_SKILLS = [
  'api-endpoint',
  'bug-fix',
  'code-review',
  'database-migration',
  'documentation',
  'nextjs-page',
  'python-script',
  'react-component',
  'refactoring',
  'test-writing',
];

describe('inbyggda skills', () => {
  it('innehåller de tio skills som specen kräver och de är kompletta', async () => {
    const skills = await loadBuiltinSkills();
    expect(skills.map((skill) => skill.name).sort()).toEqual(EXPECTED_SKILLS);

    for (const skill of skills) {
      expect(skill.description.length, skill.name).toBeGreaterThan(10);
      expect(skill.triggers.length, skill.name).toBeGreaterThan(0);
      expect(skill.tools.length, skill.name).toBeGreaterThan(0);
      expect(skill.body.length, skill.name).toBeGreaterThan(80);
      expect(skill.source).toBe('builtin');
    }
  });

  it('aktiveras av triggers i prompten och av @namn', async () => {
    const skills = await loadBuiltinSkills();

    const byTrigger = activateSkills(skills, 'Skapa en react-komponent för listan');
    expect(byTrigger.map((activation) => activation.skill.name)).toContain('react-component');
    expect(byTrigger[0]?.reason).toBe('trigger');

    const explicit = activateSkills(skills, 'kör @code-review på min diff');
    const review = explicit.find((activation) => activation.skill.name === 'code-review');
    expect(review?.reason).toBe('explicit');
  });

  it('aktiverar inget på en orelaterad prompt', async () => {
    const skills = await loadBuiltinSkills();
    expect(activateSkills(skills, 'hej hur mår du idag')).toEqual([]);
  });

  it('formaterar aktiva skills för systemprompten', async () => {
    const skills = await loadBuiltinSkills();
    const activations = activateSkills(skills, 'skriv ett test för modulen');
    const text = formatSkillsForPrompt(activations);
    expect(text).toContain('### Skill: test-writing');
    expect(text).toContain('Föreslagna verktyg');
  });
});

describe('parseSkill', () => {
  it('tolkar frontmatter med listor i både block- och inline-format', () => {
    const skill = parseSkill(
      [
        '---',
        'name: egen-skill',
        'description: Min egen skill',
        'tools: [read_file, write_file]',
        'triggers:',
        '  - "egen"',
        '  - special',
        '---',
        '',
        '# Rubrik',
        'Innehåll',
      ].join('\n'),
      { source: 'project' },
    );

    expect(skill?.name).toBe('egen-skill');
    expect(skill?.tools).toEqual(['read_file', 'write_file']);
    expect(skill?.triggers).toEqual(['egen', 'special']);
    expect(skill?.body).toContain('Innehåll');
  });

  it('returnerar null när frontmatter saknas eller är ofullständig', () => {
    expect(parseSkill('# Ingen frontmatter', { source: 'project' })).toBeNull();
    expect(parseSkill('---\nname: bara-namn\n---\ntext', { source: 'project' })).toBeNull();
  });
});

describe('SkillStore', () => {
  it('skapar, läser, exporterar och tar bort en skill', async () => {
    const store = new SkillStore({ root: tempDir });
    const file = await store.write({
      name: 'Kundspecifik komponent',
      description: 'Bygger komponenter enligt kundens designsystem.',
      tools: ['read_file', 'write_file'],
      triggers: ['designsystem', 'kund'],
      body: '## Checklista\n- Följ designsystemets färger.',
    });

    expect(file.endsWith('kundspecifik-komponent.md')).toBe(true);

    const loaded = await store.read('Kundspecifik komponent');
    expect(loaded?.description).toContain('designsystem');

    const exported = await store.export('Kundspecifik komponent');
    expect(exported).toContain('name: Kundspecifik komponent');

    expect(await store.remove('Kundspecifik komponent')).toBe(true);
    expect(await store.read('Kundspecifik komponent')).toBeNull();
  });

  it('importerar markdown och låter projektets skill vinna över den inbyggda', async () => {
    const store = new SkillStore({ root: tempDir });
    const created = await store.importMarkdown([
      renderSkillMarkdown({
        name: 'test-writing',
        description: 'Vår egen variant av testskrivning.',
        triggers: ['test'],
        body: 'Skriv alltid ett test först.',
      }),
    ]);

    expect(created).toEqual(['test-writing']);
    const all = await store.loadAll();
    const resolved = all.find((skill) => skill.name === 'test-writing');
    expect(resolved?.source).toBe('project');
    expect(resolved?.description).toContain('egen variant');
  });

  it('vägrar spara en skill utan namn eller beskrivning', async () => {
    const store = new SkillStore({ root: tempDir });
    await expect(store.write({ name: '', description: 'x' })).rejects.toThrow(/namn/);
  });

  it('kopierar de inbyggda skillsen till projektet utan att skriva över', async () => {
    const target = await fs.mkdtemp(path.join(os.tmpdir(), 'freevobe-copy-'));
    try {
      const store = new SkillStore({ root: target });
      const created = await store.copyBuiltinToProject();
      expect(created).toHaveLength(10);
      expect(await store.copyBuiltinToProject()).toEqual([]);
    } finally {
      await fs.rm(target, { recursive: true, force: true });
    }
  });
});

describe('mergeSkills', () => {
  it('låter projektets skill ersätta den inbyggda med samma namn', async () => {
    const builtin = await loadBuiltinSkills();
    const merged = mergeSkills(builtin, [
      {
        name: 'bug-fix',
        description: 'Egen buggfix',
        tools: [],
        triggers: ['bugg'],
        source: 'project',
        body: 'x',
        chars: 1,
      },
    ]);
    expect(merged).toHaveLength(builtin.length);
    expect(merged.find((skill) => skill.name === 'bug-fix')?.description).toBe('Egen buggfix');
  });
});
