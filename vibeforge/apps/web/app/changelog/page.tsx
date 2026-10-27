import type { Metadata } from 'next';
import { CHANGELOG } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Changelog',
  description: 'Vad som ändrats i VibeForge mellan versioner.',
};

export default function ChangelogPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold">Changelog</h1>
        <p className="max-w-2xl text-slate-400">
          Varje version beskriver vad som blivit bättre och vilka begränsningar som finns kvar.
        </p>
      </header>

      <div className="space-y-4">
        {CHANGELOG.map((entry) => (
          <section key={entry.version} className="vf-card p-6">
            <div className="flex items-baseline gap-3">
              <h2 className="font-mono text-lg text-ember">v{entry.version}</h2>
              <span className="text-xs text-slate-600">{entry.date}</span>
            </div>
            <ul className="mt-3 space-y-1.5">
              {entry.highlights.map((highlight) => (
                <li key={highlight} className="text-[13.5px] text-slate-400">
                  • {highlight}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
