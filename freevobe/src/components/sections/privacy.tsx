import { ArrowRight, Cpu, FolderGit2, Lock, MonitorSmartphone } from 'lucide-react';
import { Reveal } from '@/components/motion/reveal';
import { eyebrow, sectionTitle } from '@/lib/tokens';

const path = [
  { icon: MonitorSmartphone, label: 'Your machine' },
  { icon: Cpu, label: 'Ollama' },
  { icon: MonitorSmartphone, label: 'Freevobe' },
  { icon: FolderGit2, label: 'Your project' },
] as const;

export function Privacy() {
  return (
    <section id="privacy" className="scroll-mt-24 border-y border-line bg-bg-soft/50 py-20 lg:py-24">
      <div className="vf-shell grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Reveal from="left">
          <p className={eyebrow()}>Privacy</p>
          <h2 className={sectionTitle()}>Your code stays yours.</h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">
            Freevobe runs locally by default. Connect Ollama on your own machine and keep your
            projects, prompts and files private.
          </p>
          <ul className="mt-7 space-y-3 text-sm text-muted">
            {[
              'No account and no sign-in.',
              'No telemetry leaving the app.',
              'Diff and approval gate before every write.',
            ].map((item) => (
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
              Data path
            </p>

            <ol className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
              {path.map((node, index) => (
                <li key={node.label} className="flex items-center gap-2">
                  <div className="flex flex-1 items-center gap-2.5 rounded-xl border border-line bg-card-strong/60 px-3 py-2.5 sm:flex-col sm:py-4 sm:text-center">
                    <node.icon className="size-4 shrink-0 text-accent-soft" />
                    <span className="text-[12.5px] font-medium sm:text-[11.5px]">{node.label}</span>
                  </div>
                  {index < path.length - 1 ? (
                    <ArrowRight className="size-4 shrink-0 text-line-strong" />
                  ) : null}
                </li>
              ))}
            </ol>

            <p className="mt-6 rounded-xl border border-teal/25 bg-teal/8 px-4 py-3 text-[12.5px] leading-relaxed text-muted">
              Everything in that loop runs on hardware you already own. Nothing is uploaded unless
              you explicitly connect a cloud model.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
