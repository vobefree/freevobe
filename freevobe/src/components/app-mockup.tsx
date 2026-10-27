import { Check, GitBranch, Play, Terminal as TerminalIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const plan = [
  { label: 'Scaffold app router', status: 'done' },
  { label: 'Build hero + pricing', status: 'done' },
  { label: 'Wire Stripe checkout', status: 'doing' },
  { label: 'Run tests', status: 'todo' },
] as const;

const diff = [
  { kind: 'add', text: '+ export function Hero() {' },
  { kind: 'add', text: '+   return <Pricing plans={plans} />;' },
  { kind: 'add', text: '+ }' },
  { kind: 'ctx', text: '  const plans = [' },
  { kind: 'remove', text: '-   { name: "Free", price: 0 },' },
  { kind: 'add', text: '+   { name: "Pro", price: 19 },' },
] as const;

const tests = [
  { name: 'checkout.spec.ts', result: 'passed' },
  { name: 'pricing.spec.ts', result: 'passed' },
  { name: 'hero.spec.ts', result: 'passed' },
] as const;

function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-semibold tracking-[0.14em] text-muted uppercase">
      {children}
    </span>
  );
}

export function AppMockup({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'vf-panel relative overflow-hidden rounded-2xl border-line-strong bg-bg-soft/95 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.85)] backdrop-blur',
        className,
      )}
      aria-hidden="true"
    >
      {/* Fönsterkrom med status: modell, anslutning och branch. */}
      <div className="flex items-center gap-3 border-b border-line bg-card/80 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-diff-remove/70" />
          <span className="size-2.5 rounded-full bg-amber-400/70" />
          <span className="size-2.5 rounded-full bg-diff-add/70" />
        </div>
        <div className="ml-1 flex items-center gap-2 rounded-md border border-line bg-bg px-2 py-1 text-[10.5px] text-muted">
          <span className="font-mono">freevobe</span>
          <span className="text-line-strong">/</span>
          <span className="font-mono text-fg">saas-landing</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-teal/30 bg-teal/10 px-2.5 py-1 text-[10.5px] font-medium text-teal sm:inline-flex">
            <span className="size-1.5 animate-pulse rounded-full bg-teal" />
            Ollama connected · qwen3-coder · local
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-bg px-2 py-1 font-mono text-[10.5px] text-muted">
            <GitBranch className="size-3" />
            main
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 divide-line md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.25fr)_minmax(0,0.95fr)] md:divide-x">
        {/* Plan / chatt */}
        <div className="border-b border-line p-3.5 md:border-b-0">
          <div className="flex items-center justify-between">
            <PanelLabel>Plan</PanelLabel>
            <span className="rounded border border-line px-1.5 py-0.5 text-[9.5px] text-muted">
              Execute
            </span>
          </div>

          <div className="mt-3 rounded-lg border border-line bg-card p-2.5">
            <p className="text-[11.5px] leading-relaxed text-fg/90">
              Build a SaaS landing page with pricing and checkout.
            </p>
          </div>

          <ul className="mt-3 space-y-2">
            {plan.map((item) => (
              <li key={item.label} className="flex items-start gap-2 text-[11.5px]">
                <span
                  className={cn(
                    'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border text-[9px]',
                    item.status === 'done'
                      ? 'border-teal/50 bg-teal/15 text-teal'
                      : item.status === 'doing'
                        ? 'border-accent/60 bg-accent/15 text-accent-soft'
                        : 'border-line-strong text-transparent',
                  )}
                >
                  {item.status === 'done' ? <Check className="size-2.5" /> : null}
                  {item.status === 'doing' ? <span className="size-1.5 rounded-full bg-accent" /> : null}
                </span>
                <span
                  className={cn(
                    item.status === 'done' ? 'text-muted line-through' : 'text-fg/85',
                  )}
                >
                  {item.label}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-3.5 flex items-center gap-2 rounded-lg border border-line bg-card px-2.5 py-2 text-[11px] text-muted">
            <span className="text-accent-soft">›</span>
            <span>Add a pricing section</span>
            <span className="ml-auto inline-block h-3.5 w-[2px] animate-blink bg-accent-soft" />
          </div>
        </div>

        {/* Kod + diff */}
        <div className="border-b border-line p-3.5 md:border-b-0">
          <div className="flex items-center gap-2">
            <span className="rounded border border-line bg-card px-2 py-1 font-mono text-[10.5px] text-fg">
              app/page.tsx
            </span>
            <span className="rounded border border-line px-2 py-1 font-mono text-[10.5px] text-muted">
              components/pricing.tsx
            </span>
            <span className="ml-auto rounded border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-[9.5px] font-medium text-accent-soft">
              +12 −1
            </span>
          </div>

          <div className="vf-dark-surface mt-3 overflow-hidden rounded-lg border border-line bg-[#08080b]">
            <div className="flex items-center gap-2 border-b border-line px-2.5 py-1.5">
              <span className="size-1.5 rounded-full bg-diff-add" />
              <span className="text-[10px] text-muted">Diff · awaiting your approval</span>
            </div>
            <div className="vf-code py-1.5">
              {diff.map((line, index) => (
                <div
                  key={`${index}-${line.text}`}
                  className={cn(
                    'flex gap-2.5 px-2.5 whitespace-pre',
                    line.kind === 'add'
                      ? 'bg-diff-add/8 text-diff-add'
                      : line.kind === 'remove'
                        ? 'bg-diff-remove/8 text-diff-remove'
                        : 'text-slate-500',
                  )}
                >
                  <span className="w-3 shrink-0 text-right text-slate-600 select-none">
                    {index + 40}
                  </span>
                  <span>{line.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-2.5 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-diff-add/40 bg-diff-add/10 px-2 py-1 text-[10.5px] font-medium text-diff-add">
              <Check className="size-3" /> Approve
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-[10.5px] text-muted">
              Reject
            </span>
            <span className="ml-auto text-[10px] text-muted">Nothing is written yet</span>
          </div>
        </div>

        {/* Terminal + tester */}
        <div className="p-3.5">
          <div className="flex items-center gap-2 text-muted">
            <TerminalIcon className="size-3.5" />
            <PanelLabel>Terminal</PanelLabel>
          </div>

          <div className="vf-code vf-dark-surface mt-3 rounded-lg border border-line bg-[#08080b] p-2.5 text-slate-300">
            <div className="flex gap-2">
              <span className="text-accent-soft">➜</span>
              <span>
                <span className="text-teal">freevobe</span> npm test
              </span>
            </div>
            <div className="mt-1 text-terminal">
              ✓ 3 passed <span className="text-slate-500">(1.2s)</span>
            </div>
            <div className="flex gap-2">
              <span className="text-accent-soft">➜</span>
              <span>
                <span className="text-teal">freevobe</span> git commit -m "pricing"
              </span>
              <span className="inline-block h-3.5 w-[2px] animate-blink bg-slate-400" />
            </div>
          </div>

          <div className="mt-3 space-y-1.5">
            {tests.map((test) => (
              <div
                key={test.name}
                className="flex items-center gap-2 rounded-md border border-line bg-card px-2 py-1.5"
              >
                <Check className="size-3 shrink-0 text-diff-add" />
                <span className="truncate font-mono text-[10.5px] text-muted">{test.name}</span>
                <span className="ml-auto text-[10px] text-diff-add">passed</span>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-card px-2.5 py-2">
            <Play className="size-3 text-accent-soft" />
            <span className="text-[10.5px] text-muted">Local model</span>
            <span className="ml-auto rounded border border-line bg-bg px-1.5 py-0.5 font-mono text-[10px] text-fg">
              0 requests · 0 tokens billed
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
