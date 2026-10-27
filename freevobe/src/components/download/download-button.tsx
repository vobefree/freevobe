'use client';

import { Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DOWNLOAD_LINKS } from '@/config/release';
import { assetUrlFor, PLATFORM_LABELS, type Platform } from '@/lib/release';
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
      {label === 'short' ? 'Releases' : 'View releases'}
    </>
  ) : (
    <>
      <Download className="size-4" />
      {label === 'short'
        ? 'Download'
        : resolved && showPlatform
          ? `Download for ${PLATFORM_LABELS[resolved]}`
          : 'Download Freevobe'}
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
