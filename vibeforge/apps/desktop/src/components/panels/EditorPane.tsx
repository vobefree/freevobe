import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { Button, EmptyState } from '../ui';
import { shortPath } from '../../lib/format';

/** True i jsdom (tester) – då används en enkel textruta i stället för Monaco. */
function prefersPlainTextarea(): boolean {
  return typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent);
}

type MonacoEditorComponent = (props: {
  height: string;
  defaultLanguage: string;
  language: string;
  value: string;
  onChange: (value: string | undefined) => void;
  options: Record<string, unknown>;
  theme: string;
}) => JSX.Element;

export function EditorPane() {
  const editorFile = useAppStore((state) => state.editorFile);
  const updateEditorContent = useAppStore((state) => state.updateEditorContent);
  const saveEditorFile = useAppStore((state) => state.saveEditorFile);
  const [MonacoEditor, setMonacoEditor] = useState<MonacoEditorComponent | null>(null);
  const [theme, setTheme] = useState('vs-dark');
  const [language, setLanguage] = useState('plaintext');

  useEffect(() => {
    if (prefersPlainTextarea()) return;
    let cancelled = false;
    void (async () => {
      try {
        const [{ default: Editor }, { setupMonaco, MONACO_THEME, languageForPath }] =
          await Promise.all([import('@monaco-editor/react'), import('../../lib/monaco')]);
        setupMonaco();
        if (!cancelled) {
          setMonacoEditor(() => Editor as unknown as MonacoEditorComponent);
          setTheme(MONACO_THEME);
          setLanguage(languageForPath(editorFile?.path ?? 'untitled.txt'));
        }
      } catch {
        // Monaco kunde inte laddas (t.ex. i en mycket begränsad miljö) – textrutan fungerar ändå.
        if (!cancelled) setMonacoEditor(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editorFile?.path]);

  useEffect(() => {
    let cancelled = false;
    void import('../../lib/monaco')
      .then(({ languageForPath }) => {
        if (!cancelled) setLanguage(languageForPath(editorFile?.path ?? 'untitled.txt'));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [editorFile?.path]);

  if (!editorFile) {
    return (
      <EmptyState
        title="Ingen fil öppen"
        hint="Välj en fil i filträdet till vänster. Agentens ändringar dyker alltid upp här som diff först."
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b border-steel px-3 py-1.5">
        <span className="truncate font-mono text-xs text-slate-300" title={editorFile.path}>
          {shortPath(editorFile.path, 60)}
        </span>
        {editorFile.dirty ? <span className="text-[10px] text-spark">• osparad</span> : null}
        <span className="ml-auto text-[10px] text-slate-600">{language}</span>
        <Button
          variant="primary"
          onClick={() => void saveEditorFile()}
          disabled={!editorFile.dirty}
          title="Spara filen (Ctrl/Cmd+S)"
        >
          Spara
        </Button>
      </header>
      <div className="min-h-0 flex-1">
        {MonacoEditor ? (
          <MonacoEditor
            height="100%"
            language={language}
            defaultLanguage={language}
            value={editorFile.content}
            theme={theme}
            onChange={(value) => updateEditorContent(value ?? '')}
            options={{
              fontSize: 13,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              renderWhitespace: 'selection',
            }}
          />
        ) : (
          <textarea
            data-testid="editor-fallback"
            value={editorFile.content}
            onChange={(event) => updateEditorContent(event.target.value)}
            spellCheck={false}
            className="h-full w-full resize-none bg-anvil p-3 font-mono text-[12.5px] leading-5 text-slate-200 outline-none"
          />
        )}
      </div>
    </div>
  );
}
