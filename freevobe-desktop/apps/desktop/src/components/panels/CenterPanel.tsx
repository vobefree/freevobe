import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore, type CenterTab } from '../../store/appStore';
import { Button, EmptyState, Tabs } from '../ui';
import { EditorPane } from './EditorPane';
import { formatBytes, formatNumber, shortPath } from '../../lib/format';

function FileTree() {
  const { t } = useTranslation();
  const tree = useAppStore((state) => state.tree);
  const editorFile = useAppStore((state) => state.editorFile);
  const pinnedFiles = useAppStore((state) => state.pinnedFiles);
  const filesInContext = useAppStore((state) => state.filesInContext);
  const openFile = useAppStore((state) => state.openFile);
  const togglePin = useAppStore((state) => state.togglePin);
  const [filter, setFilter] = useState('');

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const list = needle ? tree.filter((entry) => entry.path.toLowerCase().includes(needle)) : tree;
    return list.slice(0, 400);
  }, [tree, filter]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-steel p-1.5">
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder={t('center.filter')}
          className="w-full rounded border border-steel bg-anvil px-2 py-1 font-mono text-[11px] text-slate-200 placeholder:text-slate-600"
        />
        <p className="mt-1 text-[10px] text-slate-600">
          {t('center.indexed', {
            files: formatNumber(tree.length),
            context: formatNumber(filesInContext.length),
          })}
        </p>
      </div>

      {pinnedFiles.length > 0 ? (
        <div className="border-b border-steel p-1.5">
          <p className="mb-1 text-[10px] tracking-wide text-slate-500 uppercase">
            {t('center.pinned')}
          </p>
          <div className="flex flex-wrap gap-1">
            {pinnedFiles.map((path) => (
              <span key={path} className="vf-chip">
                <button
                  type="button"
                  className="cursor-pointer"
                  onClick={() => void openFile(path)}
                >
                  {shortPath(path, 28)}
                </button>
                <button
                  type="button"
                  className="cursor-pointer text-slate-500"
                  onClick={() => togglePin(path)}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <p className="p-3 text-[11px] text-slate-600">{t('center.noMatch')}</p>
        ) : (
          visible.map((entry) => {
            const active = editorFile?.path === entry.path;
            const inContext = filesInContext.includes(entry.path);
            return (
              <div
                key={entry.path}
                className={`group flex items-center gap-1 px-1.5 py-0.5 text-[11px] ${
                  active ? 'bg-steel/40' : 'hover:bg-steel/20'
                }`}
                title={`${entry.path}\n${t('center.lines', { count: entry.lines })} · ${formatBytes(entry.size)} · ${entry.symbols.slice(0, 8).join(', ')}`}
              >
                <button
                  type="button"
                  onClick={() => void openFile(entry.path)}
                  className="min-w-0 flex-1 cursor-pointer truncate text-left font-mono text-slate-300"
                >
                  {entry.path}
                </button>
                {inContext ? (
                  <span className="text-[9px] text-ember">{t('center.inContext')}</span>
                ) : null}
                <button
                  type="button"
                  onClick={() => togglePin(entry.path)}
                  className={`cursor-pointer px-1 text-[10px] ${
                    pinnedFiles.includes(entry.path)
                      ? 'text-spark'
                      : 'text-slate-600 opacity-0 group-hover:opacity-100'
                  }`}
                  title={t('center.pinTitle')}
                >
                  ★
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function SearchView() {
  const { t } = useTranslation();
  const searchQuery = useAppStore((state) => state.searchQuery);
  const searchResults = useAppStore((state) => state.searchResults);
  const runSearch = useAppStore((state) => state.runSearch);
  const openFile = useAppStore((state) => state.openFile);
  const [query, setQuery] = useState(searchQuery);

  return (
    <div className="flex h-full min-h-0 flex-col p-2">
      <div className="flex gap-1.5">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void runSearch(query);
          }}
          placeholder={t('center.searchPlaceholder')}
          className="flex-1 rounded border border-steel bg-anvil px-2 py-1 text-xs text-slate-200 placeholder:text-slate-600"
        />
        <Button variant="primary" onClick={() => void runSearch(query)}>
          {t('center.search')}
        </Button>
      </div>
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
        {searchResults.length === 0 ? (
          <EmptyState title={t('center.noHits')} hint={t('center.noHitsHint')} />
        ) : (
          <ul className="space-y-0.5">
            {searchResults.map((result) => {
              const path = result.split(' (')[0] ?? result;
              return (
                <li key={result}>
                  <button
                    type="button"
                    onClick={() => void openFile(path)}
                    className="w-full cursor-pointer rounded px-2 py-1 text-left font-mono text-[11px] text-slate-300 hover:bg-steel/30"
                  >
                    {result}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function ContextView() {
  const { t } = useTranslation();
  const contextFiles = useAppStore((state) => state.contextFiles);
  const contextChars = useAppStore((state) => state.contextChars);
  const settings = useAppStore((state) => state.settings);
  const budget = settings?.contextBudgetChars ?? 24_000;

  return (
    <div className="flex h-full min-h-0 flex-col p-2">
      <div className="vf-panel p-2">
        <p className="text-[11px] text-slate-400">
          {t('center.contextSummary', {
            files: formatNumber(contextFiles.length),
            chars: formatNumber(contextChars),
            budget: formatNumber(budget),
          })}
        </p>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded bg-steel">
          <div
            className="h-full bg-ember"
            style={{
              width: `${Math.min(100, Math.round((contextChars / Math.max(1, budget)) * 100))}%`,
            }}
          />
        </div>
        <p className="mt-1 text-[10px] text-slate-600">{t('center.contextHint')}</p>
      </div>
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
        {contextFiles.length === 0 ? (
          <EmptyState title={t('center.contextEmpty')} hint={t('center.contextEmptyHint')} />
        ) : (
          <ul className="space-y-0.5">
            {contextFiles.map((file) => (
              <li
                key={file.path}
                className="flex items-center gap-2 rounded px-2 py-1 text-[11px] hover:bg-steel/20"
              >
                <span className="truncate font-mono text-slate-300" title={file.path}>
                  {file.path}
                </span>
                <span className="ml-auto shrink-0 text-[10px] text-slate-600">
                  {file.reason} · {t('center.chars', { count: file.chars })}
                  {file.truncated ? ` · ${t('center.truncated')}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function CenterPanel() {
  const { t } = useTranslation();
  const centerTab = useAppStore((state) => state.centerTab);
  const setCenterTab = useAppStore((state) => state.setCenterTab);
  const editorFile = useAppStore((state) => state.editorFile);
  const treeOpen = useAppStore((state) => state.treeOpen);
  const toggleTree = useAppStore((state) => state.toggleTree);

  return (
    <div className="flex h-full min-h-0">
      {treeOpen ? (
        <aside className="w-64 shrink-0 border-r border-steel">
          <FileTree />
        </aside>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-steel px-2">
          <Tabs<CenterTab>
            tabs={[
              { id: 'editor', label: t('center.tabEditor') },
              { id: 'preview', label: t('center.tabPreview') },
              { id: 'search', label: t('center.tabSearch') },
              { id: 'context', label: t('center.tabContext') },
            ]}
            active={centerTab}
            onChange={setCenterTab}
          />
          <Button className="ml-auto mb-1" onClick={toggleTree} title={t('center.treeToggle')}>
            {treeOpen ? '◧' : '▣'}
          </Button>
        </header>

        <div className="min-h-0 flex-1">
          {centerTab === 'search' ? (
            <SearchView />
          ) : centerTab === 'context' ? (
            <ContextView />
          ) : null}
          {centerTab === 'preview' ? (
            editorFile ? (
              <div data-testid="preview" className="h-full overflow-auto bg-anvil p-4">
                <p className="mb-2 font-mono text-[11px] text-slate-500">
                  {editorFile.path} ({t('center.previewNote')})
                </p>
                <pre className="font-mono text-[12px] whitespace-pre-wrap text-slate-300">
                  {editorFile.content}
                </pre>
              </div>
            ) : (
              <EmptyState title={t('center.noFile')} hint={t('center.noFileHint')} />
            )
          ) : null}
          {centerTab === 'editor' ? <EditorPane /> : null}
        </div>
      </div>
    </div>
  );
}
