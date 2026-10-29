import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AUTO_APPROVE_LABELS,
  PERMISSION_DESCRIPTIONS,
  PERMISSION_LABELS,
  formatBytes,
} from '../lib/format';
import { useAppStore } from '../store/appStore';
import { AutoApproveSettings } from './AutoApproveSettings';
import { ConnectorsSection } from './ConnectorsSection';
import { LanguageSelect } from './LanguageSelect';
import { Button, Chip, Field, Modal, Toggle } from './ui';
import {
  GIVES_BACK_CAUSES,
  GIVES_BACK_INTERVAL_PROMPTS,
  PERMISSION_MODES,
  formatSek,
  resolveCauses,
  type GivesBackConfig,
} from '@freevobe/protocol';

export function SettingsDialog() {
  const { t } = useTranslation();
  const settings = useAppStore((state) => state.settings);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen);
  const refreshOllama = useAppStore((state) => state.refreshOllama);
  const models = useAppStore((state) => state.models);
  const ollama = useAppStore((state) => state.ollama);
  const contributionsSummary = useAppStore((state) => state.contributionsSummary);
  const [status, setStatus] = useState<string | null>(null);

  if (!settings) return null;

  const givesBack: GivesBackConfig = settings.givesBack;
  const selectedCauses = resolveCauses(givesBack.causeIds);

  const patchGivesBack = (patch: Partial<GivesBackConfig>) =>
    updateSettings({ givesBack: { ...givesBack, ...patch } });

  const toggleCause = (id: string) => {
    const next = givesBack.causeIds.includes(id)
      ? givesBack.causeIds.filter((entry) => entry !== id)
      : [...givesBack.causeIds, id];
    // Tom lista betyder hela katalogen, så ett fullt urval sparas som tomt.
    void patchGivesBack({
      causeIds: next.length === GIVES_BACK_CAUSES.length ? [] : next,
    });
  };

  const save = async (patch: Parameters<typeof updateSettings>[0], message: string) => {
    await updateSettings(patch);
    setStatus(message);
  };

  return (
    <Modal title={t('settings.title')} onClose={() => setSettingsOpen(false)} width="max-w-3xl">
      <div className="space-y-5">
        <section className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
            {t('settings.language.section')}
          </h3>
          <Field label={t('language.label')} hint={t('language.hint')}>
            <LanguageSelect testId="settings-language" />
          </Field>
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
            {t('settings.ollama.section')}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('settings.ollama.baseUrl')} hint={t('settings.ollama.baseUrlHint')}>
              <input
                defaultValue={settings.ollamaBaseUrl}
                onBlur={(event) =>
                  void save(
                    { ollamaBaseUrl: event.target.value },
                    t('settings.ollama.baseUrlSaved'),
                  )
                }
                className="w-full rounded border border-steel bg-anvil px-2 py-1.5 font-mono text-xs text-slate-200"
              />
            </Field>
            <Field label={t('settings.ollama.defaultModel')}>
              <select
                value={settings.defaultModel}
                onChange={(event) =>
                  void save(
                    { defaultModel: event.target.value },
                    t('settings.ollama.defaultModelSaved'),
                  )
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
              {t('settings.ollama.rediscover')}
            </Button>
            <span className="text-[11px] text-slate-500">
              {ollama?.available
                ? t('settings.ollama.modelsCount', {
                    count: models.length,
                    tools: models.filter((model) => model.supportsTools).length,
                  })
                : t('settings.ollama.down')}
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
                    {t('settings.ollama.tokens', {
                      count: model.contextLength,
                    })}
                  </span>
                  {model.supportsTools ? (
                    <Chip tone="mint">{t('settings.ollama.tools')}</Chip>
                  ) : (
                    <Chip tone="alert">{t('settings.ollama.noTools')}</Chip>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
            {t('settings.agent.section')}
          </h3>
          <Field
            label={t('settings.agent.permissionMode')}
            hint={PERMISSION_DESCRIPTIONS[settings.permissionMode]}
          >
            <select
              value={settings.permissionMode}
              onChange={(event) =>
                void save(
                  { permissionMode: event.target.value as never },
                  t('settings.agent.permissionSaved'),
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
              label={t('settings.agent.contextBudget')}
              hint={t('settings.agent.contextBudgetHint')}
            >
              <input
                type="number"
                defaultValue={settings.contextBudgetChars}
                onBlur={(event) =>
                  void save(
                    { contextBudgetChars: Number(event.target.value) },
                    t('settings.agent.contextBudgetSaved'),
                  )
                }
                className="w-full rounded border border-steel bg-anvil px-2 py-1.5 text-xs text-slate-200"
              />
            </Field>
            <Field label={t('settings.agent.maxIterations')}>
              <input
                type="number"
                defaultValue={settings.maxIterations}
                onBlur={(event) =>
                  void save(
                    { maxIterations: Number(event.target.value) },
                    t('settings.agent.maxIterationsSaved'),
                  )
                }
                className="w-full rounded border border-steel bg-anvil px-2 py-1.5 text-xs text-slate-200"
              />
            </Field>
          </div>
          <AutoApproveSettings
            autoApprove={settings.autoApprove}
            onToggle={(category, enabled) =>
              void save(
                { autoApprove: { ...settings.autoApprove, [category]: enabled } },
                enabled
                  ? t('settings.agent.autoApproveOn', {
                      category: AUTO_APPROVE_LABELS[category],
                    })
                  : t('settings.agent.autoApproveOff', {
                      category: AUTO_APPROVE_LABELS[category],
                    }),
              )
            }
          />
          <Toggle
            checked={settings.verifyAfterRun}
            onChange={(value) =>
              void save(
                { verifyAfterRun: value },
                value ? t('settings.agent.verifyOn') : t('settings.agent.verifyOff'),
              )
            }
            label={t('settings.agent.verifyLabel')}
          />
          <Toggle
            checked={settings.browserAutomationEnabled}
            onChange={(value) =>
              void save({ browserAutomationEnabled: value }, t('settings.agent.browserSaved'))
            }
            label={t('settings.agent.browserLabel')}
          />
          <Toggle
            checked={settings.allowCloudServices}
            onChange={(value) =>
              void save({ allowCloudServices: value }, t('settings.agent.cloudSaved'))
            }
            label={t('settings.agent.cloudLabel')}
          />
          <p className="rounded border border-steel p-2 text-[11px] text-slate-500">
            {t('settings.agent.telemetry')}
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
            {t('connectors.title')}
          </h3>
          <ConnectorsSection />
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
            {t('settings.gives.section')}
          </h3>
          <Toggle
            checked={givesBack.enabled}
            onChange={(value) =>
              void patchGivesBack({
                enabled: value,
                ...(value ? { consentedAt: Date.now() } : {}),
              })
            }
            label={t('settings.gives.enable')}
          />
          <Field
            label={t('settings.gives.interval')}
            hint={t('settings.gives.intervalHint', { count: GIVES_BACK_INTERVAL_PROMPTS })}
          >
            <input
              type="number"
              min={1}
              max={200}
              defaultValue={givesBack.everyNPrompts}
              onBlur={(event) =>
                void patchGivesBack({
                  everyNPrompts: Math.min(200, Math.max(1, Number(event.target.value) || 1)),
                })
              }
              className="w-full rounded border border-steel bg-anvil px-2 py-1.5 text-xs text-slate-200"
            />
          </Field>

          <div className="space-y-1.5">
            <p className="text-[11px] text-slate-500">
              {t('settings.gives.rotation', {
                selected: selectedCauses.length,
                total: GIVES_BACK_CAUSES.length,
              })}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {GIVES_BACK_CAUSES.map((cause) => {
                const active = selectedCauses.some((entry) => entry.id === cause.id);
                return (
                  <button
                    key={cause.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleCause(cause.id)}
                    className={`cursor-pointer rounded border px-2 py-1 text-[10.5px] ${
                      active
                        ? 'border-mint/50 bg-mint/10 text-mint'
                        : 'border-steel text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {cause.name}
                  </button>
                );
              })}
            </div>
          </div>

          <p className="rounded border border-steel p-2 text-[11px] text-slate-500">
            {t('settings.gives.privacy')}
          </p>
          <p className="text-[11px] text-slate-600">
            {t('settings.gives.localLog', {
              count: contributionsSummary.count,
              amount: formatSek(contributionsSummary.totalSek),
            })}
          </p>
        </section>

        {status ? <p className="text-[11px] text-mint">{status}</p> : null}
      </div>
      <footer className="mt-4 flex justify-end">
        <Button variant="primary" onClick={() => setSettingsOpen(false)}>
          {t('settings.close')}
        </Button>
      </footer>
    </Modal>
  );
}
