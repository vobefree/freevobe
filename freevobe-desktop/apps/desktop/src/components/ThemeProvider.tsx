import { useEffect, type ReactNode } from 'react';
import { useAppStore } from '../store/appStore';
import { applyQoder, applyTheme, resolveTheme } from '../lib/theme';

/**
 * Håller dokumentets tema och Qoder-läge i takt med storen, och lyssnar på systemets
 * färgschemainställning så länge användaren valt "Följ systemet".
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const themeMode = useAppStore((state) => state.themeMode);
  const qoderMode = useAppStore((state) => state.qoderMode);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const sync = () => {
      const resolved = resolveTheme(themeMode, media?.matches ?? true);
      applyTheme(resolved);
      useAppStore.getState().setResolvedTheme(resolved);
    };

    sync();
    media?.addEventListener?.('change', sync);
    return () => media?.removeEventListener?.('change', sync);
  }, [themeMode]);

  useEffect(() => {
    applyQoder(qoderMode);
  }, [qoderMode]);

  return <>{children}</>;
}
