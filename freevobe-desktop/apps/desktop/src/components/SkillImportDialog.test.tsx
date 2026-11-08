// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  SkillImportApplyItem,
  SkillImportItem,
  SkillImportScan,
  SkillSecurityReport,
} from '@freevobe/protocol';
import { SkillImportDialog } from './SkillImportDialog';
import { useAppStore } from '../store/appStore';

function item(overrides: Partial<SkillImportItem> & Pick<SkillImportItem, 'path' | 'name'>) {
  const base: SkillImportItem = {
    path: overrides.path,
    source: 'claude',
    kind: 'skill',
    name: overrides.name,
    description: `${overrides.name} beskrivning`,
    tools: [],
    triggers: [],
    globs: [],
    alwaysApply: false,
    body: 'Gör så här.',
    markdown: '',
    warnings: [],
    security: { level: 'safe', score: 100, findings: [], urls: [], scripts: [], scannedChars: 0 },
    conflict: null,
  };
  return { ...base, ...overrides };
}

function securityOf(overrides: Partial<SkillSecurityReport> = {}): SkillSecurityReport {
  return {
    level: 'safe',
    score: 100,
    findings: [],
    urls: [],
    scripts: [],
    scannedChars: 200,
    ...overrides,
  };
}

const review = item({
  path: '.claude/skills/review/SKILL.md',
  name: 'review',
  triggers: ['review'],
  globs: ['src/**'],
  body: 'Läs diffen först.',
});
const legacy = item({
  path: '.claude/skills/legacy/SKILL.md',
  name: 'legacy',
  conflict: { with: 'builtin', description: 'Finns som inbyggd skill.' },
});
const projectRules = item({
  path: 'AGENTS.md',
  source: 'agents_md',
  kind: 'document',
  name: 'project-rules',
  alwaysApply: true,
  warnings: ['Beskrivningen gissades från första stycket.'],
});

const scan: SkillImportScan = {
  target: '/hem/projekt/annat-projekt',
  bySource: [
    { source: 'claude', count: 2 },
    { source: 'agents_md', count: 1 },
  ],
  items: [review, legacy, projectRules],
  unknown: ['anteckningar.md'],
  ignored: 3,
};

const originalScan = useAppStore.getState().scanSkillImport;
const originalApply = useAppStore.getState().applySkillImport;

function openWith(actions: { scan?: unknown; apply?: unknown } = {}) {
  useAppStore.setState({
    skillImportOpen: true,
    scanSkillImport: (actions.scan ?? vi.fn()) as never,
    applySkillImport: (actions.apply ?? vi.fn()) as never,
  });
}

