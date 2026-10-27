'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DownloadButton } from '@/components/download/download-button';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { nav } from '@/lib/site';
import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
        <defs>
          <linearGradient id="fv-logo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="55%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#2dd4bf" />
          </linearGradient>
        </defs>
        <rect
          x="0.75"
          y="0.75"
          width="22.5"
          height="22.5"
          rx="7"
          fill="url(#fv-logo)"
          fillOpacity="0.14"
          stroke="url(#fv-logo)"
          strokeOpacity="0.45"
          strokeWidth="1.5"
        />
        {/* Ett "v" för vobe – rundade ändar, gradient som går mot teal. */}
        <path
          d="M7.2 7.4 12 16.4l4.8-9"
          fill="none"
          stroke="url(#fv-logo)"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-[17px] font-semibold tracking-tight">
        Free<span className="text-accent-soft">vobe</span>
      </span>
    </span>
  );
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b transition-colors duration-300',
        scrolled
          ? 'border-line bg-bg/80 backdrop-blur-xl'
          : 'border-transparent bg-transparent backdrop-blur-sm',
      )}
    >
      <nav className="vf-shell flex h-16 items-center gap-6" aria-label="Main">
        <a href="#top" className="rounded-lg" aria-label="Freevobe home">
          <Logo />
        </a>

        <ul className="ml-4 hidden items-center gap-7 text-sm text-muted lg:flex">
          {nav.map((item) => (
            <li key={item.label}>
              <a
                href={item.href}
                {...('external' in item && item.external
                  ? { target: '_blank', rel: 'noreferrer noopener' }
                  : {})}
                className="transition-colors hover:text-fg"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-2.5">
          <ThemeToggle />
          <DownloadButton size="sm" label="short" className="hidden sm:inline-flex" />
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-line bg-card text-muted lg:hidden"
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </nav>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id="mobile-nav"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden border-t border-line bg-bg/95 backdrop-blur-xl lg:hidden"
          >
            <ul className="vf-shell flex flex-col py-3 text-sm">
              {nav.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block border-b border-line/60 py-3 text-muted transition-colors hover:text-fg"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
              <li className="pt-3">
                <DownloadButton className="w-full" />
              </li>
              <li>
                <Button asChild variant="secondary" className="mt-2 w-full">
                  <a href="/download/" onClick={() => setOpen(false)}>
                    All platforms &amp; release notes
                  </a>
                </Button>
              </li>
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
