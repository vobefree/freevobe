import type { HookConfig } from '@vibeforge/protocol';

/**
 * Färdiga hook-mallar som användaren kan aktivera per projekt. Alla är avstängda som standard
 * så att VibeForge aldrig kör kommandon användaren inte bett om.
 */
export function defaultHookTemplates(): HookConfig[] {
  return [
    {
      name: 'lint-efter-ändring',
      event: 'after_file_edit',
      command: 'npx --no-install eslint --fix {{path}}',
      filePattern: '**/*.{ts,tsx,js,jsx}',
      blockOnFailure: false,
      enabled: false,
      timeoutMs: 60_000,
    },
    {
      name: 'formatera-efter-ändring',
      event: 'after_file_edit',
      command: 'npx --no-install prettier --write {{path}}',
      filePattern: '**/*.{ts,tsx,js,jsx,json,md,css}',
      blockOnFailure: false,
      enabled: false,
      timeoutMs: 60_000,
    },
    {
      name: 'tester-före-commit',
      event: 'before_commit',
      command: 'npm test --silent',
      blockOnFailure: true,
      enabled: false,
      timeoutMs: 300_000,
    },
    {
      name: 'blockera-ledtråd',
      event: 'before_file_edit',
      command: 'node -e "process.exit(/console\\.log\\(\\x27debug/.test(0)?0:0)"',
      blockOnFailure: true,
      enabled: false,
      timeoutMs: 10_000,
    },
    {
      name: 'skriv-sessionslogg',
      event: 'on_session_start',
      command: 'node -e "console.log(\'session start\')"',
      blockOnFailure: false,
      enabled: false,
      timeoutMs: 10_000,
    },
  ];
}

export const HOOK_DESCRIPTIONS: Record<string, string> = {
  on_session_start: 'När en session startas.',
  before_file_edit: 'Före varje filändring. Kan blockera ändringen.',
  after_file_edit: 'Efter varje filändring (t.ex. lint eller formatering).',
  before_terminal_command: 'Före varje terminalkommando. Kan blockera kommandot.',
  after_terminal_command: 'Efter varje terminalkommando.',
  before_test_run: 'Före en testkörning.',
  after_test_run: 'Efter en testkörning.',
  before_commit: 'Före commit. Kan blockera commiten.',
  after_commit: 'Efter commit.',
};
