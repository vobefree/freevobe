import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store/appStore';
import { Button, Chip, EmptyState } from '../ui';

/**
 * Live-preview: projektets dev-server (eller de statiska filerna) i en iframe, alltid på
 * loopback. Panelen startar ingenting själv – servern gör det först när användaren trycker på
 * knappen, och stänger servern när sessionen stängs.
 */
export function PreviewPane() {
  const { t } = useTranslation();
  const project = useAppStore((state) => state.project);
  const preview = useAppStore((state) => state.preview);
  const busy = useAppStore((state) => state.previewBusy);
  const startPreview = useAppStore((state) => state.startPreview);
  const stopPreview = useAppStore((state) => state.stopPreview);
  const editorFile = useAppStore((state) => state.editorFile);

  if (!project) {
    return <EmptyState title={t('center.live.noProject')} hint={t('center.live.noProjectHint')} />;
  }

  const running = preview?.status === 'running' && preview.url !== null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b border-steel p-2">
        <Button variant="primary" disabled={busy || running} onClick={() => void startPreview()}>
          {busy ? t('center.live.starting') : t('center.live.start')}
        </Button>
        {running && preview ? (
          <>
            <Chip tone="mint">{t('center.live.running')}</Chip>
            <span className="min-w-0 truncate font-mono text-[10.5px] text-sky">{preview.url}</span>
            <Button
              onClick={() => {
                if (preview.url) window.open(preview.url, '_blank', 'noopener');
              }}
            >
              {t('center.live.open')}
            </Button>
            <Button variant="danger" onClick={() => void stopPreview()}>
              {t('center.live.stop')}
            </Button>
          </>
        ) : (
          <span className="text-[11px] text-slate-500">{t('center.live.hint')}</span>
        )}
      </header>

      <div className="min-h-0 flex-1 bg-anvil">
        {running && preview?.url ? (
          <iframe
            title={t('center.live.frameTitle')}
            src={preview.url}
            className="h-full w-full border-0 bg-white"
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
          />
        ) : editorFile ? (
          // Utan live-preview visas den valda filen, så fliken aldrig blir tom.
          <div data-testid="preview" className="h-full overflow-auto p-4">
            <p className="mb-2 font-mono text-[11px] text-slate-500">
              {editorFile.path} ({t('center.previewNote')})
            </p>
            <pre className="font-mono text-[12px] whitespace-pre-wrap text-slate-300">
              {editorFile.content}
            </pre>
          </div>
        ) : (
          <EmptyState title={t('center.noFile')} hint={t('center.noFileHint')} />
        )}
      </div>

      {preview && preview.logTail.length > 0 ? (
        <footer className="max-h-28 shrink-0 overflow-auto border-t border-steel bg-forge/60 p-2 font-mono text-[10px] text-slate-500">
          {preview.logTail.slice(-8).map((line, index) => (
            <div key={`${index}-${line}`}>{line}</div>
          ))}
        </footer>
      ) : null}
    </div>
  );
}