describe('SkillImportDialog', () => {
  afterEach(() => {
    cleanup();
    useAppStore.setState({
      skillImportOpen: false,
      scanSkillImport: originalScan,
      applySkillImport: originalApply,
    });
  });

  it('renderar ingenting när vyn är stängd', () => {
    render(<SkillImportDialog />);
    expect(screen.queryByText('Importera skills från en annan AI')).toBeNull();
  });

  it('skannar målet och grupperar träffarna per källa', async () => {
    const scanSkillImport = vi.fn().mockResolvedValue(scan);
    openWith({ scan: scanSkillImport });
    render(<SkillImportDialog />);

    fireEvent.change(screen.getByPlaceholderText(/github\.com/), {
      target: { value: ' ../annat-projekt ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Skanna' }));

    await waitFor(() => expect(scanSkillImport).toHaveBeenCalledTimes(1));
    expect(scanSkillImport.mock.calls[0]?.[0]).toBe(' ../annat-projekt ');
    expect(await screen.findByText('review')).toBeTruthy();
    expect(screen.getByText('project-rules')).toBeTruthy();
    expect(screen.getByText('/hem/projekt/annat-projekt')).toBeTruthy();
    expect(screen.getByText('3 skill(s) från 2 källa/källor')).toBeTruthy();
    // Markdown utan känt format försvinner inte i tysthet.
    expect(screen.getByText(/1 markdownfil\(er\) utan känt format/)).toBeTruthy();
  });

  it('markerar konflikter, låser dem och väljer bara de övriga', async () => {
    openWith({ scan: vi.fn().mockResolvedValue(scan) });
    render(<SkillImportDialog />);

    fireEvent.click(screen.getByRole('button', { name: 'Skanna' }));
    await screen.findByText('legacy');

    expect(screen.getByText('finns redan')).toBeTruthy();
    expect(screen.getByText(/1 av de hittade skillsen finns redan/)).toBeTruthy();

    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    // Första rutan är "Välj alla", därefter en per post i gruppordning.
    expect(boxes).toHaveLength(4);
    expect(boxes[1]?.checked).toBe(true);
    expect(boxes[2]?.checked).toBe(false);
    expect(boxes[2]?.disabled).toBe(true);
    expect(boxes[3]?.checked).toBe(true);
    expect(screen.getByText('2 valda')).toBeTruthy();
  });

  it('skickar bara de valda posterna och visar resultatet', async () => {
    const applySkillImport = vi
      .fn()
      .mockResolvedValue({ created: ['review'], files: ['.freevobe/skills/review.md'] });
    openWith({ scan: vi.fn().mockResolvedValue(scan), apply: applySkillImport });
    render(<SkillImportDialog />);

    fireEvent.click(screen.getByRole('button', { name: 'Skanna' }));
    await screen.findByText('project-rules');

    // Avmarkera AGENTS.md-posten så att bara Claude-skillen återstår.
    fireEvent.click(screen.getAllByRole('checkbox')[3] as HTMLElement);
    expect(screen.getByText('1 valda')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Importera valda' }));
    await waitFor(() => expect(applySkillImport).toHaveBeenCalledTimes(1));

    const payload = applySkillImport.mock.calls[0]?.[0] as SkillImportApplyItem[];
    expect(payload.map((entry) => entry.name)).toEqual(['review']);
    expect(payload[0]).toMatchObject({
      source: 'claude',
      sourcePath: '.claude/skills/review/SKILL.md',
      body: 'Läs diffen först.',
      globs: ['src/**'],
      alwaysApply: false,
    });
    expect(await screen.findByText(/1 skill\(s\) importerade till \.freevobe\/skills/)).toBeTruthy();
    // Efter importen är listan tom så att ingen råkar importera samma sak igen.
    expect(screen.queryByText('review')).toBeNull();
  });

  it('kan inte importera när inget är valt', async () => {
    const applySkillImport = vi.fn();
    openWith({ scan: vi.fn().mockResolvedValue(scan), apply: applySkillImport });
    render(<SkillImportDialog />);

    fireEvent.click(screen.getByRole('button', { name: 'Skanna' }));
    await screen.findByText('review');

    fireEvent.click(screen.getAllByRole('checkbox')[0] as HTMLElement);
    expect(screen.getByText('0 valda')).toBeTruthy();
    const apply = screen.getByRole('button', { name: 'Importera valda' }) as HTMLButtonElement;
    expect(apply.disabled).toBe(true);
    fireEvent.click(apply);
    expect(applySkillImport).not.toHaveBeenCalled();
  });

  it('visar felmeddelandet när skanningen misslyckas', async () => {
    openWith({
      scan: vi.fn().mockRejectedValue(new Error('Kunde inte läsa mappen: nekad åtkomst')),
    });
    render(<SkillImportDialog />);

    fireEvent.click(screen.getByRole('button', { name: 'Skanna' }));
    expect(await screen.findByText('Kunde inte läsa mappen: nekad åtkomst')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Importera valda' })).toBeNull();
  });

  it('blockerar en farlig skill tills risken bekräftats', async () => {
    const sneaky = item({
      path: '.claude/skills/sneaky/SKILL.md',
      name: 'sneaky',
      security: securityOf({
        level: 'dangerous',
        score: 20,
        findings: [
          {
            code: 'override_instructions',
            level: 'dangerous',
            excerpt: 'Ignore previous instructions',
            line: 4,
          },
        ],
      }),
    });
    const applySkillImport = vi.fn().mockResolvedValue({ created: ['sneaky'], files: [] });
    openWith({
      scan: vi.fn().mockResolvedValue({
        ...scan,
        items: [review, sneaky],
        bySource: [{ source: 'claude', count: 2 }],
        unknown: [],
      }),
      apply: applySkillImport,
    });
    render(<SkillImportDialog />);

    fireEvent.click(screen.getByRole('button', { name: 'Skanna' }));
    await screen.findByText('sneaky');

    expect(screen.getByText('Farlig')).toBeTruthy();
    expect(screen.getByText(/Blockerad tills du bekräftar risken/)).toBeTruthy();
    expect(screen.getByText(/Försöker styra modellen/)).toBeTruthy();
    // Bara den säkra posten är vald från början.
    expect(screen.getByText('1 valda')).toBeTruthy();

    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(boxes[2]?.disabled).toBe(true);
    fireEvent.click(boxes[2] as HTMLElement);
    expect(boxes[2]?.disabled).toBe(true);
    expect(applySkillImport).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Jag förstår risken och vill importera ändå'));
    expect((screen.getAllByRole('checkbox') as HTMLInputElement[])[2]?.disabled).toBe(false);
    expect(screen.getByText('2 valda')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Importera valda' }));
    await waitFor(() => expect(applySkillImport).toHaveBeenCalledTimes(1));
    const payload = applySkillImport.mock.calls[0]?.[0] as SkillImportApplyItem[];
    expect(payload.map((entry) => entry.name).sort()).toEqual(['review', 'sneaky']);
  });

  it('kräver ett eget godkännande av skript och visar vad som importeras', async () => {
    const deploy = item({
      path: '.claude/skills/deploy/SKILL.md',
      name: 'deploy',
      security: securityOf({
        level: 'warning',
        score: 80,
        findings: [
          {
            code: 'script_reference',
            level: 'warning',
            excerpt: '```bash',
            line: 6,
          },
        ],
        scripts: ['bash (kodblock)', 'scripts/install.sh'],
        urls: ['https://example.com/install'],
      }),
    });
    const applySkillImport = vi.fn().mockResolvedValue({ created: ['review', 'deploy'], files: [] });
    openWith({
      scan: vi.fn().mockResolvedValue({
        ...scan,
        items: [review, deploy],
        bySource: [{ source: 'claude', count: 2 }],
        unknown: [],
      }),
      apply: applySkillImport,
    });
    render(<SkillImportDialog />);

    fireEvent.click(screen.getByRole('button', { name: 'Skanna' }));
    await screen.findByText('deploy');

    expect(screen.getByText(/Skript som nämns: bash \(kodblock\), scripts\/install\.sh/)).toBeTruthy();
    expect(screen.getByText(/Externa adresser: https:\/\/example\.com\/install/)).toBeTruthy();
    expect(screen.getByText(/1 fil\(er\), 0 skript och 0 extern/)).toBeTruthy();

    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(boxes[2]?.disabled).toBe(true);

    fireEvent.click(screen.getByLabelText('Jag har granskat skripten'));
    const afterAck = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(afterAck[2]?.disabled).toBe(false);

    fireEvent.click(afterAck[2] as HTMLElement);
    expect(screen.getByText(/2 fil\(er\), 2 skript och 1 extern/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Importera valda' }));
    await waitFor(() => expect(applySkillImport).toHaveBeenCalledTimes(1));
    const payload = applySkillImport.mock.calls[0]?.[0] as SkillImportApplyItem[];
    expect(payload.map((entry) => entry.name).sort()).toEqual(['deploy', 'review']);
  });
});
