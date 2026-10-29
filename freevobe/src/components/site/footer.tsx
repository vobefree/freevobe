import { Github, MessageCircle, Twitter } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Logo } from '@/components/site/navbar';
import { site } from '@/lib/site';

const socials = [
  { labelKey: 'socialGithub', href: site.github, icon: Github },
  { labelKey: 'socialDiscord', href: site.discord, icon: MessageCircle },
  { labelKey: 'socialX', href: site.x, icon: Twitter },
] as const;

export function Footer() {
  const t = useTranslations('footer');
  const locale = useLocale();

  const columns = [
    {
      title: t('product'),
      links: [
        { label: t('features'), href: `/${locale}/#features` },
        { label: t('howItWorks'), href: `/${locale}/#how-it-works` },
        { label: t('skills'), href: `/${locale}/#skills` },
        { label: t('givesBack'), href: `/${locale}/#gives-back` },
        { label: t('learn'), href: `/${locale}/download/#learn` },
        { label: t('download'), href: `/${locale}/download/` },
      ],
    },
    {
      title: t('resources'),
      links: [
        { label: t('documentation'), href: site.docs },
        { label: t('github'), href: site.github },
        { label: t('discord'), href: site.discord },
        { label: t('faq'), href: `/${locale}/#faq` },
      ],
    },
    {
      title: t('legal'),
      links: [
        { label: t('privacy'), href: `/${locale}/privacy/` },
        { label: t('terms'), href: `/${locale}/terms/` },
        { label: t('licenseLink'), href: `${site.github}/blob/main/LICENSE` },
      ],
    },
  ];

  return (
    <footer className="border-t border-line bg-bg-soft/60">
      <div className="vf-shell grid gap-10 py-14 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">{t('tagline')}</p>
          <div className="mt-5 flex items-center gap-2.5">
            {socials.map((social) => (
              <a
                key={social.labelKey}
                href={social.href}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={t(social.labelKey)}
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
          <p>{t('copyright')}</p>
          <p>{t('builtFor')}</p>
        </div>
      </div>
    </footer>
  );
}
