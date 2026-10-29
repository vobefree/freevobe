import { useAppStore } from '../store/appStore';
import { Button, Chip } from './ui';
import { LeftPanel } from './panels/LeftPanel';
import { CenterPanel } from './panels/CenterPanel';
import { RightPanel } from './panels/RightPanel';
import { ChatView } from './chat/ChatView';
import { givesBackHint } from './gives-back/GivesBackCard';
import { PERMISSION_LABELS, PHASE_LABELS, shortPath } from '../lib/format';
import type { AgentPhase } from '@freevobe/protocol';

function Logo() {
  return (
    <span className="flex items-center gap-1.5">
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 3h7l3 6-3 6H4l3-6z" fill="var(--color-ember)" />
        <path d="M13 21h7l-3-6h-7z" fill="var(--color-spark)" opacity="0.9" />
      </svg>
      <span className="text-sm font-semibold tracking-tight text-slate-100">
        Free<span className="text-ember">vobe</span>
      </span>
    </span>
  );
}

function TopBar() {
  const project = useAppStore((state) => state.project);
  const models = useAppStore((state) => state.models);
  const selectedModel = useAppStore((state) => state.selectedModel);
  const selectModel = useAppStore((state) => state.selectModel);
  const permissionMode = useAppStore((state) => state.permissionMode);
  const mode = useAppStore((state) => state.mode);
  const plans = useAppStore((state) => state.plans);
  const isRunning = useAppStore((state) => state.isRunning);
  const abort = useAppStore((state) => state.abort);
  const connectionStatus = useAppStore((state) => state.connectionStatus);
  const gitStatus = useAppStore((state) => state.gitStatus);
  const ollama = useAppStore((state) => state.ollama);
  const setDoctorOpen = useAppStore((state) => state.setDoctorOpen);
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen);
  const setSkillsOpen = useAppStore((state) => state.setSkillsOpen);
  const setMcpOpen = useAppStore((state) => state.setMcpOpen);
  const setMemoryOpen = useAppStore((state) => state.setMemoryOpen);
  const setPalette = useAppStore((state) => state.setPalette);
  const runDoctor = useAppStore((state) => state.runDoctor);

  const activeModel = models.find((model) => model.name === selectedModel);
  const currentPlan = plans.find(
    (plan) => plan.status === 'proposed' || plan.status === 'approved',
  );

  return (
    <header className="flex items-center gap-2 border-b border-steel bg-forge px-3 py-1.5">
      <Logo />

      <span className="mx-1 h-4 w-px bg-steel" />

      <span
        className="max-w-56 truncate font-mono text-[11px] text-slate-400"
        title={project?.path ?? ''}
      >
        {project ? shortPath(project.path, 40) : 'inget projekt'}
      </span>

      <select
        value={selectedModel}
        onChange={(event) => selectModel(event.target.value)}
        className="max-w-56 rounded border border-steel bg-anvil px-2 py-1 font-mono text-[11px] text-slate-200"
        title="Aktiv modell (sparas per projekt)"
      >
        {models.length === 0 ? (
          <option value={selectedModel}>{selectedModel || 'ingen modell'}</option>
        ) : null}
        {models.map((model) => (
          <option key={model.name} value={model.name}>
            {model.name} · {model.parameterSize}
            {model.supportsTools ? '' : ' (utan tool calling)'}
          </option>
        ))}
      </select>

      {activeModel && !activeModel.supportsTools ? (
        <Chip tone="ember">utan tool calling</Chip>
      ) : null}

      <div className="ml-1 flex items-center gap-1">
        <Chip tone={mode === 'plan' ? 'sky' : 'mint'}>{mode === 'plan' ? 'Plan' : 'Execute'}</Chip>
        {currentPlan ? (
          <Chip tone={currentPlan.status === 'approved' ? 'mint' : 'ember'}>
            {currentPlan.status === 'approved' ? 'plan godkänd' : 'plan väntar'}
          </Chip>
        ) : null}
        <Chip
          tone={
            permissionMode === 'ask'
              ? 'neutral'
              : permissionMode === 'full-auto'
                ? 'alert'
                : 'ember'
          }
        >
          {PERMISSION_LABELS[permissionMode]}
        </Chip>
        {gitStatus ? (
          <Chip tone="neutral">
            {gitStatus.branch}
            {gitStatus.files.length > 0 ? ` · ${gitStatus.files.length}` : ''}
          </Chip>
        ) : null}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {isRunning ? (
          <Button variant="danger" onClick={() => void abort()}>
            Avbryt
          </Button>
        ) : null}
        <Button onClick={() => setPalette(true)} title="Kommandopalett (Ctrl/Cmd+K)">
          ⌘K
        </Button>
        <Button onClick={() => setSkillsOpen(true)} title="Skills">
          Skills
        </Button>
        <Button onClick={() => setMcpOpen(true)} title="MCP-servrar">
          MCP
        </Button>
        <Button onClick={() => setMemoryOpen(true)} title="Projektminne">
          Minne
        </Button>
        <Button
          onClick={() => {
            setDoctorOpen(true);
            void runDoctor();
          }}
          title="Doctor – kontrollera Node, Git, Ollama, modell och behörigheter"
        >
          Doctor
        </Button>
        <Button onClick={() => setSettingsOpen(true)} title="Inställningar">
          ⚙
        </Button>
        <span
          className={`h-2 w-2 rounded-full ${
            connectionStatus === 'ready'
              ? 'bg-mint'
              : connectionStatus === 'error'
                ? 'bg-alert'
                : 'bg-spark'
          }`}
          title={
            connectionStatus === 'ready'
              ? `Agent-anslutning redo${ollama?.available ? ' · Ollama svarar' : ' · Ollama svarar inte'}`
              : connectionStatus
          }
        />
      </div>
    </header>
  );
}

