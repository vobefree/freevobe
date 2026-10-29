import { ExternalLink, HeartHandshake, ShieldCheck } from 'lucide-react';
import { Reveal } from '@/components/motion/reveal';
import { GIVES_BACK_CAUSES, GIVES_BACK_PRINCIPLES } from '@/lib/gives-back';
import { eyebrow, sectionTitle } from '@/lib/tokens';

/**
 * Freevobe Gives Back på webbplatsen.
 *
 * Ersätter den reserverade annonsplatsen. Sektionen säljer ingenting och har inga spårnings-
 * element: den förklarar principen och länkar vidare till organisationernas egna sidor.
 */
export function GivesBack() {
  return (
    <section
      id="gives-back"
      className="scroll-mt-24 border-y border-line bg-bg-soft/50 py-20 lg:py-24"
    >
      <div className="vf-shell">
        <Reveal>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className={eyebrow()}>Gives Back</p>
              <h2 className={sectionTitle()}>No ads. A choice to give back.</h2>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted">
                Freevobe does not sell your attention. Instead of an advertising slot, the app can
                offer a voluntary reminder about a cause you picked. You give directly to the
                organisation — Freevobe never handles the money.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2.5 rounded-xl border border-teal/25 bg-teal/8 px-4 py-3 text-[12.5px] text-muted">
              <ShieldCheck className="size-4 shrink-0 text-teal" />
              No ad network, no tracking, no checkout in the app.
            </div>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GIVES_BACK_CAUSES.map((cause, index) => (
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
                  Opens {cause.url.replace('https://', '')} · reviewed {cause.verifiedAt}
                </p>
              </a>
            </Reveal>
          ))}
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {GIVES_BACK_PRINCIPLES.map((principle, index) => (
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
            The catalogue is editorial and links point at each organisation&apos;s own front page
            rather than at a checkout, so a changed payment flow never turns into a broken promise.
            Freevobe has no partnership, commission or referral agreement with any organisation
            listed here. Read the full description in{' '}
            <a
              className="text-accent-soft underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
              href="https://github.com/freevobe/freevobe/blob/main/freevobe-desktop/docs/gives-back.md"
              target="_blank"
              rel="noreferrer noopener"
            >
              docs/gives-back.md
            </a>
            .
          </p>
        </Reveal>
      </div>
    </section>
  );
}
