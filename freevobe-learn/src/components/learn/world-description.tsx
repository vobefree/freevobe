'use client';

import { useState } from 'react';
import { describeInWords } from '@/lib/learn/describe';
import { biomeById, goalById, heroById, obstacleById, treasureById } from '@/lib/learn/lexicon';
import { reachableTiles } from '@/lib/learn/validate';
import { WORLD_TEXT_LEGEND, worldToText } from '@/lib/learn/world-text';
import type { Interpretation, PlayableWorld, ValidationIssue } from '@/lib/learn/types';

export interface WorldDescriptionProps {
  interpretation: Interpretation;
  world: PlayableWorld | null;
  issues: ValidationIssue[];
}

function Value({ label, value }: { label: string; value: string }) {
  return (
    <div className="learn-tile px-3 py-2.5">
      <p className="font-mono text-[10.5px] tracking-[0.07em] text-[color:var(--learn-muted)]">
        {label}
      </p>
      <p className="mt-0.5 text-[13.5px] font-semibold">{value}</p>
    </div>
  );
}

export function WorldDescription({ interpretation, world, issues }: WorldDescriptionProps) {
  const [copied, setCopied] = useState(false);
  const spec = interpretation.spec;
  const errors = issues.filter((issue) => issue.level === 'error');
  const warnings = issues.filter((issue) => issue.level === 'warning');
  const ok = errors.length === 0 && world !== null;

  const reachable = world ? reachableTiles(world) : null;
  const reachableTreasures = world && reachable
    ? world.treasures.filter((point) => reachable.has(point.y * world.cols + point.x)).length
    : 0;

  const copyJson = async () => {
    const json = JSON.stringify(spec, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <article className="learn-panel p-5 shadow-[6px_6px_0_var(--learn-shadow)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-[0.08em] text-[color:var(--learn-muted)]">
            Världsbeskrivning
          </p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{spec.name}</h2>
        </div>
        <p
          data-testid="learn-validation-badge"
          className="rounded-full border-2 px-3 py-1 text-[12px] font-semibold"
          style={{
            borderColor: ok ? 'var(--learn-mint)' : 'var(--learn-coral)',
            color: ok ? 'var(--learn-mint)' : 'var(--learn-coral)',
          }}
        >
          {ok ? 'Godkänd och spelbar' : 'Behöver rättas'}
        </p>
      </div>

      <p className="mt-3 text-[15px] leading-relaxed text-[color:var(--learn-fg)]">
        {describeInWords(spec)}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Value label="Plats" value={biomeById(spec.biome).label} />
        <Value label="Hjälte" value={heroById(spec.hero).label} />
        <Value label="Skatt" value={treasureById(spec.treasure).label} />
        <Value label="I vägen" value={obstacleById(spec.obstacle).label} />
        <Value label="Mål" value={goalById(spec.goal).label} />
        <Value label="Karta" value={`${spec.cols} × ${spec.rows} rutor`} />
        <Value label="Känsla" value={spec.mood === 'wild' ? 'vild' : 'lugn'} />
        <Value label="Frö" value={String(spec.seed)} />
      </div>

      {ok && world ? (
        <p
          data-testid="learn-validation-summary"
          className="mt-4 flex items-start gap-2 rounded-lg border border-[color:var(--learn-mint)]/40 bg-[color:var(--learn-mint)]/10 px-3 py-2 text-[13px]"
        >
          <span aria-hidden="true">✓</span>
          <span>
            Kontrollerad: målet går att nå och {reachableTreasures} av {world.treasures.length}{' '}
            {world.treasures.length === 1 ? 'skatt ligger' : 'skatter ligger'} inom räckhåll.
            Hjälten börjar på ({world.start.x}, {world.start.y}).
          </span>
        </p>
      ) : null}

      {errors.length > 0 ? (
        <ul className="mt-4 space-y-2" data-testid="learn-validation-issues">
          {errors.map((issue) => (
            <li
              key={`${issue.code}-${issue.message}`}
              className="rounded-lg border border-[color:var(--learn-coral)]/50 bg-[color:var(--learn-coral)]/10 px-3 py-2 text-[13px]"
            >
              <p className="font-semibold">{issue.message}</p>
              <p className="mt-0.5 text-[color:var(--learn-muted)]">{issue.fix}</p>
            </li>
          ))}
        </ul>
      ) : null}

      {warnings.length > 0 ? (
        <ul className="mt-3 space-y-1 text-[12.5px] text-[color:var(--learn-muted)]">
          {warnings.map((issue) => (
            <li key={`${issue.code}-${issue.message}`}>! {issue.message}</li>
          ))}
        </ul>
      ) : null}

      <details className="mt-4 rounded-lg border border-[color:var(--learn-line)] bg-[color:var(--learn-panel-strong)]/60 px-3 py-2">
        <summary className="cursor-pointer text-[13px] font-semibold">
          Så blev orden en värld ({interpretation.notes.length} val)
        </summary>
        <ul className="mt-2 space-y-1 font-mono text-[11.5px] leading-relaxed text-[color:var(--learn-muted)]">
          {interpretation.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        {interpretation.ignored.length > 0 ? (
          <p className="mt-3 text-[12px] leading-relaxed text-[color:var(--learn-muted)]">
            Ord jag inte använde: {interpretation.ignored.join(', ')}. De står kvar i din mening,
            men blev inget i världen.
          </p>
        ) : null}
      </details>

      {world ? (
        <details className="mt-2 rounded-lg border border-[color:var(--learn-line)] bg-[color:var(--learn-panel-strong)]/60 px-3 py-2">
          <summary className="cursor-pointer text-[13px] font-semibold">
            Kartan som text ({world.cols} × {world.rows})
          </summary>
          <pre
            data-testid="learn-world-text-map"
            className="learn-code mt-2 !px-3 !leading-[1.35]"
          >
            {worldToText(world)}
          </pre>
          <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-[color:var(--learn-muted)]">
            {WORLD_TEXT_LEGEND.map((entry) => (
              <span key={entry.symbol}>
                {entry.symbol} {entry.meaning}
              </span>
            ))}
          </p>
        </details>
      ) : null}

      <details className="mt-2 rounded-lg border border-[color:var(--learn-line)] bg-[color:var(--learn-panel-strong)]/60 px-3 py-2">
        <summary className="cursor-pointer text-[13px] font-semibold">
          Hela beskrivningen som data
        </summary>
        <div className="mt-2">
          <pre data-testid="learn-world-json" className="learn-code">
            {JSON.stringify(spec, null, 2)}
          </pre>
          <button
            type="button"
            onClick={copyJson}
            className="learn-button learn-button-secondary mt-2 !px-3 !py-1.5 !text-[12px]"
          >
            {copied ? 'Kopierat' : 'Kopiera beskrivningen'}
          </button>
        </div>
      </details>
    </article>
  );
}
