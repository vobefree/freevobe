import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from './store/appStore';
import { AppShell } from './components/AppShell';
import { Onboarding } from './components/Onboarding';
import { CommandPalette } from './components/CommandPalette';
import { SettingsDialog } from './components/SettingsDialog';
import { SkillsDialog } from './components/SkillsDialog';
import { McpDialog } from './components/McpDialog';
import { DoctorDialog } from './components/DoctorDialog';
import { MemoryDialog } from './components/MemoryDialog';
import { Button } from './components/ui';
import { LanguageSelect } from './components/LanguageSelect';
import { useShortcuts, type ShortcutHandlers } from './hooks/useShortcuts';

export function App() {
  const { t } = useTranslation();
  const connectionStatus = useAppStore((state) => state.connectionStatus);
  const connectionError = useAppStore((state) => state.connectionError);
  const onboardingComplete = useAppStore((state) => state.onboardingComplete);
  const doctorOpen = useAppStore((state) => state.doctorOpen);
  const settingsOpen = useAppStore((state) => state.settingsOpen);

  useEffect(() => {
    void useAppStore.getState().bootstrap();
  }, []);

  // Doctor-läget kan begäras från flera ställen; kör kontrollen när anslutningen är redo.
  useEffect(() => {
    if (doctorOpen && connectionStatus === 'ready') void useAppStore.getState().runDoctor();
  }, [doctorOpen, connectionStatus]);

  const save = useCallback(() => {
    void useAppStore.getState().saveEditorFile();
  }, []);
  const newChat = useCallback(() => {
    void useAppStore.getState().newSession();
  }, []);
  const runTests = useCallback(() => {
    void useAppStore.getState().runTests();
  }, []);
  const abort = useCallback(() => {
    void useAppStore.getState().abort();
  }, []);
  const command = useCallback(() => {
    useAppStore.getState().setPalette(true);
  }, []);

  useShortcuts({
    onSave: save,
    onNewChat: newChat,
    onRunTests: runTests,
    onAbort: abort,
    onCommand: command,
  } as ShortcutHandlers);

  if (connectionStatus === 'idle' || connectionStatus === 'connecting') {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <span className="h-2 w-2 animate-pulse rounded-full bg-ember" />
          {t('app.connecting')}
        </div>
      </div>
    );
  }

  if (connectionStatus === 'error') {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="vf-panel max-w-lg space-y-3 p-6">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-lg font-semibold">{t('app.errorTitle')}</h1>
            <LanguageSelect />
          </div>
          <p className="text-sm text-slate-400">{connectionError}</p>
          <ol className="list-inside list-decimal space-y-1 text-xs text-slate-500">
            <li>
              {t('app.startAgent')} <code className="text-slate-300">npm run dev:server</code>
            </li>
            <li>{t('app.portFree')}</li>
            <li>{t('app.seeDocs')}</li>
          </ol>
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => void useAppStore.getState().connect()}>
              {t('app.retry')}
            </Button>
            <a
              className="vf-button"
              href="https://freevobe.dev/docs/agent"
              target="_blank"
              rel="noreferrer"
            >
              {t('app.help')}
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!onboardingComplete) {
    return (
      <>
        <Onboarding />
        <CommandPalette />
      </>
    );
  }

  return (
    <>
      <AppShell />
      <CommandPalette />
      {settingsOpen ? <SettingsDialog /> : null}
      <SkillsDialog />
      <McpDialog />
      <MemoryDialog />
      {doctorOpen ? <DoctorDialog /> : null}
    </>
  );
}
