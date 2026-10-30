'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { LOCALE_LABELS, LOCALE_SHORT } from '@/i18n/locales';
import { routing, type Locale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

/**
 * Språkväljaren byter URL till samma sida på det valda språket och sparar valet i cookien
 * `NEXT_LOCALE`, som `/` läser vid nästa besök. Ingen omstart och ingen omladdning av appen.
 *
 * Listan ritas i sidan i stället för att lämnas till webbläsarens egen `<select>`-meny: den menyn
 * får operativsystemets färger, så i mörkt läge blev den vit med grå text som bara gick att läsa
 * när raden var markerad. Här används samma ytor och accenter som resten av sajten.
 *
 * Tangentbord: Enter/Space eller nedåt öppnar, piltangenter flyttar markeringen, Enter väljer,
 * Escape stänger och lämnar tillbaka fokus till knappen.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale() as Locale;
  const t = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => Math.max(routing.locales.indexOf(locale), 0));
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const reduceMotion = useReducedMotion();

  const optionId = (candidate: Locale) => `${listId}-${candidate}`;

  function close(returnFocus = false) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  function choose(next: Locale) {
    setOpen(false);
    if (next === locale) return;
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.replace(pathname, { locale: next }));
  }

  // Öppna menyn: markera nuvarande språk och flytta fokus till listan, så att tangentbordet
  // fungerar direkt. Markeringen scrollas in i vyn för språk som ligger långt ner.
  useEffect(() => {
    if (!open) return;
    const index = Math.max(routing.locales.indexOf(locale), 0);
    setActive(index);
    listRef.current?.focus();
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({
      block: 'nearest',
    });
  }, [open, locale]);

  // Klick utanför och fokus som lämnar menyn stänger den – utan att stjäla tillbaka fokus.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  function onTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
    }
  }

  function onListKeyDown(event: React.KeyboardEvent<HTMLUListElement>) {
    const last = routing.locales.length - 1;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActive((index) => (index >= last ? 0 : index + 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActive((index) => (index <= 0 ? last : index - 1));
        break;
      case 'Home':
        event.preventDefault();
        setActive(0);
        break;
      case 'End':
        event.preventDefault();
        setActive(last);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        choose(routing.locales[active]);
        break;
      case 'Escape':
        event.preventDefault();
        close(true);
        break;
      case 'Tab':
        close();
        break;
      default:
        break;
    }
  }

  // Tangentbordsmarkeringen ska följa med i vyn även när den flyttas med piltangenterna.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({
      block: 'nearest',
    });
  }, [open, active]);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        onKeyDown={onTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        title={`${t('changeLanguage')} · ${LOCALE_LABELS[locale]}`}
        className={cn(
          'flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-card pl-2.5 pr-1.5 text-muted transition-colors hover:border-accent/50 hover:text-fg focus-visible:border-accent/60 focus-visible:text-fg focus-visible:outline-none aria-expanded:border-accent/60 aria-expanded:text-fg',
          pending && 'opacity-60',
        )}
      >
        <Globe className="size-4 shrink-0" aria-hidden="true" />
        <span
          aria-hidden="true"
          className="text-[11px] font-semibold uppercase leading-none tracking-wide"
        >
          {LOCALE_SHORT[locale]}
        </span>
        <ChevronDown
          className={cn(
            'size-3.5 shrink-0 opacity-60 transition-transform duration-200',
            open && 'rotate-180',
          )}
          aria-hidden="true"
        />
        <span className="sr-only">{t('changeLanguage')}</span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={t('language')}
            aria-activedescendant={optionId(routing.locales[active])}
            tabIndex={-1}
            onKeyDown={onListKeyDown}
            initial={reduceMotion ? false : { opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="absolute right-0 top-[calc(100%+6px)] z-50 max-h-[min(60vh,380px)] w-56 origin-top-right overflow-y-auto overscroll-contain rounded-xl border border-line bg-card-strong p-1.5 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.75)] backdrop-blur-xl focus:outline-none [scrollbar-color:var(--border-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-line-strong [&::-webkit-scrollbar-track]:bg-transparent"
          >
            {routing.locales.map((candidate, index) => {
              const selected = candidate === locale;
              const highlighted = index === active;
              return (
                <li
                  key={candidate}
                  id={optionId(candidate)}
                  role="option"
                  aria-selected={selected}
                  data-active={highlighted}
                  lang={candidate}
                  onClick={() => choose(candidate)}
                  onMouseEnter={() => setActive(index)}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] transition-colors',
                    highlighted
                      ? 'bg-card text-fg ring-1 ring-line-strong ring-inset'
                      : 'text-muted',
                    selected && 'font-semibold',
                  )}
                >
                  <span className="flex-1 truncate">{LOCALE_LABELS[candidate]}</span>
                  <span
                    aria-hidden="true"
                    className="text-[10px] font-medium uppercase tracking-wide text-muted/70"
                  >
                    {LOCALE_SHORT[candidate]}
                  </span>
                  {selected ? (
                    <Check className="size-3.5 shrink-0 text-accent-soft" aria-hidden="true" />
                  ) : (
                    <span className="size-3.5 shrink-0" aria-hidden="true" />
                  )}
                </li>
              );
            })}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
