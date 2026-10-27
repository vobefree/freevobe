import Link from 'next/link';

const NAV = [
  { href: '/', label: 'Start' },
  { href: '/download/', label: 'Ladda ner' },
  { href: '/docs/', label: 'Dokumentation' },
  { href: '/skills/', label: 'Skills' },
  { href: '/blog/', label: 'Blogg' },
  { href: '/community/', label: 'Community' },
  { href: '/changelog/', label: 'Changelog' },
];

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 3h7l3 6-3 6H4l3-6z" fill="var(--color-ember)" />
        <path d="M13 21h7l-3-6h-7z" fill="var(--color-spark)" opacity="0.9" />
      </svg>
      <span className="text-base font-semibold tracking-tight">
        Vibe<span className="text-ember">Forge</span>
      </span>
    </span>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-steel bg-forge/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3">
        <Link href="/" aria-label="VibeForge startsida">
          <Logo />
        </Link>
        <nav className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
          {NAV.slice(1).map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-slate-100">
              {item.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/download/"
          className="ml-2 rounded-md bg-ember px-3 py-1.5 text-sm font-semibold text-anvil hover:brightness-110"
        >
          Ladda ner
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-steel bg-forge">
      <div className="mx-auto grid max-w-6xl gap-6 px-5 py-8 text-sm text-slate-500 sm:grid-cols-3">
        <div className="space-y-2">
          <Logo size={18} />
          <p className="text-xs">Lokal-first vibecoding med Ollama. Koden stannar på din dator.</p>
        </div>
        <div className="space-y-1 text-xs">
          <p className="font-semibold text-slate-400">Sajten</p>
          {NAV.map((item) => (
            <p key={item.href}>
              <Link href={item.href} className="hover:text-slate-200">
                {item.label}
              </Link>
            </p>
          ))}
        </div>
        <div className="space-y-1 text-xs">
          <p className="font-semibold text-slate-400">Juridik och källa</p>
          <p>
            <Link href="/privacy/" className="hover:text-slate-200">
              Integritetspolicy
            </Link>
          </p>
          <p>
            <a href="https://github.com/vibeforge/vibeforge" className="hover:text-slate-200">
              Källkod (MIT)
            </a>
          </p>
          <p>© {new Date().getFullYear()} VibeForge</p>
        </div>
      </div>
    </footer>
  );
}
