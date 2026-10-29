import { Activity, Cpu, KeyRound, ShieldCheck, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Reveal } from '@/components/motion/reveal';

const ICONS = [Activity, Cpu, KeyRound, Sparkles, ShieldCheck] as const;

export function SocialProof() {
  const t = useTranslations('socialProof');
  const badges = (t.raw('badges') as string).split(';').filter(Boolean);

  return (
    <section aria-label={t('aria')} className="border-y border-line bg-bg-soft/60">
      <div className="vf-shell py-10">
        <Reveal from="none">
          <p className="text-center text-xs font-medium tracking-[0.16em] text-muted uppercase">
            {t('heading')}
          </p>
        </Reveal>

        <Reveal delay={0.08}>
          <ul className="mt-6 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
            {badges.map((badge, index) => {
              const Icon = ICONS[index] ?? Activity;
              return (
                <li
                  key={badge}
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-card/70 px-3.5 py-1.5 text-[12.5px] font-medium text-muted transition-colors hover:border-accent/40 hover:text-fg"
                >
                  <Icon className="size-3.5 text-accent-soft" />
                  {badge}
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
