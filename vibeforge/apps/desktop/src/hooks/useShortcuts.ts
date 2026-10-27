import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';

export interface ShortcutHandlers {
  onSubmit?: () => void;
  onCommand?: () => void;
  onToggleLeft?: () => void;
  onToggleRight?: () => void;
  onAbort?: () => void;
  onSave?: () => void;
  onNewChat?: () => void;
  onRunTests?: () => void;
}

/** True när kommandotangenten (macOS) eller Ctrl (Windows/Linux) hålls nere. */
export function isCommandKey(event: { metaKey: boolean; ctrlKey: boolean }): boolean {
  return event.metaKey || event.ctrlKey;
}

/**
 * Genvägar enligt specen:
 *   Cmd/Ctrl+Enter  skicka prompt
 *   Cmd/Ctrl+K      kommandopalett
 *   Cmd/Ctrl+B      växla sidopanel
 *   Cmd/Ctrl+J      växla högerpanel
 *   Cmd/Ctrl+S      spara fil
 *   Cmd/Ctrl+Shift+K avbryt körningen (K är upptaget av paletten)
 */
export function useShortcuts(handlers: ShortcutHandlers): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const store = useAppStore.getState();
      const target = event.target as HTMLElement | null;
      const inField =
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLInputElement ||
        target?.isContentEditable === true;

      // I textfält hanterar fältet själv Cmd/Ctrl+Enter, så vi undviker dubbel skickning.
      if (isCommandKey(event) && event.key === 'Enter') {
        if (inField) return;
        event.preventDefault();
        handlers.onSubmit?.();
        return;
      }
      if (isCommandKey(event) && event.shiftKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        handlers.onAbort?.();
        return;
      }
      if (isCommandKey(event) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        handlers.onCommand?.();
        return;
      }
      if (isCommandKey(event) && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        (handlers.onToggleLeft ?? store.toggleLeft)();
        return;
      }
      if (isCommandKey(event) && event.key.toLowerCase() === 'j') {
        event.preventDefault();
        (handlers.onToggleRight ?? store.toggleRight)();
        return;
      }
      if (isCommandKey(event) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        handlers.onSave?.();
        return;
      }
      if (isCommandKey(event) && event.shiftKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        handlers.onNewChat?.();
        return;
      }
      if (isCommandKey(event) && event.shiftKey && event.key.toLowerCase() === 't') {
        event.preventDefault();
        handlers.onRunTests?.();
        return;
      }
      if (event.key === 'Escape') {
        if (useAppStore.getState().paletteOpen) useAppStore.getState().setPalette(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlers]);
}
