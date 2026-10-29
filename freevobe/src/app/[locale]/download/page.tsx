import type { Metadata } from 'next';
import { ExternalLink } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DownloadButton } from '@/components/download/download-button';
import { PlatformButtons } from '@/components/download/platform-buttons';
import { ReleaseBadge } from '@/components/download/release-badge';
import { ReleaseFiles } from '@/components/download/release-files';
import { ReleaseNotes } from '@/components/download/release-notes';
import { Reveal } from '@/components/motion/reveal';
import { Button } from '@/components/ui/button';
import { DOWNLOAD_LINKS, RELEASE_REPO } from '@/config/release';
import { alternatesFor } from '@/i18n/alternates';
import { site } from '@/lib/site';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'download' });

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: alternatesFor('/download', locale),
  };
}

export default async function DownloadPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('download');

  const requirements = [
    { label: t('requirements.ollama'), detail: t('requirements.ollamaDetail') },
    { label: t('requirements.disk'), detail: t('requirements.diskDetail') },
    { label: t('requirements.platforms'), detail: t('requirements.platformsDetail') },
    { label: t('requirements.phone'), detail: t('requirements.phoneDetail') },
  ];

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
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
            {t('title')}
          </h1>
        </Reveal>

        <Reveal delay={0.1}>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted">{t('body')}</p>
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
          <p className="mt-4 text-[11.5px] text-muted">{t('signed')}</p>
        </Reveal>
      </section>

      <section className="vf-shell max-w-4xl pb-4">
        <div className="vf-panel p-5">
          <h2 className="text-sm font-semibold tracking-tight">{t('phone.title')}</h2>
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{t('phone.body')}</p>
          <ol className="mt-3 space-y-2 text-[12.5px] leading-relaxed text-muted">
            <li>
              <span className="font-medium text-fg">1.</span> {t('phone.step1')}
            </li>
            <li>
              <span className="font-medium text-fg">2.</span> {t('phone.step2')}
            </li>
            <li>
              <span className="font-medium text-fg">3.</span> {t('phone.step3')}
            </li>
          </ol>
          <p className="mt-3 text-[11.5px] text-muted">{t('phone.ios')}</p>
        </div>
      </section>

      {/* Learn är en egen app – en fil, ingen sida på sajten. Därför ligger den här som en
          nedladdning bredvid installerarna, inte som en egen route. */}
      <section id="learn" className="vf-shell max-w-4xl scroll-mt-24 pb-12">
        <div className="vf-panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] tracking-[0.08em] text-accent-soft">
                {t('learn.eyebrow')}
              </p>
              <h2 className="mt-1 text-sm font-semibold tracking-tight">{t('learn.title')}</h2>
            </div>
            <span className="rounded-full border border-line px-3 py-1 font-mono text-[11px] text-muted">
              {t('learn.size')}
            </span>
          </div>

          <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{t('learn.body')}</p>

          <ol className="mt-3 space-y-2 text-[12.5px] leading-relaxed text-muted">
            <li>
              <span className="font-medium text-fg">1.</span> {t('learn.step1')}
            </li>
            <li>
              <span className="font-medium text-fg">2.</span> {t('learn.step2')}
            </li>
            <li>
              <span className="font-medium text-fg">3.</span> {t('learn.step3')}
            </li>
          </ol>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button asChild size="sm">
              <a href={DOWNLOAD_LINKS.learn} download>
                {t('learn.download')}
              </a>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <a href={DOWNLOAD_LINKS.all} target="_blank" rel="noreferrer noopener">
                {t('learn.allReleases')}
                <ExternalLink className="size-3.5" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      <section className="vf-shell max-w-4xl pb-12">
        <ReleaseFiles />
      </section>

      <section className="vf-shell max-w-4xl pb-16">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{t('notes.title')}</h2>
            <p className="mt-2 text-sm text-muted">{t('notes.body')}</p>
            <div className="mt-5">
              <ReleaseNotes />
            </div>
          </div>

          <aside className="space-y-5">
            <div className="vf-panel p-5">
              <h2 className="text-sm font-semibold tracking-tight">{t('requirements.title')}</h2>
              <ul className="mt-3 space-y-3">
                {requirements.map((item) => (
                  <li key={item.label} className="text-[12.5px] leading-relaxed text-muted">
                    <span className="font-medium text-fg">{item.label}</span>
                    <br />
                    {item.detail}
                  </li>
                ))}
              </ul>
            </div>

            <div className="vf-panel p-5">
              <h2 className="text-sm font-semibold tracking-tight">{t('where.title')}</h2>
              <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
                {t('where.body', { repo: RELEASE_REPO })}
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <Button asChild variant="secondary" size="sm">
                  <a href={DOWNLOAD_LINKS.all} target="_blank" rel="noreferrer noopener">
                    {t('where.all')}
                    <ExternalLink className="size-3.5" />
                  </a>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <a href={site.docs} target="_blank" rel="noreferrer noopener">
                    {t('where.docs')}
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
