'use client';

import { Apple, Download, ExternalLink, MonitorPlay, Terminal } from 'lucide-react';
import type { ReactNode } from 'react';
import { DOWNLOAD_LINKS } from '@/config/release';
import { assetUrlFor, type Platform } from '@/lib/release';
import { cn } from '@/lib/utils';
import { usePlatform, useRelease } from './use-release';

type Target = {
  platform: Exclude<Platform, 'unknown'>;
  label: string;
  file: string;
  icon: ReactNode;
  /** macOS-knappen visar båda varianterna som en liten rad. */
  variants?: { platform: Exclude<Platform, 'unknown'>; label: string }[];
};

const TARGETS: Target[] = [
  { platform: 'windows', label: 'Windows', file: '.exe', icon: <MonitorPlay className="size-4" /> },
  {
    platform: 'macAppleSilicon',
    label: 'macOS',
    file: '.dmg',
    icon: <Apple className="size-4" />,
    variants: [
      { platform: 'macAppleSilicon', label: 'Apple Silicon' },
      { platform: 'macIntel', label: 'Intel' },
    ],
  },
  { platform: 'linux', label: 'Linux', file: '.AppImage', icon: <Terminal className="size-4" /> },
];

export function PlatformButtons({
  className,
  note = true,
}: {
  className?: string;
  note?: boolean;
}) {
  const release = useRelease();
  const { platform: detected } = usePlatform();
  const published = release.status !== 'missing';
  const releaseData = release.status === 'ready' ? release.release : null;

  return (
    <div className={cn('w-full', className)}>
      <ul className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        {TARGETS.map((target) => {
          const primary = target.variants?.[0]?.platform ?? target.platform;
          const href = published ? assetUrlFor(primary, releaseData) : DOWNLOAD_LINKS.all;
          const isDetected = detected !== 'unknown' && detected === target.platform;

          return (
            <li key={target.label} className="flex-1 sm:min-w-[10.5rem] sm:flex-none">
              <a
                href={href}
                rel="noreferrer"
                className={cn(
                  'group flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-medium transition-colors',
                  published
                    ? 'border-line-strong bg-card text-fg hover:border-accent/60 hover:text-accent-soft'
                    : 'border-line bg-card/60 text-muted hover:border-accent/40 hover:text-fg',
                  isDetected && published ? 'border-accent/40' : null,
                )}
              >
                {published ? target.icon : <ExternalLink className="size-4" />}
                <span>{target.label}</span>
                <span className="font-mono text-[11px] text-muted">
                  {published ? target.file : 'releases'}
                </span>
              </a>

              {published && target.variants ? (
                <div className="mt-1 flex items-center justify-center gap-2 text-[10.5px] text-muted">
                  {target.variants.map((variant) => (
                    <a
                      key={variant.platform}
                      href={assetUrlFor(variant.platform, releaseData)}
                      rel="noreferrer"
                      className="underline decoration-dotted underline-offset-2 hover:text-fg"
                    >
                      {variant.label}
                    </a>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {note ? (
        <div className="mt-3 space-y-1 text-center text-[11.5px] text-muted">
          <p className="flex flex-wrap items-center justify-center gap-1.5">
            <Download className="size-3" />
            Freevobe is distributed through GitHub Releases.
          </p>
          {published ? null : <p>Installers are published on GitHub Releases.</p>}
        </div>
      ) : null}
    </div>
  );
}
