import { useTranslation } from 'react-i18next';
import {
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  applyLocale,
  currentLocale,
  normalizeLocale,
  type Locale,
} from '../i18n';

/**
 * Språkväxlare. Värdet sparas lokalt och slår igenom direkt – ingen omstart behövs, och alla
 * komponenter som använder useTranslation ritas om när språket byts.
 */
export function LanguageSelect({
  className,
  testId = 'language-select',
  showLabel = false,
}: {
  className?: string;
  testId?: string;
  showLabel?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const active = normalizeLocale(i18n.resolvedLanguage ?? i18n.language) ?? currentLocale();

  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ''}`}>
      {showLabel ? (
        <span className="text-xs font-medium text-slate-300">{t('language.label')}</span>
      ) : null}
      <select
        value={active}
        onChange={(event) => applyLocale(event.target.value as Locale)}
        title={t('language.hint')}
        aria-label={t('language.label')}
        data-testid={testId}
        className="cursor-pointer rounded border border-steel bg-anvil px-2 py-1 text-[11.5px] text-slate-200"
      >
        {SUPPORTED_LOCALES.map((locale) => (
          <option key={locale} value={locale}>
            {LOCALE_LABELS[locale]}
          </option>
        ))}
      </select>
    </span>
  );
}
