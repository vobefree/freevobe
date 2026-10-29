import type { Metadata } from 'next';
import { LegalPage } from '@/components/site/legal-page';

export const metadata: Metadata = {
  title: 'Privacy',
  description:
    'Freevobe runs locally by default: your projects, prompts and files stay on your machine.',
  alternates: { canonical: '/privacy/' },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      updated="27 October 2026"
      intro="Freevobe is local-first. This page describes what this website and the Freevobe desktop app do with your data."
    >
      <section>
        <h2>This website</h2>
        <p>
          This site is a static page. It sets no analytics, no tracking pixels and no cookies of
          its own, and it makes no requests to third-party hosts — fonts and images are served from
          the same domain.
        </p>
        <p>
          Your theme choice (dark or light) is stored in your browser&apos;s local storage so the
          page opens the way you left it. It never leaves your machine.
        </p>
      </section>

      <section>
        <h2>Advertising and Gives Back</h2>
        <p>
          Freevobe has no advertising: no ad slots, no ad scripts and no ad network. The website
          and the desktop app therefore set no advertising cookies or device identifiers, and no
          data is shared with a third party for marketing.
        </p>
        <p>
          In place of an ad slot, the desktop app can show a voluntary reminder about a
          charity — Freevobe Gives Back. It is off until you turn it on. The reminder contains a
          link to the organisation&apos;s own website; Freevobe has no checkout, no account and no
          payment provider, and never receives or forwards a donation.
        </p>
        <p>
          If you record a contribution in the app, the note stays in your local database and is
          labelled as self-reported. It is never sent to the organisation or to us, and you can
          delete it at any time.
        </p>
      </section>

      <section>
        <h2>The desktop app</h2>
        <ul>
          <li>
            Your code, prompts and files are processed on your own machine by a model you run
            yourself through Ollama. Nothing is uploaded by default.
          </li>
          <li>
            Sessions, project indexes and memory are stored in a local SQLite database on your
            computer.
          </li>
          <li>
            The app sends no telemetry. There is no account and no sign-in.
          </li>
          <li>
            A cloud model is only contacted if you configure one yourself, and that connection is
            then governed by the provider you chose.
          </li>
        </ul>
      </section>

      <section>
        <h2>Downloads</h2>
        <p>
          Download links point to the project&apos;s release page. Your browser and the hosting
          provider of that page apply their own normal request logging.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          If this policy changes, the date at the top of this page changes with it. Freevobe is
          open source, so this page and its history are reviewable in the public repository.
        </p>
      </section>
    </LegalPage>
  );
}
