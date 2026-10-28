import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { DownloadButton } from "@/components/download/download-button";
import { PlatformButtons } from "@/components/download/platform-buttons";
import { ReleaseBadge } from "@/components/download/release-badge";
import { ReleaseFiles } from "@/components/download/release-files";
import { ReleaseNotes } from "@/components/download/release-notes";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { DOWNLOAD_LINKS, RELEASE_REPO } from "@/config/release";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Download",
  description:
    "Download Freevobe for Windows, macOS or Linux, or the Android app for your phone. Installers are published on GitHub Releases.",
  alternates: { canonical: "/download/" },
};

const REQUIREMENTS = [
  {
    label: "Ollama",
    detail: "Running locally, with at least one model pulled",
  },
  {
    label: "Disk",
    detail: "~120 MB for the app, plus the space your models need",
  },
  {
    label: "Platforms",
    detail:
      "Windows 10+, macOS 12+ (Apple Silicon or Intel), Linux (AppImage, x86-64)",
  },
  {
    label: "Phone",
    detail:
      "Android 8+ can install the APK directly. iOS needs a Mac and an Apple account.",
  },
] as const;

export default function DownloadPage() {
  return (
    <div className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden="true"
      >
        <div className="vf-grid-bg absolute inset-x-0 top-0 h-[420px]" />
        <div className="vf-glow absolute -top-32 left-1/2 size-[520px] -translate-x-1/2 opacity-60" />
      </div>

      <section className="vf-shell max-w-4xl pt-16 pb-10 text-center">
        <Reveal from="none">
          <div className="flex justify-center">
            <ReleaseBadge />
          </div>
        </Reveal>

        <Reveal delay={0.05}>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Download Freevobe
          </h1>
        </Reveal>

        <Reveal delay={0.1}>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted">
            Pick your platform — the button below already knows it. Freevobe
            runs offline and talks to the Ollama installation on your own
            machine.
          </p>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="mt-8 flex justify-center">
            <DownloadButton className="w-full sm:w-auto" />
          </div>
        </Reveal>

        <Reveal delay={0.2}>
          <PlatformButtons className="mx-auto mt-5 max-w-2xl" />
        </Reveal>

        <Reveal delay={0.25}>
          <p className="mt-4 text-[11.5px] text-muted">
            Builds are signed by default where the platform allows it. Source is
            MIT licensed.
          </p>
        </Reveal>
      </section>

      <section className="vf-shell max-w-4xl pb-4">
        <div className="vf-panel p-5">
          <h2 className="text-sm font-semibold tracking-tight">
            The phone app
          </h2>
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
            Freevobe Mobile mirrors the desktop app: QR-pair once over your
            local network and then follow runs, diffs and approvals from the
            couch. Nothing leaves your Wi-Fi — the phone talks to the Freevobe
            agent running on your own machine.
          </p>
          <ol className="mt-3 space-y-2 text-[12.5px] leading-relaxed text-muted">
            <li>
              <span className="font-medium text-fg">1.</span> Download the APK
              and open it. Android asks you to allow installs from this source —
              the file is not from Google Play.
            </li>
            <li>
              <span className="font-medium text-fg">2.</span> Open the desktop
              app and show the pairing QR code. Point the phone at it.
            </li>
            <li>
              <span className="font-medium text-fg">3.</span> Both devices need
              to be on the same network. Pairing works offline.
            </li>
          </ol>
          <p className="mt-3 text-[11.5px] text-muted">
            iOS builds are not published yet — they need a Mac and an Apple
            Developer account.
          </p>
        </div>
      </section>

      <section className="vf-shell max-w-4xl pb-12">
        <ReleaseFiles />
      </section>

      <section className="vf-shell max-w-4xl pb-16">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              What changed in the last release
            </h2>
            <p className="mt-2 text-sm text-muted">
              Release notes come straight from the newest GitHub tag.
            </p>
            <div className="mt-5">
              <ReleaseNotes />
            </div>
          </div>

          <aside className="space-y-5">
            <div className="vf-panel p-5">
              <h2 className="text-sm font-semibold tracking-tight">
                Before you install
              </h2>
              <ul className="mt-3 space-y-3">
                {REQUIREMENTS.map((item) => (
                  <li
                    key={item.label}
                    className="text-[12.5px] leading-relaxed text-muted"
                  >
                    <span className="font-medium text-fg">{item.label}</span>
                    <br />
                    {item.detail}
                  </li>
                ))}
              </ul>
            </div>

            <div className="vf-panel p-5">
              <h2 className="text-sm font-semibold tracking-tight">
                Where the files live
              </h2>
              <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
                Every build is attached to a tag on{" "}
                <span className="font-mono">{RELEASE_REPO}</span>. Nothing is
                served from this site, and the badge above shows the newest tag
                as soon as one exists.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <Button asChild variant="secondary" size="sm">
                  <a
                    href={DOWNLOAD_LINKS.all}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    All releases on GitHub
                    <ExternalLink className="size-3.5" />
                  </a>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <a href={site.docs} target="_blank" rel="noreferrer noopener">
                    Read the docs
                  </a>
                </Button>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
