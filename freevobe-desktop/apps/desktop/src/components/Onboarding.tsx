import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GIVES_BACK_INTERVAL_PROMPTS } from '@freevobe/protocol';
import { formatBytes } from '../lib/format';
import { useAppStore } from '../store/appStore';
import { Button, Chip, Field, Toggle } from './ui';
import { LanguageSelect } from './LanguageSelect';

const STEP_KEYS = [
  'ob.step.welcome',
  'ob.step.ollama',
  'ob.step.project',
  'ob.step.givesBack',
  'ob.step.done',
] as const;

export function Onboarding() {
  const { t } = useTranslation();
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
  const steps = STEP_KEYS.map((key) => t(key));

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
            <p className="text-xs text-slate-500">{t('ob.tagline')}</p>
          </div>
          <nav className="ml-auto flex items-center gap-1">
            {steps.map((label, index) => (
              <span
                key={label}
                title={label}
                className={`h-1.5 w-6 rounded-full ${index <= step ? 'bg-ember' : 'bg-steel'}`}
              />
            ))}
          </nav>
          <LanguageSelect showLabel />
        </header>

        {step === 0 ? (
          <section className="space-y-3 text-sm text-slate-300">
            <h2 className="text-base font-semibold text-slate-100">{t('ob.how.title')}</h2>
            <ul className="space-y-1.5 text-[13px] text-slate-400">
              <li>• {t('ob.how.b1')}</li>
              <li>• {t('ob.how.b2')}</li>
              <li>• {t('ob.how.b3')}</li>
              <li>• {t('ob.how.b4')}</li>
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
                <span className="font-medium text-slate-200">{t('ob.consent.local.title')}</span>
                <span className="block text-[11px] text-slate-500">
                  {t('ob.consent.local.hint')}
                </span>
              </span>
            </label>
          </section>
        ) : null}

        {step === 1 ? (
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-100">{t('ob.ollama.title')}</h2>
            <p className="text-[13px] text-slate-400">{t('ob.ollama.body')}</p>
            <p className="text-[11.5px] text-slate-500">{t('ob.ollama.skipHint')}</p>
            {ollama?.available ? (
              <>
                <p className="text-xs text-mint">
                  {ollama.version
                    ? t('ob.ollama.detected', {
                        version: ollama.version,
                        count: models.length,
                      })
                    : t('ob.ollama.detectedNoVersion', { count: models.length })}
                </p>
                <Field label={t('ob.ollama.activeModel')} hint={t('ob.ollama.activeModelHint')}>
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
                    <Chip>{t('ob.ollama.tokens', { count: activeModel.contextLength })}</Chip>
                    <Chip tone={activeModel.supportsTools ? 'mint' : 'alert'}>
                      {activeModel.supportsTools ? t('ob.ollama.hasTools') : t('ob.ollama.noTools')}
                    </Chip>
                  </div>
                ) : null}
                {activeModel && !activeModel.supportsTools ? (
                  <p className="rounded border border-ember/40 bg-ember/10 p-2 text-[11.5px] text-ember">
                    {t('ob.ollama.noToolsWarning')}
                  </p>
                ) : null}
              </>
            ) : (
              <div className="space-y-2 rounded border border-alert/40 bg-alert/10 p-3 text-[12.5px] text-alert">
                <p>{ollama?.error ?? t('ob.ollama.unreachable')}</p>
                <div className="flex gap-2">
                  <Button onClick={() => void refreshOllama()} className="border-alert/50">
                    {t('ob.ollama.checkAgain')}
                  </Button>
                  <a
                    className="vf-button border-alert/50"
                    href={ollama?.helpUrl ?? 'https://freevobe.dev/docs/ollama'}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {t('ob.ollama.help')}
                  </a>
                </div>
              </div>
            )}
          </section>
        ) : null}

        {step === 2 ? (
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-100">{t('ob.project.title')}</h2>
            <p className="text-[13px] text-slate-400">{t('ob.project.body')}</p>
            <Field label={t('ob.project.path')}>
              <input
                value={path}
                onChange={(event) => setPath(event.target.value)}
                placeholder={t('ob.project.placeholder')}
                data-testid="project-path"
                className="w-full rounded border border-steel bg-anvil px-2 py-1.5 font-mono text-sm text-slate-200"
              />
            </Field>
            {project ? (
              <p className="text-xs text-mint">{t('ob.project.opened', { name: project.name })}</p>
            ) : null}
            <p className="text-[11px] text-slate-500">{t('ob.project.skip')}</p>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-100">{t('ob.gives.title')}</h2>
            <p className="text-[13px] text-slate-400">{t('ob.gives.body')}</p>
            <ul className="space-y-1 rounded border border-steel p-3 text-[11.5px] text-slate-500">
              <li>• {t('ob.gives.b1')}</li>
              <li>• {t('ob.gives.b2')}</li>
              <li>• {t('ob.gives.b3')}</li>
              <li>• {t('ob.gives.b4')}</li>
              <li>• {t('ob.gives.b5')}</li>
            </ul>
            <Toggle
              checked={consentGivesBack}
              onChange={(value) => setConsent({ givesBack: value })}
              label={t('ob.gives.toggle')}
            />
            <p className="text-[11px] text-slate-600">{t('ob.gives.footnote')}</p>
          </section>
        ) : null}

        {step === 4 ? (
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-100">{t('ob.done.title')}</h2>
            <ul className="space-y-1.5 text-[13px] text-slate-400">
              <li>• {t('ob.done.t1')}</li>
              <li>• {t('ob.done.t2')}</li>
              <li>• {t('ob.done.t3')}</li>
              <li>• {t('ob.done.t4')}</li>
            </ul>
            <p className="text-[11.5px] text-slate-500">{t('ob.done.autoUpdate')}</p>
          </section>
        ) : null}

        <footer className="mt-5 flex items-center gap-2 border-t border-steel pt-3">
          {step > 0 ? (
            <Button onClick={() => setStep(step - 1)} disabled={busy}>
              {t('ob.back')}
            </Button>
          ) : null}
          <span className="text-[11px] text-slate-600">
            {t('ob.stepCounter', {
              current: step + 1,
              total: steps.length,
              label: steps[step],
            })}
          </span>
          <div className="ml-auto flex gap-2">
            {step === 1 && !ollama?.available ? (
              <Button onClick={() => setStep(step + 1)} testId="onboarding-skip-ollama">
                {t('ob.skip')}
              </Button>
            ) : null}
            {step < steps.length - 1 ? (
              <Button
                variant="primary"
                onClick={() => void next()}
                disabled={(step === 0 && !consentLocalData) || busy}
                testId="onboarding-next"
              >
                {busy ? t('ob.indexing') : t('ob.next')}
              </Button>
            ) : (
              <Button variant="primary" onClick={() => void finish()} testId="onboarding-finish">
                {t('ob.start')}
              </Button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
