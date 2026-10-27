import fs from 'node:fs/promises';
import path from 'node:path';
import type { SkillSummary } from '@vibeforge/protocol';
import {
  loadBuiltinSkills,
  loadProjectSkills,
  mergeSkills,
  parseSkill,
  type Skill,
} from './loader.js';

export interface SkillDraft {
  name: string;
  description: string;
  tools?: string[];
  triggers?: string[];
  body?: string;
}

export interface SkillStoreOptions {
  /** Projektrot. Projektets skills hamnar i `<root>/.vibeforge/skills`. */
  root: string;
  /** Extra katalog för användarens globala skills. */
  userSkillsDir?: string;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function renderSkillMarkdown(draft: SkillDraft): string {
  const tools = draft.tools ?? [];
  const triggers = draft.triggers ?? [];
  const lines = [
    '---',
    `name: ${draft.name}`,
    `description: ${draft.description}`,
    'tools:',
    ...(tools.length > 0 ? tools.map((tool) => `  - ${tool}`) : ['  - read_file']),
    'triggers:',
    ...(triggers.length > 0 ? triggers.map((trigger) => `  - ${trigger}`) : ['  - ']),
    '---',
    '',
    `# ${draft.name}`,
    '',
    draft.body?.trim() || 'Beskriv hur agenten ska arbeta när den här skillen är aktiv.',
    '',
  ];
  return lines.join('\n');
}

/** Hanterar projektets och användarens skills på disk. Inbyggda skills är skrivskyddade. */
export class SkillStore {
  private readonly projectDir: string;
  private readonly userDir?: string;

  constructor(options: SkillStoreOptions) {
    this.projectDir = path.join(path.resolve(options.root), '.vibeforge', 'skills');
    this.userDir = options.userSkillsDir;
  }

  get directory(): string {
    return this.projectDir;
  }

  async list(): Promise<SkillSummary[]> {
    const summaries: SkillSummary[] = [];
    for (const skill of await this.loadAll()) {
      summaries.push({
        name: skill.name,
        description: skill.description,
        tools: skill.tools,
        triggers: skill.triggers,
        source: skill.source,
        chars: skill.chars,
        ...(skill.path ? { path: skill.path } : {}),
      });
    }
    return summaries;
  }

  async loadAll(): Promise<Skill[]> {
    const builtin = await loadBuiltinSkills();
    const project = await loadProjectSkills(this.projectDir);
    const user = this.userDir ? await loadProjectSkills(this.userDir) : [];
    return mergeSkills(
      mergeSkills(
        builtin,
        user.map((skill) => ({ ...skill, source: 'user' as const })),
      ),
      project,
    );
  }

  async read(name: string): Promise<Skill | null> {
    const skills = await this.loadAll();
    return skills.find((skill) => skill.name === name) ?? null;
  }

  async write(draft: SkillDraft): Promise<string> {
    if (!draft.name.trim() || !draft.description.trim()) {
      throw new Error('Skillen måste ha både namn och beskrivning.');
    }
    await fs.mkdir(this.projectDir, { recursive: true });
    const file = path.join(this.projectDir, `${slugify(draft.name) || 'skill'}.md`);
    const rendered = renderSkillMarkdown(draft);
    const parsed = parseSkill(rendered, { source: 'project', path: file });
    if (!parsed) throw new Error('Kunde inte skapa skillen – kontrollera namn och beskrivning.');
    await fs.writeFile(file, rendered, 'utf8');
    return file;
  }

  async remove(name: string): Promise<boolean> {
    const skill = (await loadProjectSkills(this.projectDir)).find((entry) => entry.name === name);
    if (!skill?.path) return false;
    await fs.rm(skill.path, { force: true });
    return true;
  }

  /** Importerar en eller flera skill-filer (t.ex. från urklipp). Returnerar skapade namn. */
  async importMarkdown(contents: string[]): Promise<string[]> {
    await fs.mkdir(this.projectDir, { recursive: true });
    const created: string[] = [];
    for (const content of contents) {
      const parsed = parseSkill(content, { source: 'project' });
      if (!parsed) continue;
      const file = path.join(this.projectDir, `${slugify(parsed.name)}.md`);
      await fs.writeFile(file, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
      created.push(parsed.name);
    }
    return created;
  }

  /** Läser skillens markdown så att användaren kan spara eller dela den. */
  async export(name: string): Promise<string | null> {
    const skill = await this.read(name);
    if (!skill) return null;
    return `---\nname: ${skill.name}\ndescription: ${skill.description}\ntools:\n${skill.tools.map((tool) => `  - ${tool}`).join('\n')}\ntriggers:\n${skill.triggers.map((trigger) => `  - ${trigger}`).join('\n')}\n---\n\n${skill.body}\n`;
  }

  /** Kopierar de inbyggda skillsen till projektet så att de kan redigeras fritt. */
  async copyBuiltinToProject(): Promise<string[]> {
    const builtin = await loadBuiltinSkills();
    await fs.mkdir(this.projectDir, { recursive: true });
    const created: string[] = [];
    for (const skill of builtin) {
      const target = path.join(this.projectDir, `${slugify(skill.name)}.md`);
      const exists = await fs
        .access(target)
        .then(() => true)
        .catch(() => false);
      if (exists) continue;
      await fs.writeFile(target, renderSkillMarkdown({ ...skill, body: skill.body }), 'utf8');
      created.push(skill.name);
    }
    return created;
  }
}
