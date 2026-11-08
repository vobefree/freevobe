import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store/appStore';
import { Button, Chip, EmptyState } from '../ui';
import { PHASE_LABELS, clockTime } from '../../lib/format';

const KIND_COLOR: Record<string, string> = {
  run: 'bg-mint',
  phase: 'bg-slate-500',
  route: 'bg-sky',
  tool: 'bg-ember',
  result: 'bg-mint',
  approval: 'bg-spark',
  diff: 'bg-sky',
  verify: 'bg-mint',
  preview: 'bg-mint',
  checkpoint: 'bg-spark',
  error: 'bg-alert',
  pull: 'bg-sky',
};

/**
 * Control Room: en samlad tidslinje över allt som händer i körningarna – modellval, verktyg,
 * godkännanden, diffar, verifiering, preview och checkpoints. Varje rad kommer från en händelse
 * som redan gick genom agenten; vyn lägger inget till och döljer inget.
 */
export function ControlRoomPane() {
  const { t } = useTranslation();
  const timeline = useAppStore((state) => state.timeline);
  const phase = useAppStore((state) => state.phase);
  const model = useAppStore((state) => state.selectedModel);
  const isRunning = useAppStore((state) => state.isRunning);
  const preview = useAppStore((state) => state.preview);
  const clearTimeline = useAppStore((state) => state.clearTimeline);

  const entries = [...timeline].reverse();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b border-steel p-2">
        <span className="text-xs font-semibold text-slate-200">{t('control.title')}</span>
        <Chip tone={isRunning ? 'mint' : 'neutral'}>
          {isRunning
            ? (PHASE_LABELS[phase as keyof typeof PHASE_LABELS] ?? phase)
            : t('control.idle')}
        </Chip>
        <span className="truncate font-mono text-[10.5px] text-slate-500">
          {model || t('topbar.noModel')}
        </span>
        {preview?.status === 'running' ? <Chip tone="mint">{t('control.previewOn')}</Chip> : null}
        <span className="ml-auto text-[10px] text-slate-600">
          {t('control.count', { count: timeline.length })}
        </span>
        <Button onClick={clearTimeline} title={t('control.clear')}>
          {t('control.clear')}
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {entries.length === 0 ? (
          <EmptyState title={t('control.empty')} hint={t('control.emptyHint')} />
        ) : (
          <ul className="space-y-1">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-start gap-2 rounded px-1 py-0.5">
                <span
                  className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                    KIND_COLOR[entry.kind] ?? 'bg-slate-600'
                  }`}
                />
                <span className="shrink-0 font-mono text-[10px] text-slate-600">
                  {clockTime(entry.at)}
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] break-words text-slate-300">{entry.text}</p>
                  {entry.detail ? (
                    <p className="font-mono text-[10px] break-words text-slate-600">
                      {entry.detail}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
