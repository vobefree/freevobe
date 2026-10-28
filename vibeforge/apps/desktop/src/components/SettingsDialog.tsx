import { useState } from 'react';
import { PERMISSION_DESCRIPTIONS, PERMISSION_LABELS, formatBytes } from '../lib/format';
import { useAppStore } from '../store/appStore';
import { Button, Chip, Field, Modal, Toggle } from './ui';
import { AD_INTERVAL_PROMPTS, PERMISSION_MODES, type AdsConfig } from '@vibeforge/protocol';

export function SettingsDialog() {
  const settings = useAppStore((state) => state.settings);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen);
  const refreshOllama = useAppStore((state) => state.refreshOllama);
  const models = useAppStore((state) => state.models);
  const ollama = useAppStore((state) => state.ollama);
  const [status, setStatus] = useState<string | null>(null);

  if (!settings) return null;

  const ads: AdsConfig = settings.ads;

  const patchAds = (patch: Partial<AdsConfig>) => updateSettings({ ads: { ...ads, ...patch } });

  const save = async (patch: Parameters<typeof updateSettings>[0], message: string) => {
    await updateSettings(patch);
    setStatus(message);
  };

  return (
    <Modal title="Inställningar" onClose={() => setSettingsOpen(false)} width="max-w-3xl">
      <div className="space-y-5">
        <section className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Ollama</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bas-URL" hint="OpenAI-kompatibelt API, t.ex. http://localhost:11434">
              <input
                defaultValue={settings.ollamaBaseUrl}
                onBlur={(event) =>
                  void save({ ollamaBaseUrl: event.target.value }, 'Bas-URL sparad.')
                }
                className="w-full rounded border border-steel bg-anvil px-2 py-1.5 font-mono text-xs text-slate-200"
              />
            </Field>
            <Field label="Standardmodell">
              <select
                value={settings.defaultModel}
                onChange={(event) =>
                  void save({ defaultModel: event.target.value }, 'Standardmodell sparad.')
                }
                className="w-full rounded border border-steel bg-anvil px-2 py-1.5 text-xs text-slate-200"
              >
                <option value={settings.defaultModel}>{settings.defaultModel}</option>
                {models
                  .filter((model) => model.name !== settings.defaultModel)
                  .map((model) => (
                    <option key={model.name} value={model.name}>
                      {model.name}
                    </option>
                  ))}
              </select>
            </Field>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => void refreshOllama(settings.ollamaBaseUrl)}>
              Upptäck modeller igen
            </Button>
            <span className="text-[11px] text-slate-500">
              {ollama?.available
                ? `${models.length} modeller · ${models.filter((model) => model.supportsTools).length} med tool calling`
                : 'Ollama svarar inte'}
            </span>
          </div>
          {models.length > 0 ? (
            <ul className="max-h-40 space-y-0.5 overflow-y-auto rounded border border-steel p-2">
              {models.map((model) => (
                <li
                  key={model.name}
                  className="flex items-center gap-2 text-[11.5px] text-slate-400"
                >
                  <span className="truncate font-mono text-slate-300">{model.name}</span>
                  <span className="ml-auto shrink-0">{formatBytes(model.sizeBytes)}</span>
                  <span className="shrink-0">{model.parameterSize}</span>
                  <span className="shrink-0">
                    {model.contextLength.toLocaleString('sv-SE')} tkn
                  </span>
                  {model.supportsTools ? (
                    <Chip tone="mint">verktyg</Chip>
                  ) : (
                    <Chip tone="alert">inget verktyg</Chip>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
            Agent och säkerhet
          </h3>
          <Field label="Behörighetsläge" hint={PERMISSION_DESCRIPTIONS[settings.permissionMode]}>
            <select
              value={settings.permissionMode}
              onChange={(event) =>
                void save(
                  { permissionMode: event.target.value as never },
                  'Behörighetsläge sparat.',
                )
              }
              className="w-full rounded border border-steel bg-anvil px-2 py-1.5 text-xs text-slate-200"
            >
              {PERMISSION_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {PERMISSION_LABELS[mode]}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Kontextbudget (tecken)"
              hint="Hur mycket kod som får skickas till modellen per anrop."
            >
              <input
                type="number"
                defaultValue={settings.contextBudgetChars}
                onBlur={(event) =>
                  void save(
                    { contextBudgetChars: Number(event.target.value) },
                    'Kontextbudget sparad.',
                  )
                }
                className="w-full rounded border border-steel bg-anvil px-2 py-1.5 text-xs text-slate-200"
              />
            </Field>
            <Field label="Max varv i agent-loopen">
              <input
                type="number"
                defaultValue={settings.maxIterations}
                onBlur={(event) =>
                  void save({ maxIterations: Number(event.target.value) }, 'Varvgräns sparad.')
                }
                className="w-full rounded border border-steel bg-anvil px-2 py-1.5 text-xs text-slate-200"
              />
            </Field>
          </div>
          <Toggle
            checked={settings.browserAutomationEnabled}
            onChange={(value) =>
              void save({ browserAutomationEnabled: value }, 'Webbläsarautomation uppdaterad.')
            }
            label="Tillåt webbläsarautomation (Playwright) – kräver alltid godkännande per åtgärd"
          />
          <Toggle
            checked={settings.allowCloudServices}
            onChange={(value) =>
              void save({ allowCloudServices: value }, 'Molntjänster uppdaterade.')
            }
            label="Tillåt att agenten använder molntjänster (avstängt = allt körs lokalt)"
          />
          <p className="rounded border border-steel p-2 text-[11px] text-slate-500">
            Telemetri är permanent avstängt i den här versionen (<code>telemetry: false</code>) och
            kan inte slås på från gränssnittet. Inga prompts, filer eller personuppgifter lämnar
            datorn utan ditt uttryckliga samtycke.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
            Annonsplats i chatten
          </h3>
          <Toggle
            checked={ads.enabled}
            onChange={(value) => void patchAds({ enabled: value })}
            label="Visa sponsorplats"
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Leverantör"
              hint="AdSense är avstängt i skrivbordsappen – använd egen plats."
            >
              <select
                value={ads.provider}
                onChange={(event) =>
                  void patchAds({ provider: event.target.value as AdsConfig['provider'] })
                }
                className="w-full rounded border border-steel bg-anvil px-2 py-1.5 text-xs text-slate-200"
              >
                <option value="none">Ingen</option>
                <option value="custom">Egen (custom)</option>
                <option value="adsense" disabled>
                  AdSense (avstängt i appen)
                </option>
              </select>
            </Field>
            <Field label="Visa efter var N:te prompt" hint={`Standard är ${AD_INTERVAL_PROMPTS}.`}>
              <input
                type="number"
                min={1}
                defaultValue={ads.everyNPrompts}
                onBlur={(event) =>
                  void patchAds({ everyNPrompts: Math.max(1, Number(event.target.value)) })
                }
                className="w-full rounded border border-steel bg-anvil px-2 py-1.5 text-xs text-slate-200"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Rubrik">
              <input
                defaultValue={ads.custom?.headline ?? ''}
                onBlur={(event) =>
                  void patchAds({
                    custom: { ...(ads.custom ?? defaultCustom()), headline: event.target.value },
                  })
                }
                className="w-full rounded border border-steel bg-anvil px-2 py-1.5 text-xs text-slate-200"
              />
            </Field>
            <Field label="Knapptext">
              <input
                defaultValue={ads.custom?.ctaLabel ?? ''}
                onBlur={(event) =>
                  void patchAds({
                    custom: { ...(ads.custom ?? defaultCustom()), ctaLabel: event.target.value },
                  })
                }
                className="w-full rounded border border-steel bg-anvil px-2 py-1.5 text-xs text-slate-200"
              />
            </Field>
          </div>
          <Field label="Länk (ctaUrl)">
            <input
              defaultValue={ads.custom?.ctaUrl ?? ''}
              onBlur={(event) =>
                void patchAds({
                  custom: { ...(ads.custom ?? defaultCustom()), ctaUrl: event.target.value },
                })
              }
              className="w-full rounded border border-steel bg-anvil px-2 py-1.5 font-mono text-xs text-slate-200"
            />
          </Field>
          <p className="text-[11px] text-slate-500">
            Annonsplatsen får bara ett tal som indata (antal prompter) och har ingen åtkomst till
            chattinnehåll.
          </p>
        </section>

        {status ? <p className="text-[11px] text-mint">{status}</p> : null}
      </div>
      <footer className="mt-4 flex justify-end">
        <Button variant="primary" onClick={() => setSettingsOpen(false)}>
          Stäng
        </Button>
      </footer>
    </Modal>
  );
}

function defaultCustom() {
  return {
    headline: 'Bygg snabbare med Freevobe Pro',
    body: 'Fler samtidiga agenter och team-minne – fortfarande helt lokalt.',
    ctaLabel: 'Läs mer',
    ctaUrl: 'https://freevobe.dev/pro',
  };
}
