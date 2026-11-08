import { readStorage, writeStorage } from './storage';

/**
 * Tema och Qoder-läge. Valen sparas lokalt och följer systemet tills användaren väljer något
 * annat. All DOM-koppling ligger här, så komponenterna bara läser och sätter state.
 */

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_MODES: ThemeMode[] = ['light', 'dark', 'system'];

export const THEME_LABEL_KEY = {
  light: 'theme.light',
  dark: 'theme.dark',
  system: 'theme.system',
} as const;

export const THEME_STORAGE_KEY = 'freevobe.theme';
export const QODER_STORAGE_KEY = 'freevobe.qoder';

export function readThemeMode(): ThemeMode {
  const stored = readStorage(THEME_STORAGE_KEY);
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
}

export function saveThemeMode(mode: ThemeMode): void {
  writeStorage(THEME_STORAGE_KEY, mode);
}

export function readQoderMode(): boolean {
  return readStorage(QODER_STORAGE_KEY) === 'true';
}

export function saveQoderMode(enabled: boolean): void {
  writeStorage(QODER_STORAGE_KEY, String(enabled));
}

export function resolveTheme(mode: ThemeMode, systemDark: boolean): ResolvedTheme {
  if (mode === 'system') return systemDark ? 'dark' : 'light';
  return mode;
}

/** Sant när operativsystemet föredrar mörkt. Utan matchMedia (tester, äldre miljö) blir svaret ja. */
export function systemPrefersDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return true;
  }
}

export function applyTheme(theme: ResolvedTheme): void {
  try {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  } catch {
    // Utan DOM (tester i node) finns inget att måla.
  }
}

export function applyQoder(enabled: boolean): void {
  try {
    document.documentElement.dataset.qoder = enabled ? 'true' : 'false';
  } catch {
    // Se applyTheme.
  }
}

/** Nästa tema i knappens cykel: ljust → mörkt → system → ljust. */
export function nextThemeMode(mode: ThemeMode): ThemeMode {
  return mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light';
}

/** Hur stor del av höjden chatten får. Håller splittringen användbar. */
export function clampShare(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(0.8, Math.max(0.2, value));
}

/** Kodeditorns teman. Samma namn definieras i lib/monaco.ts. */
export const MONACO_DARK_THEME = 'freevobe-dark';
export const MONACO_LIGHT_THEME = 'freevobe-light';

/** Editorn följer det valda temat, även när det kommer från systemet. */
export function monacoThemeFor(theme: ResolvedTheme): string {
  return theme === 'light' ? MONACO_LIGHT_THEME : MONACO_DARK_THEME;
}
