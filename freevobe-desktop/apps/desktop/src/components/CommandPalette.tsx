import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/appStore';
import { AUTO_APPROVE_LABELS, PERMISSION_DESCRIPTIONS, PERMISSION_LABELS } from '../lib/format';
import { AUTO_APPROVE_CATEGORIES, PERMISSION_MODES, FREEVOBE_SKILLS_DIR } from '@freevobe/protocol';

interface Command {
  id: string;
  label: string;
  hint?: string;
  group: string;
  run: () => void | Promise<void>;
}

export function CommandPalette() {
  const { t } = useTranslation();
  const open = useAppStore((state) => state.paletteOpen);
  const setPalette = useAppStore((state) => state.setPalette);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<Command[]>(() => {
    const store = useAppStore.getState();
    return [
      {
        id: 'chat',
        group: t('palette.groupNavigation'),
        label: t('palette.newChat'),
        run: () => store.newSession(),
      },
      {
        id: 'sessions',
        group: t('palette.groupNavigation'),
        label: t('palette.reloadSessions'),
        run: () => store.loadSessions(),
      },
      {
        id: 'left',
        group: t('palette.groupNavigation'),
        label: t('palette.toggleLeft'),
        run: () => store.toggleLeft(),
      },
      {
        id: 'right',
        group: t('palette.groupNavigation'),
        label: t('palette.toggleRight'),
        run: () => store.toggleRight(),
      },
      {
        id: 'tree',
        group: t('palette.groupNavigation'),
        label: t('palette.toggleTree'),
        run: () => store.toggleTree(),
      },
      {
        id: 'plan',
        group: t('palette.groupMode'),
        label: t('palette.planMode'),
        run: () => store.setMode('plan'),
      },
      {
        id: 'execute',
        group: t('palette.groupMode'),
        label: t('palette.executeMode'),
        run: () => store.setMode('execute'),
      },
      {
        id: 'plan-approve',
        group: t('palette.groupMode'),
        label: t('palette.approvePlan'),
        hint: t('palette.approvePlanHint'),
        run: () => {
          const plan = useAppStore.getState().plans.find((entry) => entry.status === 'proposed');
          return plan
            ? useAppStore.getState().decidePlan(plan.id, 'approved', { run: true })
            : Promise.resolve();
        },
      },
      {
        id: 'plan-reject',
        group: t('palette.groupMode'),
        label: t('palette.rejectPlan'),
        run: () => {
          const plan = useAppStore.getState().plans.find((entry) => entry.status === 'proposed');
          return plan ? useAppStore.getState().decidePlan(plan.id, 'rejected') : Promise.resolve();
        },
      },
      ...PERMISSION_MODES.map((mode) => ({
        id: `perm-${mode}`,
        group: t('palette.groupPermissions'),
        label: t('palette.permission', { label: PERMISSION_LABELS[mode] }),
        hint: PERMISSION_DESCRIPTIONS[mode],
        run: () => store.setPermissionMode(mode),
      })),
      ...AUTO_APPROVE_CATEGORIES.map((category) => {
        const enabled = store.settings?.autoApprove[category] === true;
        return {
          id: `auto-${category}`,
          group: t('palette.groupAutoApprove'),
          label: t(enabled ? 'palette.autoApproveOff' : 'palette.autoApproveOn', {
            category: AUTO_APPROVE_LABELS[category],
          }),
          hint: enabled ? t('palette.on') : t('palette.off'),
          run: () => store.setAutoApprove(category, !enabled),
        };
      }),
      {
        id: 'skills',
        group: t('palette.groupTools'),
        label: t('palette.skills'),
        hint: FREEVOBE_SKILLS_DIR,
        run: () => store.setSkillsOpen(true),
      },
      {
        id: 'mcp',
        group: t('palette.groupTools'),
        label: t('palette.mcp'),
        run: () => store.setMcpOpen(true),
      },
      {
        id: 'memory',
        group: t('palette.groupTools'),
        label: t('palette.memory'),
        run: () => store.setMemoryOpen(true),
      },
      {
        id: 'doctor',
        group: t('palette.groupTools'),
        label: t('palette.doctor'),
        run: () => store.runDoctor(),
      },
      {
        id: 'verify',
        group: t('palette.groupVerification'),
        label: t('palette.runVerification'),
        hint: t('palette.runVerificationHint'),
        run: () => store.runVerification(),
      },
      {
        id: 'verify-panel',
        group: t('palette.groupVerification'),
        label: t('palette.verificationReport'),
        run: () => store.setRightTab('verify'),
      },
      {
        id: 'settings',
        group: t('palette.groupTools'),
        label: t('palette.settings'),
        run: () => store.setSettingsOpen(true),
      },
      {
        id: 'git',
        group: t('palette.groupTools'),
        label: t('palette.refreshGit'),
        run: () => store.refreshGit(),
      },
      {
        id: 'tests',
        group: t('palette.groupTools'),
        label: t('palette.runTests'),
        run: () => store.runTests(),
      },
      {
        id: 'checkpoints',
        group: t('palette.groupCheckpoints'),
        label: t('palette.checkpoints'),
        hint: t('palette.checkpointsHint'),
        run: () => store.setRightTab('checkpoints'),
      },
      {
        id: 'checkpoint-save',
        group: t('palette.groupCheckpoints'),
        label: t('palette.saveCheckpoint'),
        hint: t('palette.saveCheckpointHint'),
        run: () => store.createCheckpoint(),
      },
      {
        id: 'checkpoint-undo',
        group: t('palette.groupCheckpoints'),
        label: t('palette.undo'),
        hint: t('palette.undoHint'),
        run: () => {
          const newest = useAppStore
            .getState()
            .checkpoints.find((checkpoint) => checkpoint.status === 'open');
          return newest ? store.restoreCheckpoint(newest.id) : Promise.resolve();
        },
      },
      {
        id: 'explorer',
        group: t('palette.groupSubagents'),
        label: t('palette.explorer'),
        run: () => store.runSubagent('explorer', t('palette.explorerPrompt')),
      },
      {
        id: 'reviewer',
        group: t('palette.groupSubagents'),
        label: t('palette.reviewer'),
        run: () => store.runSubagent('reviewer', t('palette.reviewerPrompt')),
      },
      {
        id: 'abort',
        group: t('palette.groupRun'),
        label: t('palette.abort'),
        run: () => store.abort(),
      },
    ];
  }, [t]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter(
      (command) =>
        command.label.toLowerCase().includes(needle) ||
        command.group.toLowerCase().includes(needle) ||
        (command.hint ?? '').toLowerCase().includes(needle),
    );
  }, [commands, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => setCursor(0), [query]);

  if (!open) return null;

  const execute = async (command: Command | undefined) => {
    if (!command) return;
    setPalette(false);
    await command.run();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-anvil/60 p-6 pt-24 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setPalette(false);
      }}
    >
      <div
        className="vf-panel w-full max-w-xl overflow-hidden shadow-2xl"
        data-testid="command-palette"
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setPalette(false);
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setCursor((value) => Math.min(filtered.length - 1, value + 1));
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setCursor((value) => Math.max(0, value - 1));
            }
            if (event.key === 'Enter') {
              event.preventDefault();
              void execute(filtered[cursor]);
            }
          }}
          placeholder={t('palette.placeholder')}
          className="w-full border-b border-steel bg-forge px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 outline-none"
        />
        <ul className="max-h-80 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <li className="px-4 py-2 text-xs text-slate-600">{t('palette.noMatch')}</li>
          ) : null}
          {filtered.map((command, index) => (
            <li key={command.id}>
              <button
                type="button"
                onMouseEnter={() => setCursor(index)}
                onClick={() => void execute(command)}
                className={`flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left text-sm ${
                  index === cursor ? 'bg-steel/50 text-slate-100' : 'text-slate-400'
                }`}
              >
                <span className="w-24 shrink-0 text-[10px] tracking-wide text-slate-600 uppercase">
                  {command.group}
                </span>
                <span className="flex-1 truncate">{command.label}</span>
                {command.hint ? (
                  <span className="truncate text-[10px] text-slate-600">{command.hint}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
