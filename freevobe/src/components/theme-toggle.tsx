'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'freevobe-theme';

/**
 * Mörkt läge är standard. Valet sparas i localStorage och läggs som klass på <html>, vilket är
 * samma klass som CSS-tokenöversättningen i globals.css lyssnar på.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    setTheme(document.documentElement.classList.contains('light') ? 'light' : 'dark');
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.classList.toggle('light', next === 'light');
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Privat läge utan localStorage – temat gäller ändå för den här sidvisningen.
    }
  }

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={cn(
        'flex size-9 cursor-pointer items-center justify-center rounded-lg border border-line bg-card text-muted transition-colors hover:border-accent/50 hover:text-fg',
        className,
      )}
    >
      {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </button>
  );
}

/** Sätter rätt tema innan första målningen, så att sidan aldrig blinkar vitt. */
export const themeBootstrapScript = `
(function () {
  try {
    var stored = localStorage.getItem('${STORAGE_KEY}');
    if (stored === 'light') document.documentElement.classList.add('light');
  } catch (error) {}
})();
`;
