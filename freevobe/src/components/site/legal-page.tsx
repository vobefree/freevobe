import type { ReactNode } from 'react';

export function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <article className="vf-shell max-w-3xl py-20 lg:py-28">
      <p className="text-xs font-semibold tracking-[0.16em] text-accent-soft uppercase">
        Freevobe
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
      <p className="mt-4 text-sm text-muted">Last updated {updated}</p>
      <p className="mt-8 text-base leading-relaxed text-muted">{intro}</p>

      <div className="mt-10 space-y-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_li]:leading-relaxed [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-muted [&_p+p]:mt-3 [&_ul+p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_ul]:text-sm [&_ul]:text-muted">
        {children}
      </div>

      <p className="mt-14 border-t border-line pt-6 text-xs text-muted">
        Questions about this page? Ask in the community Discord linked in the footer.
      </p>
    </article>
  );
}
