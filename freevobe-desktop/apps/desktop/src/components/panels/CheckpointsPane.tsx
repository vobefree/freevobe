import { useState } from 'react';
import type { Checkpoint } from '@freevobe/protocol';
import { useAppStore } from '../../store/appStore';
import { Button, Chip, EmptyState } from '../ui';
import { timeAgo } from '../../lib/format';

const STATUS_LABELS: Record<Checkpoint['status'], string> = {
  open: 'Öppen',
  restored: 'Återställd',
  committed: 'Committad',
  discarded: 'Avförd',
};

const STATUS_TONES: Record<Checkpoint['status'], 'neutral' | 'mint' | 'sky' | 'ember'> = {
  open: 'mint',
  restored: 'sky',
  committed: 'neutral',
  discarded: 'ember',
};

/** Checkpointens filer med sin nettoändring, så att listan går att överblicka utan att öppna diffen. */
function FileList({ checkpoint }: { checkpoint: Checkpoint }) {
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
          … och {checkpoint.files.length - 6} filer till
        </li>
      ) : null}
    </ul>
  );
}

function CheckpointCard({ checkpoint }: { checkpoint: Checkpoint }) {
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
        <Chip tone={STATUS_TONES[checkpoint.status]}>{STATUS_LABELS[checkpoint.status]}</Chip>
        <Chip>{checkpoint.reason === 'manual' ? 'manuell' : 'agent'}</Chip>
        {checkpoint.testStatus === 'passed' ? <Chip tone="mint">tester gröna</Chip> : null}
        {checkpoint.testStatus === 'failed' ? <Chip tone="alert">tester röda</Chip> : null}
        <span className="ml-auto font-mono text-[10px] text-slate-600">
          {timeAgo(checkpoint.createdAt)}
        </span>
      </header>

      <p className="mt-1 font-mono text-[10px] text-slate-600">
        {checkpoint.files.length} filer
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
            {conflicts.length === 1 ? '1 fil har' : `${conflicts.length} filer har`} ändrats sedan
            checkpointen och hoppades över: {conflicts.join(', ')}.
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
                Skriv över ändå
              </Button>
              <Button variant="ghost" onClick={() => setForcing(false)}>
                Avbryt
              </Button>
            </div>
          ) : (
            <Button
              className="mt-1"
              disabled={disabled}
              onClick={() => setForcing(true)}
              title="Skriv över filerna även om de ändrats sedan checkpointen"
              testId="checkpoint-force"
            >
              Tvinga återställning
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
          Diff
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
              Skriv över filerna
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Avbryt
            </Button>
          </>
        ) : (
          <Button
            variant="primary"
            disabled={disabled || discarded}
            onClick={() => setConfirming(true)}
            title="Skriv tillbaka filerna som de såg ut före checkpointen"
            testId="checkpoint-restore"
          >
            Återställ
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
              Committa
            </Button>
            <Button variant="ghost" onClick={() => setCommitting(false)}>
              Avbryt
            </Button>
          </div>
        ) : (
          <Button
            disabled={disabled || discarded}
            onClick={() => setCommitting(true)}
            title="Skapa en Git-commit av filerna i checkpointen"
            testId="checkpoint-commit"
          >
            Committa
          </Button>
        )}

        <Button
          variant="ghost"
          className="ml-auto"
          disabled={disabled || discarded}
          onClick={() => void discardCheckpoint(checkpoint.id)}
          testId="checkpoint-discard"
        >
          Kassera
        </Button>
      </footer>
    </article>
  );
}

export function CheckpointsPane() {
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
          title="Spara nuvarande innehåll i ändrade filer"
        >
          Ny checkpoint
        </Button>
        <span className="text-[10.5px] text-slate-600">
          Sparas lokalt, utan att röra Git-historiken
        </span>
        <Button
          variant="ghost"
          className="ml-auto"
          onClick={() => void refreshCheckpoints()}
          title="Läs om listan"
        >
          ↻
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        {checkpoints.length === 0 ? (
          <EmptyState
            title="Inga checkpoints än"
            hint="Varje gång agenten ändrar en fil sparas filens tidigare innehåll här. Sedan kan du backa till valfri punkt utan att röra Git."
          />
        ) : (
          checkpoints.map((checkpoint) => (
            <CheckpointCard key={checkpoint.id} checkpoint={checkpoint} />
          ))
        )}
      </div>
    </div>
  );
}
