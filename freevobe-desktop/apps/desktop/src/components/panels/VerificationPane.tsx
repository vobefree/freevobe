import { useState } from 'react';
import type {
  VerificationCheckResult,
  VerificationCommand,
  VerificationReport,
} from '@freevobe/protocol';
import { useAppStore } from '../../store/appStore';
import { Button, Chip, EmptyState } from '../ui';
import { clockTime } from '../../lib/format';

const STATUS_LABELS: Record<VerificationCheckResult['status'], string> = {
  passed: 'grön',
  failed: 'röd',
  timeout: 'tidsgräns',
  skipped: 'överhoppad',
};

const STATUS_TONE: Record<
  VerificationCheckResult['status'],
  'neutral' | 'ember' | 'mint' | 'alert'
> = {
  passed: 'mint',
  failed: 'alert',
  timeout: 'alert',
  skipped: 'neutral',
};

const TRIGGER_LABELS: Record<VerificationReport['trigger'], string> = {
  run: 'automatiskt efter körningen',
  manual: 'manuellt',
  tool: 'av agenten',
};

function CheckRow({ check }: { check: VerificationCheckResult }) {
  const [open, setOpen] = useState(check.status !== 'passed');

  return (
    <li className="rounded border border-steel/70 bg-forge/40">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full cursor-pointer items-center gap-2 px-2 py-1.5 text-left"
        title={check.command}
      >
        <Chip tone={STATUS_TONE[check.status]}>{STATUS_LABELS[check.status]}</Chip>
        <span className="text-xs font-medium text-slate-200">{check.label}</span>
        <span className="truncate font-mono text-[10px] text-slate-500">{check.command}</span>
        <span className="ml-auto shrink-0 text-[10px] text-slate-500">
          {check.durationMs} ms
          {check.kind === 'test' && check.passed !== undefined
            ? ` · ${check.passed} gröna${check.failed ? `, ${check.failed} röda` : ''}`
            : ''}
        </span>
        <span className="shrink-0 text-[10px] text-slate-600">{open ? '▾' : '▸'}</span>
      </button>
      {open ? (
        check.output ? (
          <pre className="max-h-64 overflow-auto border-t border-steel/60 px-2 py-1.5 font-mono text-[10.5px] whitespace-pre-wrap text-slate-400">
            {check.output}
          </pre>
        ) : (
          <p className="border-t border-steel/60 px-2 py-1.5 text-[10.5px] text-slate-600">
            {check.status === 'skipped' ? 'Steget hoppades över.' : 'Kommandot gav ingen utdata.'}
          </p>
        )
      ) : null}
    </li>
  );
}

function CommandList({ commands }: { commands: VerificationCommand[] }) {
  return (
    <div className="flex flex-wrap gap-1" data-testid="verification-commands">
      {commands.map((command) => (
        <Chip key={command.id}>{command.label}</Chip>
      ))}
    </div>
  );
}

export function VerificationPane() {
  const verification = useAppStore((state) => state.verification);
  const commands = useAppStore((state) => state.verificationCommands);
  const progress = useAppStore((state) => state.verificationProgress);
  const running = useAppStore((state) => state.verificationRunning);
  const hasProject = useAppStore((state) => state.project !== null);
  const runVerification = useAppStore((state) => state.runVerification);

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="verification-pane">
      <div className="space-y-1.5 border-b border-steel p-2">
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            disabled={!hasProject || running}
            onClick={() => void runVerification()}
            testId="run-verification"
            title="Kör typkontroll, lint, tester och bygge – de som finns i projektet"
          >
            {running ? 'Verifierar…' : 'Kör verifieringen'}
          </Button>
          {verification ? (
            <span className="text-[11px] text-slate-500">{verification.summary}</span>
          ) : null}
        </div>
        {commands.length > 0 ? <CommandList commands={commands} /> : null}
        {commands.length === 0 ? (
          <p className="text-[10.5px] text-slate-600">
            Inga verifieringssteg hittades. Lägg till skript i <code>package.json</code>
            (typecheck, lint, test, build) eller motsvarande konfiguration.
          </p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-2">
        {running ? (
          <ul className="space-y-1" data-testid="verification-progress">
            {progress.length === 0 ? (
              <li className="text-[11px] text-slate-500">Kör första steget…</li>
            ) : null}
            {progress.map((check) => (
              <CheckRow key={check.id} check={check} />
            ))}
          </ul>
        ) : verification ? (
          <div className="space-y-1.5" data-testid="verification-report">
            <header className="flex flex-wrap items-center gap-2">
              <Chip tone={verification.status === 'passed' ? 'mint' : 'alert'}>
                {verification.status === 'passed'
                  ? 'allt grönt'
                  : verification.status === 'failed'
                    ? 'röda steg'
                    : 'inget kört'}
              </Chip>
              <span className="text-[11px] text-slate-400">{verification.summary}</span>
              <span className="ml-auto text-[10px] text-slate-600">
                {clockTime(verification.finishedAt)} · {TRIGGER_LABELS[verification.trigger]}
              </span>
            </header>
            <ul className="space-y-1">
              {verification.checks.map((check) => (
                <CheckRow key={check.id} check={check} />
              ))}
            </ul>
          </div>
        ) : (
          <EmptyState
            title="Ingen verifiering körd än"
            hint="Efter en körning som ändrat filer körs typkontroll, lint och tester automatiskt – rapporten hamnar här."
          />
        )}
      </div>
    </div>
  );
}
