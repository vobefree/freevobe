import { useEffect, useState } from 'react';
import { GIVES_BACK_INTERVAL_PROMPTS } from '@freevobe/protocol';
import { formatBytes } from '../lib/format';
import { useAppStore } from '../store/appStore';
import { Button, Chip, Field, Toggle } from './ui';

const STEPS = ['Välkommen', 'Ollama', 'Projekt', 'Gives Back', 'Klart'] as const;

export function Onboarding() {
  const step = useAppStore((state) => state.onboardingStep);
  const setStep = useAppStore((state) => state.setOnboardingStep);
  const consentLocalData = useAppStore((state) => state.consentLocalData);
  const consentGivesBack = useAppStore((state) => state.consentGivesBack);
  const setConsent = useAppStore((state) => state.setConsent);
  const finishOnboarding = useAppStore((state) => state.finishOnboarding);
  const ollama = useAppStore((state) => state.ollama);
  const models = useAppStore((state) => state.models);
  const selectedModel = useAppStore((state) => state.selectedModel);
  const selectModel = useAppStore((state) => state.selectModel);
  const refreshOllama = useAppStore((state) => state.refreshOllama);
  const openProject = useAppStore((state) => state.openProject);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const project = useAppStore((state) => state.project);
  const [path, setPath] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (step === 1 && !ollama) void refreshOllama();
  }, [step, ollama, refreshOllama]);

  const activeModel = models.find((model) => model.name === selectedModel);

  const next = async () => {
    if (step === 2 && path.trim() && !project) {
      setBusy(true);
      await openProject(path.trim());
      setBusy(false);
    }
    setStep(step + 1);
  };

  const finish = async () => {
    await updateSettings({
      givesBack: {
        enabled: consentGivesBack,
        everyNPrompts: GIVES_BACK_INTERVAL_PROMPTS,
        causeIds: [],
        ...(consentGivesBack ? { consentedAt: Date.now() } : {}),
      },
    });
    finishOnboarding();
  };

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="vf-panel w-full max-w-2xl p-6" data-testid="onboarding">
        <header className="mb-4 flex items-center gap-3">
          <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 3h7l3 6-3 6H4l3-6z" fill="var(--color-ember)" />
            <path d="M13 21h7l-3-6h-7z" fill="var(--color-spark)" opacity="0.9" />
          </svg>
          <div>
            <h1 className="text-lg font-semibold">
              Free<span className="text-ember">vobe</span>
            </h1>
            <p className="text-xs text-slate-500">
              Lokal-first vibecoding med Ollama – koden stannar på din dator.
            </p>
          </div>
          <nav className="ml-auto flex items-center gap-1">
            {STEPS.map((label, index) => (
              <span
                key={label}
                title={label}
                className={`h-1.5 w-6 rounded-full ${index <= step ? 'bg-ember' : 'bg-steel'}`}
              />
            ))}
          </nav>
        </header>

        {step === 0 ? (
          <section className="space-y-3 text-sm text-slate-300">
            <h2 className="text-base font-semibold text-slate-100">Så fungerar det</h2>
            <ul className="space-y-1.5 text-[13px] text-slate-400">
              <li>• Freevobe kör en lokal agent som läser och skriver kod i dina projektmappar.</li>
              <li>
                • Modellen körs via Ollama på din dator. Ingen kod skickas någonstans om du inte
                själv aktiverar en molntjänst.
              </li>
              <li>
                • Varje filändring visas som en diff innan den sparas, och varje kommando kräver
                ditt godkännande.
              </li>
              <li>• Ingen telemetri. Ingen inloggning. Ingen molnkonto behövs.</li>
            </ul>
            <label className="flex cursor-pointer items-start gap-2 rounded border border-steel p-3 text-[13px]">
              <input
                type="checkbox"
                checked={consentLocalData}
                onChange={(event) => setConsent({ localData: event.target.checked })}
                className="mt-0.5"
                data-testid="consent-local"
              />
              <span>
                <span className="font-medium text-slate-200">
                  Jag förstår att appen läser och skriver filer lokalt.
                </span>
                <span className="block text-[11px] text-slate-500">
                  Sessioner, minne och projektindex sparas i en lokal SQLite-databas. Du kan radera
                  allt via inställningarna.
                </span>
              </span>
            </label>
          </section>
        ) : null}

        {step === 1 ? (
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-100">Anslut Ollama</h2>
            <p className="text-[13px] text-slate-400">
              Freevobe letar automatiskt efter http://localhost:11434. Starta Ollama och tryck på
              Kontrollera igen om listan är tom.
            </p>
            <p className="text-[11.5px] text-slate-500">
              Du kan hoppa över det här steget och titta runt i appen direkt. Projekt, editor,
              skills och inställningar fungerar utan modell – bara chatten väntar på Ollama, och du
              kan ansluta när du vill.
            </p>
            {ollama?.available ? (
              <>
                <p className="text-xs text-mint">
                  Ollama svarar {ollama.version ? `(v${ollama.version})` : ''} – {models.length}{' '}
                  modeller hittades.
                </p>
                <Field label="Aktiv modell" hint="Spara senast använda modell per projekt.">
                  <select
                    value={selectedModel}
                    onChange={(event) => selectModel(event.target.value)}
                    className="w-full rounded border border-steel bg-anvil px-2 py-1.5 text-sm text-slate-200"
                  >
                    {models.map((model) => (
                      <option key={model.name} value={model.name}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                </Field>
                {activeModel ? (
                  <div className="flex flex-wrap gap-1.5">
                    <Chip>{formatBytes(activeModel.sizeBytes)}</Chip>
                    <Chip>{activeModel.parameterSize}</Chip>
                    <Chip>{activeModel.contextLength.toLocaleString('sv-SE')} tokens kontext</Chip>
                    <Chip tone={activeModel.supportsTools ? 'mint' : 'alert'}>
                      {activeModel.supportsTools ? 'tool calling' : 'saknar tool calling'}
                    </Chip>
                  </div>
                ) : null}
                {activeModel && !activeModel.supportsTools ? (
                  <p className="rounded border border-ember/40 bg-ember/10 p-2 text-[11.5px] text-ember">
                    Den här modellen kan inte anropa verktyg. Chatten fungerar, men agenten kan inte
                    läsa eller ändra filer. Välj en modell med tool calling, t.ex. qwen2.5-coder
                    eller llama3.1.
                  </p>
                ) : null}
              </>
            ) : (
              <div className="space-y-2 rounded border border-alert/40 bg-alert/10 p-3 text-[12.5px] text-alert">
                <p>{ollama?.error ?? 'Ollama svarar inte på localhost:11434.'}</p>
                <div className="flex gap-2">
                  <Button onClick={() => void refreshOllama()} className="border-alert/50">
                    Kontrollera igen
                  </Button>
                  <a
                    className="vf-button border-alert/50"
                    href={ollama?.helpUrl ?? 'https://freevobe.dev/docs/ollama'}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Öppna hjälp
                  </a>
                </div>
              </div>
            )}
          </section>
        ) : null}

        {step === 2 ? (
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-100">Välj projekt</h2>
            <p className="text-[13px] text-slate-400">
              Ange sökvägen till mappen du vill arbeta i. Freevobe indexerar koden lokalt för att
              kunna hitta rätt filer.
            </p>
            <Field label="Projektmapp">
              <input
                value={path}
                onChange={(event) => setPath(event.target.value)}
                placeholder="C:\\kod\\mitt-projekt"
                data-testid="project-path"
                className="w-full rounded border border-steel bg-anvil px-2 py-1.5 font-mono text-sm text-slate-200"
              />
            </Field>
            {project ? <p className="text-xs text-mint">Öppnade {project.name}.</p> : null}
            <p className="text-[11px] text-slate-500">
              Du kan hoppa över det här och öppna ett projekt senare.
            </p>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-100">Freevobe Gives Back</h2>
            <p className="text-[13px] text-slate-400">
              I stället för reklam kan Freevobe påminna om ett välgörenhetsändamål. Det är helt
              frivilligt, av som standard och kan slås av när som helst i inställningarna.
            </p>
            <ul className="space-y-1 rounded border border-steel p-3 text-[11.5px] text-slate-500">
              <li>• Påminnelsen visas i ett eget block, aldrig som ett AI-svar.</li>
              <li>• Den påverkar aldrig modellens svar, kontext eller agentens beslut.</li>
              <li>• Inga prompts, filer eller projektuppgifter lämnar datorn.</li>
              <li>
                • Freevobe tar inte emot pengar – du ger direkt till organisationens egen sida.
              </li>
              <li>
                • Vill du anteckna ett bidrag sparas det bara lokalt, märkt som egen rapportering.
              </li>
            </ul>
            <Toggle
              checked={consentGivesBack}
              onChange={(value) => setConsent({ givesBack: value })}
              label="Visa Gives Back efter var 10:e prompt (du kan ändra intervallet senare)"
            />
            <p className="text-[11px] text-slate-600">
              Inget händer om du hoppar över det här. Appen fungerar likadant.
            </p>
          </section>
        ) : null}

        {step === 4 ? (
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-100">Klart att smida</h2>
            <ul className="space-y-1.5 text-[13px] text-slate-400">
              <li>• Ctrl/Cmd+Enter skickar din prompt.</li>
              <li>• Ctrl/Cmd+K öppnar kommandopaletten.</li>
              <li>• Ctrl/Cmd+B växlar vänsterpanelen.</li>
              <li>
                • Doctor-knappen i toppraden kontrollerar Node, Git, Ollama, modell och
                behörigheter.
              </li>
            </ul>
            <p className="text-[11.5px] text-slate-500">
              Auto-uppdatering är förberedd men avstängt tills en release-server är konfigurerad. Se
              TODO i README.
            </p>
          </section>
        ) : null}

        <footer className="mt-5 flex items-center gap-2 border-t border-steel pt-3">
          {step > 0 ? (
            <Button onClick={() => setStep(step - 1)} disabled={busy}>
              Tillbaka
            </Button>
          ) : null}
          <span className="text-[11px] text-slate-600">
            Steg {step + 1} av {STEPS.length} · {STEPS[step]}
          </span>
          <div className="ml-auto flex gap-2">
            {step === 1 && !ollama?.available ? (
              <Button onClick={() => setStep(step + 1)} testId="onboarding-skip-ollama">
                Hoppa över
              </Button>
            ) : null}
            {step < STEPS.length - 1 ? (
              <Button
                variant="primary"
                onClick={() => void next()}
                disabled={(step === 0 && !consentLocalData) || busy}
                testId="onboarding-next"
              >
                {busy ? 'Indexerar…' : 'Nästa'}
              </Button>
            ) : (
              <Button variant="primary" onClick={() => void finish()} testId="onboarding-finish">
                Starta Freevobe
              </Button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
