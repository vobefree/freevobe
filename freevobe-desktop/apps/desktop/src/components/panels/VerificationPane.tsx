import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  VerificationCheckResult,
  VerificationCommand,
  VerificationReport,
} from '@freevobe/protocol';
import { useAppStore } from '../../store/appStore';
import { Button, Chip, EmptyState } from '../ui';
import { clockTime } from '../../lib/format';

const STATUS_KEYS: Record<VerificationCheckResult['status'], string> = {
  passed: 'verify.status.passed',
  failed: 'verify.status.failed',
  timeout: 'verify.status.timeout',
  skipped: 'verify.status.skipped',
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

const TRIGGER_KEYS: Record<VerificationReport['trigger'], string> = {
  run: 'verify.trigger.run',
  manual: 'verify.trigger.manual',
  tool: 'verify.trigger.tool',
};

function CheckRow({ check }: { check: VerificationCheckResult }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(check.status !== 'passed');

  return (
    <li className="rounded border border-steel/70 bg-forge/40">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full cursor-pointer items-center gap-2 px-2 py-1.5 text-left"
        title={check.command}
      >
        <Chip tone={STATUS_TONE[check.status]}>{t(STATUS_KEYS[check.status])}</Chip>
        <span className="text-xs font-medium text-slate-200">{check.label}</span>
        <span className="truncate font-mono text-[10px] text-slate-500">{check.command}</span>
        <span className="ml-auto shrink-0 text-[10px] text-slate-500">
          {t('verify.ms', { count: check.durationMs })}
          {check.kind === 'test' && check.passed !== undefined
            ? ` · ${t('rightPanel.tests.passed', { count: check.passed })}${
                check.failed ? `, ${t('rightPanel.tests.failed', { count: check.failed })}` : ''
              }`
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
            {check.status === 'skipped' ? t('verify.skippedStep') : t('verify.noOutput')}
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
  const { t } = useTranslation();
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
            title={t('verify.runTitle')}
          >
            {running ? t('verify.running') : t('verify.run')}
          </Button>
          {verification ? (
            <span className="text-[11px] text-slate-500">{verification.summary}</span>
          ) : null}
        </div>
        {commands.length > 0 ? <CommandList commands={commands} /> : null}
        {commands.length === 0 ? (
          <p className="text-[10.5px] text-slate-600">
            {t('verify.none.before')} <code>package.json</code> {t('verify.none.after')}
          </p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-2">
        {running ? (
          <ul className="space-y-1" data-testid="verification-progress">
            {progress.length === 0 ? (
              <li className="text-[11px] text-slate-500">{t('verify.firstStep')}</li>
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
                  ? t('verify.summary.allGreen')
                  : verification.status === 'failed'
                    ? t('verify.summary.failed')
                    : t('verify.summary.none')}
              </Chip>
              <span className="text-[11px] text-slate-400">{verification.summary}</span>
              <span className="ml-auto text-[10px] text-slate-600">
                {clockTime(verification.finishedAt)} · {t(TRIGGER_KEYS[verification.trigger])}
              </span>
            </header>
            <ul className="space-y-1">
              {verification.checks.map((check) => (
                <CheckRow key={check.id} check={check} />
              ))}
            </ul>
          </div>
        ) : (
          <EmptyState title={t('verify.empty.title')} hint={t('verify.empty.hint')} />
        )}
      </div>
    </div>
  );
}
