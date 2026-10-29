import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

/**
 * Monaco laddas från det lokala paketet – aldrig från CDN. `@monaco-editor/react` hämtar annars
 * editorn från jsDelivr, vilket både bryter offline-löftet och ger en annan version än den vi
 * byggt in. Vi pekar därför om dess loader till vår egen bundle innan editorn monteras.
 */
export const MONACO_THEME = 'freevobe-dark';

let configured = false;

export function setupMonaco(): typeof monaco {
  if (configured) return monaco;

  self.MonacoEnvironment = {
    getWorker(_workerId: string, label: string) {
      switch (label) {
        case 'json':
          return new jsonWorker();
        case 'css':
        case 'scss':
        case 'less':
          return new cssWorker();
        case 'html':
        case 'handlebars':
        case 'razor':
          return new htmlWorker();
        case 'typescript':
        case 'javascript':
          return new tsWorker();
        default:
          return new editorWorker();
      }
    },
  };

  monaco.editor.defineTheme(MONACO_THEME, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6b7484', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'ff9f5a' },
      { token: 'string', foreground: 'b7e08a' },
      { token: 'number', foreground: 'ffd166' },
      { token: 'type', foreground: '6ab7ff' },
    ],
    colors: {
      'editor.background': '#14161c',
      'editorGutter.background': '#14161c',
      'editorLineNumber.foreground': '#3a4150',
      'editorLineNumber.activeForeground': '#8a94a6',
      'editor.lineHighlightBackground': '#1b1f27',
      'editorCursor.foreground': '#ff7a3d',
      'editor.selectionBackground': '#3a415066',
    },
  });

  loader.config({ monaco });

  configured = true;
  return monaco;
}

export function languageForPath(path: string): string {
  const extension = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  switch (extension) {
    case 'ts':
      return 'typescript';
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'mjs':
    case 'cjs':
    case 'jsx':
      return 'javascript';
    case 'json':
      return 'json';
    case 'css':
      return 'css';
    case 'scss':
      return 'scss';
    case 'html':
    case 'htm':
      return 'html';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'py':
      return 'python';
    case 'rs':
      return 'rust';
    case 'go':
      return 'go';
    case 'sql':
      return 'sql';
    case 'sh':
    case 'bash':
      return 'shell';
    case 'yml':
    case 'yaml':
      return 'yaml';
    case 'toml':
      return 'ini';
    default:
      return 'plaintext';
  }
}
