import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store/appStore';

/**
 * \"Bygger…\" och \"Klart\" i chatten. Det är hela återkopplingen i prompt → klart-läget: inga
 * mellansteg, inga godkännandekort, bara en rad som visar att arbetet pågår och en knapp till
 * resultatet när det är färdigt.
 */
export function InstantStatus() {
  const { t } = useTranslation();
  const instantMode = useAppStore((state) => state.settings?.instantMode === true);
  const status = useAppStore((state) => state.instantStatus);
  const previewUrl = useAppStore((state) => state.preview?.url ?? null);
  const setCenterTab = useAppStore((state) => state.setCenterTab);

  if (!instantMode || status === 'idle') return null;

  if (status === 'working') {
    return (
      <div
        data-testid="instant-status"
        className="flex items-center gap-2 rounded-lg border border-ember/30 bg-ember/5 px-3 py-2 text-xs text-slate-300"
      >
        <span className="h-2 w-2 animate-pulse rounded-full bg-ember" />
        {t('instant.working')}
      </div>
    );
  }

  return (
    <div
      data-testid="instant-status"
      className="flex items-center gap-2 rounded-lg border border-mint/30 bg-mint/5 px-3 py-2 text-xs text-slate-300"
    >
      <span className="h-2 w-2 rounded-full bg-mint" />
      <span className="text-mint">{t('instant.done')}</span>
      {previewUrl ? (
        <button
          type="button"
          onClick={() => setCenterTab('preview')}
          className="vf-button ml-auto cursor-pointer"
        >
          {t('instant.openPreview')}
        </button>
      ) : null}
    </div>
  );
}
