import type { Plan } from '@freevobe/protocol';
import { useAppStore } from '../../store/appStore';
import { Button, Chip } from '../ui';
import { clockTime } from '../../lib/format';

function contractSummary(plan: Plan): string {
  const files = plan.files.length;
  return files === 0
    ? 'inga namngivna filer'
    : `${files} fil${files === 1 ? '' : 'er'} i kontraktet`;
}

const STATUS_LABELS: Record<Plan['status'], string> = {
  proposed: 'Väntar på ditt beslut',
  approved: 'Godkänd – gäller som kontrakt',
  rejected: 'Avvisad',
  superseded: 'Ersatt av en nyare plan',
};

/**
 * Plan/Act: planen visas i chatten och är det enda sättet för agenten att få skriva. Innan
 * användaren godkänt den är knapparna det enda som händer – agenten har redan nekats skrivning
 * av Plan-läget.
 */
export function PlanCard({ plan }: { plan: Plan }) {
  const decidePlan = useAppStore((state) => state.decidePlan);
  const isRunning = useAppStore((state) => state.isRunning);
  const mode = useAppStore((state) => state.mode);

  const proposed = plan.status === 'proposed';
  const approved = plan.status === 'approved';

  return (
    <article
      data-testid="plan-card"
      className={`vf-panel p-3 ${
        proposed ? 'border-ember/50' : approved ? 'border-mint/40' : 'border-steel/60 opacity-80'
      }`}
    >
      <header className="flex flex-wrap items-center gap-2">
        <Chip tone={proposed ? 'ember' : approved ? 'mint' : 'neutral'}>Plan</Chip>
        <span className="text-sm font-semibold text-slate-100" data-testid="plan-title">
          {plan.title}
        </span>
        <span className="ml-auto text-[10px] text-slate-600">
          {clockTime(plan.createdAt)} · {STATUS_LABELS[plan.status]}
        </span>
      </header>

      {plan.summary ? (
        <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{plan.summary}</p>
      ) : null}

      <details open={proposed} className="mt-2">
        <summary className="cursor-pointer text-[10px] tracking-wide text-slate-500 uppercase select-none">
          {plan.steps.length} steg · {contractSummary(plan)}
        </summary>
        <ol className="mt-1.5 space-y-1.5" data-testid="plan-steps">
          {plan.steps.map((step, index) => (
            <li key={step.id} className="text-xs text-slate-300">
              <span className="mr-1.5 font-mono text-[10px] text-slate-600">{index + 1}.</span>
              {step.title}
              {step.files.length > 0 ? (
                <span className="ml-1.5 font-mono text-[10px] text-slate-500">
                  {step.files.join(', ')}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </details>

      {plan.files.length > 0 ? (
        <p className="mt-1.5 font-mono text-[10px] text-slate-500">
          Kontrakt: {plan.files.length} fil{plan.files.length === 1 ? '' : 'er'} ·{' '}
          {plan.files.join(', ')}
        </p>
      ) : (
        <p className="mt-1.5 text-[10px] text-slate-500">
          Planen namnger inga filer. Agenten får skriva i projektet men ska följa stegen.
        </p>
      )}

      {proposed ? (
        <>
          <p className="mt-2 rounded border border-steel bg-forge/60 px-2 py-1 text-[10.5px] text-slate-400">
            Ingenting skrivs förrän du godkänt planen. Godkännandet växlar chatten till
            Execute-läget och gör planen till ett kontrakt för filerna ovan.
          </p>
          <footer className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              testId="approve-plan"
              disabled={isRunning}
              onClick={() => void decidePlan(plan.id, 'approved', { run: true })}
              title="Godkänn planen och låt agenten utföra den"
            >
              Godkänn & utför
            </Button>
            <Button
              testId="approve-plan-only"
              disabled={isRunning}
              onClick={() => void decidePlan(plan.id, 'approved')}
              title="Godkänn planen utan att starta en körning"
            >
              Godkänn utan att köra
            </Button>
            <Button
              variant="danger"
              testId="reject-plan"
              disabled={isRunning}
              onClick={() => void decidePlan(plan.id, 'rejected')}
            >
              Avvisa
            </Button>
            <span className="text-[10px] text-slate-600">Beslutet sparas i sessionen.</span>
          </footer>
        </>
      ) : null}

      {proposed && mode === 'execute' ? (
        <p className="mt-2 text-[10px] text-spark">
          Tipset: växla till Plan-läget om du vill ha en ny plan innan agenten skriver.
        </p>
      ) : null}
    </article>
  );
}
