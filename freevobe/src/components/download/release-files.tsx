'use client';

import { Check, Copy, Download, Files, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { CHECKSUMS_FILE_NAME, checksumsUrlForTag } from '@/config/release';
import {
  formatFileSize,
  releaseFiles,
  type Release,
  type ReleaseFile,
} from '@/lib/release';
import { cn } from '@/lib/utils';
import { useRelease } from './use-release';

/** 'selected' betyder att clipboard nekades och summan markerats för hand i stället. */
type CopyState = 'idle' | 'copied' | 'selected';

function FileRow({ file }: { file: ReleaseFile }) {
  const t = useTranslations('download');
  const [state, setState] = useState<CopyState>('idle');
  const code = useRef<HTMLElement>(null);

  const label = file.platform
    ? t(`platform.${file.platform}`)
    : file.name === CHECKSUMS_FILE_NAME
      ? t('files.checksums')
      : t('files.releaseFile');

  useEffect(() => {
    if (state === 'idle') return;
    const timer = setTimeout(() => setState('idle'), state === 'copied' ? 2000 : 6000);
    return () => clearTimeout(timer);
  }, [state]);

  async function copy() {
    if (!file.sha256) return;
    try {
      await navigator.clipboard.writeText(file.sha256);
      setState('copied');
    } catch {
      // Clipboard nekas ibland (dokumentet i bakgrunden, äldre webbläsare). Då markeras summan i
      // stället, så att Ctrl/Cmd+C räcker – bättre än en knapp som ser ut att göra ingenting.
      const node = code.current;
      if (!node) return;
      const range = document.createRange();
      range.selectNodeContents(node);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      setState('selected');
    }
  }

  const copyLabel =
    state === 'copied' ? t('files.copied') : state === 'selected' ? t('files.copyKey') : t('files.copy');

  return (
    <li className="flex flex-col gap-2.5 px-5 py-3.5 lg:flex-row lg:items-center lg:gap-4">
      <div className="min-w-0 lg:w-56 lg:shrink-0">
        <p className="text-[12.5px] font-medium text-fg">{label}</p>
        <p className="truncate font-mono text-[11px] text-muted" title={file.name}>
          {file.name}
        </p>
      </div>

      <span className="font-mono text-[11px] text-muted lg:w-16 lg:shrink-0">
        {formatFileSize(file.sizeBytes)}
      </span>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        {file.sha256 ? (
          <>
            <code
              ref={code}
              className="min-w-0 flex-1 break-all font-mono text-[11px] leading-relaxed text-muted selection:bg-accent/40"
            >
              {file.sha256}
            </code>
            <button
              type="button"
              onClick={copy}
              aria-label={
                state === 'copied'
                  ? t('files.copiedAria', { file: file.name })
                  : state === 'selected'
                    ? t('files.selectedAria', { file: file.name })
                    : t('files.copyAria', { file: file.name })
              }
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-[11px] text-muted transition-colors hover:border-accent/50 hover:text-fg"
            >
              {state === 'copied' ? (
                <Check className="size-3 text-accent-soft" />
              ) : (
                <Copy className="size-3" />
              )}
              {copyLabel}
            </button>
          </>
        ) : (
          // Äldre releaser publicerades innan kontrollsummorna fanns – säg det i stället för att gissa.
          <span className="flex-1 text-[11px] text-muted">{t('files.noChecksum')}</span>
        )}
      </div>

      <a
        href={file.url}
        rel="noreferrer"
        className="inline-flex shrink-0 items-center justify-center gap-1.5 self-start rounded-lg border border-line px-2.5 py-1 text-[11.5px] font-medium text-fg transition-colors hover:border-accent/60 hover:text-accent-soft lg:self-auto"
      >
        <Download className="size-3.5" />
        {t('files.download')}
      </a>
    </li>
  );
}

export function ReleaseFiles({ className }: { className?: string }) {
  const t = useTranslations('download.files');
  const release = useRelease();

  // Repot finns inte eller har inga releases: då finns det inga filer att lista ännu.
  if (release.status === 'missing') return null;

  return (
    <div className={cn('vf-panel overflow-hidden', className)} data-release-files={release.status}>
      <header className="flex flex-wrap items-center gap-2 border-b border-line bg-card-strong/50 px-5 py-3.5">
        <Files className="size-4 text-accent-soft" />
        <h2 className="text-sm font-semibold tracking-tight">{t('title')}</h2>
        {release.status === 'ready' ? (
          <span className="ml-auto font-mono text-[11px] text-muted">
            {release.release.tag} · {release.release.assets.length}{' '}
            {release.release.assets.length === 1 ? t('file') : t('files')}
          </span>
        ) : null}
      </header>

      {release.status === 'loading' ? (
        <p className="flex items-center gap-2 px-5 py-4 text-[12.5px] text-muted">
          <Loader2 className="size-4 animate-spin" />
          {t('loading')}
        </p>
      ) : release.status === 'error' ? (
        <p className="px-5 py-4 text-[12.5px] leading-relaxed text-muted">{t('error')}</p>
      ) : (
        <FilesBody release={release.release} />
      )}
    </div>
  );
}

function FilesBody({ release }: { release: Release }) {
  const t = useTranslations('download.files');
  const files = releaseFiles(release);

  if (files.length === 0) {
    return (
      <p className="px-5 py-4 text-[12.5px] leading-relaxed text-muted">
        {t('empty')}{' '}
        <a
          href={release.htmlUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="text-accent-soft underline underline-offset-2"
        >
          {t('emptyLink')}
        </a>{' '}
        {t('emptyAfter')}
      </p>
    );
  }

  const withChecksums = files.filter((file) => file.sha256).length;

  return (
    <>
      <ul className="divide-y divide-line">
        {files.map((file) => (
          <FileRow key={file.name} file={file} />
        ))}
      </ul>

      <footer className="space-y-2 border-t border-line px-5 py-3.5 text-[11.5px] leading-relaxed text-muted">
        <p>
          {withChecksums === files.length
            ? t('allChecksums')
            : t('someChecksums', { have: withChecksums, total: files.length })}{' '}
          {t('mismatch')}{' '}
          <a
            href={checksumsUrlForTag(release.tag)}
            className="font-mono text-accent-soft underline underline-offset-2"
          >
            {CHECKSUMS_FILE_NAME}
          </a>
          {t('mismatchAfter')} <span className="font-mono">sha256sum -c</span>{' '}
          {t('mismatchReads')}
        </p>
        <dl className="grid gap-1 font-mono text-[11px]">
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-fg">{t('platformMacLinux')}</dt>
            <dd className="break-all">shasum -a 256 &lt;file&gt;</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-fg">{t('platformWindows')}</dt>
            <dd className="break-all">Get-FileHash .\&lt;file&gt; -Algorithm SHA256</dd>
          </div>
        </dl>
      </footer>
    </>
  );
}
