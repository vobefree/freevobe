import type { ChatMessage } from '@freevobe/protocol';
import { readStorage, writeStorage } from './storage';

/**
 * Vylägen, samma idé som Claude Code: Verbose visar allt, Normal det viktigaste och Summary bara
 * samtalen. Reglerna ligger här så att chatten och testerna delar samma definition.
 */

export type ViewMode = 'verbose' | 'normal' | 'summary';

export const VIEW_MODES: ViewMode[] = ['verbose', 'normal', 'summary'];

export const VIEW_LABEL_KEY = {
  verbose: 'view.verbose',
  normal: 'view.normal',
  summary: 'view.summary',
} as const;

export const VIEW_MODE_STORAGE_KEY = 'freevobe.viewMode';

export function readViewMode(): ViewMode {
  const stored = readStorage(VIEW_MODE_STORAGE_KEY);
  return stored === 'verbose' || stored === 'normal' || stored === 'summary' ? stored : 'normal';
}

export function saveViewMode(mode: ViewMode): void {
  writeStorage(VIEW_MODE_STORAGE_KEY, mode);
}

export function visibleMessages(messages: ChatMessage[], mode: ViewMode): ChatMessage[] {
  return mode === 'summary' ? messages.filter((message) => message.role !== 'tool') : messages;
}

export function showsToolDetails(mode: ViewMode): boolean {
  return mode === 'verbose';
}

export function shouldShowReasoning(mode: ViewMode): boolean {
  return mode !== 'summary';
}
