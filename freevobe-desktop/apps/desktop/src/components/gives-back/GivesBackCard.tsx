import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GIVES_BACK_INTERVAL_PROMPTS,
  causeForPrompt,
  type GivesBackCause,
} from '@freevobe/protocol';
import { useAppStore } from '../../store/appStore';

export interface GivesBackCardProps {
  /** Antal användarprompter i samtalet så här långt. Det enda indata komponenten får. */
  promptIndex: number;
  /** Tvinga fram visning i tester. Används aldrig av chattflödet. */
  forceVisible?: boolean;
}

/**
 * Freevobe Gives Back i chattflödet – ersättningen för den gamla annonsplatsen.
 *
 * Komponenten får bara ett tal: antalet användarprompter. Den har ingen åtkomst till prompttext,
 * filinnehåll eller agentsvar och kan därför varken påverka eller läsas av agenten.
 *
 * Den tar aldrig emot pengar. Länken öppnar organisationens egen sida i webbläsaren, och det
 * användaren själv registrerar hamnar bara i den lokala loggen.
 */
export function GivesBackCard({ promptIndex, forceVisible = false }: GivesBackCardProps) {
  const { t } = useTranslation();
  const config = useAppStore((state) => state.settings?.givesBack ?? null);
  const logContribution = useAppStore((state) => state.logContribution);
  const [dismissed, setDismissed] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (dismissed) return null;

  if (!forceVisible) {
    if (!config || !config.enabled) return null;
    // Aldrig före första prompten och aldrig två platser i rad.
    if (promptIndex <= 0) return null;
    const interval = Math.max(1, config.everyNPrompts || GIVES_BACK_INTERVAL_PROMPTS);
    if (promptIndex % interval !== 0) return null;
  }

  const cause = causeForPrompt(promptIndex, config?.causeIds ?? []);

  const submit = async (selected: GivesBackCause) => {
    const parsed = amount.trim() === '' ? 0 : Number(amount.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError(t('givesBack.card.invalidAmount'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await logContribution({
        causeId: selected.id,
        amountSek: Math.round(parsed),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      setSaved(true);
      setFormOpen(false);
      setAmount('');
      setNote('');
    } catch (causeError) {
      setError(causeError instanceof Error ? causeError.message : String(causeError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside
      data-testid="gives-back-card"
      role="complementary"
      aria-label="Freevobe Gives Back"
      className="my-3 rounded-lg border border-dashed border-mint/40 bg-forge/60 p-3"
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span className="rounded border border-mint/40 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-mint uppercase">
          Gives Back
        </span>
        <span className="text-[10px] text-slate-600">{t('givesBack.card.voluntary')}</span>
        <button
          type="button"
          aria-label={t('givesBack.card.dismiss')}
          data-testid="gives-back-dismiss"
          className="ml-auto cursor-pointer text-xs text-slate-600 hover:text-slate-300"
          onClick={() => setDismissed(true)}
        >
          ×
        </button>
      </div>

      <p className="text-sm font-medium text-slate-200">{cause.name}</p>
      <p className="mt-0.5 text-xs text-slate-500">{cause.tagline}</p>

      {saved ? (
        <p className="mt-2 text-xs text-mint" data-testid="gives-back-saved">
          {t('givesBack.card.saved')}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <a
          className="vf-button"
          href={cause.url}
          target="_blank"
          rel="noreferrer noopener"
          data-testid="gives-back-open"
        >
          {t('givesBack.card.open', { name: cause.name })}
        </a>
        <button
          type="button"
          className="vf-button cursor-pointer"
          data-testid="gives-back-log"
          onClick={() => setFormOpen((value) => !value)}
        >
          {t('givesBack.card.gave')}
        </button>
        <span className="text-[10.5px] text-slate-600">{t('givesBack.card.direct')}</span>
      </div>

      {formOpen ? (
        <form
          className="mt-2 flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(cause);
          }}
        >
          <label className="text-[10.5px] text-slate-500">
            {t('givesBack.card.amount')}
            <input
              type="number"
              min={0}
              step={1}
              value={amount}
              data-testid="gives-back-amount"
              onChange={(event) => setAmount(event.target.value)}
              className="mt-0.5 block w-28 rounded border border-steel bg-anvil px-2 py-1 text-xs text-slate-200"
            />
          </label>
          <label className="min-w-[12rem] flex-1 text-[10.5px] text-slate-500">
            {t('givesBack.card.note')}
            <input
              value={note}
              maxLength={200}
              data-testid="gives-back-note"
              onChange={(event) => setNote(event.target.value)}
              className="mt-0.5 block w-full rounded border border-steel bg-anvil px-2 py-1 text-xs text-slate-200"
            />
          </label>
          <button
            type="submit"
            className="vf-button cursor-pointer"
            disabled={busy}
            data-testid="gives-back-submit"
          >
            {t('givesBack.card.saveLog')}
          </button>
        </form>
      ) : null}

      {error ? <p className="mt-1.5 text-[11px] text-alert">{error}</p> : null}
    </aside>
  );
}
