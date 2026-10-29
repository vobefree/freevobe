import type { Metadata } from 'next';
import { GivesBackSlot } from '@/components/GivesBackSlot';
import {
  ALL_RELEASES_URL,
  RELEASE_ASSETS,
  RELEASE_PAGE_URL,
  RELEASE_SHA256,
  RELEASE_TAG,
  assetUrl,
} from '@/lib/releases';

export const metadata: Metadata = {
  title: 'Ladda ner',
  description: `Ladda ner Freevobe ${RELEASE_TAG} för Windows, macOS, Linux och Android – med SHA-256-summa för varje fil så att du kan kontrollera nedladdningen.`,
};

const CHECK_COMMANDS = `# macOS och Linux (byt ut filnamnet mot filen du hämtade)
shasum -a 256 Freevobe_${RELEASE_TAG}_x64-setup.exe

# Windows (PowerShell)
(Get-FileHash .\\Freevobe_${RELEASE_TAG}_x64-setup.exe -Algorithm SHA256).Hash`;

export default function DownloadPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold">Ladda ner Freevobe</h1>
        <p className="max-w-2xl text-slate-400">
          Senaste versionen är <span className="font-mono text-slate-300">{RELEASE_TAG}</span>.
          Appen startar en lokal agent på 127.0.0.1 och pratar med Ollama på din dator. Alla filer
          nedan kommer från samma release, och varje fil har en SHA-256-summa du kan kontrollera.
        </p>
        <p className="text-[13px] text-slate-500">
          Du behöver Ollama för att chatten ska svara, men appen går att starta och titta runt i
          redan innan du kopplar upp den.
        </p>
      </header>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {RELEASE_ASSETS.map((asset) => (
          <article key={asset.id} className="vf-card flex flex-col gap-2 p-5" data-asset={asset.id}>
            <h2 className="text-sm font-semibold text-slate-100">
              {asset.platform}{' '}
              <span className="font-normal text-slate-400">{asset.architecture}</span>
            </h2>
            <p className="font-mono text-[11px] break-all text-spark">{asset.file}</p>
            <p className="text-[12px] text-slate-500">{asset.requirement}</p>
            <a
              className="mt-auto inline-flex w-fit rounded-md bg-ember px-3 py-1.5 text-sm font-semibold text-anvil hover:brightness-110"
              href={assetUrl(asset.file)}
            >
              Ladda ner
            </a>
          </article>
        ))}
      </section>{' '}
      <section className="vf-card space-y-3 p-6">
        <h2 className="text-lg font-semibold">Kontrollera nedladdningen</h2>
        <p className="text-[13px] text-slate-400">
          Varje fil i releasen har en SHA-256-summa. Räkna ut summan för filen du hämtade och jämför
          med raden nedan – stämmer den inte är filen inte den som byggdes.
        </p>
        <ul className="space-y-2">
          {RELEASE_ASSETS.map((asset) => (
            <li key={asset.id} className="rounded border border-steel p-2.5">
              <p className="font-mono text-[11px] break-all text-slate-300">{asset.file}</p>
              <p className="mt-1 font-mono text-[11px] break-all text-spark">
                {RELEASE_SHA256[asset.file] ?? 'Summa saknas för den här filen.'}
              </p>
            </li>
          ))}
        </ul>
        <pre className="overflow-x-auto rounded-md border border-steel bg-anvil p-3 font-mono text-[11.5px] text-slate-300">
          {CHECK_COMMANDS}
        </pre>
      </section>
      <section className="vf-card space-y-2 p-6">
        <h2 className="text-lg font-semibold">Innan du kör första gången</h2>
        <ul className="space-y-1 text-[13px] text-slate-400">
          <li>
            • Byggena signeras och notariseras när certifikaten är konfigurerade i CI. Saknas de
            varnar Windows SmartScreen eller macOS Gatekeeper vid första starten – filen är då
            osignerad, inte skadlig.
          </li>
          <li>
            • Automatisk uppdatering är förberedd men avstängd tills en release-server är
            konfigurerad. Nya versioner hämtas manuellt härifrån.
          </li>{' '}
          <li>
            • APK:n kräver att skrivbordsappen körs på samma nätverk och att du parar ihop dem.
          </li>
        </ul>
        <p className="text-[12px] text-slate-500">
          Hela listan med äldre versioner finns på{' '}
          <a className="text-spark hover:text-ember" href={ALL_RELEASES_URL}>
            GitHub Releases
          </a>
          , och vad som ändrats står i{' '}
          <a className="text-spark hover:text-ember" href="/changelog/">
            changeloggen
          </a>
          .
        </p>
      </section>
      <section className="vf-card space-y-3 p-6">
        <h2 className="text-lg font-semibold">Bygg från källkoden</h2>
        <p className="text-[13px] text-slate-400">
          Du behöver Node 22.5 eller senare, Rust (för Tauri) och Ollama. Plattformsberoenden för
          Tauri finns i dokumentationen.
        </p>
        <pre className="overflow-x-auto rounded-md border border-steel bg-anvil p-3 font-mono text-[11.5px] text-slate-300">
          {`git clone https://github.com/vobefree/freevobe.git
cd freevobe/freevobe
npm install
npm run icons           # genererar appikoner
npm run tauri build     # .exe, .dmg eller .AppImage/.deb`}
        </pre>
        <p className="text-[12px] text-slate-500">
          Vill du bara köra appen under utveckling:{' '}
          <code className="font-mono text-slate-300">npm run dev</code> startar agenten och
          skrivbordsgränssnittet. Releasen ovan byggs av{' '}
          <a className="text-spark hover:text-ember" href={RELEASE_PAGE_URL}>
            samma workflow
          </a>
          .
        </p>
      </section>
      <GivesBackSlot />
    </div>
  );
}
