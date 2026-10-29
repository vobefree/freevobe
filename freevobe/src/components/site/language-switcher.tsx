'use client';

import { ChevronDown, Globe } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { LOCALE_LABELS, LOCALE_SHORT } from '@/i18n/locales';
import { routing, type Locale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

/**
 * Språkväljaren byter URL till samma sida på det valda språket och sparar valet i cookien
 * `NEXT_LOCALE`, som `/` läser vid nästa besök. Ingen omstart och ingen omladdning av appen.
 *
 * Knappen visar vilket språk som är aktivt (`SV`, `DE` …) och en pil, eftersom enbart en jordglob
 * inte gick att skilja från en temaknapp. Den riktiga `<select>`-en ligger osynlig ovanpå, så
 * tangentbord, skärmläsare och mobilens egen lista fungerar som vanligt.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale() as Locale;
  const t = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value as Locale;
    if (next === locale) return;
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.replace(pathname, { locale: next }));
  }

  return (
    <label
      className={cn(
        'group relative flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-card pl-2.5 pr-1.5 text-muted transition-colors hover:border-accent/50 hover:text-fg focus-within:border-accent/60 focus-within:text-fg',
        pending && 'opacity-60',
        className,
      )}
      title={`${t('changeLanguage')} · ${LOCALE_LABELS[locale]}`}
    >
      <Globe className="size-4 shrink-0" aria-hidden="true" />
      <span
        aria-hidden="true"
        className="text-[11px] font-semibold uppercase leading-none tracking-wide"
      >
        {LOCALE_SHORT[locale]}
      </span>
      <ChevronDown
        className="size-3.5 shrink-0 opacity-60 transition-transform group-focus-within:rotate-180"
        aria-hidden="true"
      />
      <span className="sr-only">{t('changeLanguage')}</span>
      <select
        value={locale}
        onChange={onChange}
        aria-label={t('language')}
        className="absolute inset-0 size-full cursor-pointer appearance-none opacity-0"
      >
        {routing.locales.map((candidate) => (
          <option key={candidate} value={candidate} lang={candidate}>
            {LOCALE_LABELS[candidate]}
          </option>
        ))}
      </select>
    </label>
  );
}
