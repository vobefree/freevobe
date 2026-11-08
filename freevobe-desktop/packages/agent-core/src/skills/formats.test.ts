import { describe, expect, it } from 'vitest';
import { countDetected, detectSkillFile, detectSkillFormats } from './formats.js';

describe('detectSkillFile', () => {
  it('känner igen Claude-skills i både .claude/skills och rotens skills', () => {
    expect(detectSkillFile('.claude/skills/react-review/SKILL.md')).toEqual({
      path: '.claude/skills/react-review/SKILL.md',
      source: 'claude',
      kind: 'skill',
      nameHint: 'react-review',
    });
    expect(detectSkillFile('skills/api-endpoint/SKILL.md')?.nameHint).toBe('api-endpoint');
  });

  it('klarar Windows-sökvägar, inledande ./ och versaler i filnamnet', () => {
    expect(detectSkillFile('.\\skills\\foo\\skill.md')?.path).toBe('skills/foo/skill.md');
    expect(detectSkillFile('./.claude/skills/bar/SKILL.md')?.source).toBe('claude');
    expect(detectSkillFile('.claude/skills/bar/Skill.MD')?.nameHint).toBe('bar');
  });

  it('känner igen Cursor-regler och tar namnet från filen', () => {
    const rule = detectSkillFile('.cursor/rules/typescript.mdc');
    expect(rule?.source).toBe('cursor');
    expect(rule?.kind).toBe('skill');
    expect(rule?.nameHint).toBe('typescript');
  });

  it('behandlar AGENTS.md i roten och .github som regeldokument', () => {
    expect(detectSkillFile('AGENTS.md')).toMatchObject({
      source: 'agents_md',
      kind: 'document',
      nameHint: 'agents',
    });
    expect(detectSkillFile('.github/AGENTS.md')?.source).toBe('agents_md');
  });

  it('behandlar Copilot-instruktioner som regeldokument', () => {
    expect(detectSkillFile('.github/copilot-instructions.md')).toMatchObject({
      source: 'copilot',
      kind: 'document',
      nameHint: 'copilot-instructions',
    });
  });

  it('känner igen Codex, OpenCode, Windsurf och Cline', () => {
    expect(detectSkillFile('.codex/review.md')?.source).toBe('codex');
    expect(detectSkillFile('.opencode/style.md')?.source).toBe('opencode');
    expect(detectSkillFile('.windsurf/rules/tone.md')?.source).toBe('windsurf');
    expect(detectSkillFile('.clinerules/team.md')?.source).toBe('cline');
    expect(detectSkillFile('.clinerules')?.source).toBe('cline');
  });

  it('returnerar null för filer utan känt format', () => {
    expect(detectSkillFile('README.md')).toBeNull();
    expect(detectSkillFile('src/index.ts')).toBeNull();
    expect(detectSkillFile('.cursorrules')).toBeNull();
  });
});

describe('detectSkillFormats', () => {
  it('grupperar träffar per källa i fast ordning', () => {
    const result = detectSkillFormats([
      { path: 'AGENTS.md' },
      { path: '.cursor/rules/a.mdc' },
      { path: '.claude/skills/one/SKILL.md' },
      { path: '.claude/skills/two/SKILL.md' },
      { path: 'README.md' },
    ]);

    expect(result.files.map((file) => file.source)).toEqual([
      'claude',
      'claude',
      'cursor',
      'agents_md',
    ]);
    expect(result.bySource).toEqual([
      { source: 'claude', count: 2 },
      { source: 'cursor', count: 1 },
      { source: 'agents_md', count: 1 },
    ]);
    expect(countDetected(result)).toEqual({ skills: 4, sources: 3 });
  });

  it('samlar markdown utan känt format som förslag på generisk import', () => {
    const result = detectSkillFormats([
      { path: 'docs/guide.md' },
      { path: 'packages/app/AGENTS.md' },
      { path: 'src/index.ts' },
    ]);

    expect(result.files).toEqual([]);
    expect(result.unknownMarkdown).toEqual(['docs/guide.md', 'packages/app/AGENTS.md']);
  });

  it('hoppar över node_modules och andra ignorerade mappar', () => {
    const result = detectSkillFormats([
      { path: 'node_modules/pkg/.claude/skills/x/SKILL.md' },
      { path: '.next/AGENTS.md' },
      { path: 'src/index.ts' },
    ]);

    expect(result.files).toEqual([]);
    expect(result.ignored).toBe(2);
  });

  it('räknar dubbletter en gång', () => {
    const result = detectSkillFormats([
      { path: '.cursor/rules/a.mdc' },
      { path: '.cursor/rules/a.mdc' },
      { path: './.cursor/rules/a.mdc' },
    ]);

    expect(result.files).toHaveLength(1);
  });

  it('tar emot en tom lista utan att falla', () => {
    expect(detectSkillFormats([])).toEqual({
      files: [],
      bySource: [],
      unknownMarkdown: [],
      ignored: 0,
    });
  });
});
