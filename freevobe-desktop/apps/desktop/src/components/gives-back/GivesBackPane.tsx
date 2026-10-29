import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GIVES_BACK_CAUSES,
  MAX_CONTRIBUTION_NOTE_CHARS,
  findCause,
  formatSek,
  resolveCauses,
  type Contribution,
} from '@freevobe/protocol';
import { useAppStore } from '../../store/appStore';
import { Button, EmptyState } from '../ui';

function causeName(causeId: string): string {
  return findCause(causeId)?.name ?? causeId;
}

/** Ett stöd som användaren själv registrerat. */
function ContributionRow({
  entry,
  onDelete,
}: {
  entry: Contribution;
  onDelete: (id: string) => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const cause = findCause(entry.causeId);
  const [busy, setBusy] = useState(false);
  return (
    <article className="vf-panel p-2" data-testid="contribution-row">
      <header className="flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-200">{causeName(entry.causeId)}</span>
        <span className="ml-auto font-mono text-[11px] text-mint">
          {entry.amountSek > 0 ? formatSek(entry.amountSek) : t('givesBack.pane.noAmount')}
        </span>
      </header>
      <p className="mt-0.5 text-[10.5px] text-slate-600">
        {new Date(entry.createdAt).toLocaleDateString(i18n.language)} ·{' '}
        {t('givesBack.pane.ownReport')}
      </p>
      {entry.note ? <p className="mt-1 text-[11px] text-slate-400">{entry.note}</p> : null}
      <footer className="mt-1.5 flex items-center gap-2">
        {cause ? (
          <a
            className="text-[10.5px] text-sky hover:underline"
            href={cause.url}
            target="_blank"
            rel="noreferrer noopener"
          >
            {cause.name}
          </a>
        ) : null}
        <Button
          variant="danger"
          className="ml-auto"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onDelete(entry.id);
            setBusy(false);
          }}
        >
          {t('givesBack.pane.remove')}
        </Button>
      </footer>
    </article>
  );
}

/**
 * Panelen Gives Back: användarens egen logg, katalogen och en tydlig gräns mot pengar.
 *
 * Ingen del av panelen gör anspråk på att ha tagit emot eller förmedlat ett bidrag. Det som
 * visas är det användaren själv skrivit in, sparat lokalt i samma databas som sessionshistoriken.
 */
export function GivesBackPane() {
  const { t } = useTranslation();
  const entries = useAppStore((state) => state.contributions);
  const summary = useAppStore((state) => state.contributionsSummary);
  const config = useAppStore((state) => state.settings?.givesBack ?? null);
  const loadContributions = useAppStore((state) => state.loadContributions);
  const deleteContribution = useAppStore((state) => state.deleteContribution);
  const logContribution = useAppStore((state) => state.logContribution);
  const updateSettings = useAppStore((state) => state.updateSettings);

  const [causeId, setCauseId] = useState(GIVES_BACK_CAUSES[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadContributions();
  }, [loadContributions]);

  const selected = resolveCauses(config?.causeIds ?? []);
  const enabled = config?.enabled ?? false;

  const submit = async () => {
    const parsed = amount.trim() === '' ? 0 : Number(amount.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError(t('givesBack.pane.invalidAmount'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await logContribution({
        causeId,
        amountSek: Math.round(parsed),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      setAmount('');
      setNote('');
    } catch (causeError) {
      setError(causeError instanceof Error ? causeError.message : String(causeError));
    } finally {
      setBusy(false);
    }
  };

  const toggleCause = async (id: string) => {
    if (!config) return;
    const current = config.causeIds;
    const next = current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id];
    // Tom lista betyder "alla" – då får ett tomt urval aldrig bli ett tomt urval av misstag.
    await updateSettings({
      givesBack: { ...config, causeIds: next.length === GIVES_BACK_CAUSES.length ? [] : next },
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-steel p-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-200">Gives Back</span>
          <span
            className={`rounded border px-1.5 py-0.5 text-[10px] ${
              enabled ? 'border-mint/40 text-mint' : 'border-steel text-slate-500'
            }`}
          >
            {enabled ? t('givesBack.pane.onInChat') : t('givesBack.pane.off')}
          </span>
          <span className="ml-auto text-[10.5px] text-slate-500" data-testid="gives-back-summary">
            {t('givesBack.pane.summary', {
              count: summary.count,
              total: formatSek(summary.totalSek),
            })}
          </span>
        </div>
        <p className="mt-1 text-[10.5px] text-slate-600">{t('givesBack.pane.notice')}</p>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        <section className="space-y-1.5">
          <h3 className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
            {t('givesBack.pane.causes')}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {GIVES_BACK_CAUSES.map((cause) => {
              const active = selected.some((entry) => entry.id === cause.id);
              return (
                <button
                  key={cause.id}
                  type="button"
                  onClick={() => void toggleCause(cause.id)}
                  aria-pressed={active}
                  data-testid={`cause-toggle-${cause.id}`}
                  className={`cursor-pointer rounded border px-2 py-1 text-[10.5px] ${
                    active
                      ? 'border-mint/50 bg-mint/10 text-mint'
                      : 'border-steel text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {cause.name}
                </button>
              );
            })}
          </div>
        </section>

        <form
          className="space-y-1.5 rounded border border-steel/70 p-2"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <h3 className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
            {t('givesBack.pane.logTitle')}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            <select
              value={causeId}
              onChange={(event) => setCauseId(event.target.value)}
              data-testid="gives-back-cause"
              className="rounded border border-steel bg-anvil px-2 py-1 text-xs text-slate-200"
            >
              {GIVES_BACK_CAUSES.map((cause) => (
                <option key={cause.id} value={cause.id}>
                  {cause.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              step={1}
              value={amount}
              placeholder={t('givesBack.pane.amountPlaceholder')}
              data-testid="gives-back-pane-amount"
              onChange={(event) => setAmount(event.target.value)}
              className="w-28 rounded border border-steel bg-anvil px-2 py-1 text-xs text-slate-200"
            />
            <input
              value={note}
              maxLength={MAX_CONTRIBUTION_NOTE_CHARS}
              placeholder={t('givesBack.pane.notePlaceholder')}
              data-testid="gives-back-pane-note"
              onChange={(event) => setNote(event.target.value)}
              className="min-w-[10rem] flex-1 rounded border border-steel bg-anvil px-2 py-1 text-xs text-slate-200"
            />
            <Button type="submit" variant="primary" disabled={busy}>
              {t('givesBack.pane.save')}
            </Button>
          </div>
          <p className="text-[10px] text-slate-600">{t('givesBack.pane.disclaimer')}</p>
          {error ? <p className="text-[10.5px] text-alert">{error}</p> : null}
        </form>

        {entries.length === 0 ? (
          <EmptyState title={t('givesBack.pane.emptyTitle')} hint={t('givesBack.pane.emptyHint')} />
        ) : (
          entries.map((entry) => (
            <ContributionRow key={entry.id} entry={entry} onDelete={deleteContribution} />
          ))
        )}
      </div>
    </div>
  );
}
