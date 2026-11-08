import { describe, expect, it } from 'vitest';
import { parseSkill } from './loader.js';
import {
  normalizeSkill,
  normalizedFileName,
  renderNormalizedSkill,
  yamlScalar,
} from './normalize.js';

describe('normalizeSkill – Claude', () => {
  it('använder name, description, tools och when_to_use som triggers', () => {
    const skill = normalizeSkill({
      path: '.claude/skills/react-review/SKILL.md',
      source: 'claude',
      kind: 'skill',
      nameHint: 'react-review',
      content: [
        '---',
        'name: react-review',
        'description: Granskar React-komponenter.',
        'tools: [read_file, grep]',
        'when_to_use: när du granskar react, hooks',
        '---',
        '',
        '# React-granskning',
        'Leta efter onödiga renders.',
      ].join('\n'),
    });

    expect(skill.name).toBe('react-review');
    expect(skill.description).toBe('Granskar React-komponenter.');
    expect(skill.tools).toEqual(['read_file', 'grep']);
    expect(skill.triggers).toEqual(['när du granskar react', 'hooks']);
    expect(skill.alwaysApply).toBe(false);
    expect(skill.body).toContain('Leta efter onödiga renders.');
    expect(skill.warnings).toEqual([]);
  });

  it('faller tillbaka på första stycket och varnar när description saknas', () => {
    const skill = normalizeSkill({
      path: 'skills/deploy/SKILL.md',
      source: 'claude',
      kind: 'skill',
      nameHint: 'deploy',
      content:
        '---\nname: deploy\ntools:\n  - read_file\n---\n\n# Deploy\nKör alltid testerna först.\n',
    });

    expect(skill.description).toBe('Kör alltid testerna först.');
    expect(skill.triggers).toEqual(['deploy']);
    expect(skill.warnings.join(' ')).toContain('första stycke');
  });
});

describe('normalizeSkill – Cursor', () => {
  it('behåller globs och alwaysApply så att regeln aktiveras som i Cursor', () => {
    const skill = normalizeSkill({
      path: '.cursor/rules/typescript.mdc',
      source: 'cursor',
      kind: 'skill',
      nameHint: 'typescript',
      content: [
        '---',
        'description: TypeScript-stil med strikta typer',
        'globs: src/**/*.ts, src/**/*.tsx',
        'alwaysApply: false',
        '---',
        'Använd interface i stället för type när det går.',
      ].join('\n'),
    });

    expect(skill.name).toBe('typescript');
    expect(skill.globs).toEqual(['src/**/*.ts', 'src/**/*.tsx']);
    expect(skill.alwaysApply).toBe(false);
    expect(skill.triggers).toEqual([]);
    expect(skill.warnings).toEqual([]);
  });

  it('varnar när regeln varken har globs eller alwaysApply', () => {
    const skill = normalizeSkill({
      path: '.cursor/rules/lös.mdc',
      source: 'cursor',
      kind: 'skill',
      nameHint: 'los',
      content: '---\ndescription: En lös regel\n---\nVar trevlig i kommentarer.',
    });

    expect(skill.alwaysApply).toBe(false);
    expect(skill.globs).toEqual([]);
    expect(skill.warnings.join(' ')).toContain('manuell');
  });

  it('tolkar alwaysApply som sant oavsett skrivsätt', () => {
    const skill = normalizeSkill({
      path: '.cursor/rules/alltid.mdc',
      source: 'cursor',
      kind: 'skill',
      nameHint: 'alltid',
      content: '---\ndescription: Gäller allt\nalwaysApply: TRUE\n---\nText.',
    });

    expect(skill.alwaysApply).toBe(true);
    expect(skill.warnings).toEqual([]);
  });
});

describe('normalizeSkill – regeldokument', () => {
  it('gör AGENTS.md till en project-rules-skill som alltid är aktiv', () => {
    const skill = normalizeSkill({
      path: 'AGENTS.md',
      source: 'agents_md',
      kind: 'document',
      nameHint: 'agents',
      content: '# Projektregler\n\n- Kör tester före commit.\n- Svara på svenska.',
    });

    expect(skill.name).toBe('project-rules');
    expect(skill.description).toBe('Projektregler');
    expect(skill.alwaysApply).toBe(true);
    expect(skill.triggers).toEqual([]);
    expect(skill.body).toContain('Kör tester före commit.');
    expect(skill.warnings.join(' ')).toContain('första rubrik');
  });

  it('gör Copilot-instruktioner till en egen skill', () => {
    const skill = normalizeSkill({
      path: '.github/copilot-instructions.md',
      source: 'copilot',
      kind: 'document',
      nameHint: 'copilot-instructions',
      content: '# Copilot-regler\nAnvänd alltid TypeScript.',
    });

    expect(skill.name).toBe('copilot-instructions');
    expect(skill.alwaysApply).toBe(true);
    expect(skill.body).toContain('Använd alltid TypeScript.');
  });
});

