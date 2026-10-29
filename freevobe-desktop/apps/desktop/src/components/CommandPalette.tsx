import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { AUTO_APPROVE_LABELS, PERMISSION_DESCRIPTIONS, PERMISSION_LABELS } from '../lib/format';
import {
  AUTO_APPROVE_CATEGORIES,
  PERMISSION_MODES,
  FREEVOBE_SKILLS_DIR,
} from '@freevobe/protocol';

interface Command {
  id: string;
  label: string;
  hint?: string;
  group: string;
  run: () => void | Promise<void>;
}

export function CommandPalette() {
  const open = useAppStore((state) => state.paletteOpen);
  const setPalette = useAppStore((state) => state.setPalette);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<Command[]>(() => {
    const store = useAppStore.getState();
    return [
      { id: 'chat', group: 'Navigering', label: 'Ny chatt', run: () => store.newSession() },
      {
        id: 'sessions',
        group: 'Navigering',
        label: 'Ladda om sessioner',
        run: () => store.loadSessions(),
      },
      {
        id: 'left',
        group: 'Navigering',
        label: 'Växla vänsterpanel',
        run: () => store.toggleLeft(),
      },
      {
        id: 'right',
        group: 'Navigering',
        label: 'Växla högerpanel',
        run: () => store.toggleRight(),
      },
      { id: 'tree', group: 'Navigering', label: 'Växla filträd', run: () => store.toggleTree() },
      { id: 'plan', group: 'Läge', label: 'Plan-läge', run: () => store.setMode('plan') },
      { id: 'execute', group: 'Läge', label: 'Execute-läge', run: () => store.setMode('execute') },
      {
        id: 'plan-approve',
        group: 'Läge',
        label: 'Godkänn planen och utför den',
        hint: 'Plan/Act-kontraktet',
        run: () => {
          const plan = useAppStore
            .getState()
            .plans.find((entry) => entry.status === 'proposed');
          return plan
            ? useAppStore.getState().decidePlan(plan.id, 'approved', { run: true })
            : Promise.resolve();
        },
      },
      {
        id: 'plan-reject',
        group: 'Läge',
        label: 'Avvisa planen',
        run: () => {
          const plan = useAppStore
            .getState()
            .plans.find((entry) => entry.status === 'proposed');
          return plan
            ? useAppStore.getState().decidePlan(plan.id, 'rejected')
            : Promise.resolve();
        },
      },
      ...PERMISSION_MODES.map((mode) => ({
        id: `perm-${mode}`,
        group: 'Behörigheter',
        label: `Behörigheter: ${PERMISSION_LABELS[mode]}`,
        hint: PERMISSION_DESCRIPTIONS[mode],
        run: () => store.setPermissionMode(mode),
      })),
      ...AUTO_APPROVE_CATEGORIES.map((category) => {
        const enabled = store.settings?.autoApprove[category] === true;
        return {
          id: `auto-${category}`,
          group: 'Auto-godkänn',
          label: `${enabled ? 'Slå av' : 'Slå på'} auto-godkännande: ${AUTO_APPROVE_LABELS[category]}`,
          hint: enabled ? 'på' : 'av',
          run: () => store.setAutoApprove(category, !enabled),
        };
      }),
      {
        id: 'skills',
        group: 'Verktyg',
        label: 'Skills…',
        hint: FREEVOBE_SKILLS_DIR,
        run: () => store.setSkillsOpen(true),
      },
      { id: 'mcp', group: 'Verktyg', label: 'MCP-servrar…', run: () => store.setMcpOpen(true) },
      {
        id: 'memory',
        group: 'Verktyg',
        label: 'Projektminne…',
        run: () => store.setMemoryOpen(true),
      },
      { id: 'doctor', group: 'Verktyg', label: 'Kör Doctor', run: () => store.runDoctor() },
      {
        id: 'verify',
        group: 'Verifiering',
        label: 'Kör verifieringen',
        hint: 'Typkontroll, lint, tester, bygge',
        run: () => store.runVerification(),
      },
      {
        id: 'verify-panel',
        group: 'Verifiering',
        label: 'Visa verifieringsrapporten',
        run: () => store.setRightTab('verify'),
      },
      {
        id: 'settings',
        group: 'Verktyg',
        label: 'Inställningar…',
        run: () => store.setSettingsOpen(true),
      },
      { id: 'git', group: 'Verktyg', label: 'Uppdatera git-status', run: () => store.refreshGit() },
      {
        id: 'tests',
        group: 'Verktyg',
        label: 'Kör tester via agenten',
        run: () => store.runTests(),
      },
      {
        id: 'checkpoints',
        group: 'Checkpoints',
        label: 'Visa checkpoints',
        hint: 'Tidslinjen i högerpanelen',
        run: () => store.setRightTab('checkpoints'),
      },
      {
        id: 'checkpoint-save',
        group: 'Checkpoints',
        label: 'Spara checkpoint av nuvarande läge',
        hint: 'Utan att röra Git',
        run: () => store.createCheckpoint(),
      },
      {
        id: 'checkpoint-undo',
        group: 'Checkpoints',
        label: 'Ångra senaste agentändringen',
        hint: 'Återställ senaste öppna checkpointen',
        run: () => {
          const newest = useAppStore
            .getState()
            .checkpoints.find((checkpoint) => checkpoint.status === 'open');
          return newest ? store.restoreCheckpoint(newest.id) : Promise.resolve();
        },
      },
      {
        id: 'explorer',
        group: 'Subagents',
        label: 'Kör Explorer på projektet',
        run: () =>
          store.runSubagent(
            'explorer',
            'Sammanfatta projektets arkitektur och viktigaste moduler.',
          ),
      },
      {
        id: 'reviewer',
        group: 'Subagents',
        label: 'Kör Reviewer på senaste ändringarna',
        run: () =>
          store.runSubagent('reviewer', 'Granska arbetskopians ändringar och rapportera risker.'),
      },
      { id: 'abort', group: 'Körning', label: 'Avbryt pågående körning', run: () => store.abort() },
    ];
  }, []);

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
          placeholder="Skriv ett kommando…"
          className="w-full border-b border-steel bg-forge px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 outline-none"
        />
        <ul className="max-h-80 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <li className="px-4 py-2 text-xs text-slate-600">Inga kommandon matchar.</li>
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
