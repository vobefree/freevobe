import type { Metadata } from 'next';
import { LegalPage } from '@/components/site/legal-page';

export const metadata: Metadata = {
  title: 'Terms',
  description: 'Plain terms for using Freevobe and this website.',
  alternates: { canonical: '/terms/' },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms"
      updated="27 October 2026"
      intro="Short and plain: Freevobe is free software that runs on your hardware, and you are responsible for what you build with it."
    >
      <section>
        <h2>The app</h2>
        <ul>
          <li>
            The core application is free to use with your own local Ollama models. There is no
            subscription, no token metering and no usage limit imposed by us.
          </li>
          <li>
            The source code is released under the MIT licence. You may use, modify and redistribute
            it under that licence.
          </li>
          <li>
            The app runs on your machine with your credentials and your files. You are responsible
            for the projects you point it at, the commands you approve and the changes you commit.
          </li>
        </ul>
      </section>

      <section>
        <h2>No warranty</h2>
        <p>
          Freevobe is provided &ldquo;as is&rdquo;, without warranty of any kind. Model output can
          be wrong, and generated code should be reviewed like any other contribution. Keep your
          work under version control and review diffs before approving them.
        </p>
      </section>

      <section>
        <h2>Models and third-party services</h2>
        <p>
          Models you run through Ollama, and any service you choose to connect, are governed by
          their own terms and licences. We do not control and are not responsible for them.
        </p>
      </section>

      <section>
        <h2>This website</h2>
        <p>
          Product information here is provided for orientation and may change as the app evolves.
          Material may be served by advertising partners in the future; see{' '}
          <a className="text-accent-soft underline underline-offset-2" href="/privacy/">
            the privacy page
          </a>{' '}
          for what that means for your data.
        </p>
      </section>
    </LegalPage>
  );
}