describe('normalizeSkill – generisk markdown', () => {
  it('gissar namn från filen och beskrivning från första stycket', () => {
    const skill = normalizeSkill({
      path: 'docs/deploy-runbook.md',
      source: 'generic',
      kind: 'skill',
      nameHint: 'deploy-runbook',
      content: '# Deploy\n\nKör `npm run release` och kontrollera loggen.\n\nMer text.',
    });

    expect(skill.name).toBe('deploy-runbook');
    expect(skill.description).toBe('Kör `npm run release` och kontrollera loggen.');
    expect(skill.alwaysApply).toBe(false);
    expect(skill.warnings.join(' ')).toContain('första stycke');
  });

  it('respekterar frontmatter när filen redan är en Freevobe-skill', () => {
    const skill = normalizeSkill({
      path: 'skills/egen.md',
      source: 'generic',
      kind: 'skill',
      nameHint: 'egen',
      content:
        '---\nname: egen-skill\ndescription: Redan normaliserad\ntriggers:\n  - egen\n---\n\nGör si.',
    });

    expect(skill.name).toBe('egen-skill');
    expect(skill.description).toBe('Redan normaliserad');
    expect(skill.triggers).toEqual(['egen']);
    expect(skill.warnings).toEqual([]);
  });

  it('varnar för en fil utan brödtext', () => {
    const skill = normalizeSkill({
      path: 'skills/tom.md',
      source: 'generic',
      kind: 'skill',
      nameHint: 'tom',
      content: '---\nname: tom\n---\n',
    });

    expect(skill.body).toBe('');
    expect(skill.warnings.join(' ')).toContain('brödtext');
  });
});

describe('renderNormalizedSkill', () => {
  it('renderar frontmatter som går att läsa tillbaka med parseSkill', () => {
    const skill = normalizeSkill({
      path: '.cursor/rules/api.mdc',
      source: 'cursor',
      kind: 'skill',
      nameHint: 'api',
      repo: 'acme/rules',
      content: [
        '---',
        "description: 'API-stil: svenska felmeddelanden'",
        'globs:',
        '  - src/api/**',
        'alwaysApply: true',
        '---',
        '# API',
        'Svara med { ok: true }.',
      ].join('\n'),
    });

    const rendered = renderNormalizedSkill(skill);
    expect(rendered).toContain('source: cursor');
    expect(rendered).toContain('source_repo: acme/rules');
    expect(rendered).toContain('alwaysApply: true');

    const parsed = parseSkill(rendered, { source: 'project' });
    expect(parsed?.name).toBe('api');
    expect(parsed?.description).toBe('API-stil: svenska felmeddelanden');
    expect(parsed?.globs).toEqual(['src/api/**']);
    expect(parsed?.alwaysApply).toBe(true);
    expect(parsed?.importedFrom).toBe('cursor');
    expect(parsed?.sourceRepo).toBe('acme/rules');
    expect(parsed?.body).toContain('Svara med { ok: true }.');
  });

  it('citerar värden som YAML annars skulle tolka fel', () => {
    expect(yamlScalar('enkel')).toBe('enkel');
    expect(yamlScalar('true')).toBe("'true'");
    expect(yamlScalar('a: b')).toBe("'a: b'");
    expect(yamlScalar("React's regler")).toBe("'React''s regler'");
  });

  it('ger ett filnamn som är stabilt och filsystemsäkert', () => {
    expect(normalizedFileName({ ...baseSkill(), name: 'React Review / Hooks!' })).toBe(
      'react-review-hooks.md',
    );
  });
});

function baseSkill() {
  return normalizeSkill({
    path: 'skills/x.md',
    source: 'generic',
    kind: 'skill',
    nameHint: 'x',
    content: '---\nname: x\ndescription: Ett test\n---\nText.',
  });
}
