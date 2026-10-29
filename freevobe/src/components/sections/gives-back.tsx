import { ExternalLink, HeartHandshake, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Reveal } from '@/components/motion/reveal';
import { LocaleLink } from '@/components/site/locale-link';
import { eyebrow, sectionTitle } from '@/lib/tokens';
import { GIVES_BACK_CAUSES } from '@/lib/gives-back';

type Cause = { id: string; name: string; tagline: string; description: string; url: string };
type Principle = { title: string; body: string };

export function GivesBack() {
  const t = useTranslations('givesBack');
  const causes = t.raw('causes') as Cause[];
  const principles = t.raw('principles') as Principle[];

  return (
    <section
      id="gives-back"
      className="scroll-mt-24 border-y border-line bg-bg-soft/50 py-20 lg:py-24"
    >
      <div className="vf-shell">
        <Reveal>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className={eyebrow()}>{t('eyebrow')}</p>
              <h2 className={sectionTitle()}>{t('heading')}</h2>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted">{t('body')}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2.5 rounded-xl border border-teal/25 bg-teal/8 px-4 py-3 text-[12.5px] text-muted">
              <ShieldCheck className="size-4 shrink-0 text-teal" />
              {t('badge')}
            </div>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {causes.map((cause, index) => {
            const verifiedAt =
              GIVES_BACK_CAUSES.find((entry) => entry.id === cause.id)?.verifiedAt ?? '';
            return (
              <Reveal key={cause.id} delay={index * 0.03}>
                <a
                  href={cause.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  data-testid="cause-card"
                  className="vf-panel group flex h-full flex-col p-5 transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-teal/45"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-semibold tracking-tight">{cause.name}</h3>
                    <ExternalLink className="mt-0.5 size-4 shrink-0 text-muted transition-colors group-hover:text-teal" />
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-accent-soft">{cause.tagline}</p>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted">{cause.description}</p>
                  <p className="mt-auto pt-4 text-[11px] text-muted">
                    {t('causeFooter', {
                      host: cause.url.replace('https://', ''),
                      date: verifiedAt,
                    })}
                  </p>
                </a>
              </Reveal>
            );
          })}
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {principles.map((principle, index) => (
            <Reveal key={principle.title} delay={index * 0.03}>
              <div className="h-full rounded-xl border border-line bg-card/60 p-5">
                <HeartHandshake className="size-4 text-teal" />
                <h3 className="mt-3 text-sm font-semibold">{principle.title}</h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{principle.body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <p className="mt-10 max-w-3xl text-[12.5px] leading-relaxed text-muted">
            {t('footnote')}{' '}
            <a
              className="text-accent-soft underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
              href="https://github.com/vobefree/freevobe/blob/main/freevobe-desktop/docs/gives-back.md"
              target="_blank"
              rel="noreferrer noopener"
            >
              {t('footnoteLink')}
            </a>
            .
          </p>
        </Reveal>
      </div>
    </section>
  );
}
