import { Github, MessageCircle, Twitter } from 'lucide-react';
import { Logo } from '@/components/site/navbar';
import { site } from '@/lib/site';

const columns = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'How it works', href: '#how-it-works' },
      { label: 'Skills', href: '#skills' },
      { label: 'Download', href: '/download/' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Documentation', href: site.docs },
      { label: 'GitHub', href: site.github },
      { label: 'Discord', href: site.discord },
      { label: 'FAQ', href: '#faq' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy', href: '/privacy/' },
      { label: 'Terms', href: '/terms/' },
      { label: 'License (MIT)', href: `${site.github}/blob/main/LICENSE` },
    ],
  },
] as const;

const socials = [
  { label: 'GitHub', href: site.github, icon: Github },
  { label: 'Discord', href: site.discord, icon: MessageCircle },
  { label: 'X', href: site.x, icon: Twitter },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-line bg-bg-soft/60">
      <div className="vf-shell grid gap-10 py-14 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
            Local-first vibecoding with Ollama. Vobe without counting tokens.
          </p>
          <div className="mt-5 flex items-center gap-2.5">
            {socials.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={social.label}
                className="flex size-9 items-center justify-center rounded-lg border border-line bg-card text-muted transition-colors hover:border-accent/50 hover:text-fg"
              >
                <social.icon className="size-4" />
              </a>
            ))}
          </div>
        </div>

        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h2 className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">
              {column.title}
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {column.links.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    {...(link.href.startsWith('http')
                      ? { target: '_blank', rel: 'noreferrer noopener' }
                      : {})}
                    className="text-muted transition-colors hover:text-fg"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-line">
        <div className="vf-shell flex flex-col items-center justify-between gap-2 py-6 text-xs text-muted sm:flex-row">
          <p>© 2026 Freevobe.</p>
          <p>Built for the vibe coding community.</p>
        </div>
      </div>
    </footer>
  );
}
