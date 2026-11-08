import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store/appStore';
import { Button, Chip } from '../ui';
import { formatBytes } from '../../lib/format';

const VERIFY_TONE = {
  verified: 'mint',
  mismatch: 'alert',
  unverified: 'neutral',
  unknown: 'ember',
} as const;

const VERIFY_LABEL = {
  verified: 'pull.verified',
  mismatch: 'pull.mismatch',
  unverified: 'pull.unverified',
  unknown: 'pull.unknown',
} as const;

/**
 * Rekommendationskortet: när ingen modell på datorn kan göra jobbet visas vad som bör hämtas –
 * namn, storlek, källa och checksumma – och hämtningen startar först när användaren trycker på
 * knappen. Kortet hämtar aldrig något själv.
 */
export function ModelPullCard() {
  const { t } = useTranslation();
  const decision = useAppStore((state) => state.routerDecision);
  const busy = useAppStore((state) => state.pullBusy);
  const progress = useAppStore((state) => state.pullProgress);
  const result = useAppStore((state) => state.pullResult);
  const pull = useAppStore((state) => state.pullRecommendedModel);
  const dismiss = useAppStore((state) => state.dismissRouterRecommendation);

  const recommendation = decision?.recommendation;
  if (!recommendation) return null;

  const { preview } = recommendation;
  const thirdParty = preview.source === 'third-party';
  const done = result !== null;

  return (
    <section
      data-testid="model-pull-card"
      className="rounded-lg border border-steel bg-forge/60 p-3 text-xs"
    >
      <header className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold tracking-wide text-ember uppercase">
          {t('pull.title')}
        </span>
        <Chip tone={thirdParty ? 'ember' : 'mint'}>
          {thirdParty ? t('pull.sourceThirdParty') : t('pull.sourceOfficial')}
        </Chip>
        {recommendation.fitsHardware ? (
          <Chip tone="mint">{t('pull.fits')}</Chip>
        ) : (
          <Chip tone="ember">{t('pull.tooBig')}</Chip>
        )}
      </header>

      <p className="mt-1.5 text-slate-400">{t('pull.body')}</p>

      <div className="mt-2 rounded border border-steel/70 bg-anvil/60 p-2 font-mono text-[11px]">
        <p className="text-sm text-slate-100">{preview.name}</p>
        <p className="mt-1 text-slate-500">
          {t('pull.size')}: {preview.sizeBytes ? formatBytes(preview.sizeBytes) : '–'}
        </p>
        <p className="text-slate-500">
          {t('pull.checksum')}:{' '}
          {preview.checksum ? (
            <span className="break-all">{preview.checksum.slice(0, 24)}…</span>
          ) : (
            <span className="text-spark">{t('pull.noChecksum')}</span>
          )}
        </p>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {recommendation.reasons.map((reason) => (
          <Chip key={reason}>{t(`pull.reason.${reason}`)}</Chip>
        ))}
      </div>

      {recommendation.alternatives.length > 0 ? (
        <p className="mt-1.5 text-[10.5px] text-slate-600">
          {t('pull.alternatives')}: {recommendation.alternatives.join(', ')}
        </p>
      ) : null}

      {busy || progress ? (
        <div className="mt-2">
          <div className="h-1.5 w-full overflow-hidden rounded bg-steel">
            <div
              className="h-full bg-ember transition-all"
              style={{ width: `${progress?.percent ?? 5}%` }}
            />
          </div>
          <p className="mt-1 text-[10.5px] text-slate-500">
            {progress?.status ?? t('pull.downloading')}
            {progress && progress.percent !== null ? ` · ${progress.percent}%` : ''}
          </p>
        </div>
      ) : null}

      {result ? (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
          <Chip tone={VERIFY_TONE[result.verification.status]}>
            {t(VERIFY_LABEL[result.verification.status])}
          </Chip>
          {result.error ? <span className="text-alert">{result.error}</span> : null}
        </p>
      ) : null}

      <footer className="mt-2 flex flex-wrap gap-1.5">
        <Button variant="primary" disabled={busy || done} onClick={() => void pull()}>
          {busy ? t('pull.downloading') : t('pull.download')}
        </Button>
        <Button onClick={dismiss}>{t('pull.cancel')}</Button>
      </footer>
    </section>
  );
}
