import type { ApprovalRequest } from '@/api/types';

/**
 * Regler för godkännanden.
 *
 * Kraven är tydliga: "Approve all" får finnas för enkla ändringar, men destruktiva ändringar ska
 * alltid kräva ett eget svar. Den regeln bor här – inte i en skärm – så att den gäller varje väg
 * genom appen och kan testas.
 */

/** Sant när godkännandet ändrar något som inte går att ångra med en omkörning. */
export function isDestructive(approval: ApprovalRequest): boolean {
  if (approval.hardBlock) return true;
  if (approval.kind === 'file_delete') return true;
  if (approval.risk === 'high') return true;
  // Ett terminalkommando vi inte kan förutse risken med behandlas som destruktivt.
  return false;
}

export function requiresIndividualApproval(approval: ApprovalRequest): boolean {
  return isDestructive(approval) || approval.kind === 'user_question';
}

export interface ApprovalBatch {
  /** Får godkännas i grupp ("Approve all"). */
  batchable: ApprovalRequest[];
  /** Måste godkännas ett i taget, alltid med diffen eller kommandot synligt. */
  individual: ApprovalRequest[];
}

export function splitApprovals(approvals: ApprovalRequest[]): ApprovalBatch {
  const batchable: ApprovalRequest[] = [];
  const individual: ApprovalRequest[] = [];
  for (const approval of approvals) {
    (requiresIndividualApproval(approval) ? individual : batchable).push(approval);
  }
  return { batchable, individual };
}

/** Kort beskrivning av vad godkännandet gäller, för listrader och notiser. */
export function approvalSummary(approval: ApprovalRequest): string {
  if (approval.command) {
    return [approval.command, ...(approval.args ?? [])].join(' ');
  }
  if (approval.path) return approval.path;
  if (approval.url) return approval.url;
  return approval.detail;
}

export const RISK_LABELS: Record<ApprovalRequest['risk'], string> = {
  low: 'Låg risk',
  medium: 'Medelrisk',
  high: 'Hög risk',
};

export const APPROVAL_KIND_LABELS: Record<ApprovalRequest['kind'], string> = {
  file_write: 'Filändring',
  file_delete: 'Fil bort',
  terminal: 'Terminalkommando',
  browser: 'Webbläsare',
  network: 'Nätverksanrop',
  mcp: 'MCP-verktyg',
  git_commit: 'Commit',
  user_question: 'Fråga',
};
