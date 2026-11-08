import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { summarizeMediaSpend } from '@freevobe/protocol';
import { useAppStore } from '../../store/appStore';
import { Button, Chip, EmptyState } from '../ui';
import { MediaTile } from '../media/MediaTile';

/** Mediafliken: allt agenten skapat i projektets `.freevobe/media`, nyast först. */
export function MediaPane() {
  const { t } = useTranslation();
  const assets = useAppStore((state) => state.mediaAssets);
  const loading = useAppStore((state) => state.mediaLoading);
  const error = useAppStore((state) => state.mediaError);
  const hasProject = useAppStore((state) => state.project !== null);
  const resultCount = useAppStore((state) => state.mediaResults.length);
  const loadMedia = useAppStore((state) => state.loadMedia);
  const budgetUsd = useAppStore((state) => state.settings?.mediaDailyBudgetUsd ?? 0);

  // Kostnaden räknas ur metadatafilerna som redan är hämtade – ingen extra rundtur till servern.
  const spend = summarizeMediaSpend(assets);
  const remainingUsd = budgetUsd > 0 ? Math.max(0, budgetUsd - spend.todayUsd) : null;
  const overBudget = budgetUsd > 0 && spend.todayUsd >= budgetUsd;

  // Laddas när fliken öppnas och när en körning har skapat ny media.
  useEffect(() => {
    if (hasProject) void loadMedia();
  }, [hasProject, loadMedia, resultCount]);

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="media-pane">
      <div className="flex items-center gap-2 border-b border-steel p-2">
        <span className="text-[11px] text-slate-500">
          {t('media.count', { count: assets.length })}
        </span>
        <Button
          className="ml-auto"
          disabled={!hasProject || loading}
          onClick={() => void loadMedia()}
        >
          {loading ? t('media.loading') : t('media.refresh')}
        </Button>
      </div>
      {spend.count > 0 || budgetUsd > 0 ? (
        <div
          data-testid="media-spend"
          className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-steel px-2 py-1 text-[10.5px] text-slate-500"
        >
          <span>{t('media.spend.total', { cost: `$${spend.totalUsd.toFixed(2)}` })}</span>
          <span>{t('media.spend.today', { cost: `$${spend.todayUsd.toFixed(2)}` })}</span>
          {budgetUsd > 0 && remainingUsd !== null ? (
            overBudget ? (
              <Chip tone="alert">{t('media.spend.over')}</Chip>
            ) : (
              <span>{t('media.spend.budget', { cost: `$${remainingUsd.toFixed(2)}` })}</span>
            )
          ) : null}
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {error ? <p className="mb-2 text-[11px] text-alert">{error}</p> : null}
        {assets.length === 0 ? (
          <EmptyState title={t('media.empty.title')} hint={t('media.empty.hint')} />
        ) : (
          <div className="grid grid-cols-2 gap-2" data-testid="media-grid">
            {assets.map((asset) => (
              <MediaTile key={asset.path} asset={asset} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
