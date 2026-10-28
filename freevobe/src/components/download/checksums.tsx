'use client';

import { Check, Copy, Fingerprint, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CHECKSUMS_FILE_NAME, checksumsUrlForTag } from '@/config/release';
import {
  PLATFORM_LABELS,
  checksumFor,
  parseChecksums,
  type Platform,
  type Release,
} from '@/lib/release';
import { cn } from '@/lib/utils';
import { useRelease } from './use-release';

/** Knapparnas ordning – samma som på sidan i övrigt, med Mac-variantena bredvid varandra. */
const PLATFORMS: Exclude<Platform, 'unknown'>[] = [
  'windows',
  'macAppleSilicon',
  'macIntel',
  'linux',
  'android',
];

type Row = { platform: Exclude<Platform, 'unknown'>; name: string; sha256: string };

/** Plattformarna som faktiskt har en publicerad summa i releasen. */
function rowsFor(release: Release): Row[] {
  const checksums = parseChecksums(release.notes);
  if (checksums.length === 0) return [];
  return PLATFORMS.flatMap((platform) => {
    const checksum = checksumFor(platform, release, checksums);
    return checksum ? [{ platform, name: checksum.name, sha256: checksum.sha256 }] : [];
  });
}

/** 'selected' betyder att clipboard nekades och summan markerats för hand i stället. */
type CopyState = 'idle' | 'copied' | 'selected';

function ChecksumRow({ row }: { row: Row }) {
  const [state, setState] = useState<CopyState>('idle');
  const code = useRef<HTMLElement>(null);

  useEffect(() => {
    if (state === 'idle') return;
    const timer = setTimeout(() => setState('idle'), state === 'copied' ? 2000 : 6000);
    return () => clearTimeout(timer);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(row.sha256);
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

  const label = state === 'copied' ? 'Copied' : state === 'selected' ? 'Ctrl+C' : 'Copy';

  return (
    <li className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 sm:w-52 sm:shrink-0">
        <p className="text-[12.5px] font-medium text-fg">{PLATFORM_LABELS[row.platform]}</p>
        <p className="truncate font-mono text-[11px] text-muted" title={row.name}>
          {row.name}
        </p>
      </div>
      <code
        ref={code}
        className="min-w-0 flex-1 break-all font-mono text-[11px] leading-relaxed text-muted selection:bg-accent/40"
      >
        {row.sha256}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={
          state === 'copied'
            ? `Copied the SHA-256 for ${row.name}`
            : state === 'selected'
              ? `The SHA-256 for ${row.name} is selected – press Ctrl or Cmd and C`
              : `Copy the SHA-256 for ${row.name}`
        }
        className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-line px-2 py-1 text-[11px] text-muted transition-colors hover:border-accent/50 hover:text-fg sm:self-auto"
      >
        {state === 'copied' ? <Check className="size-3 text-accent-soft" /> : <Copy className="size-3" />}
        {label}
      </button>
    </li>
  );
}

export function Checksums({ className }: { className?: string }) {
  const release = useRelease();

  // Repot finns inte eller har inga releases: då finns det inga filer att kontrollera ännu.
  if (release.status === 'missing') return null;

  return (
    <div className={cn('vf-panel overflow-hidden', className)} data-checksum-state={release.status}>
      <header className="flex flex-wrap items-center gap-2 border-b border-line bg-card-strong/50 px-5 py-3.5">
        <Fingerprint className="size-4 text-accent-soft" />
        <h2 className="text-sm font-semibold tracking-tight">Verify your download</h2>
        {release.status === 'ready' ? (
          <span className="ml-auto font-mono text-[11px] text-muted">SHA-256</span>
        ) : null}
      </header>

      {release.status === 'loading' ? (
        <p className="flex items-center gap-2 px-5 py-4 text-[12.5px] text-muted">
          <Loader2 className="size-4 animate-spin" />
          Fetching checksums…
        </p>
      ) : release.status === 'error' ? (
        <p className="px-5 py-4 text-[12.5px] leading-relaxed text-muted">
          Checksums could not be fetched because GitHub was unreachable from this browser. They are
          always published with the release on GitHub.
        </p>
      ) : (
        <ChecksumBody release={release.release} />
      )}
    </div>
  );
}

function ChecksumBody({ release }: { release: Release }) {
  const rows = rowsFor(release);

  if (rows.length === 0) {
    return (
      <p className="px-5 py-4 text-[12.5px] leading-relaxed text-muted">
        This release has no published checksums. They are written into every release from the next
        tag onwards — until then, compare the size and source of the file on{' '}
        <a
          href={release.htmlUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="text-accent-soft underline underline-offset-2"
        >
          the release page
        </a>
        .
      </p>
    );
  }

  return (
    <>
      <ul className="divide-y divide-line">
        {rows.map((row) => (
          <ChecksumRow key={row.platform} row={row} />
        ))}
      </ul>

      <footer className="space-y-2 border-t border-line px-5 py-3.5 text-[11.5px] leading-relaxed text-muted">
        <p>
          A mismatch means the file was altered in transit — do not install it. All sums are also in{' '}
          <a
            href={checksumsUrlForTag(release.tag)}
            className="font-mono text-accent-soft underline underline-offset-2"
          >
            {CHECKSUMS_FILE_NAME}
          </a>
          , the file that <span className="font-mono">sha256sum -c</span> reads.
        </p>
        <dl className="grid gap-1 font-mono text-[11px]">
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-fg">macOS/Linux</dt>
            <dd className="break-all">shasum -a 256 Freevobe-…</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-fg">Windows</dt>
            <dd className="break-all">Get-FileHash .\Freevobe-… -Algorithm SHA256</dd>
          </div>
        </dl>
      </footer>
    </>
  );
}
