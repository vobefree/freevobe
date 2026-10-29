import { useLocale } from 'next-intl';
import type { AnchorHTMLAttributes, ReactNode } from 'react';

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string;
  children: ReactNode;
};

/**
 * Vanlig `<a>`, men sökvägar får språkprefix (`/sv/download/`). Ankarlänkar (`#features`) lämnas
 * orörda – de hoppar inom samma sida och ska inte byta språk.
 *
 * Externa adresser rörs inte heller; där sätts `target`/`rel` av anroparen som vanligt.
 */
export function LocaleLink({ href, children, ...rest }: Props) {
  const locale = useLocale();
  const external = /^(https?:)?\/\//.test(href) || href.startsWith('mailto:');
  const resolved = external || href.startsWith('#') ? href : `/${locale}${href}`;

  return (
    <a href={resolved} {...rest}>
      {children}
    </a>
  );
}
