import {
  Blocks,
  GitBranch,
  LayoutPanelLeft,
  Plug,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Reveal, RevealGroup, RevealItem } from '@/components/motion/reveal';
import { card, eyebrow, sectionTitle } from '@/lib/tokens';
import { cn } from '@/lib/utils';

const ICONS: Record<string, LucideIcon> = {
  plug: Plug,
  layout: LayoutPanelLeft,
  shield: ShieldCheck,
  sparkles: Sparkles,
  git: GitBranch,
  blocks: Blocks,
};

type Item = { icon: string; title: string; body: string };

export function Features() {
  const t = useTranslations('features');
  const items = t.raw('items') as Item[];

  return (
    <section id="features" className="scroll-mt-24 py-20 lg:py-24">
      <div className="vf-shell">
        <Reveal>
          <p className={eyebrow()}>{t('eyebrow')}</p>
          <h2 className={sectionTitle()}>{t('heading')}</h2>
        </Reveal>

        <RevealGroup className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((feature) => {
            const Icon = ICONS[feature.icon] ?? Plug;
            return (
              <RevealItem key={feature.title}>
                <div className={cn(card(), 'group')}>
                  <div className="flex size-10 items-center justify-center rounded-xl border border-line bg-card-strong text-accent-soft transition-colors duration-300 group-hover:border-accent/50 group-hover:text-accent">
                    <Icon className="size-[18px]" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold tracking-tight">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{feature.body}</p>
                </div>
              </RevealItem>
            );
          })}
        </RevealGroup>
      </div>
    </section>
  );
}
