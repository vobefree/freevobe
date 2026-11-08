import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/appStore';
import { Button, Field } from './ui';
import { THEME_LABEL_KEY, THEME_MODES, type ThemeMode } from '../lib/theme';
import { VIEW_LABEL_KEY, VIEW_MODES, type ViewMode } from '../lib/viewMode';

/** Utseende i Inställningar: tema, vyläge och Qoder-läget. Allt sparas lokalt direkt. */
export function AppearanceSection() {
  const { t } = useTranslation();
  const themeMode = useAppStore((state) => state.themeMode);
  const setThemeMode = useAppStore((state) => state.setThemeMode);
  const viewMode = useAppStore((state) => state.viewMode);
  const setViewMode = useAppStore((state) => state.setViewMode);
  const qoderMode = useAppStore((state) => state.qoderMode);
  const setQoder = useAppStore((state) => state.setQoder);

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
        {t('settings.appearance.section')}
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('settings.appearance.theme')} hint={t('settings.appearance.themeHint')}>
          <select
            data-testid="theme-select"
            value={themeMode}
            onChange={(event) => setThemeMode(event.target.value as ThemeMode)}
            className="w-full rounded border border-steel bg-anvil px-2 py-1.5 text-xs text-slate-200"
          >
            {THEME_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {t(THEME_LABEL_KEY[mode])}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('settings.appearance.view')} hint={t('settings.appearance.viewHint')}>
          <select
            data-testid="view-mode-select"
            value={viewMode}
            onChange={(event) => setViewMode(event.target.value as ViewMode)}
            className="w-full rounded border border-steel bg-anvil px-2 py-1.5 text-xs text-slate-200"
          >
            {VIEW_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {t(VIEW_LABEL_KEY[mode])}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="flex items-center justify-between gap-3 rounded border border-steel px-3 py-2">
        <div className="min-w-0">
          <p className="text-xs text-slate-200">{t('settings.appearance.qoder')}</p>
          <p className="text-[11px] text-slate-500">{t('settings.appearance.qoderHint')}</p>
        </div>
        <Button onClick={() => setQoder(!qoderMode)}>
          {qoderMode ? t('settings.appearance.qoderDisable') : t('settings.appearance.qoderEnable')}
        </Button>
      </div>
    </section>
  );
}
