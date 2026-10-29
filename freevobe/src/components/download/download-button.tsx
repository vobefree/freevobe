'use client';

import { Download, ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { DOWNLOAD_LINKS } from '@/config/release';
import { assetUrlFor, type Platform } from '@/lib/release';
import { cn } from '@/lib/utils';
import { usePlatform, useRelease } from './use-release';

type DownloadButtonProps = {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Kort etikett (navbaren) eller den fulla "Download Freevobe". */
  label?: 'full' | 'short';
  showPlatform?: boolean;
};

export function DownloadButton({
  size = 'lg',
  className,
  label = 'full',
  showPlatform = true,
}: DownloadButtonProps) {
  const t = useTranslations('download');
  const { platform } = usePlatform();
  const release = useRelease();

  // Repot finns inte eller har inga releases: skicka till släppsidan i stället för en död fil.
  const published = release.status !== 'missing';
  const resolved: Exclude<Platform, 'unknown'> | null = platform === 'unknown' ? null : platform;

  const href = !published
    ? DOWNLOAD_LINKS.all
    : resolved
      ? assetUrlFor(resolved, release.status === 'ready' ? release.release : null)
      : DOWNLOAD_LINKS.latest;

  const text = !published ? (
    <>
      <ExternalLink className="size-4" />
      {label === 'short' ? t('button.releases') : t('button.viewReleases')}
    </>
  ) : (
    <>
      <Download className="size-4" />
      {label === 'short'
        ? t('button.download')
        : resolved && showPlatform
          ? t('button.downloadFor', { platform: t(`platform.${resolved}`) })
          : t('button.downloadFreevobe')}
    </>
  );

  return (
    <Button asChild size={size} className={cn(className)}>
      <a
        href={href}
        data-download-target={!published ? 'releases' : (resolved ?? 'latest')}
        {...(published && /\.(exe|dmg|AppImage|apk)$/i.test(href) ? {} : { rel: 'noreferrer' })}
      >
        {text}
      </a>
    </Button>
  );
}
