import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MediaKind, ProviderCapability, ProviderView } from '@freevobe/protocol';
import { MEDIA_KINDS } from '@freevobe/protocol';
import { useAppStore } from '../store/appStore';
import { Button, Chip, Field, Toggle } from './ui';

/** Capabilityn som en mediesort kräver. Samma tabell som servern använder vid routing. */
const MEDIA_CAPABILITY: Record<MediaKind, ProviderCapability> = {
  image: 'image_gen',
  video: 'video_gen',
  audio: 'audio_gen',
};

const MEDIA_LABEL_KEY: Record<MediaKind, string> = {
  image: 'settings.providers.defaultImage',
  video: 'settings.providers.defaultVideo',
  audio: 'settings.providers.defaultAudio',
};

/**
 * Providers i Settings: varje modellkälla visas med sina capabilities, sin status och – för
 * molnproviders – ett fält för användarens egen API-nyckel. Nyckeln sparas krypterat lokalt och
 * visas bara som en maskerad ledtråd när den har sparats.
 */
export function ProvidersSection() {
  const { t } = useTranslation();
  const providers = useAppStore((state) => state.providers);
  const message = useAppStore((state) => state.providerMessage);
  const refreshProviders = useAppStore((state) => state.refreshProviders);
  const setProviderEnabled = useAppStore((state) => state.setProviderEnabled);
  const saveProviderKey = useAppStore((state) => state.saveProviderKey);
  const clearProviderKey = useAppStore((state) => state.clearProviderKey);
  const setProviderMediaPreference = useAppStore((state) => state.setProviderMediaPreference);

  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    void refreshProviders();
  }, [refreshProviders]);

  if (!providers) return null;

  const mediaCandidates = (kind: MediaKind) =>
    providers.providers.filter((provider) =>
      provider.definition.capabilities.includes(MEDIA_CAPABILITY[kind]),
    );

  return (
    <div className="space-y-3">
      <p className="rounded border border-steel p-2 text-[11px] text-slate-500">
        {providers.localOnly ? t('settings.providers.localOnly') : t('settings.providers.hint')}
      </p>

      <div className="grid grid-cols-2 gap-2">
        {providers.providers.map((provider) => {
          const { definition } = provider;
          const isCloud = definition.authType === 'api_key';
          return (
            <div
              key={definition.id}
              data-testid={`provider-card-${definition.id}`}
              className="space-y-2 rounded border border-steel bg-anvil/40 p-2.5"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-steel font-mono text-[10px] text-slate-300">
                  {definition.icon}
                </span>
                <span className="truncate text-xs font-semibold text-slate-200">
                  {t(`providers.name.${definition.id}`)}
                </span>
                <span className="ml-auto shrink-0">
                  {isCloud ? (
                    <Chip tone={provider.ready ? 'mint' : 'neutral'}>
                      {provider.ready
                        ? t('settings.providers.ready')
                        : t('settings.providers.needsKey')}
                    </Chip>
                  ) : (
                    <Chip tone="mint">{t('connectors.auth.local')}</Chip>
                  )}
                </span>
              </div>

              <div className="flex flex-wrap gap-1">
                {definition.capabilities.map((capability) => (
                  <Chip key={capability} tone="sky">
                    {t(`providers.capability.${capability}`)}
                  </Chip>
                ))}
              </div>

              <Toggle
                checked={provider.enabled}
                onChange={(value) => void setProviderEnabled(definition.id, value)}
                label={t('settings.providers.enable')}
              />

              {isCloud ? (
                <div className="space-y-1">
                  {provider.keyHint ? (
                    <div className="flex items-center gap-2">
                      <span className="truncate font-mono text-[11px] text-slate-400">
                        {provider.keyHint}
                      </span>
                      <Button
                        onClick={() => void clearProviderKey(definition.id)}
                        testId={`provider-clear-${definition.id}`}
                      >
                        {t('settings.providers.clearKey')}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="password"
                        value={draft[definition.id] ?? ''}
                        placeholder={t('settings.providers.keyPlaceholder')}
                        data-testid={`provider-key-${definition.id}`}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            [definition.id]: event.target.value,
                          }))
                        }
                        className="min-w-0 flex-1 rounded border border-steel bg-anvil px-2 py-1 font-mono text-[11px] text-slate-200"
                      />
                      <Button
                        testId={`provider-save-${definition.id}`}
                        onClick={() => {
                          const value = (draft[definition.id] ?? '').trim();
                          if (!value) return;
                          void saveProviderKey(definition.id, value);
                          setDraft((current) => ({ ...current, [definition.id]: '' }));
                        }}
                      >
                        {t('settings.providers.saveKey')}
                      </Button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] text-slate-500">{t('settings.providers.defaultHint')}</p>
        <div className="grid grid-cols-3 gap-2">
          {MEDIA_KINDS.map((kind) => (
            <Field key={kind} label={t(MEDIA_LABEL_KEY[kind])}>
              <select
                value={providers.preferences[kind]}
                data-testid={`provider-pref-${kind}`}
                onChange={(event) => void setProviderMediaPreference(kind, event.target.value)}
                className="w-full rounded border border-steel bg-anvil px-2 py-1.5 text-xs text-slate-200"
              >
                {mediaCandidates(kind).map((provider) => (
                  <option key={provider.definition.id} value={provider.definition.id}>
                    {t(`providers.name.${provider.definition.id}`)}
                  </option>
                ))}
              </select>
            </Field>
          ))}
        </div>
      </div>

      {message ? <p className="text-[11px] text-mint">{message}</p> : null}
    </div>
  );
}

export type { ProviderView };
