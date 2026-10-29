import { useTranslation } from 'react-i18next';
import type { Plan } from '@freevobe/protocol';
import { useAppStore } from '../../store/appStore';
import { Button, Chip } from '../ui';
import { clockTime } from '../../lib/format';

const STATUS_KEYS: Record<Plan['status'], string> = {
  proposed: 'plan.statusProposed',
  approved: 'plan.statusApproved',
  rejected: 'plan.statusRejected',
  superseded: 'plan.statusSuperseded',
};

/**
 * Plan/Act: planen visas i chatten och är det enda sättet för agenten att få skriva. Innan
 * användaren godkänt den är knapparna det enda som händer – agenten har redan nekats skrivning
 * av Plan-läget.
 */
export function PlanCard({ plan }: { plan: Plan }) {
  const { t } = useTranslation();
  const decidePlan = useAppStore((state) => state.decidePlan);
  const isRunning = useAppStore((state) => state.isRunning);
  const mode = useAppStore((state) => state.mode);

  const proposed = plan.status === 'proposed';
  const approved = plan.status === 'approved';
  const contractSummary =
    plan.files.length === 0
      ? t('plan.noFiles')
      : t('plan.filesInContract', { count: plan.files.length });

  return (
    <article
      data-testid="plan-card"
      className={`vf-panel p-3 ${
        proposed ? 'border-ember/50' : approved ? 'border-mint/40' : 'border-steel/60 opacity-80'
      }`}
    >
      <header className="flex flex-wrap items-center gap-2">
        <Chip tone={proposed ? 'ember' : approved ? 'mint' : 'neutral'}>{t('plan.badge')}</Chip>
        <span className="text-sm font-semibold text-slate-100" data-testid="plan-title">
          {plan.title}
        </span>
        <span className="ml-auto text-[10px] text-slate-600">
          {clockTime(plan.createdAt)} · {t(STATUS_KEYS[plan.status])}
        </span>
      </header>

      {plan.summary ? (
        <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{plan.summary}</p>
      ) : null}

      <details open={proposed} className="mt-2">
        <summary className="cursor-pointer text-[10px] tracking-wide text-slate-500 uppercase select-none">
          {t('plan.steps', { count: plan.steps.length, files: contractSummary })}
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
          {t('plan.contract', { count: plan.files.length, list: plan.files.join(', ') })}
        </p>
      ) : (
        <p className="mt-1.5 text-[10px] text-slate-500">{t('plan.noFileNotice')}</p>
      )}

      {proposed ? (
        <>
          <p className="mt-2 rounded border border-steel bg-forge/60 px-2 py-1 text-[10.5px] text-slate-400">
            {t('plan.approveNotice')}
          </p>
          <footer className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              testId="approve-plan"
              disabled={isRunning}
              onClick={() => void decidePlan(plan.id, 'approved', { run: true })}
              title={t('plan.approveRunTitle')}
            >
              {t('plan.approveRun')}
            </Button>
            <Button
              testId="approve-plan-only"
              disabled={isRunning}
              onClick={() => void decidePlan(plan.id, 'approved')}
              title={t('plan.approveOnlyTitle')}
            >
              {t('plan.approveOnly')}
            </Button>
            <Button
              variant="danger"
              testId="reject-plan"
              disabled={isRunning}
              onClick={() => void decidePlan(plan.id, 'rejected')}
            >
              {t('plan.reject')}
            </Button>
            <span className="text-[10px] text-slate-600">{t('plan.decisionSaved')}</span>
          </footer>
        </>
      ) : null}

      {proposed && mode === 'execute' ? (
        <p className="mt-2 text-[10px] text-spark">{t('plan.tip')}</p>
      ) : null}
    </article>
  );
}
