import { DownloadButton } from '@/components/download/download-button';
import { PlatformButtons } from '@/components/download/platform-buttons';
import { Reveal } from '@/components/motion/reveal';
import { Button } from '@/components/ui/button';
import { site } from '@/lib/site';

export function FinalCta() {
  return (
    <section className="relative overflow-hidden py-20 lg:py-28">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="vf-grid-bg absolute inset-x-0 bottom-0 h-[420px] rotate-180" />
        <div className="vf-glow absolute -bottom-32 left-1/2 size-[560px] -translate-x-1/2 opacity-60" />
      </div>

      <div className="vf-shell">
        <Reveal from="none">
          <div className="vf-panel mx-auto max-w-3xl px-8 py-14 text-center sm:px-14">
            <h2 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Ready to vobe?
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted">
              Install the app, point it at Ollama and describe what you want to build. The diff
              lands before a single file changes.
            </p>

            {/* Endast en primär CTA – den väljer rätt plattform automatiskt. */}
            <div className="mt-9 flex justify-center">
              <DownloadButton className="w-full sm:w-auto" />
            </div>

            <div className="mt-5">
              <PlatformButtons className="mx-auto max-w-xl" />
            </div>

            <div className="mt-4 flex justify-center">
              <Button asChild size="sm" variant="secondary">
                <a href="/download/">All platforms &amp; release notes</a>
              </Button>
            </div>

            <p className="mt-6 text-sm text-muted">
              Free to use with your local Ollama models.
            </p>
            <p className="mt-2 font-mono text-[11.5px] text-muted">
              {site.platforms.join(' · ')} · {site.license}
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
