import { useAppStore } from '../../store/appStore';
import { Chip, EmptyState } from '../ui';
import { diffSummary, diffWeight, renderDiff } from '../../lib/diffRender';
import { RISK_LABELS } from '../../lib/format';
import type { RiskLevel } from '@vibeforge/protocol';

const RISK_TONE: Record<RiskLevel, 'neutral' | 'ember' | 'alert'> = {
  low: 'neutral',
  medium: 'ember',
  high: 'alert',
};

export function DiffLineList({ diff }: { diff: Parameters<typeof renderDiff>[0] }) {
  const lines = renderDiff(diff);
  return (
    <div className="overflow-x-auto font-mono text-[11.5px] leading-5">
      {lines.map((line, index) => (
        <div
          key={`${index}-${line.text.slice(0, 12)}`}
          className={`flex gap-2 px-2 ${
            line.kind === 'add'
              ? 'bg-mint/10 text-mint'
              : line.kind === 'remove'
                ? 'bg-alert/10 text-alert'
                : line.kind === 'meta'
                  ? 'bg-steel/40 text-sky'
                  : 'text-slate-400'
          }`}
        >
          <span className="w-8 shrink-0 text-right text-slate-600 select-none">
            {line.oldNumber ?? ''}
          </span>
          <span className="w-8 shrink-0 text-right text-slate-600 select-none">
            {line.newNumber ?? ''}
          </span>
          <span className="w-3 shrink-0 select-none">
            {line.kind === 'add' ? '+' : line.kind === 'remove' ? '−' : ''}
          </span>
          <span className="whitespace-pre">{line.text}</span>
        </div>
      ))}
    </div>
  );
}

export function DiffPane() {
  const diffs = useAppStore((state) => state.diffs);
  const activeDiffId = useAppStore((state) => state.activeDiffId);
  const setActiveDiff = useAppStore((state) => state.setActiveDiff);
  const openFile = useAppStore((state) => state.openFile);

  if (diffs.length === 0) {
    return (
      <EmptyState
        title="Inga ändringar än"
        hint="När agenten föreslår eller skriver en fil visas diffen här. Ingenting sparas i ditt projekt utan att du ser den först."
      />
    );
  }

  const active = diffs.find((diff) => diff.id === activeDiffId) ?? diffs[diffs.length - 1];
  if (!active) return <EmptyState title="Ingen diff vald" />;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="max-h-40 shrink-0 overflow-y-auto border-b border-steel">
        {diffs
          .slice()
          .reverse()
          .map((diff) => (
            <button
              key={diff.id}
              type="button"
              onClick={() => setActiveDiff(diff.id)}
              className={`flex w-full cursor-pointer items-center gap-2 px-2.5 py-1.5 text-left text-[11.5px] ${
                diff.id === active.id
                  ? 'bg-steel/40 text-slate-200'
                  : 'text-slate-500 hover:bg-steel/20'
              }`}
            >
              <span
                className={`font-mono ${
                  diff.kind === 'create'
                    ? 'text-mint'
                    : diff.kind === 'delete'
                      ? 'text-alert'
                      : 'text-spark'
                }`}
              >
                {diff.kind === 'create' ? 'A' : diff.kind === 'delete' ? 'D' : 'M'}
              </span>
              <span className="truncate font-mono" title={diff.path}>
                {diff.path}
              </span>
              <span className="ml-auto shrink-0 text-[10px] text-slate-600">
                +{diff.additions} −{diff.deletions}
              </span>
            </button>
          ))}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-b border-steel px-2.5 py-1.5">
        <span className="truncate font-mono text-[11.5px] text-slate-300">
          {diffSummary(active)}
        </span>
        <Chip tone={active.kind === 'delete' ? 'alert' : 'neutral'}>{active.kind}</Chip>
        <Chip tone={diffWeight(active) === 'stor' ? 'alert' : 'neutral'}>{diffWeight(active)}</Chip>
        <button
          type="button"
          className="ml-auto cursor-pointer text-[10px] text-slate-500 underline decoration-dotted"
          onClick={() => void openFile(active.path)}
        >
          öppna fil
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {active.binary ? (
          <p className="p-3 text-xs text-slate-500">Binär fil – ingen textdiff tillgänglig.</p>
        ) : (
          <DiffLineList diff={active} />
        )}
      </div>

      <footer className="shrink-0 border-t border-steel px-2.5 py-1.5 text-[10px] text-slate-600">
        Diffen är oföränderlig: {active.additions} tillagda och {active.deletions} borttagna rader i{' '}
        {active.absolutePath}
      </footer>
    </div>
  );
}

export { RISK_TONE, RISK_LABELS };
