'use client';

import { ArrowUpRight, Tag } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DOWNLOAD_LINKS } from '@/config/release';
import { cn } from '@/lib/utils';
import { useRelease } from './use-release';

/**
 * Visar senaste version. Tre lägen:
 *  – API svarar: "Latest release v0.1.0" som länkar till releasen,
 *  – API:t vet inte (nätverk/rate limit): "Latest release" utan versionsnummer,
 *  – inga releases ännu (404): "View releases".
 */
export function ReleaseBadge({ className }: { className?: string }) {
  const t = useTranslations('download.badge');
  const release = useRelease();

  const { label, href } =
    release.status === 'ready'
      ? { label: t('latest', { version: release.release.tag }), href: release.release.htmlUrl }
      : release.status === 'missing'
        ? { label: t('missing'), href: DOWNLOAD_LINKS.all }
        : { label: t('latestNoVersion'), href: DOWNLOAD_LINKS.latest };

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      data-release-state={release.status}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-line-strong bg-card/70 px-3 py-1 text-xs font-medium text-muted backdrop-blur transition-colors hover:border-accent/50 hover:text-fg',
        className,
      )}
    >
      <Tag className="size-3 text-accent-soft" />
      <span>{label}</span>
      <ArrowUpRight className="size-3 text-muted" />
    </a>
  );
}
