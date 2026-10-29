/**
 * Plan/Act: en plan läggs fram i Plan-läget, godkänns av användaren och blir sedan ett kontrakt
 * som styr vad agenten får ändra. Typerna här delas av agent-core, agent-server och gränssnittet.
 */

export type PlanStatus = 'proposed' | 'approved' | 'rejected' | 'superseded';

export interface PlanStep {
  id: string;
  title: string;
  /** Projektrelativa filer steget rör. Tom lista = steget är inte knutet till några filer. */
  files: string[];
}

export interface Plan {
  id: string;
  sessionId: string;
  /** Körningen som lade fram planen. */
  runId: string;
  title: string;
  summary: string;
  steps: PlanStep[];
  /**
   * Alla filer planen får ändra. Tom lista betyder att planen inte namnger några filer –
   * då begränsar kontraktet inte filvägarna, bara det faktum att planen är godkänd.
   */
  files: string[];
  status: PlanStatus;
  createdAt: number;
  decidedAt?: number;
}

/** Sant när planen är godkänd och därmed gäller som kontrakt för sessionen. */
export function isActivePlan(plan: Plan): boolean {
  return plan.status === 'approved';
}

/** Normaliserar en projektrelativ sökväg så att jämförelser blir förutsägbara. */
export function normalizePlanPath(entry: string): string {
  return entry
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
}
