import { ChevronRight, Download, MonitorSmartphone, Terminal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Reveal, RevealGroup, RevealItem } from '@/components/motion/reveal';
import { card, eyebrow, sectionTitle } from '@/lib/tokens';
import { cn } from '@/lib/utils';

const ICONS = [Download, Terminal, MonitorSmartphone] as const;

type Step = { title: string; body: string };
type FlowItem = { step: string; detail: string };

export function HowItWorks() {
  const t = useTranslations('howItWorks');
  const steps = t.raw('steps') as Step[];
  const flow = t.raw('flow') as FlowItem[];

  return (
    <section id="how-it-works" className="scroll-mt-24 border-y border-line bg-bg-soft/50 py-20 lg:py-24">
      <div className="vf-shell">
        <Reveal>
          <p className={eyebrow()}>{t('eyebrow')}</p>
          <h2 className={sectionTitle()}>{t('heading')}</h2>
        </Reveal>

        <RevealGroup className="mt-12 grid gap-5 md:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = ICONS[index] ?? Download;
            return (
              <RevealItem key={step.title}>
                <div className={cn(card(), 'h-full')}>
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-xl border border-line bg-card-strong font-mono text-sm text-accent-soft">
                      {index + 1}
                    </span>
                    <Icon className="size-[18px] text-muted" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold tracking-tight">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
                </div>
              </RevealItem>
            );
          })}
        </RevealGroup>

        {/* Flödesgraf: samma sex steg som i verkligheten, i en enda rad på stora skärmar. */}
        <Reveal delay={0.1} className="mt-12">
          <ol className="vf-panel flex flex-wrap items-stretch gap-2 p-3 sm:p-4">
            {flow.map((item, index) => (
              <li key={item.step} className="flex flex-1 items-center gap-2">
                <div className="min-w-[9.5rem] flex-1 rounded-xl border border-line bg-card-strong/60 px-3 py-2.5">
                  <p className="flex items-center gap-2 text-[13px] font-medium">
                    <span className="font-mono text-[11px] text-accent-soft">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    {item.step}
                  </p>
                  <p className="mt-1 text-[11px] text-muted">{item.detail}</p>
                </div>
                {index < flow.length - 1 ? (
                  <ChevronRight className="hidden size-4 shrink-0 text-line-strong sm:block" />
                ) : null}
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}
