import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Checkpoint } from '@freevobe/protocol';
import { useAppStore } from '../../store/appStore';
import { Button, Chip, EmptyState } from '../ui';
import { timeAgo } from '../../lib/format';

const STATUS_KEYS: Record<Checkpoint['status'], string> = {
  open: 'checkpoints.status.open',
  restored: 'checkpoints.status.restored',
  committed: 'checkpoints.status.committed',
  discarded: 'checkpoints.status.discarded',
};

const STATUS_TONES: Record<Checkpoint['status'], 'neutral' | 'mint' | 'sky' | 'ember'> = {
  open: 'mint',
  restored: 'sky',
  committed: 'neutral',
  discarded: 'ember',
};

/** Checkpointens filer med sin nettoändring, så att listan går att överblicka utan att öppna diffen. */
function FileList({ checkpoint }: { checkpoint: Checkpoint }) {
  const { t } = useTranslation();
  return (
    <ul className="mt-1.5 space-y-0.5">
      {checkpoint.files.slice(0, 6).map((file) => (
        <li key={file.path} className="flex items-center gap-2 font-mono text-[10.5px]">
          <span
            className={
              file.changeKind === 'create'
                ? 'text-mint'
                : file.changeKind === 'delete'
                  ? 'text-alert'
                  : 'text-spark'
            }
          >
            {file.changeKind === 'create' ? 'A' : file.changeKind === 'delete' ? 'D' : 'M'}
          </span>
          <span className="truncate text-slate-400" title={file.path}>
            {file.path}
          </span>
          {file.additions + file.deletions > 0 ? (
            <span className="ml-auto shrink-0 text-[10px] text-slate-600">
              +{file.additions} −{file.deletions}
            </span>
          ) : null}
        </li>
      ))}
      {checkpoint.files.length > 6 ? (
        <li className="text-[10px] text-slate-600">
          {t('checkpoints.moreFiles', { count: checkpoint.files.length - 6 })}
        </li>
      ) : null}
    </ul>
  );
}

