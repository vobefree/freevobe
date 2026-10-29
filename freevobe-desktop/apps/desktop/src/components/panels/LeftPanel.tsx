import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { AutoApproveChips } from '../AutoApproveSettings';
import { Button, Chip, EmptyState } from '../ui';
import { PERMISSION_DESCRIPTIONS, PERMISSION_LABELS, shortPath, timeAgo } from '../../lib/format';
import { PERMISSION_MODES } from '@freevobe/protocol';

const SUBAGENT_TONE: Record<string, 'neutral' | 'ember' | 'mint' | 'alert'> = {
  queued: 'neutral',
  running: 'ember',
  done: 'mint',
  failed: 'alert',
  aborted: 'neutral',
};

export function LeftPanel() {
  const sessions = useAppStore((state) => state.sessions);
  const sessionId = useAppStore((state) => state.sessionId);
  const project = useAppStore((state) => state.project);
  const projects = useAppStore((state) => state.projects);
  const mode = useAppStore((state) => state.mode);
  const permissionMode = useAppStore((state) => state.permissionMode);
  const settings = useAppStore((state) => state.settings);
  const tasks = useAppStore((state) => state.tasks);
  const subagents = useAppStore((state) => state.subagents);
  const newSession = useAppStore((state) => state.newSession);
  const selectSession = useAppStore((state) => state.selectSession);
  const deleteSession = useAppStore((state) => state.deleteSession);
  const openProject = useAppStore((state) => state.openProject);
  const setMode = useAppStore((state) => state.setMode);
  const setPermissionMode = useAppStore((state) => state.setPermissionMode);
  const [projectPath, setProjectPath] = useState('');

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-2">
      <section className="vf-panel p-2">
        <div className="flex items-center gap-1.5">
          <Button variant="primary" full onClick={() => void newSession()} testId="new-session">
            + Ny chatt
          </Button>
        </div>
        <div className="mt-2 flex rounded border border-steel p-0.5 text-[11px]">
          {(['plan', 'execute'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => void setMode(value)}
              className={`flex-1 cursor-pointer rounded px-2 py-1 ${
                mode === value
                  ? 'bg-ember font-semibold text-anvil'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={
                value === 'plan'
                  ? 'Agenten läser och föreslår en plan. Inga filer ändras förrän du godkänt planen.'
                  : 'Agenten får skriva kod – inom den godkända planen om det finns en.'
              }
            >
              {value === 'plan' ? 'Plan-läge' : 'Execute-läge'}
            </button>
          ))}
        </div>
        <label className="mt-2 block text-[10px] tracking-wide text-slate-500 uppercase">
          Behörigheter
        </label>
        <select
          value={permissionMode}
          data-testid="permission-mode"
          onChange={(event) => void setPermissionMode(event.target.value as never)}
          className="mt-0.5 w-full rounded border border-steel bg-anvil px-2 py-1 text-xs text-slate-200"
        >
          {PERMISSION_MODES.map((value) => (
            <option key={value} value={value}>
              {PERMISSION_LABELS[value]}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[10px] leading-4 text-slate-600">
          {PERMISSION_DESCRIPTIONS[permissionMode]}
        </p>
        {mode === 'plan' ? (
          <p className="mt-1 rounded border border-sky/30 bg-sky/5 px-1.5 py-1 text-[10px] leading-4 text-sky">
            Plan-läget avslutas när du godkänner planen i chatten.
          </p>
        ) : null}
        {settings ? <AutoApproveChips autoApprove={settings.autoApprove} /> : null}
      </section>

      <section className="vf-panel p-2">
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
            Projekt
          </h2>
          <span className="text-[10px] text-slate-600">{projects.length} kända</span>
        </div>
        <p
          className="mt-1 truncate font-mono text-[11px] text-slate-300"
          title={project?.path ?? ''}
        >
          {project ? shortPath(project.path, 46) : 'Inget projekt öppet'}
        </p>
        <div className="mt-1.5 flex gap-1">
          <input
            value={projectPath}
            onChange={(event) => setProjectPath(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && projectPath.trim()) void openProject(projectPath.trim());
            }}
            placeholder="C:\\kod\\mitt-projekt"
            data-testid="open-project-path"
            className="flex-1 rounded border border-steel bg-anvil px-2 py-1 font-mono text-[11px] text-slate-200 placeholder:text-slate-600"
          />
          <Button
            onClick={() => projectPath.trim() && void openProject(projectPath.trim())}
            title="Öppna mappen"
            testId="open-project"
          >
            Öppna
          </Button>
        </div>
        {projects.length > 0 ? (
          <ul className="mt-1.5 space-y-0.5">
            {projects.slice(0, 6).map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => void openProject(entry.path, entry.name)}
                  className={`w-full cursor-pointer truncate rounded px-1.5 py-1 text-left text-[11px] ${
                    entry.id === project?.id
                      ? 'bg-steel/40 text-slate-200'
                      : 'text-slate-500 hover:bg-steel/20'
                  }`}
                >
                  {entry.name} · {timeAgo(entry.lastOpenedAt)}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="vf-panel flex min-h-0 flex-1 flex-col p-2">
        <h2 className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
          Sessioner
        </h2>
        <div className="mt-1 min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          {sessions.length === 0 ? (
            <p className="p-1 text-[11px] text-slate-600">Inga sessioner än.</p>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={`group flex items-center gap-1 rounded px-1.5 py-1 ${
                  session.id === sessionId ? 'bg-steel/40' : 'hover:bg-steel/20'
                }`}
              >
                <button
                  type="button"
                  onClick={() => void selectSession(session.id)}
                  className="min-w-0 flex-1 cursor-pointer text-left"
                  title={session.title}
                >
                  <span className="block truncate text-[11.5px] text-slate-300">
                    {session.title}
                  </span>
                  <span className="block text-[10px] text-slate-600">
                    {session.messageCount} meddelanden · {timeAgo(session.updatedAt)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void deleteSession(session.id)}
                  className="cursor-pointer px-1 text-[10px] text-slate-600 opacity-0 group-hover:opacity-100 hover:text-alert"
                  title="Ta bort sessionen"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="vf-panel max-h-48 shrink-0 overflow-y-auto p-2">
        <h2 className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
          Uppgifter
        </h2>
        {tasks.length === 0 ? (
          <p className="mt-1 text-[11px] text-slate-600">Agentens plan dyker upp här.</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-start gap-1.5 text-[11px]">
                <span
                  className={
                    task.status === 'done'
                      ? 'text-mint'
                      : task.status === 'doing'
                        ? 'text-ember'
                        : task.status === 'blocked'
                          ? 'text-alert'
                          : 'text-slate-600'
                  }
                >
                  {task.status === 'done'
                    ? '☑'
                    : task.status === 'doing'
                      ? '▸'
                      : task.status === 'blocked'
                        ? '⛔'
                        : '☐'}
                </span>
                <span
                  className={
                    task.status === 'done' ? 'text-slate-500 line-through' : 'text-slate-300'
                  }
                >
                  {task.title}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="vf-panel max-h-56 shrink-0 overflow-y-auto p-2">
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
            Subagents
          </h2>
          <span className="text-[10px] text-slate-600">
            {subagents.filter((entry) => entry.status === 'running').length} aktiva
          </span>
        </div>
        {subagents.length === 0 ? (
          <p className="mt-1 text-[11px] text-slate-600">
            Inga subagents har körts i den här sessionen.
          </p>
        ) : (
          <ul className="mt-1 space-y-1.5">
            {subagents.slice(0, 12).map((agent) => (
              <li key={agent.id} className="text-[11px]">
                <div className="flex items-center gap-1.5">
                  <Chip tone={SUBAGENT_TONE[agent.status] ?? 'neutral'}>{agent.kind}</Chip>
                  <span className="text-slate-400">{agent.status}</span>
                  <span className="ml-auto text-[10px] text-slate-600">
                    {agent.finishedAt
                      ? `${Math.max(1, Math.round((agent.finishedAt - agent.startedAt) / 1000))} s`
                      : '…'}
                  </span>
                </div>
                {agent.summary ? (
                  <p className="mt-0.5 line-clamp-3 text-[10.5px] text-slate-500">
                    {agent.summary}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export { EmptyState };
