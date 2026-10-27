import { describe, expect, it } from 'vitest';
import type { ApprovalRequest } from '@/api/types';
import { approvalSummary, isDestructive, requiresIndividualApproval, splitApprovals } from './approvals';

function approval(overrides: Partial<ApprovalRequest>): ApprovalRequest {
  return {
    id: 'a1',
    runId: 'run.1',
    kind: 'file_write',
    title: 'Skriv över fil',
    detail: 'detalj',
    risk: 'low',
    reason: 'behörighetsläge: ask',
    hardBlock: false,
    createdAt: 0,
    ...overrides,
  };
}

describe('isDestructive', () => {
  it('flaggar borttagning, hög risk och hårda blockeringar', () => {
    expect(isDestructive(approval({ kind: 'file_delete' }))).toBe(true);
    expect(isDestructive(approval({ risk: 'high' }))).toBe(true);
    expect(isDestructive(approval({ hardBlock: true }))).toBe(true);
  });

  it('tillåter vanliga filändringar och kommandon med låg risk', () => {
    expect(isDestructive(approval({ risk: 'low' }))).toBe(false);
    expect(isDestructive(approval({ kind: 'terminal', risk: 'medium' }))).toBe(false);
  });
});

describe('requiresIndividualApproval', () => {
  it('kräver eget svar för frågor till användaren', () => {
    expect(requiresIndividualApproval(approval({ kind: 'user_question', risk: 'low' }))).toBe(true);
  });
});

describe('splitApprovals', () => {
  it('delar upp i gruppgodkännbara och enskilda', () => {
    const batchable = approval({ id: 'ok', risk: 'medium' });
    const destructive = approval({ id: 'farlig', kind: 'file_delete', risk: 'high' });
    const result = splitApprovals([batchable, destructive]);
    expect(result.batchable.map((item) => item.id)).toEqual(['ok']);
    expect(result.individual.map((item) => item.id)).toEqual(['farlig']);
  });

  it('lägger allt i individual när inget får godkännas i grupp', () => {
    const result = splitApprovals([approval({ id: 'a', hardBlock: true }), approval({ id: 'b', risk: 'high' })]);
    expect(result.batchable).toHaveLength(0);
    expect(result.individual).toHaveLength(2);
  });
});

describe('approvalSummary', () => {
  it('visar hela kommandot inklusive argument', () => {
    expect(
      approvalSummary(approval({ kind: 'terminal', command: 'npm', args: ['test', '--run'] })),
    ).toBe('npm test --run');
  });

  it('faller tillbaka på sökväg och detalj', () => {
    expect(approvalSummary(approval({ path: 'src/a.ts' }))).toBe('src/a.ts');
    expect(approvalSummary(approval({ detail: 'bara en detalj' }))).toBe('bara en detalj');
  });
});