function CheckpointCard({ checkpoint }: { checkpoint: Checkpoint }) {
  const { t } = useTranslation();
  const busy = useAppStore((state) => state.checkpointBusy);
  const showCheckpointDiff = useAppStore((state) => state.showCheckpointDiff);
  const restoreCheckpoint = useAppStore((state) => state.restoreCheckpoint);
  const discardCheckpoint = useAppStore((state) => state.discardCheckpoint);
  const commitCheckpoint = useAppStore((state) => state.commitCheckpoint);

  const conflicts = useAppStore((state) =>
    state.checkpointConflicts?.checkpointId === checkpoint.id
      ? state.checkpointConflicts.paths
      : null,
  );
  const [confirming, setConfirming] = useState(false);
  const [forcing, setForcing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [message, setMessage] = useState(`Checkpoint: ${checkpoint.label}`);

  const disabled = busy === checkpoint.id;
  const discarded = checkpoint.status === 'discarded';

  return (
    <article
      data-testid="checkpoint-item"
      data-checkpoint-id={checkpoint.id}
      className={`vf-panel p-2 ${discarded ? 'opacity-60' : ''}`}
    >
      <header className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-semibold text-slate-200">{checkpoint.label}</span>
        <Chip tone={STATUS_TONES[checkpoint.status]}>{t(STATUS_KEYS[checkpoint.status])}</Chip>
        <Chip>
          {checkpoint.reason === 'manual' ? t('checkpoints.manual') : t('checkpoints.agent')}
        </Chip>
        {checkpoint.testStatus === 'passed' ? (
          <Chip tone="mint">{t('checkpoints.testsPassed')}</Chip>
        ) : null}
        {checkpoint.testStatus === 'failed' ? (
          <Chip tone="alert">{t('checkpoints.testsFailed')}</Chip>
        ) : null}
        <span className="ml-auto font-mono text-[10px] text-slate-600">
          {timeAgo(checkpoint.createdAt)}
        </span>
      </header>

      <p className="mt-1 font-mono text-[10px] text-slate-600">
        {t('checkpoints.files', { count: checkpoint.files.length })}
        {checkpoint.committedHash ? ` · commit ${checkpoint.committedHash}` : ''}
        {checkpoint.testSummary && checkpoint.testStatus !== 'unknown'
          ? ` · ${checkpoint.testSummary}`
          : ''}
      </p>

      <FileList checkpoint={checkpoint} />

      {conflicts ? (
        <div
          className="mt-2 rounded border border-ember/40 bg-ember/10 p-1.5"
          data-testid="checkpoint-conflicts"
        >
          <p className="text-[10.5px] text-spark">
            {t('checkpoints.conflicts', { count: conflicts.length, paths: conflicts.join(', ') })}
          </p>
          {forcing ? (
            <div className="mt-1 flex items-center gap-1.5">
              <Button
                variant="danger"
                disabled={disabled}
                onClick={() => {
                  setForcing(false);
                  void restoreCheckpoint(checkpoint.id, true);
                }}
                testId="checkpoint-confirm-force"
              >
                {t('checkpoints.forceConfirm')}
              </Button>
              <Button variant="ghost" onClick={() => setForcing(false)}>
                {t('checkpoints.cancel')}
              </Button>
            </div>
          ) : (
            <Button
              className="mt-1"
              disabled={disabled}
              onClick={() => setForcing(true)}
              title={t('checkpoints.forceTitle')}
              testId="checkpoint-force"
            >
              {t('checkpoints.force')}
            </Button>
          )}
        </div>
      ) : null}

      <footer className="mt-2 flex flex-wrap items-center gap-1.5">
        <Button
          onClick={() => void showCheckpointDiff(checkpoint.id)}
          disabled={disabled || discarded}
          testId="checkpoint-diff"
        >
          {t('checkpoints.diff')}
        </Button>

        {confirming ? (
          <>
            <Button
              variant="danger"
              disabled={disabled}
              onClick={() => {
                setConfirming(false);
                void restoreCheckpoint(checkpoint.id);
              }}
              testId="checkpoint-confirm-restore"
            >
              {t('checkpoints.overwrite')}
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              {t('checkpoints.cancel')}
            </Button>
          </>
        ) : (
          <Button
            variant="primary"
            disabled={disabled || discarded}
            onClick={() => setConfirming(true)}
            title={t('checkpoints.restoreTitle')}
            testId="checkpoint-restore"
          >
            {t('checkpoints.restore')}
          </Button>
        )}

        {committing ? (
          <div className="flex w-full items-center gap-1.5">
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              data-testid="checkpoint-commit-input"
              className="min-w-0 flex-1 rounded border border-steel bg-anvil px-2 py-1 text-[11px] text-slate-200"
            />
            <Button
              disabled={disabled || message.trim() === ''}
              onClick={() => {
                setCommitting(false);
                void commitCheckpoint(checkpoint.id, message.trim());
              }}
              testId="checkpoint-commit-send"
            >
              {t('checkpoints.commitSend')}
            </Button>
            <Button variant="ghost" onClick={() => setCommitting(false)}>
              {t('checkpoints.cancel')}
            </Button>
          </div>
        ) : (
          <Button
            disabled={disabled || discarded}
            onClick={() => setCommitting(true)}
            title={t('checkpoints.commitTitle')}
            testId="checkpoint-commit"
          >
            {t('checkpoints.commit')}
          </Button>
        )}

        <Button
          variant="ghost"
          className="ml-auto"
          disabled={disabled || discarded}
          onClick={() => void discardCheckpoint(checkpoint.id)}
          testId="checkpoint-discard"
        >
          {t('checkpoints.discard')}
        </Button>
      </footer>
    </article>
  );
}

export function CheckpointsPane() {
  const { t } = useTranslation();
  const checkpoints = useAppStore((state) => state.checkpoints);
  const createCheckpoint = useAppStore((state) => state.createCheckpoint);
  const refreshCheckpoints = useAppStore((state) => state.refreshCheckpoints);
  const busy = useAppStore((state) => state.checkpointBusy);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-steel p-2">
        <Button
          variant="primary"
          disabled={busy !== null}
          onClick={() => void createCheckpoint()}
          testId="new-checkpoint"
          title={t('checkpoints.newTitle')}
        >
          {t('checkpoints.new')}
        </Button>
        <span className="text-[10.5px] text-slate-600">{t('checkpoints.localOnly')}</span>
        <Button
          variant="ghost"
          className="ml-auto"
          onClick={() => void refreshCheckpoints()}
          title={t('checkpoints.refresh')}
        >
          ↻
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        {checkpoints.length === 0 ? (
          <EmptyState title={t('checkpoints.empty.title')} hint={t('checkpoints.empty.hint')} />
        ) : (
          checkpoints.map((checkpoint) => (
            <CheckpointCard key={checkpoint.id} checkpoint={checkpoint} />
          ))
        )}
      </div>
    </div>
  );
}
