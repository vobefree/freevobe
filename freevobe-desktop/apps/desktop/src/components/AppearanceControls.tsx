import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/appStore';
import { THEME_LABEL_KEY, nextThemeMode } from '../lib/theme';
import { VIEW_LABEL_KEY, VIEW_MODES } from '../lib/viewMode';

const THEME_ICON = { light: '☀', dark: '☾', system: '◐' } as const;

/** Snabbväxling av tema. Klick cyklar ljust → mörkt → system. */
export function ThemeButton() {
  const { t } = useTranslation();
  const themeMode = useAppStore((state) => state.themeMode);
  const setThemeMode = useAppStore((state) => state.setThemeMode);

  return (
    <button
      type="button"
      data-testid="theme-toggle"
      onClick={() => setThemeMode(nextThemeMode(themeMode))}
      title={`${t('topbar.theme')}: ${t(THEME_LABEL_KEY[themeMode])}`}
      aria-label={t('topbar.theme')}
      className="vf-button cursor-pointer"
    >
      {THEME_ICON[themeMode]}
    </button>
  );
}

/** Verbose / Normal / Summary som en liten rad, används i toppraden och i chatten. */
export function ViewModeSwitch({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const viewMode = useAppStore((state) => state.viewMode);
  const setViewMode = useAppStore((state) => state.setViewMode);

  return (
    <div
      className="flex items-center gap-0.5 rounded border border-steel p-0.5"
      role="group"
      aria-label={t('topbar.viewMode')}
    >
      {VIEW_MODES.map((mode) => (
        <button
          key={mode}
          type="button"
          data-testid={`view-mode-${mode}`}
          onClick={() => setViewMode(mode)}
          className={`cursor-pointer rounded px-1.5 py-0.5 text-[10px] ${
            viewMode === mode ? 'bg-steel text-slate-100' : 'text-slate-500 hover:text-slate-300'
          }`}
          title={t(VIEW_LABEL_KEY[mode])}
        >
          {compact ? t(VIEW_LABEL_KEY[mode]).slice(0, 1).toUpperCase() : t(VIEW_LABEL_KEY[mode])}
        </button>
      ))}
    </div>
  );
}
