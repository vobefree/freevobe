import { ArrowRight } from 'lucide-react';
import { AppMockup } from '@/components/app-mockup';
import { DownloadButton } from '@/components/download/download-button';
import { PlatformButtons } from '@/components/download/platform-buttons';
import { ReleaseBadge } from '@/components/download/release-badge';
import { Reveal } from '@/components/motion/reveal';
import { Badge, StatusDot } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-16 pb-20 sm:pt-24 lg:pb-28">
      {/* Bakgrund: rutnät, glöd och en diskret horisontlinje. */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="vf-grid-bg absolute inset-x-0 top-0 h-[560px]" />
        <div className="vf-glow absolute -top-40 left-1/2 size-[620px] -translate-x-1/2 opacity-70" />
        <div className="absolute inset-x-0 top-[520px] h-px bg-gradient-to-r from-transparent via-line-strong to-transparent" />
      </div>

      <div className="vf-shell">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal from="none">
            <Badge className="mx-auto">
              <StatusDot />
              Local-first AI coding agent
            </Badge>
          </Reveal>

          <Reveal delay={0.05}>
            <h1 className="mt-7 text-5xl leading-[1.02] font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl">
              <span className="vf-text-gradient">Vobe with Ollama.</span>
            </h1>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted text-pretty sm:text-lg">
              Freevobe is your local vibecoding agent. Install it, connect Ollama and build software
              through natural-language chat — no API keys, no token counting, no cloud dependency.
            </p>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <DownloadButton className="w-full sm:w-auto" />
              <Button asChild size="lg" variant="secondary" className="w-full sm:w-auto">
                <a href="#how-it-works">
                  See how it works
                  <ArrowRight className="size-4" />
                </a>
              </Button>
            </div>
          </Reveal>

          <Reveal delay={0.18}>
            <PlatformButtons className="mx-auto mt-5 max-w-xl" />
          </Reveal>

          <Reveal delay={0.2}>
            <div className="mt-4 flex justify-center">
              <ReleaseBadge />
            </div>
          </Reveal>

          <Reveal delay={0.2}>
            <p className="mt-6 font-mono text-xs tracking-wide text-muted sm:text-[13px]">
              No tokens. No limits. Just vibes.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.25} className="relative mt-14 lg:mt-18">
          <div
            className="vf-glow pointer-events-none absolute -inset-x-10 top-6 -z-10 h-56 opacity-40"
            aria-hidden="true"
          />
          <AppMockup />
          <p className="mt-4 text-center text-[11.5px] text-muted">
            The whole loop on your machine — plan, diff, terminal and tests in one workspace.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
