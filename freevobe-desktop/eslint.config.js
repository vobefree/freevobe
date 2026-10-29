// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

/** Globala namn som finns i Node och i webbläsaren. Används bara för rena JS-filer. */
const runtimeGlobals = {
  process: 'readonly',
  console: 'readonly',
  Buffer: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly',
  AbortController: 'readonly',
  AbortSignal: 'readonly',
  fetch: 'readonly',
  Response: 'readonly',
  Request: 'readonly',
  Headers: 'readonly',
  FormData: 'readonly',
  Blob: 'readonly',
  WebSocket: 'readonly',
  Event: 'readonly',
  EventTarget: 'readonly',
  MessageChannel: 'readonly',
  structuredClone: 'readonly',
  queueMicrotask: 'readonly',
  performance: 'readonly',
  crypto: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  setImmediate: 'readonly',
  global: 'readonly',
  self: 'readonly',
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  localStorage: 'readonly',
  HTMLElement: 'readonly',
  HTMLTextAreaElement: 'readonly',
  HTMLInputElement: 'readonly',
  Element: 'readonly',
  Node: 'readonly',
  MutationObserver: 'readonly',
  ResizeObserver: 'readonly',
  IntersectionObserver: 'readonly',
  requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  module: 'writable',
  require: 'readonly',
  exports: 'writable',
};

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/out/**',
      '**/.next/**',
      '**/node_modules/**',
      '**/src-tauri/target/**',
      '**/src-tauri/binaries/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/.freevobe/workspace/**',
      '**/*.d.ts',
      '**/public/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    // TypeScript kontrollerar redan okända namn, och `no-undef` ger falska larm i typer och JSX.
    rules: {
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      'no-console': 'off',
      eqeqeq: ['error', 'smart'],
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: { globals: runtimeGlobals },
    rules: {
      'no-console': 'off',
      eqeqeq: ['error', 'smart'],
    },
  },
  {
    files: ['apps/desktop/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'e2e/**/*.ts', '**/*.config.{ts,js,mjs}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  prettier,
);
