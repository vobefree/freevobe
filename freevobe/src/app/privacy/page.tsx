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
        <h2>Advertising</h2>
        <p>
          Advertising is currently disabled and no ad code is loaded. If ads are enabled on this
          site later, they will be served by Google AdSense, which may use cookies or device
          identifiers to serve and measure ads. You will be able to decline personalised ads
          through the consent notice that appears with them.
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
