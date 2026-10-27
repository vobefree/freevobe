import { ArrowRight } from 'lucide-react';
import { Reveal, RevealGroup, RevealItem } from '@/components/motion/reveal';
import { card } from '@/lib/tokens';
import { problems } from '@/lib/site';
import { cn } from '@/lib/utils';

export function ProblemSolution() {
  return (
    <section id="why" className="scroll-mt-24 py-20 lg:py-28">
      <div className="vf-shell">
        <Reveal>
          <h2 className="mx-auto max-w-3xl text-center text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-[2.75rem]">
            Token limits should not stop your flow.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-center text-base leading-relaxed text-muted">
            Cloud agents bill you for thinking. Freevobe runs the model you already have, so the
            meter never starts.
          </p>
        </Reveal>

        <RevealGroup className="mt-14 grid gap-5 md:grid-cols-3">
          {problems.map((item) => (
            <RevealItem key={item.problem}>
              <div className={cn(card(), 'group h-full')}>
                <p className="text-sm font-medium text-muted line-through decoration-diff-remove/70">
                  {item.problem}
                </p>
                <div className="mt-3 flex items-start gap-2">
                  <ArrowRight className="mt-1 size-4 shrink-0 text-accent transition-transform duration-300 group-hover:translate-x-1" />
                  <p className="text-lg font-semibold tracking-tight text-balance">
                    {item.solution}
                  </p>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-muted">{item.detail}</p>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
