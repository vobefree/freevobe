import type { Metadata } from 'next';
import { AdSlot } from '@/components/AdSlot';
import { DOWNLOADS } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Ladda ner',
  description: 'Ladda ner VibeForge för Windows, macOS och Linux, eller bygg från källkoden.',
};

export default function DownloadPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold">Ladda ner VibeForge</h1>
        <p className="max-w-2xl text-slate-400">
          Appen startar en lokal agent på 127.0.0.1 och pratar med Ollama på din dator. Den här
          versionen är den första MVP:n – installationsfilerna byggs från källkoden tills
          release-servern och signeringen är konfigurerade.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        {DOWNLOADS.map((target) => (
          <article key={target.platform} className="vf-card p-5">
            <h2 className="text-sm font-semibold text-slate-100">{target.platform}</h2>
            <p className="mt-1 font-mono text-xs text-slate-400">{target.format}</p>
            <p className="mt-2 text-[13px] text-slate-500">{target.note}</p>
            <p className="mt-3 text-[11px] text-spark">
              {target.available
                ? 'Tillgänglig nu'
                : 'Byggs från källkoden – se instruktionerna nedan'}
            </p>
          </article>
        ))}
      </section>

      <section className="vf-card space-y-3 p-6">
        <h2 className="text-lg font-semibold">Bygg från källkoden</h2>
        <p className="text-[13px] text-slate-400">
          Du behöver Node 22.5 eller senare, Rust (för Tauri) och Ollama. Plattformsberoenden för
          Tauri finns i dokumentationen.
        </p>
        <pre className="overflow-x-auto rounded-md border border-steel bg-anvil p-3 font-mono text-[11.5px] text-slate-300">
          {`git clone https://github.com/vibeforge/vibeforge.git
cd vibeforge
npm install
npm run icons           # genererar appikoner
npm run tauri build     # .exe, .dmg eller .AppImage/.deb`}
        </pre>
        <p className="text-[12px] text-slate-500">
          Vill du bara köra appen under utveckling:{' '}
          <code className="font-mono text-slate-300">npm run dev</code> startar agenten och
          skrivbordsgränssnittet.
        </p>
      </section>

      <section className="vf-card space-y-2 p-6">
        <h2 className="text-lg font-semibold">Vad som ännu inte är klart</h2>
        <ul className="space-y-1 text-[13px] text-slate-400">
          <li>• Signering av binärer (Windows Authenticode, Apple notarization).</li>
          <li>
            • Automatisk uppdatering – koden är förberedd men avstängd tills release-servern finns.
          </li>
          <li>• Pro-funktioner (team-minne, delade skills mellan projekt).</li>
        </ul>
        <p className="text-[12px] text-slate-500">Alla punkter finns som TODO i repots README.</p>
      </section>

      <AdSlot label="Sponsrat" />
    </div>
  );
}
