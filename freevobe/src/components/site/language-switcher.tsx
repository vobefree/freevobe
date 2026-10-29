'use client';

import { Globe } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { LOCALE_LABELS } from '@/i18n/locales';
import { routing, type Locale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

/**
 * Språkväljaren byter URL till samma sida på det valda språket och sparar valet i cookien
 * `NEXT_LOCALE`, som `/` läser vid nästa besök. Ingen omstart och ingen omladdning av appen.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale() as Locale;
  const t = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value as Locale;
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.replace(pathname, { locale: next }));
  }

  return (
    <label
      className={cn(
        'relative flex size-9 items-center justify-center rounded-lg border border-line bg-card text-muted transition-colors hover:border-accent/50 hover:text-fg',
        pending && 'opacity-60',
        className,
      )}
      title={t('changeLanguage')}
    >
      <span className="sr-only">{t('changeLanguage')}</span>
      <Globe className="pointer-events-none size-4" aria-hidden="true" />
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
