'use client';

import { CalendarDays, FileText, Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { parseMarkdown, tokenizeInline } from '@/lib/markdown';
import { stripChecksums } from '@/lib/release';
import { useRelease } from './use-release';

/**
 * Renderar en rad med fetstil, inline-kod och länkar. Anteckningarna kommer från GitHub, så inga
 * taggar skapas från indata – varje del blir en textnod eller ett React-element.
 */
function RichText({ text }: { text: string }) {
  return (
    <>
      {tokenizeInline(text).map((token, index) => {
        if (token.kind === 'strong') {
          return (
            <strong key={index} className="font-semibold text-fg">
              {token.text}
            </strong>
          );
        }
        if (token.kind === 'code') {
          return (
            <code key={index} className="rounded bg-card-strong px-1 py-0.5 font-mono text-[12px] text-fg">
              {token.text}
            </code>
          );
        }
        if (token.kind === 'link') {
          return (
            <a
              key={index}
              href={token.href}
              target="_blank"
              rel="noreferrer noopener"
              className="text-accent-soft underline underline-offset-2 break-all"
            >
              {token.text}
            </a>
          );
        }
        return token.text;
      })}
    </>
  );
}

export function ReleaseNotes() {
  const t = useTranslations('download.notes');
  const locale = useLocale();
  const release = useRelease();

  function formatDate(value: string): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    // Datumet skrivs på besökarens språk – "27 okt. 2026" på svenska, "Oct 27, 2026" på engelska.
    return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  if (release.status === 'loading') {
    return (
      <div className="vf-panel flex items-center gap-2 p-5 text-sm text-muted">
        <Loader2 className="size-4 animate-spin" />
        {t('loading')}
      </div>
    );
  }

  if (release.status === 'missing') {
    return (
      <div className="vf-panel p-5">
        <p className="flex items-center gap-2 text-sm font-medium text-fg">
          <FileText className="size-4 text-accent-soft" />
          {t('missingTitle')}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t('missingBody')}</p>
      </div>
    );
  }

  if (release.status === 'error') {
    return (
      <div className="vf-panel p-5">
        <p className="text-sm font-medium text-fg">{t('errorTitle')}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t('errorBody')}</p>
      </div>
    );
  }

  const { release: latest } = release;
  // Kontrollsummorna har en egen panel ovanför – här räcker ändringslistan.
  const blocks = parseMarkdown(stripChecksums(latest.notes));
  const published = formatDate(latest.publishedAt);

  return (
    <div className="vf-panel overflow-hidden">
      <header className="flex flex-wrap items-center gap-3 border-b border-line bg-card-strong/50 px-5 py-3.5">
        <span className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 font-mono text-[11.5px] text-accent-soft">
          {latest.tag}
        </span>
        {latest.name && latest.name !== latest.tag ? (
          <span className="text-sm font-medium">{latest.name}</span>
        ) : null}
        {published ? (
          <span className="ml-auto flex items-center gap-1.5 text-[11.5px] text-muted">
            <CalendarDays className="size-3.5" />
            {published}
          </span>
        ) : null}
      </header>

      <div className="px-5 py-4">
        {blocks.length === 0 ? (
          <p className="text-sm text-muted">{t('empty')}</p>
        ) : (
          <div className="space-y-2.5">
            {blocks.map((block, index) =>
              block.kind === 'heading' ? (
                <h3 key={index} className="pt-1 text-[13px] font-semibold tracking-tight text-fg">
                  <RichText text={block.text} />
                </h3>
              ) : block.kind === 'bullet' ? (
                <p key={index} className="flex gap-2.5 text-[13px] leading-relaxed text-muted">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-accent-soft" />
                  <span>
                    <RichText text={block.text} />
                  </span>
                </p>
              ) : (
                <p key={index} className="text-[13px] leading-relaxed text-muted">
                  <RichText text={block.text} />
                </p>
              ),
            )}
          </div>
        )}
      </div>

      <footer className="border-t border-line px-5 py-3">
        <a
          href={latest.htmlUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="text-[12.5px] text-accent-soft underline underline-offset-2"
        >
          {t('readFull')}
        </a>
      </footer>
    </div>
  );
}