function StatusBar() {
  const phase = useAppStore((state) => state.phase);
  const contextChars = useAppStore((state) => state.contextChars);
  const filesInContext = useAppStore((state) => state.filesInContext);
  const subagents = useAppStore((state) => state.subagents);
  const givesBack = useAppStore((state) => state.settings?.givesBack ?? null);
  const contributionsSummary = useAppStore((state) => state.contributionsSummary);
  const connection = useAppStore((state) => state.connection);
  const verification = useAppStore((state) => state.verification);
  const verificationRunning = useAppStore((state) => state.verificationRunning);

  return (
    <footer className="flex items-center gap-3 border-t border-steel bg-forge px-3 py-1 text-[10.5px] text-slate-500">
      <span>{PHASE_LABELS[phase as AgentPhase] ?? phase}</span>
      <span>
        kontext: {filesInContext.length} filer / {contextChars.toLocaleString('sv-SE')} tecken
      </span>
      <span>{subagents.filter((entry) => entry.status === 'running').length} subagents aktiva</span>
      {verificationRunning ? (
        <span className="text-spark">verifierar…</span>
      ) : verification ? (
        <span
          className={
            verification.status === 'passed'
              ? 'text-mint'
              : verification.status === 'failed'
                ? 'text-alert'
                : 'text-slate-500'
          }
          title={verification.summary}
        >
          verifiering: {verification.summary}
        </span>
      ) : null}
      <button
        type="button"
        className="cursor-pointer hover:text-slate-300"
        title="Öppna Gives Back"
        onClick={() => useAppStore.getState().setRightTab('gives')}
      >
        {givesBackHint(givesBack?.enabled ?? false, contributionsSummary)}
      </button>
      <span className="ml-auto font-mono">
        {connection ? `${connection.baseUrl}` : 'ingen anslutning'}
      </span>
    </footer>
  );
}

export function AppShell() {
  const leftOpen = useAppStore((state) => state.leftOpen);
  const rightOpen = useAppStore((state) => state.rightOpen);
  const connectionStatus = useAppStore((state) => state.connectionStatus);
  const connectionError = useAppStore((state) => state.connectionError);
  const agentHelpUrl = useAppStore((state) => state.agentHelpUrl);
  const connect = useAppStore((state) => state.connect);

  return (
    <div className="flex h-full flex-col bg-anvil text-slate-200">
      <TopBar />

      {connectionStatus === 'error' ? (
        <div className="flex items-center gap-2 border-b border-alert/40 bg-alert/10 px-3 py-1.5 text-xs text-alert">
          <span>{connectionError ?? 'Kunde inte nå agent-backenden.'}</span>
          <Button onClick={() => void connect()}>Försök igen</Button>
          {agentHelpUrl ? (
            <a className="underline" href={agentHelpUrl} target="_blank" rel="noreferrer noopener">
              Öppna hjälp
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {leftOpen ? (
          <aside className="w-72 shrink-0 overflow-y-auto border-r border-steel">
            <LeftPanel />
          </aside>
        ) : null}

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 border-b border-steel">
            <CenterPanel />
          </div>
          <div className="min-h-0 flex-[1.1]">
            <ChatView />
          </div>
        </main>

        {rightOpen ? (
          <aside className="w-[26rem] shrink-0 border-l border-steel">
            <RightPanel />
          </aside>
        ) : null}
      </div>

      <StatusBar />
    </div>
  );
}
