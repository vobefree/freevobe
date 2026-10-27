import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { Button, Chip, EmptyState } from '../ui';
import { RISK_LABELS } from '../../lib/format';
import { DiffLineList } from './DiffPane';
import type { PendingApproval } from '../../store/appStore';

function QuestionBlock({
  approval,
  answers,
  onToggle,
  onText,
}: {
  approval: PendingApproval;
  answers: Record<string, string[]>;
  onToggle: (questionId: string, label: string, multiSelect: boolean) => void;
  onText: (questionId: string, value: string) => void;
}) {
  if (!approval.questions?.length) return null;
  return (
    <div className="mt-2 space-y-2">
      {approval.questions.map((question) => (
        <fieldset key={question.id} className="rounded border border-steel p-2">
          <legend className="px-1 text-[10px] tracking-wide text-slate-500 uppercase">
            {question.header}
          </legend>
          <p className="mb-1.5 text-xs text-slate-300">{question.question}</p>
          <div className="space-y-1">
            {question.options.map((option) => {
              const selected = (answers[question.id] ?? []).includes(option.label);
              return (
                <label
                  key={option.label}
                  className="flex cursor-pointer items-start gap-2 text-xs text-slate-300"
                >
                  <input
                    type={question.multiSelect ? 'checkbox' : 'radio'}
                    name={question.id}
                    checked={selected}
                    onChange={() =>
                      onToggle(question.id, option.label, Boolean(question.multiSelect))
                    }
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium">{option.label}</span>
                    {option.description ? (
                      <span className="text-slate-500"> – {option.description}</span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>
          <input
            placeholder="Eget svar…"
            onChange={(event) => onText(question.id, event.target.value)}
            className="mt-1.5 w-full rounded border border-steel bg-anvil px-2 py-1 text-xs text-slate-200 placeholder:text-slate-600"
          />
        </fieldset>
      ))}
    </div>
  );
}

export function ApprovalCard({ approval }: { approval: PendingApproval }) {
  const resolveApproval = useAppStore((state) => state.resolveApproval);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [showDiff, setShowDiff] = useState(true);

  const toggle = (questionId: string, label: string, multiSelect: boolean) => {
    setAnswers((current) => {
      const existing = current[questionId] ?? [];
      if (!multiSelect)
        return { ...current, [questionId]: existing.includes(label) ? [] : [label] };
      return {
        ...current,
        [questionId]: existing.includes(label)
          ? existing.filter((entry) => entry !== label)
          : [...existing, label],
      };
    });
  };

  const setText = (questionId: string, value: string) => {
    setAnswers((current) => ({ ...current, [questionId]: value.trim() ? [value] : [] }));
  };

  // Skicka bara med svar när användaren faktiskt svarat på något.
  const submittedAnswers = Object.values(answers).some((entries) => entries.length > 0)
    ? answers
    : undefined;

  return (
    <article
      data-testid="approval-card"
      className={`vf-panel p-2.5 ${approval.risk === 'high' || approval.hardBlock ? 'border-alert/60' : ''}`}
    >
      <header className="flex items-center gap-2">
        <Chip
          tone={
            approval.risk === 'high' ? 'alert' : approval.risk === 'medium' ? 'ember' : 'neutral'
          }
        >
          {RISK_LABELS[approval.risk]}
        </Chip>
        <span className="text-xs font-semibold text-slate-200">{approval.title}</span>
        <span className="ml-auto text-[10px] text-slate-600">{approval.kind}</span>
      </header>

      <p className="mt-1 text-[11.5px] text-slate-400">{approval.detail}</p>
      <p className="mt-0.5 text-[10px] text-slate-600">{approval.reason}</p>

      {approval.hardBlock ? (
        <p className="mt-1 rounded border border-alert/40 bg-alert/10 px-2 py-1 text-[10px] text-alert">
          Skyddad åtgärd: körs aldrig automatiskt, även i full auto.
        </p>
      ) : null}

      {approval.command ? (
        <pre className="mt-1.5 overflow-x-auto rounded border border-steel bg-anvil px-2 py-1 font-mono text-[11px] text-spark">
          {approval.command}
        </pre>
      ) : null}
      {approval.url ? <p className="mt-1 font-mono text-[11px] text-sky">{approval.url}</p> : null}
      {approval.path ? (
        <p className="mt-1 font-mono text-[11px] text-slate-400">{approval.path}</p>
      ) : null}

      {approval.diff ? (
        <div className="mt-2 rounded border border-steel">
          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-2 border-b border-steel px-2 py-1 text-[10px] text-slate-500"
            onClick={() => setShowDiff((value) => !value)}
          >
            <span className="font-mono">{approval.diff.path}</span>
            <span className="ml-auto">
              +{approval.diff.additions} −{approval.diff.deletions} · {showDiff ? 'dölj' : 'visa'}
            </span>
          </button>
          {showDiff ? (
            <div className="max-h-64 overflow-auto">
              <DiffLineList diff={approval.diff} />
            </div>
          ) : null}
        </div>
      ) : null}

      <QuestionBlock approval={approval} answers={answers} onToggle={toggle} onText={setText} />

      <footer className="mt-2 flex items-center gap-2">
        <Button
          variant="primary"
          onClick={() => void resolveApproval(approval.id, 'approved', submittedAnswers)}
          testId="approve"
        >
          Godkänn
        </Button>
        <Button
          variant="danger"
          onClick={() => void resolveApproval(approval.id, 'rejected', submittedAnswers)}
        >
          Avvisa
        </Button>
        <span className="text-[10px] text-slate-600">Beslutet loggas i sessionshistoriken.</span>
      </footer>
    </article>
  );
}

export function ApprovalPane() {
  const approvals = useAppStore((state) => state.approvals);
  const permissionMode = useAppStore((state) => state.permissionMode);

  if (approvals.length === 0) {
    return (
      <EmptyState
        title="Inget väntar på besked"
        hint={`Behörighetsläge: ${permissionMode}. Ändringar och kommandon som kräver ditt godkännande hamnar här.`}
      />
    );
  }

  return (
    <div className="space-y-2 p-2">
      {approvals.map((approval) => (
        <ApprovalCard key={approval.id} approval={approval} />
      ))}
    </div>
  );
}
