'use client';

import { useEffect, useRef, useState } from 'react';
import { buildWorld, compileWorld } from '@/lib/learn/compile';
import { MAX_INPUT_LENGTH } from '@/lib/learn/describe';
import {
  EMPTY_PROGRESS,
  bestRecord,
  markLessonDone,
  readProgress,
  recordWin,
  worldKey,
  writeProgress,
  type LearnProgress,
  type ProgressStorage,
} from '@/lib/learn/progress';
import type { CompileResult } from '@/lib/learn/types';
import { LessonsSection } from './lessons-section';
import { WorldCanvas } from './world-canvas';
import { WorldDescription } from './world-description';

const EXAMPLES = [
  { label: 'Skog och katt', text: 'En mörk skog med en katt, tre stjärnor och lava' },
  { label: 'Rymd och robot', text: 'Rymden med en robot som heter Månen och fem mynt' },
  { label: 'Hav och fisk', text: 'Havet med en fisk, fyra snäckor och vågor' },
  { label: 'Godis och kanin', text: 'Ett godisland med en kanin och åtta godisbitar' },
] as const;

function getStorage(): ProgressStorage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function LearnApp() {
  const [text, setText] = useState<string>(EXAMPLES[0].text);
  const [result, setResult] = useState<CompileResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [round, setRound] = useState(0);
  const [progress, setProgress] = useState<LearnProgress>(EMPTY_PROGRESS);
  const [loaded, setLoaded] = useState(false);
  const [storageNote, setStorageNote] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const playRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setProgress(readProgress(getStorage()));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (!writeProgress(getStorage(), progress)) {
      setStorageNote('Rekordet kunde inte sparas i den här webbläsaren. Spelet fungerar ändå.');
    }
  }, [progress, loaded]);

  const scrollToPlay = () => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    playRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  const build = (value: string) => {
    const compiled = compileWorld(value);
    setResult(compiled);
    setAttempt(0);
    setRound((current) => current + 1);
    if (compiled.ok) window.setTimeout(scrollToPlay, 60);
  };

  const newMap = () => {
    if (!result) return;
    const nextAttempt = attempt + 1;
    const rebuilt = buildWorld(result.interpretation.spec, nextAttempt);
    setAttempt(nextAttempt);
    setRound((current) => current + 1);
    setResult(
      rebuilt.ok
        ? {
            ok: true,
            interpretation: result.interpretation,
            world: rebuilt.world,
            issues: rebuilt.issues,
          }
        : { ok: false, interpretation: result.interpretation, issues: rebuilt.issues },
    );
  };

  const world = result?.ok ? result.world : null;
  const key = world ? worldKey(world.spec) : null;
  const best = key ? bestRecord(progress, key) : null;

  return (
    <div className="learn" lang="sv">
      <noscript>
        <div className="border-b border-[color:var(--learn-line)] bg-[color:var(--learn-panel)] px-5 py-3 text-center text-[13px]">
          Kartan ritas i din webbläsare och behöver JavaScript. Utan JavaScript kan du läsa
          lektionerna i källkoden i stället.
        </div>
      </noscript>
      <div className="vf-shell py-12 lg:py-16">
        <header className="max-w-3xl">
          <p className="font-mono text-[11.5px] tracking-[0.08em] text-[color:var(--learn-gold)]">
            Learn How to Vobe
          </p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">
            Gör en värld. Spela den. Se koden.
          </h1>
          <p className="mt-4 text-[16px] leading-relaxed text-[color:var(--learn-muted)]">
            Skriv en plats, en hjälte och något att hämta. Appen gör om orden till en karta som du
            kan gå omkring i – och visar sedan koden som byggde den, med din värld som exempel.
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-[color:var(--learn-muted)]">
            Allt sker i din webbläsare. Ordlistan, kartan och kontrollen är kod som laddas med
            sidan: ingen modell, ingen server, ingen inloggning.
          </p>
        </header>

        <div className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              build(text);
            }}
            className="learn-panel h-fit p-5 shadow-[6px_6px_0_var(--learn-shadow)] sm:p-6"
          >
            <div className="flex items-center gap-2">
              <span className="rounded-md border border-[color:var(--learn-line-strong)] px-1.5 py-0.5 font-mono text-[11px] text-[color:var(--learn-muted)]">
                1
              </span>
              <h2 className="text-lg font-bold tracking-tight">Beskriv din värld</h2>
            </div>

            <label htmlFor="learn-world-input" className="mt-3 block text-[13px] font-semibold">
              Vad finns i världen?
            </label>
            <textarea
              id="learn-world-input"
              ref={textareaRef}
              data-testid="learn-input"
              value={text}
              onChange={(event) => setText(event.target.value.slice(0, MAX_INPUT_LENGTH))}
              rows={4}
              spellCheck={false}
              className="mt-1.5 w-full resize-y rounded-xl border-2 border-[color:var(--learn-line-strong)] bg-[color:var(--learn-panel-strong)] px-3 py-2.5 text-[15px] leading-relaxed outline-none focus:border-[color:var(--learn-gold)]"
              placeholder="En mörk skog med en katt, tre stjärnor och lava"
            />
            <div className="mt-1 flex items-center justify-between text-[11.5px] text-[color:var(--learn-muted)]">
              <span>Plats, hjälte, skatt, hinder och mål – allt är frivilligt.</span>
              <span className="font-mono">
                {text.length}/{MAX_INPUT_LENGTH}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {EXAMPLES.map((example) => (
                <button
                  key={example.label}
                  type="button"
                  className="learn-chip"
                  title={example.text}
                  onClick={() => {
                    setText(example.text);
                    build(example.text);
                  }}
                >
                  {example.label}
                </button>
              ))}
            </div>

            <button
              type="submit"
              data-testid="learn-build"
              className="learn-button learn-button-primary mt-4 w-full !py-2.5 !text-[15px]"
            >
              Bygg min värld
            </button>
            <p className="mt-2 text-[11.5px] leading-relaxed text-[color:var(--learn-muted)]">
              Orden tolkas av en ordlista som ligger i sidan. Ingenting skickas vidare.
            </p>
          </form>

          <div data-testid="learn-result">
            {result ? (
              <WorldDescription
                interpretation={result.interpretation}
                world={world}
                issues={result.issues}
              />
            ) : (
              <div className="learn-panel flex h-full min-h-64 flex-col justify-center gap-2 p-6">
                <p className="font-mono text-[11px] tracking-[0.08em] text-[color:var(--learn-muted)]">
                  Världsbeskrivning
                </p>
                <p className="text-[15px] leading-relaxed">
                  Här hamnar din värld: namn, hjälte, skatter, hinder och en karta som redan är
                  kontrollerad. Tryck på <span className="font-semibold">Bygg min värld</span>.
                </p>
              </div>
            )}
          </div>
        </div>

        {world ? (
          <section ref={playRef} className="mt-12 scroll-mt-20">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md border border-[color:var(--learn-line-strong)] px-1.5 py-0.5 font-mono text-[11px] text-[color:var(--learn-muted)]">
                    2
                  </span>
                  <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Spela</h2>
                </div>
                <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-[color:var(--learn-muted)]">
                  Hämta alla skatter ({world.treasures.length}) och gå sedan till målet. Målet är
                  låst så länge något finns kvar.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={newMap} data-testid="learn-new-map" className="learn-button learn-button-secondary">
                  Ny karta
                </button>
                <button
                  type="button"
                  onClick={() => {
                    textareaRef.current?.focus();
                    textareaRef.current?.scrollIntoView({ block: 'center' });
                  }}
                  className="learn-button learn-button-secondary"
                >
                  Ändra beskrivning
                </button>
              </div>
            </div>

            <div className="mt-4" data-testid="learn-play">
              <WorldCanvas
                key={`${key}-${attempt}-${round}`}
                world={world}
                best={best}
                onWin={(stats) => setProgress((current) => recordWin(current, worldKey(world.spec), stats))}
              />
            </div>

            {storageNote ? (
              <p className="mt-2 text-[12px] text-[color:var(--learn-coral)]">{storageNote}</p>
            ) : null}
          </section>
        ) : null}

        <div className="mt-14">
          <LessonsSection
            world={world}
            progress={progress}
            onLessonDone={(lessonId) =>
              setProgress((current) => markLessonDone(current, lessonId))
            }
          />
        </div>

        <footer className="mt-12 border-t border-[color:var(--learn-line)] pt-5 text-[12.5px] leading-relaxed text-[color:var(--learn-muted)]">
          <p>
            Sidan har ingen server och inget konto. Kartan byggs av regler i din webbläsare,
            kontrolleras av <span className="font-mono">validateWorld</span> och ritas på en
            canvas. Ditt rekord sparas bara i localStorage på din dator.
          </p>
        </footer>
      </div>
    </div>
  );
}
