import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/appStore';
import { Button, Chip } from './ui';
import { LanguageSelect } from './LanguageSelect';
import { LeftPanel } from './panels/LeftPanel';
import { CenterPanel } from './panels/CenterPanel';
import { RightPanel } from './panels/RightPanel';
import { ChatView } from './chat/ChatView';
import { PERMISSION_LABELS, PHASE_LABELS, formatNumber, shortPath } from '../lib/format';
import { formatSek, type AgentPhase } from '@freevobe/protocol';

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
  const { t } = useTranslation();
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
        {project ? shortPath(project.path, 40) : t('topbar.noProject')}
      </span>

      <select
        value={selectedModel}
        onChange={(event) => selectModel(event.target.value)}
        className="max-w-56 rounded border border-steel bg-anvil px-2 py-1 font-mono text-[11px] text-slate-200"
        title={t('topbar.modelTitle')}
      >
        {models.length === 0 ? (
          <option value={selectedModel}>{selectedModel || t('topbar.noModel')}</option>
        ) : null}
        {models.map((model) => (
          <option key={model.name} value={model.name}>
            {model.name} · {model.parameterSize}
            {model.supportsTools ? '' : t('topbar.noToolsSuffix')}
          </option>
        ))}
      </select>

      {activeModel && !activeModel.supportsTools ? (
        <Chip tone="ember">{t('topbar.noTools')}</Chip>
      ) : null}

      <div className="ml-1 flex items-center gap-1">
        <Chip tone={mode === 'plan' ? 'sky' : 'mint'}>
          {mode === 'plan' ? t('topbar.modePlan') : t('topbar.modeExecute')}
        </Chip>
        {currentPlan ? (
          <Chip tone={currentPlan.status === 'approved' ? 'mint' : 'ember'}>
            {currentPlan.status === 'approved' ? t('topbar.planApproved') : t('topbar.planWaiting')}
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
            {t('topbar.abort')}
          </Button>
        ) : null}
        <LanguageSelect />
        <Button onClick={() => setPalette(true)} title={t('topbar.palette')}>
          ⌘K
        </Button>
        <Button onClick={() => setSkillsOpen(true)} title={t('topbar.skills')}>
          Skills
        </Button>
        <Button onClick={() => setMcpOpen(true)} title={t('topbar.mcp')}>
          MCP
        </Button>
        <Button onClick={() => setMemoryOpen(true)} title={t('topbar.memory')}>
          {t('topbar.memory')}
        </Button>
        <Button
          onClick={() => {
            setDoctorOpen(true);
            void runDoctor();
          }}
          title={t('topbar.doctorTitle')}
        >
          Doctor
        </Button>
        <Button onClick={() => setSettingsOpen(true)} title={t('topbar.settings')}>
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
              ? `${t('topbar.connectionReady')} · ${
                  ollama?.available ? t('topbar.ollamaUp') : t('topbar.ollamaDown')
                }`
              : connectionStatus
          }
        />
      </div>
    </header>
  );
}

function StatusBar() {
  const { t } = useTranslation();
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
        {t('status.context', {
          files: formatNumber(filesInContext.length),
          chars: formatNumber(contextChars),
        })}
      </span>
      <span>
        {t('status.subagents', {
          count: subagents.filter((entry) => entry.status === 'running').length,
        })}
      </span>
      {verificationRunning ? (
        <span className="text-spark">{t('status.verifying')}</span>
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
          {t('status.verification', { summary: verification.summary })}
        </span>
      ) : null}
      <button
        type="button"
        className="cursor-pointer hover:text-slate-300"
        title={t('status.givesBackTitle')}
        onClick={() => useAppStore.getState().setRightTab('gives')}
      >
        {!givesBack?.enabled
          ? t('status.givesBackOff')
          : contributionsSummary.count === 0
            ? t('status.givesBackNone')
            : t('status.givesBackCount', {
                count: contributionsSummary.count,
                total: formatSek(contributionsSummary.totalSek),
              })}
      </button>
      <span className="ml-auto font-mono">
        {connection ? `${connection.baseUrl}` : t('status.noConnection')}
      </span>
    </footer>
  );
}

export function AppShell() {
  const { t } = useTranslation();
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
          <span>{connectionError ?? t('shell.connectionError')}</span>
          <Button onClick={() => void connect()}>{t('app.retry')}</Button>
          {agentHelpUrl ? (
            <a className="underline" href={agentHelpUrl} target="_blank" rel="noreferrer noopener">
              {t('app.help')}
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
