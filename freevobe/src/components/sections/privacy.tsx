import { ArrowRight, Cpu, FolderGit2, Lock, MonitorSmartphone } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Reveal } from '@/components/motion/reveal';
import { eyebrow, sectionTitle } from '@/lib/tokens';

const PATH_ICONS = [MonitorSmartphone, Cpu, MonitorSmartphone, FolderGit2] as const;

export function Privacy() {
  const t = useTranslations('privacy');
  const bullets = (t.raw('bullets') as string).split(';').filter(Boolean);
  const path = (t.raw('path') as string).split(';').filter(Boolean);

  return (
    <section id="privacy" className="scroll-mt-24 border-y border-line bg-bg-soft/50 py-20 lg:py-24">
      <div className="vf-shell grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Reveal from="left">
          <p className={eyebrow()}>{t('eyebrow')}</p>
          <h2 className={sectionTitle()}>{t('heading')}</h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">{t('body')}</p>
          <ul className="mt-7 space-y-3 text-sm text-muted">
            {bullets.map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <Lock className="mt-0.5 size-4 shrink-0 text-teal" />
                {item}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal from="right" delay={0.05}>
          <div className="vf-panel p-5 sm:p-7">
            <p className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">
              {t('dataPath')}
            </p>

            <ol className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
              {path.map((label, index) => {
                const Icon = PATH_ICONS[index] ?? MonitorSmartphone;
                return (
                  <li key={label} className="flex items-center gap-2">
                    <div className="flex flex-1 items-center gap-2.5 rounded-xl border border-line bg-card-strong/60 px-3 py-2.5 sm:flex-col sm:py-4 sm:text-center">
                      <Icon className="size-4 shrink-0 text-accent-soft" />
                      <span className="text-[12.5px] font-medium sm:text-[11.5px]">{label}</span>
                    </div>
                    {index < path.length - 1 ? (
                      <ArrowRight className="size-4 shrink-0 text-line-strong" />
                    ) : null}
                  </li>
                );
              })}
            </ol>

            <p className="mt-6 rounded-xl border border-teal/25 bg-teal/8 px-4 py-3 text-[12.5px] leading-relaxed text-muted">
              {t('note')}
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
